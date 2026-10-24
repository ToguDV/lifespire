# LifeSpire — Arquitectura y contratos

Este documento fija los límites entre módulos y los contratos de datos. Es la
referencia para implementar los issues sin que dos piezas se contradigan. Si una
decisión cambia, se actualiza aquí en el mismo cambio.

Fuentes: [`SPEC.md`](../SPEC.md) y [`design/DESIGN.md`](../design/DESIGN.md)
(sistema de diseño).

## 1. Estructura

Monorepo pnpm (`pnpm-workspace.yaml`): `apps/web` (Vite + React),
`apps/mobile` (Expo + React Native, Android), `apps/api` (NestJS sync API),
`packages/core` (dominio puro, fuente única), `packages/app-core` (store,
persistencia, sync y helpers puros compartidos) y `packages/api-client`
(cliente tipado). Detalle del backend en [`BACKEND.md`](./BACKEND.md), de la
app Android en [`MOBILE.md`](./MOBILE.md) y decisiones en [`adr/`](./adr/).

```text
apps/web/src/
  App.tsx          wrapper del shell (`export { default } from './ui/App'`)
  domain/          shims de una línea sobre @lifespire/core (la lógica pura —
                   sin React, store, Date.now/Math.random — vive en
                   packages/core; ver adr/0003-monorepo.md)
    types.ts       tipos y enums del dominio (GameDocument schemaVersion 3)
    balance.ts     constantes de recompensas, niveles, pesos, límites y claves de storage
    content.ts     validación de metas/rutinas y constraints de contenido
    dates.ts       fechas locales YYYY-MM-DD, sin drift UTC; dayKey con timeZone opcional
    goalIcons.ts   catálogo cerrado de iconos de meta y ciclo legado
    rng.ts         RNG determinista por string seed
    rewards.ts     tabla de recompensas, loot, duplicados, nivel
    generator.ts   generación y validación del mapa
    mapDepth.ts    profundidad del mapa según metas activas y weekly targets
    lifecycle.ts   abrir día, seleccionar, resolver, reconciliar días/run (en zona de la run)
    runClose.ts    cierre de run y bonus semanal
    merge.ts       auto-merge conservador 3-way (base = última copia
                   sincronizada; ver adr/0004-sync-auto-merge.md)
    schema.ts      validación, serialize/deserialize, migración (v1→v2→v3 run.timeZone)
    merge.ts       (shim) re-exporta tryAutoMerge del core
    selectors.ts   valores derivados (nivel, día actual, estado de nodo)
    fixtures/
      golden-map.json  fixture determinista para los tests del generador
  content/         shims de una línea sobre @lifespire/core (catálogos y
                   factories; la implementación vive en packages/core)
    loot.ts        catálogo de 12 objetos
    demo.ts        factory determinista de demo (2 goals, 5 routines)
    onboarding.ts  pasos del asistente y sugerencia de weekly targets
  state/
    store.ts       Zustand + persist, acciones de aplicación
    persistence.ts adaptador de storage, backup, multi-pestaña y avisos
    clock.ts       reloj inyectable + offset de desarrollo (no persistido) + zona del dispositivo
  sync/            motor de sync + estado + base por cuenta para auto-merge
                   (ver BACKEND.md §3 y adr/0004-sync-auto-merge.md)
  ui/
    App.tsx        shell, navegación y guardas de flujo
    components/    Button, Panel, Progress, Stat, Dialog, Icon, etc.
    dev/
      DevPanel.tsx panel de desarrollo; solo se importa con `import.meta.env.DEV`
    lib/           lógica de UI: mapLayout, wheel, importSave, feedback,
                   collection, newRun, daySummary, etc.
    screens/       una pantalla por vista
  styles/
    tokens.css     tokens canónicos (color, tipografía, espacio, radio)
    app.css        shell y componentes
    ui.css         estados añadidos (diálogos, vacíos, toast)
    m3.css         onboarding guiado y edición de metas/rutinas
    juice.css      microinteracciones y feedback visual
    dev.css        estilos del panel de desarrollo; solo se carga en DEV
  main.tsx
apps/api/src/      auth, users, admin, devices, sync, health, audit, prisma, cli
apps/mobile/src/        shell nativo, tokens, componentes, pantallas, mapa SVG,
  notificaciones locales y adaptadores de plataforma (ver MOBILE.md)
packages/core/src/      dominio puro, fuente única (tests de dominio/contenido)
packages/app-core/src/  store Zustand, persistencia, reloj, sync engine/manager,
  authStore factory y helpers puros de UI compartidos por web y Android
packages/api-client/src/ cliente fetch tipado (cookie web / token nativo)
```

Los tests viven junto al módulo (`*.test.ts` en web/core, `*.test.ts(x)` con
Jest en Android). No se añaden librerías de UI, router ni kit visual; los
iconos se resuelven con `lucide-react`/`lucide-react-native` a través de sus
adaptadores. El mapa se dibuja con SVG propio en ambas plataformas. Las fuentes
web se sirven desde `public/fonts/` y las de Android desde Expo fonts.

## 2. Navegación sin router

`view` es estado transitorio del store (no se persiste):

```ts
export type View =
  | { name: 'onboarding' }
  | { name: 'home' }
  | { name: 'map' }
  | { name: 'node'; nodeId: string }
  | { name: 'reward'; nodeId: string }
  | { name: 'day-summary'; dayId: string }
  | { name: 'run-summary' }
  | { name: 'goals' }
  | { name: 'profile' }
  | { name: 'settings' }
  | { name: 'recovery'; reason: 'corrupt' | 'future-version' | 'import-error' }
```

La app Android reutiliza este mismo `view`/`history` (sin router nativo); el
botón atrás de Android llama a `back()` y la pantalla de recap de la rueda
bloquea el retroceso. `navigate(view)` apila la vista anterior; `back()` desapila. La vista inicial se
deriva al hidratar: sin perfil → `onboarding`; run cerrado → `run-summary`; si el
día actual está abierto y su mapa tiene `currentNodeId` → `node` para ese nodo;
si no → `home`. La vista sigue siendo transitoria: el detalle se reconstruye
desde el documento persistido, nunca se guarda `view` en `localStorage`.

## 3. Documento persistido

### Claves y formato

- `lifespire:mvp0` (`STORAGE_KEY`): el `GameDocument` versionado. El slice que
  gestiona Zustand es `{ document }`, pero el adaptador escribe el documento
  directo, sin el envoltorio de `persist`. En Android el mismo contrato se
  implementa sobre `expo-sqlite/kv-store` síncrono; las claves son idénticas.
- `lifespire:mvp0:backup` (`STORAGE_BACKUP_KEY`): copia raw del save anterior,
  best-effort, antes de un import o de un reset destructivo. No se actualiza en
  cada escritura.
- `lifespire:feedback-prefs`: preferencias de sonido y háptica (`sound`,
  `haptics`; ambas activas por defecto). Son UI pura: viven fuera del documento
  y no pasan por migraciones.
- `sessionStorage` `lifespire:sealed:<dayId>` y
  `lifespire:sealed:week:<runId>`: recuerdan que los efectos de sello de ese
  día/semana ya se reprodujeron en esta pestaña, para no repetirlos al revisitar
  el resumen.

