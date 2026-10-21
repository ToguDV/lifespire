# LifeSpire MVP-0 — Arquitectura y contratos

Este documento fija los límites entre módulos y los contratos de datos. Es la
referencia para implementar los issues sin que dos piezas se contradigan. Si una
decisión cambia, se actualiza aquí en el mismo cambio.

Fuentes: [`SPEC.md`](../SPEC.md) y [`design/`](../design) (diseño aceptado).

## 1. Estructura

```text
src/
  domain/          lógica pura, sin React, sin store, sin Date.now/Math.random
    types.ts       tipos y enums del dominio
    balance.ts     constantes de recompensas, niveles, pesos y límites
    dates.ts       fechas locales YYYY-MM-DD, sin drift UTC
    rng.ts         RNG determinista por string seed
    rewards.ts     tabla de recompensas, loot, duplicados, nivel
    generator.ts   generación y validación del mapa
    lifecycle.ts   abrir día, seleccionar, resolver, reconciliar días/run
    runClose.ts    cierre de run y bonus semanal
    schema.ts      validación, serialize/deserialize, migración
    selectors.ts   valores derivados (nivel, día actual, estado de nodo)
  content/
    loot.ts        catálogo de 12 objetos
    demo.ts        factory determinista de demo (2 goals, 5 routines)
  state/
    store.ts       Zustand + persist, acciones de aplicación
    clock.ts       reloj inyectable + offset de desarrollo (no persistido)
  ui/
    components/    Button, Panel, Progress, Stat, Dialog, Icon, etc.
    screens/       una pantalla por vista
    App.tsx        shell, navegación y guardas de flujo
  styles/
    tokens.css     copia/adaptación de design/assets/tokens.css
    app.css        copia/adaptación de design/assets/app.css
    ui.css         estados añadidos por el port (diálogos, vacíos)
    m3.css         onboarding guiado y edición de metas/rutinas
  main.tsx
```

Los tests viven junto al módulo (`*.test.ts`). No se añaden librerías de UI,
router ni kit visual. El mapa se dibuja con SVG propio. Las fuentes se sirven
desde `public/fonts/` y se declaran en `tokens.css`.

## 2. Navegación sin router

`view` es estado transitorio del store (no se persiste):

```ts
export type View =
  | { name: 'onboarding' }
  | { name: 'home' }
  | { name: 'map' }
  | { name: 'node'; nodeId: string }
  | { name: 'day-summary'; dayId: string }
  | { name: 'run-summary' }
  | { name: 'goals' }
  | { name: 'profile' }
  | { name: 'settings' }
  | { name: 'recovery'; reason: 'corrupt' | 'future-version' | 'import-error' }
```

`navigate(view)` apila la vista anterior; `back()` desapila. La vista inicial se
deriva al hidratar: sin perfil → `onboarding`; run cerrado → `run-summary`; si el
día actual está abierto y su mapa tiene `currentNodeId` → `node` para ese nodo;
si no → `home`. La vista sigue siendo transitoria: el detalle se reconstruye
desde el documento persistido, nunca se guarda `view` en `localStorage`.

## 3. Documento persistido

Una sola clave de `localStorage`: `lifespire:mvp0`. Zustand `persist` guarda el
documento versionado. Se persiste únicamente `{ document }`; `view`, diálogos,
mensajes y el offset del reloj de desarrollo quedan fuera.

