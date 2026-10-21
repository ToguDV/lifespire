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
deriva al hidratar: sin perfil → `onboarding`; run cerrado → `run-summary`; si no
→ `home`.

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
- `reconcile(document, now)`: marca como `missed` los días pasados sin cerrar,
  deja `available` el día de hoy sin mapa, `in_progress` si tiene mapa, y
  `locked` los futuros. Si todos los días están cerrados o missed, cierra la run.
  Es idempotente y se ejecuta al hidratar y tras cada acción.
- Solo el día actual (índice = primer día no cerrado) es jugable. No hay
  recuperación de días missed.
- `selectNode`: solo nodos disponibles (capa 0 si no hay actual; si hay
  `currentNodeId`, solo ese nodo puede resolverse; las conexiones se eligen
  después de resolver). Persiste `currentNodeId`; recargar conserva la selección.
- `resolveNode(document, { dayId, nodeId, action, now })`:
  - exige que el nodo sea el actual o esté disponible por conexión;
  - `complete` concede recompensas, +1 de progreso si aplica y loot;
  - `skip` concede 0 y no progresa;
  - añade a `path`, registra `RewardEvent`, limpia `currentNodeId`;
  - si es boss, cierra el día y calcula `summary`; el día 7 cierra la run;
  - un segundo intento sobre el mismo nodo es no-op/error explícito, nunca
    duplica recompensas.
- El progreso semanal vive en `run.objectives` y se actualiza al completar.

### Cierre de run (`runClose.ts`)

- Objetivo cumplido si `progress >= target`.
- Cada objetivo cumplido: +50 XP, +50 oro y 1 tirada de loot (determinista).
- Todos cumplidos (y hay ≥1 objetivo): +100 XP, +100 oro y 1 objeto raro
  garantizado.
- Si no hay objetivos o no hay días jugados, el resumen sigue siendo válido.
- `run.status = 'closed'` y `run.summary` se escriben una sola vez. Llamar dos
  veces devuelve la misma run sin volver a conceder nada.
- Los totales del resumen se calculan de los eventos persistidos y deben coincidir
  con `profile` (incluidas conversiones de duplicados).

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
  updateOnboardingDraft(patch: Partial<OnboardingDraft>): void
  startRun(setup: RunSetup, now?: Date): void
  openDay(dayId?: string, now?: Date): void
  selectNode(nodeId: string): void
  resolveNode(nodeId: string, action: ResolutionAction, now?: Date): void
  closeRun(now?: Date): void
  startNewRun(now?: Date): void
  saveGoal(goal: Goal): void
  archiveGoal(goalId: string): void
  saveTask(task: Task): void
  archiveTask(taskId: string): void
  importDocument(doc: GameDocument): void
  resetAll(): void
  setTheme(theme: ThemePreference): void
  setDevOffset(days: number): void
}
```

Reglas de las acciones: leer `document`, aplicar funciones puras, recalcular
nivel/totales, escribir una sola vez. Los ids se generan con
`newId(prefix)` (`crypto.randomUUID` con fallback). El offset de desarrollo vive
en `state/clock.ts`, no en `document`.

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
- Nodos del mapa: SVG decorativo + botones HTML superpuestos (o controles
  equivalentes), 44×44 px mínimo, foco visible, estados distinguibles sin color
  (icono, forma, texto `aria-label`). Leyenda visible.
- Formularios con `<label>`, errores asociados con `aria-describedby`, diálogos
  con foco atrapado y `Esc`. `prefers-reduced-motion` desactiva animaciones no
  esenciales.
- El panel de desarrollo solo se monta si `import.meta.env.DEV`; nunca en el
  build de producción ni en el documento exportado.

## 7. Tests obligatorios por módulo

- `rng`/`generator`: determinismo, golden seed, 1.000 mapas, invariantes y edge
  cases (4 rutinas, 1 goal, 3 goals, pool pequeño/grande).
- `rewards`: tabla completa por tipo × esfuerzo, loot determinista por rareza,
  duplicados, niveles 0/99/100/199.
- `lifecycle`: medianoche 23:59/00:00, ausencia de 3 días, día 7 completado y
  missed, idempotencia, resolución duplicada, reload entre resoluciones.
- `runClose`: 0/parcial/todos los objetivos, missed days, doble cierre.
- `schema`: round-trip, JSON inválido, campos ausentes, versión futura, migración.
- `dates`: claves locales sin drift UTC.