En la clave del save se persiste únicamente el slice `{ document }`; `view`,
diálogos, mensajes, `rewardToast` y el offset del reloj de desarrollo quedan
fuera. El documento se
guarda **compacto** en `localStorage` (`JSON.stringify`, sin espacios), mientras
que `serializeDocument` produce el JSON legible de dos espacios que se descarga
desde Settings. El export de Recovery usa el raw literal (`exportRawSave`),
incluso si el save está bloqueado o es ilegible.

```ts
export const SCHEMA_VERSION = 3
export const STORAGE_KEY = 'lifespire:mvp0'
export const STORAGE_BACKUP_KEY = 'lifespire:mvp0:backup'

export interface GameDocument {
  schemaVersion: 3
  profile: Profile | null
  goals: Goal[]
  tasks: Task[]
  run: Run | null
  onboardingDraft: OnboardingDraft | null
  settings: { theme: ThemePreference }
}
```

`ThemePreference = 'light' | 'dark' | 'system'`. El tema sigue el diseño
(light/night) y es la única preferencia persistida. El resto del estado de UI no
se guarda.

### Tipos

```ts
export type Effort = 'light' | 'medium' | 'high'
export type NodeType = 'task' | 'elite' | 'rest' | 'treasure' | 'boss' | 'wheel'
export type WheelOutcome = 'task' | 'gold' | 'xp' | 'rest'
export type Rarity = 'common' | 'rare' | 'epic'
export type DayStatus = 'locked' | 'available' | 'in_progress' | 'completed' | 'missed'
export type RunStatus = 'active' | 'closed'
export type ResolutionAction = 'complete' | 'skip'
export type NodeStatus = 'locked' | 'available' | 'current' | 'completed' | 'skipped'

export interface Profile {
  id: string
  name: string
  xp: number
  level: number            // derivado de xp; se recalcula en cada cambio de XP
  gold: number
  loot: LootItem[]         // única copia por catalogId
  createdAt: string
}

export interface LootItem {
  id: string               // instancia; estable
  catalogId: string
  name: string
  rarity: Rarity
  description: string
  obtainedAt: string
}

export interface Goal {
  id: string
  title: string
  category: string
  icon: GoalIconId         // catálogo cerrado en domain/goalIcons.ts
  weeklyObjective: number  // 1..7
  active: boolean
  createdAt: string
}

export interface Task {
  id: string
  goalId: string
  title: string
  effort: Effort
  active: boolean
  createdAt: string
}

export interface TaskSnapshot {
  taskId: string
  title: string
  goalId: string
  goalTitle: string
  effort: Effort
}

export interface NodeRewards {
  xp: number
  gold: number
  lootRolls: number
  progress: 0 | 1
}

export interface MapNode {
  id: string               // `n{layer}_{i}`
  layer: number            // 0..N-1 decisiones; N = boss
  type: NodeType
  task: TaskSnapshot | null
  rewards: NodeRewards     // total al completar (incluye bonus de cierre del boss)
  connections: string[]    // ids de la capa siguiente; boss = []
}

export interface GameMap {
  id: string
  seed: string
  dayIndex: number
  generatorVersion: number
  layers: MapNode[][]      // 3..15 capas de 3..5 nodos (2..5 en saves legacy < v4)
  boss: MapNode
  currentNodeId: string | null
  createdAt: string
}

export interface ResolvedNode {
  nodeId: string
  action: ResolutionAction
  at: string
}

export interface RewardEvent {
  id: string
  dayIndex: number
  nodeId: string
  nodeType: NodeType
  action: ResolutionAction
  taskId: string | null
  taskTitle: string | null
  goalId: string | null
  goalTitle: string | null
  xp: number
  gold: number
  progress: number
  lootItem: LootItem | null
  duplicateCatalogId: string | null
  duplicateGold: number
  closingBonus: boolean
  wheelOutcome?: WheelOutcome | null
  at: string
}

export interface DaySummary {
  xp: number
  gold: number
  loot: LootItem[]
  duplicateGold: number
  bossCompleted: boolean
  closingBonusXp: number
  closingBonusGold: number
  completed: number
  skipped: number
  objectives: Array<{ goalId: string; title: string; before: number; after: number; target: number }>
}

export interface Day {
  id: string
  index: number            // 0..6
  date: string             // YYYY-MM-DD local
  status: DayStatus
  map: GameMap | null
  path: ResolvedNode[]
  rewards: RewardEvent[]
  openedAt: string | null
  closedAt: string | null
  summary: DaySummary | null
}

export interface RunObjective {
  goalId: string
  goalTitle: string
  target: number
  progress: number
}

export interface RunTotals {
  xp: number
  gold: number
  lootCount: number
  nodesCompleted: number
  nodesSkipped: number
  daysPlayed: number
  daysMissed: number
}

export interface RunSummary {
  closedAt: string
  objectives: Array<{
    goalId: string
    title: string
    target: number
    progress: number
    met: boolean
    bonusXp: number
    bonusGold: number
    loot: LootItem[]
  }>
  allComplete: boolean
  bonusXp: number
  bonusGold: number
  loot: LootItem[]
  duplicateGold: number
  guaranteedRare: LootItem | null
  totals: RunTotals
}

export interface Run {
  id: string
  seed: string
  generatorVersion: number
  startDate: string        // YYYY-MM-DD
  timeZone: string | null  // IANA de la run; null = legacy device-local
  status: RunStatus
  objectives: RunObjective[]
  days: Day[]              // siempre 7
  totals: RunTotals
  createdAt: string
  closedAt: string | null
  summary: RunSummary | null
}

export interface OnboardingDraft {
  step: number
  mode: 'demo' | 'custom' | null
  name: string
  goals: Goal[]
  tasks: Task[]
}
```

`onboardingDraft` es un borrador persistido: el esquema valida su forma, pero
acepta objetivos semanales intermedios fuera de 1..7 para que un reload no
convierta el borrador en «corrupto». Exige que `step` sea un entero entre 0 y 4,
el rango que la UI sabe renderizar. La validación de negocio se aplica al
confirmar (`beginJourney`). Los objetivos del borrador también guardan `icon`.

`GoalIconId` es un catálogo cerrado de ids (`banner`, `flame`, `quill`, `gem`,
`compass`, `star`, `sun`, `moon`, `key`, `cup`, `pine`, `lantern`, `feather`,
`ring`, `scroll`, `crown`, `map`, `tent`, `book`, `heart`, `leaf`, `brush`,
`dumbbell`, `home`, `wallet`, `briefcase`, `users`, `utensils`). El dominio
posee la lista para validar sin importar React;
la UI añade las etiquetas y el mapa a componentes de `lucide-react`
(`iconMap.ts`); `spire` se conserva como marca propia. Los mapas resuelven el
crest por `goalId` en render, de modo que un cambio de icono también actualiza
un mapa ya dibujado sin alterar pasos ni recompensas.