```ts
export const SCHEMA_VERSION = 1
export const STORAGE_KEY = 'lifespire:mvp0'

export interface GameDocument {
  schemaVersion: 1
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
export type NodeType = 'task' | 'elite' | 'rest' | 'treasure' | 'boss'
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
  layer: number            // 0..3 decisiones; 4 = boss
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
  layers: MapNode[][]      // 4 capas de 2..3 nodos
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
convierta el borrador en «corrupto». La validación de negocio se aplica al
confirmar (`beginJourney`).

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

- Semilla: `${runSeed}:day:${dayIndex}:g${generatorVersion}`.
- 4 capas de decisión con 2–3 nodos + boss. Capa 0 disponible desde el start.
- Cada capa: al menos 1 task, como máximo 1 rest **o** treasure, y 1–2 elites en
  todo el mapa.
- Task/elite/boss requieren `TaskSnapshot`. Rest/treasure tienen `task: null`.
- Sin tareas repetidas dentro de una capa. Entre capas se evita repetir mientras
  el pool lo permita; con pools pequeños se permite repetir entre capas.
- Conexiones: cada nodo de capa 0–2 conecta a 1–2 nodos de la capa siguiente;
  cada nodo de capa 3 conecta al boss. Todo nodo de la capa siguiente tiene al
  menos una entrada; ningún nodo queda huérfano. El boss no tiene salida.
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
  - `complete` concede recompensas, +1 de progreso si aplica y loot;
  - `skip` concede 0 XP/oro/loot/progreso pero también registra evento y avanza;
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
  `closed` y un setup válido (1–3 objetivos activos, ≥4 rutinas activas y
  objetivos semanales válidos) usando `validateSetup`. Un fallo lanza
  `DomainError` antes de construir nada: el documento no se modifica.
- Conserva exactamente `profile` (id, nombre, XP, nivel, oro, colección y
  `createdAt`), `goals`, `tasks` y `settings`.
- Sustituye `run` por una run nueva creada con `createRun`: id y semilla nuevos
  (la semilla deriva del `runId` inyectado), 7 días desde la fecha local de
  `now`, día 0 `available` y el resto `locked`. No quedan días, mapas, paths,
  reward events, objetivos ni resumen de la run anterior.
- Limpia `onboardingDraft`. Devuelve un único documento, por lo que la
  transición es atómica: un reload solo puede ver la run vieja completa o la
  nueva completa.

### Persistencia y recuperación (`schema.ts` + `state/store.ts`)

- `serializeDocument(doc): string` y `parseDocument(unknown): Result<GameDocument>`.
  Validación estructural explícita, sin dependencias nuevas.
- Rechazar JSON inválido, campos requeridos ausentes, `schemaVersion` futura y
  enums desconocidos. No modificar el documento actual ante un import inválido.
- Si `localStorage` está corrupto o tiene una versión futura, el store hidrata un
  documento vacío **sin sobrescribir** la clave y expone `storageIssue` para
  mostrar `recovery`. Solo `resetAll` o un import válido desbloquean la escritura.
- `exportDocument` produce el mismo `GameDocument` versionado, legible (2 espacios)
  y sin claves de desarrollo.
- `importDocument` valida, muestra un preview/resumen y exige confirmación antes de
  reemplazar el estado.
- `resetAll` exige confirmación explícita (frase) y vuelve a onboarding.

## 5. Store (Zustand)

Estado:

```ts
interface AppState {
  document: GameDocument
  hydrated: boolean
  storageIssue: { reason: 'corrupt' | 'future-version' } | null
  view: View
  history: View[]
  toast: string | null
  // acciones de navegación
  navigate(view: View): void
  back(): void
  // acciones de dominio (todas llaman a reconcile y persisten)
  completeOnboarding(setup: OnboardingSetup): void
  beginJourney(setup: OnboardingSetup, now?: Date): boolean
  updateOnboardingDraft(patch: Partial<OnboardingDraft>): void
  startRun(setup: RunSetup, now?: Date): void
  openDay(dayId?: string, now?: Date): void
  selectNode(nodeId: string): void
  resolveNode(nodeId: string, action: ResolutionAction, now?: Date): void
  finalizeRun(now?: Date): void
  startNewRun(now?: Date, goals?: Goal[]): boolean
  saveGoal(input: GoalInput, now?: Date): ContentActionResult
  archiveGoal(goalId: string, now?: Date): ContentActionResult
  saveTask(input: TaskInput, now?: Date): ContentActionResult
  archiveTask(taskId: string, now?: Date): ContentActionResult
  importDocument(doc: GameDocument): void
  resetAll(): void
  setTheme(theme: ThemePreference): void
  setDevOffset(days: number): void
}
```

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

`startNewRun` acepta metas revisadas opcionales para el diálogo de nueva run.
Las escribe en el mismo `set` que la run nueva: si la validación de setup falla,
no persiste ni las metas ni la run y devuelve `false` (el mensaje queda en
`toast`). Sin metas revisadas conserva el comportamiento anterior.

## 6. UI y diseño

- Portar `design/assets/tokens.css` a `src/styles/tokens.css` y las fuentes a
  `public/fonts/`. Reutilizar las clases y la jerarquía de `design/app.css` y
  `design/app.html` (shell, sidebar, tabbar, paneles, mapa, nodo, resumen,
  onboarding, reliquary, ajustes).
- Tokens: no introducir colores/tamaños sueltos si existe un token. El tema
  claro/oscuro se controla con `data-theme` en `<html>` y `prefers-color-scheme`
  cuando la preferencia es `system`.
- Cada pantalla debe tener su estado vacío/cargado y funcionar a 360 px, 768 px y
  desktop. Sin scroll horizontal.
- El rail del mapa se apila bajo el mapa por debajo de 1200 px en lugar de usar
  el dock flotante del prototipo: así «Next step», «Weekly aims» y la leyenda
  siguen visibles a 360 px sin tapar el mapa ni provocar scroll horizontal. Las
  etiquetas de nodos disponibles usan `data-label-side` para colocarse a
  izquierda, derecha o debajo según el ancho de la capa.
- Nodos del mapa: SVG decorativo + botones HTML superpuestos (o controles
  equivalentes), 44×44 px mínimo, foco visible, estados distinguibles sin color
  (icono, forma, texto `aria-label`). Leyenda visible.
- Formularios con `<label>`, errores asociados con `aria-describedby`, diálogos
  con foco atrapado y `Esc`. `prefers-reduced-motion` desactiva animaciones no
  esenciales.
- El panel de desarrollo solo se monta si `import.meta.env.DEV`; nunca en el
  build de producción ni en el documento exportado.

### Ajustes de la UI del bucle M2

El diseño de `design/` sigue siendo la referencia. La implementación del bucle
diario necesita mostrar más información que los estados estáticos del prototipo:

- El rail de camp (`Weekly aims`, `Run at a glance`, `The traveller`) y la tira
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
- `GoalsScreen` usa `screen--aims` y los paneles de `design/`: añade botones de
  edición/archivo en cada meta y rutina, un bloque de contenido archivado con
  restauración y un rail con el progreso de la run actual. Los formularios viven
  en `Dialog` (foco atrapado, `Esc` y restauración de foco) y los errores se
  asocian con `aria-describedby`.
- Con una run activa, el rail muestra los objetivos snapshot de `run.objectives`
  y avisa de que los cambios solo afectan a mapas futuros. La UI bloquea archivar
  la última meta activa o dejar menos de cuatro rutinas activas; el dominio
  aplica las mismas reglas aunque la acción se invoque fuera de la pantalla.

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

## 7. Tests obligatorios por módulo

- `rng`/`generator`: determinismo, golden seed, 1.000 mapas, invariantes y edge
  cases (4 rutinas, 1 goal, 3 goals, pool pequeño/grande).
- `rewards`: tabla completa por tipo × esfuerzo, loot determinista por rareza,
  duplicados, niveles 0/99/100/199.
- `lifecycle`: medianoche 23:59/00:00, ausencia de 3 días, día 7 completado y
  missed, idempotencia, resolución duplicada, reload entre resoluciones.
- `runClose`: 0/parcial/todos los objetivos, bonus por objetivo y total, raro
  garantizado, duplicados convertidos a oro, missed/0 días jugados,
  idempotencia, `summary.totals === run.totals`, deltas del perfil, nueva run
  (perfil conservado, run/días/objetivos reseteados, id/semilla nuevos,
  round-trip) y cierre automático vía reconcile.
- `schema`: round-trip, JSON inválido, campos ausentes, versión futura, migración.
- `collection`: catálogo completo de 12, filtros/contadores por rareza, historial
  de duplicados desde `RewardEvent` y vacío honesto sin run.
- `importSave`: resumen de preview (perfil, nivel, oro, run/día, reliquias,
  schema), round-trip y rechazo de JSON inválido, campos ausentes y versión
  futura sin cambiar el estado. `reset`: frase exacta.
- `dates`: claves locales sin drift UTC.