`SCHEMA_VERSION` es 3. `MIGRATIONS[1]` rellena `goals[].icon` y
`onboardingDraft.goals[].icon` con el ciclo legado `banner → flame → quill →
gem` según el índice, conservando el aspecto de los saves anteriores.
`MIGRATIONS[2]` fija `run.timeZone = null` en saves v2: conservan la
interpretación device-local que tenían al crearse. Las runs nuevas guardan la
zona IANA del dispositivo y todos los límites de día se calculan en ella.

`RunObjective.progress` se incrementa solo al completar nodos task/elite/boss cuyo
`goalId` coincida. Elite da `+1`, no `+2`.

## 4. Reglas de dominio fijadas

### Recompensas (`balance.ts` + `rewards.ts`)

```ts
EFFORT_MULTIPLIER = { light: 1, medium: 1.5, high: 2 }
REWARDS = {
  task:     { xp: 10, gold: 10, lootRolls: 0, progress: 1 },
  elite:    { xp: 20, gold: 20, lootRolls: 1, progress: 1 },
  rest:     { xp: 5,  gold: 0,  lootRolls: 0, progress: 0 },
  treasure: { xp: 0,  gold: 15, lootRolls: 1, progress: 0 },
  boss:     { xp: 20, gold: 20, lootRolls: 1, progress: 1 },
  wheel:    { xp: 0,  gold: 0,  lootRolls: 0, progress: 0 },
}
BOSS_CLOSING_BONUS = { xp: 20, gold: 20 }
```

- Task/elite/boss multiplican `xp` y `gold` por el multiplicador del snapshot.
  Ejemplos: task medium = 15/15; elite high = 40/40; boss high = 40/40 + 20/20 de
  cierre = 60/60.
- Rest y treasure no multiplican.
- El bonus de cierre del boss **solo** se concede al completarlo; se muestra
  separado en el resumen. Saltarse el boss concede 0 y cierra el día sin bonus.
- Los totales del nodo se guardan en `MapNode.rewards` al generar el mapa.
- Duplicados: `DUPLICATE_GOLD = { common: 10, rare: 25, epic: 60 }`.
- Nivel: `levelForXp(xp) = floor(xp / 100) + 1`; `profile.level` se recalcula en
  cada cambio de XP.
- Loot: 12 objetos, rarezas common/rare/epic, pesos `60/30/10`. Sin efectos.
  La primera unidad de un `catalogId` entra en `profile.loot`; las siguientes se
  convierten en oro y se registran en `RewardEvent`.
- Tirada: semilla estable `${runId}:day:${dayIndex}:node:${nodeId}:loot:${roll}`
  (la resolución nunca vuelve a tirar). El id de instancia es
  `${runId}:${dayIndex}:${nodeId}:${catalogId}`.
- `RewardEvent.gold` es el oro total acreditado por la resolución: incluye la
  recompensa del nodo y la conversión de duplicados. `duplicateGold` es el
  subconjunto que provino de una conversión y `duplicateCatalogId` identifica el
  objeto repetido. En un duplicado, `lootItem` es `null`.
- `DaySummary.xp/gold` se calculan sumando exactamente los `RewardEvent` del día;
  `DaySummary.duplicateGold` suma sus conversiones. `closingBonusXp/Gold` muestran
  los 20/20 del boss por separado (0 si se saltó), aunque ya estén incluidos en
  el total del evento.
- Wheel (`lifecycle.ts:rollWheelOutcome` + `WHEEL_SECTORS` en `balance.ts`):
  semilla estable `${runId}:day:${dayIndex}:node:${nodeId}:wheel`; la preview de
  la UI y `applyCompletion` usan los mismos inputs, sin doble tirada. Pesos
  `WHEEL_OUTCOME_WEIGHTS = { task: 50, gold: 20, xp: 20, rest: 10 }` y sectores
  visuales proporcionales 5/2/2/1 (`task` 0–4, `gold` 5–6, `xp` 7–8, `rest` 9).
  Payouts: `task` = recompensa de task según effort +1 progreso (pendientes pesan
  `WHEEL_PENDING_WEIGHT = 4`); `gold` = `WHEEL_GOLD = 20`; `xp` = `WHEEL_XP = 25`;
  `rest` = `WHEEL_REST_XP = 5`. Pool vacío → `rest` (segmento 9). El evento
  guarda `wheelOutcome` y el snapshot sorteado (`taskId/title/goal`), sin loot.

### Mapa (`generator.ts`)

```ts
generateMap(input: {
  runId: string
  runSeed: string
  dayIndex: number
  generatorVersion: number
  goals: Goal[]
  tasks: Task[]          // solo activas y con goal activo
  objectives: RunObjective[]
  now: string            // ISO, solo para createdAt
}): GameMap
```

- Semilla: `${runSeed}:day:${dayIndex}:g${generatorVersion}`. `GENERATOR_VERSION = 5` (añade el nodo wheel); los mapas ya persistidos conservan su `generatorVersion` y no se regeneran.
- 3–15 capas de decisión con 3–5 nodos + boss. La profundidad depende de las metas con al menos una rutina activa y de la suma de sus weekly targets: `resolveDecisionLayerCount = clamp(3, 15, goals + offset + floor(weeklyTargetSum / 7))`, con `offset = clamp(2, 5, 2 + floor(max(0, goals − 2) / 2))` y `MAX_DECISION_LAYERS = 15`. La tabla base es 1→3, 2→4, 3→5, 4→7, 5→8, 6→10, 7→11, 8→13, 9→14, 10→15; cada siete weekly targets suma una capa. Las rutinas no cambian la profundidad por sí solas, solo el ancho (`maxLayerSize = max(3, min(5, pool + 1))`). Capa 0 disponible desde el start.
- Ancho de capa: la primera capa se sortea entre 3 y `max(3, min(5, pool + 1))` y
  cada capa siguiente deriva ±1 nodo de la anterior. Derivar poco mantiene la
  regla de vecinos (siempre hay cobertura) y evita capas que se abren o se
  cierran de golpe. El techo `pool + 1` reserva un hueco para el rest/treasure,
  de modo que los nodos con tarea nunca repiten rutina dentro de la misma capa.
- Una frontera aleatoria es un *switchback*: ninguna arista de esa frontera
  conserva el índice de carril, así que toda ruta start→boss cruza al menos una
  vez. Si todas las capas quedaran pares, una capa del medio pasa a 5 (o a 3)
  para garantizar que el carril central exacto aparezca en el mapa.
- Cada capa: al menos 1 task, como máximo 1 especial (rest, treasure **o**
  wheel), y 1–2 elites en todo el mapa. Una capa más ancha que el pool
  **obliga** a llevar un especial.
- Wheel en el mapa: al menos 1 por mapa, `wheelCount = max(1, min(3,
  ceil(layers / 5)))`; ocupa slots especiales (nunca desplaza task/elite) y se
  valida como especial único por capa (`validateMap`). `task: null`,
  `rewards` en ceros; el payout real se sortea en `resolveNode`.
- Task/elite/boss requieren `TaskSnapshot`. Rest/treasure/wheel tienen `task: null`.
- Sin tareas repetidas dentro de una capa. Entre capas se evita repetir mientras
  el pool lo permita; con pools pequeños se permite repetir entre capas.
- Conexiones: cada nodo de una capa de decisión conecta a 1–2 nodos de la capa
  siguiente; cada nodo de la última capa conecta al boss. Todo nodo de la capa
  siguiente tiene al menos una entrada; ningún nodo queda huérfano. El boss no
  tiene salida. El boss es dinámico: `n{layers.length}_0`, con
  `layer === layers.length`.
- Conexiones de vecindario: un nodo solo alcanza su propio carril y los dos
  carriles contiguos (`|i − j| ≤ 1` por índice de capa). Ningún camino salta de
  un extremo al otro: el mapa se lee como carriles verticales con bifurcaciones
  locales. El primer pase ancla cada nodo a su carril, el segundo cubre la
  capa siguiente y el tercero ofrece una segunda rama (45 %) entre vecinos.
- Geometría (`ui/lib/mapLayout.ts`): viewBox de 560 × H, con
  `H = 130 · layers + 180`; 3 capas → 570 px, 4 → 700 px (referencia clásica),
  5 → 830 px y el máximo de 15 capas → 2.130 px. Las capas se reparten de abajo
  a arriba con paso fijo de 130 px: `y = H − 40 − 90 − 130·k`; el camp queda en
  `H − 40` y el boss siempre en 90. El canvas crece en alto y
  `.map-canvas-wrap` hace scroll vertical cuando no cabe (a partir de cinco
  capas en viewports normales; a cuatro capas no hay scroll). Los carriles
  horizontales según el ancho de la capa son
  2 → 0.22/0.78, 3 → 0.26/0.5/0.74, 4 → 0.16/0.38/0.62/0.84 y
  5 → 0.12/0.31/0.5/0.69/0.88. Las capas de 5 nodos usan un medallón más
  pequeño (`node--wide`) para que los carriles no se toquen a 360 px. A cuatro
  capas la geometría coincide con el diseño anterior (700 px), salvo que los
  pinos decorativos se retiraron: quedan los contornos, que se ciclan cada
  cuatro capas, y un pequeño trazo decorativo anclado al campamento.
- Boss: se prefiere una tarea de un goal con progreso pendiente y esfuerzo alto;
  desempate determinista por seed.
- Si el pool tiene <4 tareas activas, el generador debe seguir produciendo un mapa
  válido repitiendo tareas entre capas (nunca dentro de la misma capa). La
  validación de onboarding exige ≥4 routines, pero el generador es defensivo.
  Con una sola rutina activa las capas se fuerzan a 2 nodos; si una capa lleva
  elite (para cumplir 1–2 elites por mapa) esa única rutina se repite dentro de
  la capa. Es la única excepción posible: con una sola rutina no se puede tener
  a la vez un nodo task, un elite y tareas distintas en la misma capa.
- El mapa se genera **una vez** al abrir el día y se guarda. `selectNode` y
  `resolveNode` nunca regeneran.

### Días y run (`dates.ts` + `lifecycle.ts`)

- Fechas locales `YYYY-MM-DD`; nunca `toISOString()` para el día. Utilidades:
  `dayKey(date)`, `addDays(key, n)`, `compareDayKeys(a, b)`, `daysBetween(a, b)`.
- `startRun` crea 7 días consecutivos desde la fecha local actual. Día 0
  `available`, resto `locked`.
- `openDay(document, dayId, now)`: si `day.map` existe, no hace nada. Si no,
  genera el mapa, lo guarda, `status = 'in_progress'`, `openedAt = now`.
- `reconcile(document, now)`: marca como `missed` los días pasados sin cerrar
  (incluidos los `in_progress` con mapa parcial) y les asigna `closedAt`; deja
  `available` el día de hoy sin mapa, `in_progress` si tiene mapa, y `locked` los
  futuros. Recalcula `run.totals` y cierra la run si todos los días están
  completed/missed o el día 7 ya pasó. Es idempotente, no toca días ya cerrados
  y se ejecuta al hidratar y tras cada acción. El `reconcile` del store llama
  después a `finalizeIfNeeded`, de modo que una run cerrada sin `summary`
  recibe el bonus semanal automáticamente (al abrir la app tras el día 7 o al
  avanzar el reloj) sin duplicarlo.
- Solo el día actual (índice = primer día no cerrado) es jugable. No hay
  recuperación de días missed. Un día missed conserva su mapa/path parcial y
  `summary: null`: el resumen solo existe cuando se resuelve el boss.
- `selectNode`: solo nodos disponibles (capa 0 si no hay actual; si hay
  `currentNodeId`, solo ese nodo puede resolverse; las conexiones se eligen
  después de resolver). Persiste `currentNodeId`; recargar conserva la selección.
- `resolveNode(document, { dayId, nodeId, action, now, runId? })`:
  - exige run activo, día actual, día `in_progress` con mapa y que el nodo sea el
    actual o esté disponible por conexión;
  - `complete` concede recompensas, +1 de progreso si aplica y loot; en `wheel`
    sortea el outcome con `rollWheelOutcome` (misma semilla que la preview) y
    acredita `task` (XP/oro de task +1), `gold` (+20), `xp` (+25) o `rest` (+5).
    El claim es en dos pasos: el giro termina con avance forzado al recap
    tras un beat; sin re-spin. Solo Done resuelve y el recap no ofrece regreso;
  - `skip` concede 0 XP/oro/loot/progreso pero también registra evento y avanza
    (también en `wheel`: el skip está siempre disponible, el claim solo tras girar);
  - añade a `path`, registra un `RewardEvent` con id estable (los skip con ceros
    y `action: 'skip'`), limpia `currentNodeId` y recalcula `run.totals` desde
    los eventos persistidos;
  - si es boss, cierra el día (`completed`, `closedAt`) y construye `summary` con
    totales, loot, conversiones, bonus separado y objetivos before/after
    (`before = after − progreso ganado ese día`);
  - el día 7 (o el último día abierto) deja la run `closed` con `summary: null`;
    la acción `resolveNode` del store aplica `finalizeIfNeeded` inmediatamente
    después, de modo que el resumen semanal y el bonus quedan persistidos en la
    misma transición visible;
  - un segundo intento sobre el mismo nodo es un error explícito, nunca duplica
    recompensas; un reload entre resoluciones no cambia el resultado.
- El progreso semanal vive en `run.objectives` y se actualiza al completar.
  Completar un objetivo concede el bonus semanal al cerrar la run, no al
  completar el nodo.

### Cierre de run (`runClose.ts`)

- `finalizeRun(document, now)` (alias `closeRun`) solo actúa sobre una run
  `closed` con `summary === null`. Sin run, con perfil ausente, con run activa o
  con `summary` ya escrito devuelve el mismo documento: no inventa un cierre.
  `finalizeIfNeeded` es el punto de entrada para reconcile/resolve.
- Objetivo cumplido si `progress >= target`.
- Cada objetivo cumplido: `OBJECTIVE_BONUS` = +50 XP, +50 oro y 1 tirada de loot
  determinista con semilla
  `${runId}:day:7:node:weekly:objective:${goalId}:loot:${roll}`. El 7 es el slot
  reservado al cierre semanal; el id de instancia sigue siendo
  `${runId}:7:weekly:objective:${goalId}:${catalogId}`.
- Todos cumplidos (y hay ≥1 objetivo): `ALL_OBJECTIVES_BONUS` = +100 XP, +100
  oro y 1 objeto raro garantizado, elegido de forma determinista dentro del
  catálogo raro con semilla `${runId}:weekly:all:rare:0`.
- El orden es: objetivos en el orden de `run.objectives` y, si aplica, el raro
  garantizado al final. Si el raro coincide con una tirada previa (o con el
  perfil), también se convierte en oro.
- Si no hay objetivos o no hay días jugados, el resumen sigue siendo válido
  (`allComplete: false`, bonus 0 y totales de días correctos).
- Las tiradas usan el catálogo y `acquireLoot`; la primera unidad entra en
  `profile.loot` y las siguientes se convierten en oro. `summary.objectives[i]`
  guarda solo el loot nuevo de ese objetivo y su bonus base (50/50).
  `summary.duplicateGold` suma todas las conversiones semanales;
  `summary.bonusGold` incluye el oro base más esas conversiones.
  `summary.loot` es el loot nuevo adquirido (objetivos + raro garantizado).
  `summary.guaranteedRare` es `null` cuando el raro se convirtió en oro, ya
  fuera porque el perfil lo tenía o porque una tirada de objetivo lo obtuvo
  antes.
- `profile.level` se recalcula con `levelForXp` al aplicar el XP semanal.
- El bonus se suma a `run.totals` (`xp`, `gold`, `lootCount`) y `summary.totals`
  es exactamente ese mismo objeto. El bonus **no** se registra como
  `RewardEvent`: `computeRunTotals` sigue devolviendo los totales de nodos, y
  una run cerrada conserva sus totales congelados (reconcile no los recalcula
  porque sale antes con `status === 'closed'`). Así el resumen coincide con los
  totales persistidos y el delta del perfil.
- `run.status = 'closed'`, `closedAt` y `summary` se escriben una sola vez.
  Llamar dos veces devuelve la misma run y no vuelve a conceder XP, oro ni loot.

### Nueva run (`runClose.ts`)

- `startNewRun(document, { runId, now })` exige perfil, una run previa
  `closed` **con `summary` ya escrito** y un setup válido (1–10 objetivos activos,
  ≥4 rutinas activas, al menos una rutina activa por objetivo activo y objetivos
  semanales válidos) usando `validateSetup`. Un fallo lanza `DomainError` antes
  de construir nada: el documento no se modifica. El store reconcilia/finaliza
  primero, por lo que una run cerrada sin resumen recibe su bonus antes de ser
  reemplazada.
- Conserva exactamente `profile` (id, nombre, XP, nivel, oro, colección y
  `createdAt`), `goals`, `tasks` y `settings`.
- Sustituye `run` por una run nueva creada con `createRun`: id y semilla nuevos
  (la semilla deriva del `runId` inyectado), 7 días desde la fecha local de
  `now`, día 0 `available` y el resto `locked`. No quedan días, mapas, paths,
  reward events, objetivos ni resumen de la run anterior.
- Limpia `onboardingDraft`. Devuelve un único documento, por lo que la
  transición es atómica: un reload solo puede ver la run vieja completa o la
  nueva completa.

### Persistencia y recuperación (`schema.ts` + `state/persistence.ts` + `state/store.ts`)

- `serializeDocument(doc): string` y `parseDocument(unknown): Result<GameDocument>`.
  Validación estructural explícita, sin dependencias nuevas.
- Rechazar JSON inválido, campos requeridos ausentes, `schemaVersion` futura y
  enums desconocidos. No modificar el documento actual ante un import inválido.
- Un mapa persistido no basta con tener la forma correcta: `parseDocument` pasa
  cada `day.map` por `validateMap` (generador), exige `day.index ===
  map.dayIndex`, que `day.id` sea `${run.id}:day:${day.index}`, que
  `map.currentNodeId` exista (o sea `null`) y no apunte a un nodo ya resuelto en
  `day.path`, y que `day.path`/`day.rewards` referencien nodos de ese mapa sin
  repetir `nodeId`. `validateMap` acepta 3–15 capas y exige que el
  boss sea `n{layers.length}_0` con `layer === layers.length`. Para mapas
  `generatorVersion >= 4` exige 3–5 nodos por capa y que ningún carril tenga
  aristas rectas en todas las fronteras; para mapas anteriores acepta 2–5 nodos
  y no aplica la regla de cruce, de modo que las partidas viejas siguen
  cargando. Así un backup estructuralmente válido pero injugable se rechaza
  antes de reemplazar el estado.
- Si `localStorage` está corrupto o tiene una versión futura, el store hidrata un
  documento vacío **sin sobrescribir** la clave y expone `storageIssue` para
  mostrar `recovery`. Solo `resetAll` o un import válido desbloquean la escritura.
- Si una escritura falla (cuota, modo privado), el documento en memoria sigue
  usable y el controller notifica al store, que expone `storageWarning:
  'write-failed'`. El shell muestra un aviso persistente y no bloqueante con
  acceso a Settings/export. La siguiente escritura correcta limpia el aviso. Si
  no existe `localStorage` y el adapter cae a memoria, también se avisa porque un
  reload perdería los cambios.
- `serializeDocument(doc)` produce el mismo `GameDocument` versionado, legible
  (2 espacios) y sin claves transitorias; es lo que descarga Settings.
- `importDocument(nextDocument): boolean` revalida con `parseDocument` y
  **rechaza sin tocar el documento ni el storage** si:
  - el documento o la estructura es inválida, faltan campos, hay enums
    desconocidos o `schemaVersion` es futura;
  - hay una run sin perfil;
  - una run activa incumple `validateContentConstraints` (≥1 meta activa,
    ≥4 rutinas activas, cada rutina activa bajo una meta activa y ≤10 metas
    activas);
  - `map.currentNodeId` no existe en su mapa o ya está resuelto en `day.path`;
  - `day.path` o `day.rewards` repiten `nodeId` o referencian nodos de otro
    mapa/día;
  - `onboardingDraft.step` queda fuera de 0..4.
- El preview y la confirmación viven en `SaveImport`, que valida el texto con
  `readSaveFile`; el archivo se limita a 2 MB y el store solo recibe el
  `GameDocument` ya parseado. Un import válido copia el save actual a
  `STORAGE_BACKUP_KEY` (`storage.backup()`), desbloquea escrituras, reemplaza el
  documento, reconcilia y deriva la vista, igual que al hidratar, para que una
  run vencida abra su resumen semanal.
- `resetAll` (solo tras confirmar la frase `RESET` en Settings o Recovery) copia
  el raw actual al backup, borra `lifespire:mvp0` y vuelve a onboarding.
- `exportRawSave()` (usado por Recovery) devuelve el raw literal de
  `lifespire:mvp0`; Recovery lo descarga como
  `lifespire-recovery-<fecha-local>.json`. Funciona aunque el save esté bloqueado
  o no se pueda parsear; si no hay save, avisa de que no hay nada que descargar.

### Persistencia Android

- `apps/mobile/src/platform/storage.ts` implementa `StorageLike` sobre
  `expo-sqlite/kv-store` con `getItemSync`/`setItemSync`/`removeItemSync`. La
  hidratación de Zustand es síncrona, como en web, así que la app no muestra un
  save vacío mientras lee.
- El controlador es el mismo (`createDocumentStorage`); el aviso
  `storageWarning`, el backup, las guardas de versión futura y las claves por
  cuenta se comparten. La sincronización multi-pestaña no aplica (instancia
  única); `AppState` y NetInfo sustituyen a los eventos de ventana/red.
- El refresh token no se guarda aquí: vive en `expo-secure-store`. El save
  exportado es el mismo JSON legible y el import usa las mismas validaciones.

### Multi-pestaña

- El adaptador recuerda el último raw que leyó o escribió (`lastWrittenRaw`).
  Antes de escribir compara el valor actual de `lifespire:mvp0`: si otra pestaña
  lo cambió y el contenido no coincide con el que se va a escribir, rechaza la
  escritura y avisa al store (`conflictListener`).
- `window.addEventListener('storage')` avisa cuando otra pestaña escribe la clave
  del save. El store agrupa los eventos en un microtask y llama a
  `syncFromStorage()`.
- `syncFromStorage()` relee el documento remoto, lo reconcilia y deriva la vista.
  Si el remoto fue un reset (clave ausente), vuelve a onboarding.
- Política: **gana el remoto**. El cambio local en vuelo se descarta y se avisa
  con un toast; no hay merge ni resolución de conflictos por campo. Si el remoto
  no se puede leer, se conserva el documento actual y también se avisa.

## 5. Store (Zustand)

El store vive en `packages/app-core/src/state/store.ts`; web y Android crean su
singleton inyectando el controlador de storage (`documentStorage` en web,
SQLite KV en Android). `createAppStore(deps)` acepta storage, reloj, factoría
de ids y zona horaria, y sigue siendo la única fuente de acciones.

Estado:

```ts
interface AppState {
  document: GameDocument
  hydrated: boolean
  storageIssue: { reason: 'corrupt' | 'future-version' } | null
  storageWarning: 'write-failed' | null
  view: View
  history: View[]
  toast: string | null
  rewardToast: RewardEvent | null
  // acciones de navegación
  navigate(view: View): void
  back(): void
  // acciones de dominio (llaman a reconcile y persisten)
  reconcile(now?: Date): void
  completeOnboarding(setup: OnboardingSetup, now?: Date): void
  beginJourney(setup: OnboardingSetup, now?: Date): boolean
  updateOnboardingDraft(patch: Partial<OnboardingDraft>): void
  startRun(setup?: RunSetup, now?: Date): void
  openDay(dayId?: string, now?: Date): void
  selectNode(nodeId: string): void
  resolveNode(nodeId: string, action: ResolutionAction, now?: Date): void
  finalizeRun(now?: Date): void
  startNewRun(now?: Date, goals?: Goal[]): boolean
  saveGoal(input: GoalInput, now?: Date): ContentActionResult
  archiveGoal(goalId: string, now?: Date): ContentActionResult
  saveTask(input: TaskInput, now?: Date): ContentActionResult
  archiveTask(taskId: string, now?: Date): ContentActionResult
  setTheme(theme: ThemePreference): void
  importDocument(doc: GameDocument): boolean
  syncFromStorage(): void
  exportRawSave(): string | null
  resetAll(): void
}
```

Las acciones de desarrollo (`devStartDemoRun`, `devRestartRun`,
`devAdvanceDay`, `devResetAll`) viven en el mismo store y solo las usa
`ui/dev/DevPanel.tsx`.

Reglas de las acciones: leer `document`, aplicar funciones puras, recalcular
nivel/totales, escribir una sola vez. Los ids se generan con
`newId(prefix)` (`crypto.randomUUID` con fallback). El offset de desarrollo vive
en `state/clock.ts`, no en `document`. `reconcile` y `resolveNode` aplican
`finalizeIfNeeded` después de la transición de días, y `startNewRun` reconcilia
primero (para sellar y pagar una run vencida), valida la run previa cerrada y
deja `view: home` sin navegar desde el dominio. `devRestartRun` sigue siendo una
herramienta de desarrollo que puede reemplazar una run activa y conserva el
perfil; no es la transición de nueva run.

`beginJourney` es la transición atómica de onboarding: valida el setup, crea
perfil, contenido, run y mapa del día 1, limpia el borrador y deja `view: home`
en una sola escritura. Si la validación o la generación del mapa falla, el
documento no cambia. `saveGoal`/`saveTask` aceptan un input sin id ni fecha y los
inyectan con `newId` y el reloj del store; `archiveGoal`/`archiveTask` desactivan
(no borran) y `archiveGoal` archiva en cascada sus rutinas. `ContentActionResult`
devuelve errores de campo y de formulario para que los diálogos los asocien con
`aria-describedby`.

Al hidratar, el store reconcilia y finaliza la run **antes** de derivar la vista:
una run activa cuya semana ya venció queda cerrada, recibe su resumen y abre
`run-summary`, no una home sin mapa jugable. `importDocument` sigue el mismo
orden. `startRun` no reemplaza una run activa: muestra un toast y sale sin mutar
el documento.

`startNewRun` acepta metas revisadas opcionales para el diálogo de nueva run.
Las escribe en el mismo `set` que la run nueva: si la validación de setup falla,
no persiste ni las metas ni la run y devuelve `false` (el mensaje queda en
`toast`). Sin metas revisadas conserva el comportamiento anterior.

## 6. UI y diseño

- La app es la referencia visual; `design/DESIGN.md` es su especificación. Los
  tokens viven en `src/styles/tokens.css` y las fuentes en `public/fonts/`. Las
  clases y la jerarquía (shell, sidebar, tabbar, paneles, mapa, nodo, resumen,
  onboarding, reliquary, ajustes) se reusan tal cual, sin copias paralelas.
- Tokens: no introducir colores/tamaños sueltos si existe un token. El tema
  claro/oscuro se controla con `data-theme` en `<html>` y `prefers-color-scheme`
  cuando la preferencia es `system`.
- Cada pantalla debe tener su estado vacío/cargado y funcionar a 360 px, 768 px y
  desktop. Sin scroll horizontal.
- El rail del mapa se apila bajo el mapa por debajo de 1200 px en lugar de usar
  el dock flotante del prototipo: así «Next step», «Weekly goals» y la leyenda
  siguen visibles a 360 px sin tapar el mapa ni provocar scroll horizontal. Las
  etiquetas de nodos disponibles usan `data-label-side` para colocarse a
  izquierda, derecha o debajo según el ancho de la capa (las capas de 4–5 nodos
  las llevan siempre debajo). La etiqueta muestra solo
  el nombre de la tarea y permanece oculta hasta `:hover` o `:focus-visible`; en
  punteros sin hover, el primer toque la revela y el segundo selecciona el nodo.
- Nodos del mapa: SVG decorativo + botones HTML superpuestos (o controles
  equivalentes), 44×44 px mínimo, foco visible, estados distinguibles sin color
  (icono, forma, texto `aria-label`). Leyenda visible. Los nodos `task`, `elite`
  y `boss` muestran el crest del goal; elite añade una estrella y el boss
  conserva su marco hexagonal. `rest`/`treasure` mantienen el icono de tipo.
- El picker de iconos (`IconPicker`) es un radiogroup nativo de 44 px con
  etiqueta textual (visible o `sr-only` en modo compacto). Se usa en el diálogo
  de goal y en las tarjetas de goal del onboarding; el valor se persiste con el
  goal y se valida en dominio.
- Formularios con `<label>`, errores asociados con `aria-describedby`, diálogos
  con foco atrapado y `Esc`. `prefers-reduced-motion` desactiva animaciones no
  esenciales.
- El panel de desarrollo solo se monta si `import.meta.env.DEV`; nunca en el
  build de producción ni en el documento exportado.

### Ajustes de la UI del bucle M2

El diseño de `design/DESIGN.md` sigue siendo la referencia. La implementación del
bucle diario necesita mostrar más información que los estados estáticos del
prototipo retirado:

- El rail de camp (`Weekly goals`, `Run at a glance`, `The traveller`) y la tira
  de siete días se apilan bajo el contenido principal por debajo de 1200 px y
  960 px respectivamente. El prototipo los ocultaba en móvil; ocultarlos dejaría
  el progreso semanal y el perfil sin acceso desde el dashboard.
- La cabecera de camp añade fecha y estado del día, y el rail añade el panel del
  viajero con nivel, XP, oro y progreso al siguiente nivel. Reutiliza los mismos
  paneles, pips, chips y barras de progreso.
- El resumen de día añade un bloque explícito de bonus de cierre (`+20 XP/+20
  gold` o `Forfeited`), etiquetas `Completed`/`Skipped` en cada paso y la
  progresión `before → after` de cada objetivo. El sello usa una animación
  breve que desaparece con `prefers-reduced-motion`.
- Los nodos resueltos vuelven al mapa con un toast de recompensa. El boss navega
  al resumen de día; si era el día 7, el store aplica el cierre semanal en la
  misma acción, la run queda `closed` con `summary` calculado y el resumen de
  día sigue siendo accesible hasta que se recargue.

### Onboarding y edición de contenido (M3)

- El onboarding conserva el acceso demo en un clic y añade un asistente de
  cuatro pasos (nombre, metas, rutinas, revisión) sobre `screen--welcome`,
  `Panel`, campos y tokens existentes. El paso vive en `onboardingDraft.step`,
  por lo que un reload retoma el borrador. Los valores intermedios inválidos
  (por ejemplo, un objetivo semanal 8) se persisten sin bloquear el arranque; la
  validación final sigue siendo `validateSetup`.
- `GoalsScreen` usa `screen--aims` y los paneles del sistema de diseño: añade
  botones de edición/archivo en cada meta y rutina, un bloque de contenido
  archivado con restauración y un rail con el progreso de la run actual. Los
  formularios viven en `Dialog` (foco atrapado, `Esc` y restauración de foco) y
  los errores se asocian con `aria-describedby`.
- Con una run activa, el rail muestra los objetivos snapshot de `run.objectives`
  y avisa de que los cambios solo afectan a mapas futuros. La UI bloquea archivar
  la última meta activa, dejar menos de cuatro rutinas activas o archivar/desactivar
  la última rutina activa de una meta activa; el dominio aplica las mismas reglas
  aunque la acción se invoque fuera de la pantalla. Una meta sin rutinas no puede
  entrar en la siguiente run: `validateSetup` lo rechaza con un mensaje en inglés
  y el asistente de onboarding y el diálogo de nueva run lo muestran.

### Cierre semanal y nueva run (M3)

- `RunSummaryScreen` extiende el lenguaje de `summary-*` (mismo `Panel`,
  `ScreenHead`, sello, pips y acciones) con dos estados además del resumen
  cerrado: run activa («The week is still unfolding») con progreso de días y
  metas, y run cerrada sin `summary` (save antiguo), que llama a `finalizeRun`
  una vez y muestra el resultado. No hay una pantalla de resumen semanal en el
  prototipo; el resumen de día sigue siendo `DaySummaryScreen`.
- El resumen cerrado muestra días jugados/missed, metas con progreso/target,
  bonus por meta, bonus total por todas las metas (+100/+100 y raro garantizado
  cuando aplica), loot, oro por duplicados, totales y nivel del perfil. El texto
  explica que el bonus se concede una sola vez y que los totales ya están en el
  perfil.
- «Begin a new run» abre un diálogo modal con los objetivos semanales editables
  (1–7) de las metas activas. El diálogo valida con las mismas reglas que
  `validateSetup` y pasa las metas revisadas a `startNewRun`, que las persiste
  junto con la run nueva. Un fallo deja el documento y el diálogo intactos.
- La run cerrada nunca ofrece jugar el mapa: home muestra «Read the week» y las
  guardas de `App.tsx` redirigen `map`/`node` a `run-summary`. Tras
  `startNewRun`, la vista es `home` con el día 1 `available` y los días 2–7
  `locked`.

### Perfil, datos locales y PWA (M3)

- `ProfileScreen` usa `buildCollection` (`ui/lib/collection.ts`) para mostrar
  siempre las 12 entradas de `LOOT_CATALOG`, no solo las poseídas. Las que no se
  han encontrado conservan una ranura bloqueada con «Undiscovered» y no exponen
  nombre, rareza, descripción ni icono. Los filtros All/Common/Rare/Epic son
  botones nativos con contador `poseídas/total`; el catálogo sigue disponible
  sin perfil y sin run. Las poseídas muestran nombre, rareza, descripción y fecha
  de obtención.
- El historial de duplicados se construye solo con `RewardEvent`s de la run
  actual (`duplicateCatalogId` + `duplicateGold`). No hay historial entre runs
  porque el save no lo conserva; sin run o sin conversiones se muestra un vacío
  explícito.
- `SettingsScreen` exporta `serializeDocument(document)` con nombre
  `lifespire-<fecha-local>.json`, sin reloj de desarrollo ni estado transitorio.
  La importación lee el archivo, valida con `parseDocument` mediante
  `readSaveFile` y muestra un resumen (nombre, nivel, oro, run/día, reliquias y
  `schemaVersion`) antes de confirmar. Un archivo inválido, corrupto o de versión
  futura se rechaza antes de llamar a `importDocument`, por lo que el documento y
  `localStorage` no cambian.
- `RecoveryScreen` permite importar un backup válido sin resetear primero, con el
  mismo control (`SaveImport`), preview y confirmación que Settings. Un import
  válido llama a `importDocument`, desbloquea las escrituras y deriva la vista.
  El reset destructivo de Recovery reutiliza la frase exacta `RESET` y las mismas
  guardas que Settings.
- El reset exige escribir `RESET` exactamente además de confirmar el diálogo.
  Al confirmar se llama a `resetAll`, se limpia la clave y se vuelve a
  onboarding; cancelar no toca el save. Los ajustes muestran `STORAGE_KEY` y
  `schemaVersion`.
- La PWA se configura en `vite.config.ts` con `registerType: 'autoUpdate'` y
  `devOptions.enabled: false`. El service worker precachea el shell, JS/CSS,
  fuentes WOFF2, manifest e iconos; no cachea estado ni rutas de desarrollo. Un
  update solo sustituye assets estáticos: el save versionado sigue en
  `localStorage` y pasa por las mismas guardas. La verificación local y el
  requisito de HTTPS para instalar en un teléfono están en
  [`PWA.md`](./PWA.md).

### App Android (Expo, SDK 58)

- **Alcance:** paridad funcional con web (onboarding, mapa, nodo, rueda, recap,
  resumen de día/semana, metas/rutinas, reliquary, ajustes, recovery, dev panel
  solo en `__DEV__`) más notificaciones locales. El panel admin y las push
  remotas quedan fuera; ver `SPEC.md`.
- **Shell:** `AppShell.tsx` reproduce las guardas de vista del shell web con
  topbar, tabbar (Map/Camp/Goals/Relics), toasts, `ConflictDialog` y enlaces
  `lifespire://`. `Screen` usa el safe area raíz; las pantallas no lo duplican.
- **Diseño:** `src/theme/tokens.ts` porta las paletas, tipografía, spacing y
  radios de `tokens.css`; `useTheme` resuelve `light|dark|system`. Los
  componentes RN son la contraparte de `apps/web/src/ui/components`.
- **Mapa/rueda:** `MapCanvas` reutiliza `mapLayout`/`classifyMapEdges` y
  pinta aristas en `react-native-svg`; los nodos son `Pressable` posicionados
  por porcentaje. La rueda usa `WHEEL_SECTORS`, `nextWheelRotation` y la
  misma semilla determinista.
- **Auth/sync:** `src/sync/api.ts` crea el cliente en modo `native`; el refresh
  token va a `expo-secure-store` y el acceso vive en memoria. El servidor solo
  lo devuelve con el gate de `X-Client-Platform` sin `Origin`/
  `Sec-Fetch-Site` (ADR-0005). El motor de sync, el manager y el auto-merge son
  los de `app-core`; NetInfo/AppState sustituyen a navigator/window.
- **Notificaciones:** preferencias device-local en `lifespire:notifications`
  (fuera del documento), planner puro (`day-open`, `evening`, `run-end`) y
  scheduler `expo-notifications` con canal `daily-path`. Se reprograman al
  cambiar el documento/prefs y al volver a foreground; no se piden alarmas
  exactas. Ver `MOBILE.md` §5.
- **Datos:** export/import JSON con `expo-file-system` + `expo-sharing` +
  `expo-document-picker`, mismos gates de 2 MB y `readSaveFile`. El esquema
  `GameDocument` no cambia.

## 7. Tests obligatorios por módulo

La app Android añade `apps/mobile/src/notifications/planner.test.ts` (Jest) para
las reglas de recordatorios; el resto de la lógica compartida se cubre con la
suite de web a través de los shims. Ver [`MOBILE.md`](./MOBILE.md) §8.

- `rng`/`generator`: determinismo, golden seed, 1.000 mapas, invariantes y edge
  cases (4 rutinas, 1 goal, 3 goals, 10 goals, pool pequeño/grande).
- `rewards`: tabla completa por tipo × esfuerzo, loot determinista por rareza,
  duplicados, niveles 0/99/100/199.
- `lifecycle`: medianoche 23:59/00:00, ausencia de 3 días, día 7 completado y
  missed, idempotencia, resolución duplicada, reload entre resoluciones.
- `wheel` (`wheel.test.ts` + `ui/lib/wheel.test.ts`): sectores 5/2/2/1
  proporcionales a los pesos, determinismo preview↔resolución, `segmentIndex`
  por categoría, payouts, fallback con pool vacío, skip en ceros, doble resolve,
  totales/summary, y rotación que aterriza en el segmento sorteado.
- `runClose`: 0/parcial/todos los objetivos, bonus por objetivo y total, raro
  garantizado, duplicados convertidos a oro, missed/0 días jugados,
  idempotencia, `summary.totals === run.totals`, deltas del perfil, nueva run
  (perfil conservado, run/días/objetivos reseteados, id/semilla nuevos,
  round-trip) y cierre automático vía reconcile.
- `schema`: round-trip, JSON inválido, campos ausentes, versión futura, migración
  v1→v2 de goals y borradores, mapas válidos pero injugables, `currentNodeId` ya
  resuelto, paths/rewards duplicados, `onboardingDraft.step` fuera de rango y
  referencias día/mapa/path/rewards incoherentes.
- `goalIcons`: catálogo cerrado, ciclo legado y sugerencia del siguiente icono.
- `demo`/`content`: setup con objetivo activo sin rutina, demo válido y bloqueo de
  la última rutina activa de una meta activa durante la run.
- `persistence`/`store`: escritura compacta, escritura fallida expuesta como
  `storageWarning`, estado en memoria usable, limpieza tras un reintento
  correcto, backup antes de import/reset, export raw de Recovery,
  sincronización/conflicto entre pestañas y vista derivada después del reconcile
  de hidratación.
- `collection`: catálogo completo de 12, filtros/contadores por rareza, historial
  de duplicados desde `RewardEvent` y vacío honesto sin run.
- `importSave`: resumen de preview (perfil, nivel, oro, run/día, reliquias,
  schema), round-trip y rechazo de JSON inválido, campos ausentes y versión
  futura sin cambiar el estado. `reset`: frase exacta.
- `dates`: claves locales sin drift UTC.

La calidad de tipos se verifica en dos pasos: `tsconfig.app.json`,
`tsconfig.node.json` y `tsconfig.e2e.json` compilan con `strict`, y
`pnpm typecheck:e2e` (`tsc -p tsconfig.e2e.json`) cubre `e2e/` y
`playwright.config.ts`, que no entran en el `tsc -b` de la app. CI ejecuta
`pnpm lint`, `pnpm typecheck`, `pnpm typecheck:e2e`, `pnpm test` y `pnpm build`;
Playwright solo se ejecuta si cambian rutas críticas.

## 8. Decisiones de alcance (fuera del bucle base)

### Combate, cartas y reliquias con efectos

El bucle base (mapa, recompensas por acciones reales, cierre de día/run) es el
core validado. **No se añade combate, mazo, cartas, tienda ni economía** en el
alcance actual: desviarían la hipótesis central (la recompensa debe sentirse
como consecuencia de la acción real, no del mazo) e inflarían el alcance.

Las **reliquias son colección en el alcance actual** (catálogo de 12, rarezas,
duplicados → oro, roll garantizado al cerrar la run completa). No tienen efectos
mecánicos.

Si el playtest muestra que el loot se siente vacío, la siguiente iteración puede
añadir **modificadores pasivos de recompensa** (no de combate), acotados:
- máximo 3–4 reliquias activas por run, elegidas al inicio;
- efectos del tipo `+10% XP en nodos de tarea`, un reroll de loot por run,
  `+1 oro por nodo completado`;
- sin sinergias entre reliquias, activación automática, sin decisiones en
  combate.

Esto mantiene el foco en acciones reales → recompensas y es testeable sin
infraestructura de combate. Cualquier sistema de combate/mazo queda pospuesto
hasta haber evidencia de retención del bucle base.
