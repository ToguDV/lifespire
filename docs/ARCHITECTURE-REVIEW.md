# LifeSpire — Diagnóstico de arquitectura

> **Fecha:** 2026-10-23  
> **Commit auditado:** `3027771` (`feat(ui): quiet juice across the map loop`)  
> **Rama:** `docs/architecture-review`  
> **Alcance:** diagnóstico read-only. Este documento no cambia código, contratos ni comportamiento.  
> **Foco solicitado:** persistencia, almacenamiento, duplicidad, código verboso y escalabilidad.  
> **Método:** cinco auditorías paralelas (persistencia, duplicidad/verbosidad, escalabilidad, mapa estructural y seguridad) más la verificación directa de lint, typecheck, tests y build por el agente principal. Las cifras y referencias se contrastaron contra el árbol de trabajo.

---

## 1. Veredicto

**El núcleo está sano; los bordes son frágiles.** LifeSpire tiene un dominio puro, determinista y bien probado, una dirección de dependencias correcta y transiciones atómicas. El riesgo no está en las reglas del juego, sino en cómo se guarda y se escribe el documento, en la validación de la frontera de importación y en la duplicación de lógica de presentación entre pantallas.

No se encontró ningún **P0** en el flujo normal de una pestaña. Sí hay dos **P1**:

1. **Pérdida silenciosa de progreso con dos pestañas o PWA + pestaña**, porque la última escritura gana y no hay revisión ni escucha de `storage`.
2. **La UI promete `+1 toward weekly target` en nodos que el dominio resuelve con `progress: 0`** cuando el objetivo no forma parte de `run.objectives` (por ejemplo, una meta añadida a mitad de run).

La deuda dominante es de **amplificación de escritura** (documento completo, con sangría, en cada `set`, incluida la navegación), **validación de import incompleta** (un save válido puede ser injugable), **duplicación estructural** (guardas de navegación, reset, validación de contenido, filas semanales, formularios) y **ausencia de `strict` en TypeScript**.

**Recomendación:** aprobar el estado actual como MVP, pero pagar primero integridad de datos y contrato de recompensas antes de añadir historial de runs, sincronización o más contenido.

### Puntuación por dimensión

| Dimensión | Nota | Lectura |
|---|---:|---|
| Límites y dependencias | **B** | 0 violaciones `domain/content → state/ui`; 0 ciclos de archivo; pero existe ciclo de capa `domain ↔ content` y `ui/components ↔ ui/lib` |
| Dominio y reglas | **A−** | Puro, determinista, sin `Date.now`/`Math.random`; 410 tests; acoplamiento puntual a contenido y mensajes de UI |
| Persistencia y almacenamiento | **C+** | Guards de corrupción/versión futura bien resueltos; multi-pestaña, fail-open y coste de escritura pendientes |
| Estado y navegación | **C+** | Store de 781 líneas con 51 `set`; guardas de vista duplicadas; `history/back` sin consumidor |
| UI y CSS | **C+** | Pantallas monolíticas, formularios duplicados, 7.287 líneas de CSS global con solapamientos |
| Testing | **B−** | Excelente en dominio/estado; 0 tests de pantallas; E2E estrecho y filtrado en CI |
| Escalabilidad | **B−** | Aguanta los topes actuales con holgura; el modelo de almacenamiento bloquea historial, IndexedDB y sync |
| Seguridad | **B** | Sin XSS/RCE; superficie real = import y `localStorage`; un save manipulado puede bloquear la app |
| Documentación | **C** | `ARCHITECTURE.md` omite 23 archivos y describe contratos que ya no existen |
| Tooling y CI | **C+** | Gates verdes; `strict` apagado, sin coverage y E2E no cubierto por typecheck |

---

## 2. Estado verificado

### Quality gates

| Gate | Resultado |
|---|---|
| `pnpm lint` | ✅ 0 errores, 1 warning (`src/ui/lib/countUp.ts:57`, `react(set-state-in-effect)`) |
| `pnpm typecheck` | ✅ sin errores |
| `pnpm test` | ✅ **34 archivos, 410 tests**, 1,17 s |
| `pnpm build` | ✅ 2.009 módulos; JS **453,73 kB** (133,45 kB gzip); CSS **98,02 kB** (17,48 kB gzip) |
| PWA | ✅ 16 entradas precacheadas, 701,67 KiB; `devOptions.enabled: false` |
| `pnpm audit --prod` | ✅ 0 vulnerabilidades |
| `pnpm audit` (incl. dev) | ⚠️ 1 advisory low en `serialize-javascript` vía `vite-plugin-pwa`; no llega al cliente |

### Métricas del repositorio

| Métrica | Valor |
|---|---:|
| Archivos en `src/` + `e2e/` | 115 (78 producción, 37 test) |
| LOC totales | 30.429 |
| LOC de producción | 21.886 |
| LOC de test | 8.543 |
| TS/TSX de producción | 14.064 |
| CSS | 7.287 (6 archivos) |
| Tests unitarios | 410 en 34 archivos |
| Casos E2E | 13 en 3 specs |
| Tests por módulo de dominio | 12 archivos, ratio test/prod **1,16×** |
| Tests de pantallas | **0** para 13 pantallas y 5.444 LOC |
| `set(...)` en el store | 51 |
| Ternarios en el store | 113 |
| Claves de almacenamiento | 3 mecanismos: `localStorage` documento, `localStorage` preferencias, `sessionStorage` sellos |
| Selectores CSS duplicados | 39 exactos; 79 clases compartidas entre archivos |
| CSS muerto estimado | 240–280 líneas |

---

## 3. Mapa de arquitectura

### Capas y dependencias

```text
main.tsx → App.tsx (wrapper) → ui/App.tsx
                                  ├─ ui/screens (13) ──→ ui/lib (15), ui/components (20)
                                  ├─ ui/components ──→ ui/lib, domain
                                  └─ ui/dev (solo DEV)
state/store.ts ──→ domain, content
domain/* ──→ content/loot, content/demo   ← ciclo de capa
content/* ──→ domain
```

| Regla | Estado |
|---|---|
| `domain`/`content` no importan `state`/`ui` | ✅ 0 violaciones |
| Sin ciclos a nivel de archivo | ✅ 0 ciclos |
| Sin ciclos a nivel de capa | ❌ `domain ↔ content` |
| Sin ciclos de directorio en UI | ❌ `ui/components → ui/lib` y `ui/lib/format.ts` → `ui/components/Icon` |
| Dominio puro (sin React, `Date.now`, `Math.random`, `localStorage`) | ✅ verificado por grep |

El ciclo `domain ↔ content` es el más relevante: `domain/rewards.ts` y `domain/runClose.ts` importan el catálogo y la validación de setup de `content/`, mientras `content/` importa tipos y reglas de `domain/`. No rompe la pureza, pero impide tratar `content` como un pack sustituible y complica i18n o contenido alternativo.

### Hotspots de mantenibilidad

| Archivo | LOC | Problema principal |
|---|---:|---|
| `src/styles/app.css` | 3.833 | CSS global, 542 grupos de selector, clases muertas y overrides |
| `src/ui/screens/OnboardingScreen.tsx` | 812 | Componente único de ~782 líneas; cuatro copias de navegación |
| `src/domain/generator.ts` | 808 | `validateMap` de 295 líneas; reglas de nodo dispersas |
| `src/state/store.ts` | 781 | `createAppStore` ~606 líneas; mezcla navegación, run, contenido, persistencia y dev |
| `src/domain/lifecycle.ts` | 738 | 53 `if`, 66 ternarios; resolución y reconciliación |
| `src/domain/schema.ts` | 665 | 40 validadores manuales; duplicación documento/draft |
| `src/ui/screens/NodeScreen.tsx` | 663 | 84 ternarios; lógica de resolución y presentación |
| `src/ui/screens/HomeScreen.tsx` | 612 | 182 líneas de `switch` sobre `home.phase` |

Hubs de contrato: `domain/types.ts` (fan-in 39), `domain/balance.ts` (26), `state/store.ts` (17) y `ui/components/index.ts` (15 entradas, 18 salidas). El barrel de componentes es cómodo, pero acopla 15 archivos a su superficie.

---

## 4. Hallazgos priorizados

Severidad: **P0** bloqueante, **P1** alta (pérdida de datos o contrato incorrecto en uso plausible), **P2** deuda importante, **P3** mejora. Esfuerzo: **S** (<1 día), **M** (1–4 días), **L** (>4 días).

### P1 — Integridad y contrato

#### ARQ-01 · Multi-pestaña: la última escritura gana y borra progreso sin aviso

- **Evidencia:** Zustand `persist` llama a `setItem` tras cada `set`; `partialize` guarda el documento completo (`src/state/store.ts:744-750`); el adaptador escribe la clave única (`src/state/persistence.ts:121-130`). No existe `addEventListener('storage')`, `BroadcastChannel`, `navigator.locks` ni revisión/`updatedAt` en `src/`. `navigate` y `showToast` también escriben (`store.ts:193-204`, `651-661`).
- **Impacto:** con PWA + pestaña, o dos ventanas, la pestaña con el documento viejo puede revertir un nodo resuelto, loot o progreso con solo navegar o cerrar un toast. Es silencioso: no hay merge, aviso ni bloqueo.
- **Recomendación:** añadir `revision` y `updatedAt` al documento; escuchar `storage` y rehidratar/reconciliar si la revisión remota es mayor; serializar escrituras con Web Locks. Como mínimo, detectar otro escritor y bloquear la pestaña obsoleta.
- **Esfuerzo:** M.

#### ARQ-02 · La UI promete progreso semanal que el dominio no concede

- **Evidencia:** `NodeScreen.tsx:420-423` y `:588` muestran `+1 toward weekly target` cuando `node.rewards.progress > 0`; `RewardScreen.tsx:118-123` y `daySummary.ts:58-60` hacen lo mismo con el outcome del wheel. Sin embargo, `lifecycle.ts:554-562` solo aplica progreso si el `goalId` existe en `run.objectives`; en caso contrario devuelve `progress: 0`. El generador puede elegir tareas de metas añadidas a mitad de run (`generator.ts:120-123`), que no están en el snapshot de objetivos.
- **Impacto:** el usuario ve una promesa de progreso que no se cumple. En el wheel, el resultado dice `+1` mientras el bloque “Goal” del mismo nodo muestra `—`. Rompe la hipótesis central del producto: la recompensa debe sentirse como consecuencia real de la acción.
- **Recomendación:** un selector `grantsProgress(run, node)` (o reutilizar `objectiveProgress` ya calculado en `NodeScreen:278`) y centralizar el copy de outcome. En wheel, usar `rolledOutcome.progress`, no el tipo de outcome.
- **Esfuerzo:** S.

### P2 — Persistencia, robustez y escalabilidad

#### ARQ-03 · El import acepta documentos válidos pero injugables

- **Evidencia:** `importDocument` solo ejecuta `parseDocument` y `withSyncedLevel` (`store.ts:608-634`); no aplica `validateContentConstraints` (`domain/content.ts:106-126`) ni `validateSetup`. `validateRunIntegrity` (`schema.ts:579-618`) valida referencias de nodos, pero no coherencia de totales, resumen, duplicados, fechas ni `currentNodeId` ya resuelto. `generator.ts:757-761` solo exige que el nodo exista.
- **Impacto:** un save importado con 0–3 rutinas activas queda en deadlock: `saveTask` exige ≥4 tras añadir y `saveGoal` también, así que no se puede reparar desde la UI. Un `currentNodeId` que apunta a un nodo ya resuelto deja `availableNodeIds` vacío (`selectors.ts:72-96`) y bloquea el día. También se aceptan totales y resúmenes incoherentes.
- **Recomendación:** tratar “schema válido” y “partida jugable” como contratos distintos. En import/hidratación: aplicar constraints de contenido si hay run activa, limpiar o rechazar `currentNodeId` inválido, rechazar eventos duplicados y recalcular o verificar derivados.
- **Esfuerzo:** M.

#### ARQ-04 · El guard de “no sobrescribir” falla abierto ante una excepción de parseo

- **Evidencia:** `persistence.ts:101-111` solo envuelve `storage.getItem`; `parseDocument(raw)` queda fuera del `try`. En `schema.ts:137-146` las migraciones corren fuera del `try` que protege la validación. Si una migración lanza, Zustand deja `hasHydrated=false`, pero `store.ts:758-766` marca `hydrated: true` y escribe el documento vacío sobre el save válido.
- **Impacto:** pérdida total al arrancar. Hoy es **latente** (ninguna migración actual lanza), pero cualquier migración futura con un bug convierte un save sano en pérdida irreversible.
- **Recomendación:** envolver `parseDocument` completo en `try/catch` y bloquear como `corrupt`; no marcar `hydrated` hasta `persist.hasHydrated()`/`onFinishHydration`.
- **Esfuerzo:** S.

#### ARQ-05 · Amplificación de escritura: documento completo con sangría en cada `set`

- **Evidencia:** `serializeDocument` usa `JSON.stringify(document, null, 2)` (`schema.ts:109-111`) y el adaptador lo usa en cada `setItem` (`persistence.ts:124`). El store tiene 51 `set`; navegar, abrir/cerrar un toast y apagar el aviso de escritura también persisten. Un run típico pesa ~132 kB con sangría (57 kB compacto); el máximo medido ronda 364–390 kB (153–166 kB compacto). Resolver un nodo puede encadenar 3–4 escrituras.
- **Impacto:** jank en móvil de gama baja y desgaste de cuota; con historial de runs el coste crece linealmente. No hay pérdida de datos, pero sí coste evitable en el hilo principal.
- **Recomendación:** escribir solo si cambia la identidad de `document`; persistir compacto y reservar la sangría para exportar; agrupar con debounce trailing y flush en `pagehide`/`visibilitychange`; separar `view`/`toast`/`history` del `persist`.
- **Esfuerzo:** M.

#### ARQ-06 · El día queda obsoleto al volver del segundo plano o cruzar medianoche

- **Evidencia:** `reconcile` solo se invoca desde acciones y al hidratar (`store.ts:349-356`); `App.tsx:131-157` solo reacciona a cambios de estado. No hay `visibilitychange`, `focus` ni temporizador de medianoche.
- **Impacto:** una PWA en segundo plano durante la noche muestra el día anterior; al interactuar, `reconcile` lo marca como `missed` y la acción falla. No corrompe datos, pero rompe la promesa “el día actual es jugable”.
- **Recomendación:** `refreshClock()` en `visibilitychange`/`focus` y un timer a medianoche que reconcilie y rederive la vista.
- **Esfuerzo:** S.

#### ARQ-07 · Recovery no permite exportar el save bloqueado y no hay backup

- **Evidencia:** la UI recomienda “Export or copy the original local document first” (`RecoveryScreen.tsx:84-87`), pero con `storageIssue` solo se renderiza Recovery (`ui/App.tsx:226-228`), que solo ofrece import/reset. Settings/export es inalcanzable. `resetAll` borra la clave sin copia (`store.ts:637-647`); `importDocument` tampoco respalda. `documentStorage.read()` existe (`persistence.ts:158-164`) pero no se usa.
- **Impacto:** el usuario no puede conservar el original aunque se lo recomienden; un reset o un import equivocado es irreversible.
- **Recomendación:** botón “Download raw save” en Recovery usando `read()`; backup automático en `lifespire:mvp0:backup` antes de import/reset destructivo.
- **Esfuerzo:** S.

#### ARQ-08 · Un `onboardingDraft.step` fuera de rango bloquea la app

- **Evidencia:** `schema.ts:651-654` valida `step` como entero ≥0, sin máximo; `ONBOARDING_STEPS = 4` (`content/onboarding.ts:5`). `OnboardingScreen.tsx:42` usa el step tal cual y solo renderiza paneles para 1–4 (`:556-702`); con 5 el panel queda vacío y no hay “start over”. Sin perfil no se puede llegar a Settings/Recovery (`ui/App.tsx:116-120`).
- **Impacto:** un save importado con `step: 5` bloquea la app de forma persistente y sobrescribe el save anterior. Requiere import o edición manual, pero no hay escape desde la UI.
- **Recomendación:** validar `0..ONBOARDING_STEPS` en schema, clampear en UI y ofrecer “start over” en onboarding.
- **Esfuerzo:** S.

#### ARQ-09 · `strict` está apagado y el typecheck no cubre E2E ni configuración

- **Evidencia:** `tsconfig.app.json` y `tsconfig.node.json` no activan `strict`, `strictNullChecks`, `noImplicitAny`, `noUncheckedIndexedAccess` ni `exactOptionalPropertyTypes`. `tsconfig.app.json` solo incluye `src`; `tsconfig.node.json` solo `vite.config.ts`. `e2e/`, `playwright.config.ts` y `vitest.config.ts` no pasan por `pnpm typecheck`.
- **Impacto:** TypeScript funciona como JavaScript anotado: los `null`/`undefined` y los índices de array no se comprueban. Es la deuda estructural más barata de pagar y la que más protege futuros refactors.
- **Recomendación:** activar `strict: true` de forma incremental por carpeta, empezar por `domain/` y `state/`; añadir un `tsconfig.e2e.json` y un script `typecheck:e2e` al CI.
- **Esfuerzo:** M.

#### ARQ-10 · Duplicación transversal en navegación, contenido y presentación

- **Evidencia:**
  - Guardas de vista escritas dos veces: render y efecto (`ui/App.tsx:116-129` vs `131-157`), más guards locales en `MapScreen.tsx:273-289`, `NodeScreen.tsx:251-276`, `RewardScreen.tsx:91-116` y `DaySummaryScreen.tsx:317-341`.
  - Flujo de reset completo duplicado en `SettingsScreen.tsx:205-253` y `RecoveryScreen.tsx:91-138`.
  - Tres constructores de filas semanales (`HomeScreen.tsx:93-110`, `MapScreen.tsx:181-194`, `GoalsScreen.tsx:59-74`).
  - Perfil creado tres veces (`store.ts:231-239`, `272-280`, `665-673`); `createRun` se invoca en cuatro puntos.
  - Validación de contenido solapada entre `content/demo.ts:22-75`, `domain/content.ts:57-127`, `OnboardingScreen.tsx:114-139`, `newRun.ts:51-55` y `NewRunDialog.tsx:30-33`.
  - Formularios de meta/rutina replicados en `GoalsDialogs.tsx` y `OnboardingScreen.tsx`, sin `TextField`/`EffortPicker`/`FormAlert` compartidos.
  - `easeOutQuart` idéntico en `countUp.ts:4-7` y `wheel.ts:7-10`; `prefersReducedMotion` en tres lugares.
- **Impacto:** cada cambio de copy, validación o accesibilidad hay que hacerlo en 2–5 sitios; los bugs divergen. `store.test.ts` (1.689 líneas) ya es más grande que el store (781), señal de que la complejidad se está compensando con tests.
- **Recomendación:** `commitDocument(transition)` para reconcile/finalize; registro `VIEWS` con `{screen, tab, title, guard}` y un único `resolveView`; `ResetDataDialog`; `weeklyGoalRows`; `validateSetup` en dominio; `TextField`/`FormAlert`/`EffortPicker`/`EmptyState`; `ui/lib/motion.ts`.
- **Esfuerzo:** M.

#### ARQ-11 · CSS global con solapamientos, reglas contradictorias y tokens sin usar

- **Evidencia:** 7.287 líneas globales, 39 selectores exactamente duplicados y 79 clases compartidas. `app.css:1105` oculta `.map-rail` y `ui.css:524` lo vuelve a mostrar; `app.css:3788-3791` y `ui.css:1301-1304` se contradicen para `.camp-rail`. El bloque `.map-dock` (`app.css:1320-1426`, ~108 líneas) corresponde al dock retirado. `ui.css:1941,1968` usan `var(--font-body, sans-serif)`, token inexistente (debería ser `--font-ui`). Hay 152 `font-size` literales y 17 tokens de espaciado/tipografía declarados sin uso.
- **Impacto:** la apariencia depende del orden de importación; un cambio en `app.css` puede quedar anulado por `ui.css`. La deuda visual es difícil de razonar y de eliminar.
- **Recomendación:** borrar CSS muerto, unificar la visibilidad de rails en un solo media query, corregir `--font-body`, mapear tamaños frecuentes a tokens y añadir un test que verifique que todo `var(--*)` está definido.
- **Esfuerzo:** M.

#### ARQ-12 · Store y pantallas monolíticos; faltan primitivas compartidas

- **Evidencia:** `createAppStore` ~606 líneas (`store.ts:174-779`) mezcla navegación, hidratación, persistencia, CRUD, run, toasts y dev. `OnboardingScreen` 782 líneas, `NodeScreen` 523, `HomeScreen` 433, `GoalsScreen` 420. `HomeScreen` repite cinco `switch` sobre `home.phase` (182 líneas). No hay `FormAlert`, `TextField`, `EffortPicker`, `EmptyState` ni `ResetDataDialog` compartidos.
- **Impacto:** alta carga cognitiva y cambios con radio amplio; la lógica de presentación se prueba solo por E2E o no se prueba.
- **Recomendación:** dividir el store en slices (`navigation`, `run`, `content`, `persistence`) sin cambiar la API pública; extraer `PHASE_COPY`/`PHASE_META`; crear las primitivas de formulario y estado vacío.
- **Esfuerzo:** M/L.

#### ARQ-13 · El modelo de almacenamiento bloquea historial, IndexedDB y sync

- **Evidencia:** un único documento reemplaza la run anterior (`runClose.ts:243-249`); el perfil solo conserva agregados; el bonus semanal no se registra como `RewardEvent`; no hay `revision` ni historial. La hidratación asume storage síncrono (`store.ts:758-776`, `persistence.ts:100-140`) y el controlador es un singleton de módulo. El contenido archivado no se borra: `archiveGoal`/`archiveTask` solo marcan `active: false`, y el límite de 10 metas se aplica solo a activas.
- **Impacto:** añadir 10 runs multiplica el documento (1,3–3,9 MB) y cada acción reescribiría el total; pasar a IndexedDB o a un backend exigiría reescribir el arranque. Metas/rutinas archivadas crecen sin tope.
- **Recomendación:** ADR de almacenamiento con contrato async, revisión y política de conflicto; decidir que el historial vivirá en claves separadas/IndexedDB y que el documento principal solo guarda run actual + resúmenes compactos; poda de archivados.
- **Esfuerzo:** L (feature) / S (decisión).

#### ARQ-14 · Reglas y metadatos de nodo dispersos en 8+ archivos

- **Evidencia:** `NODE_TYPES` duplicado en `generator.ts:59` y `schema.ts:87`; reglas “task-bearing”/“especial” en `generator.ts:68,612`; recompensas en `balance.ts:40`; excepción en `rewards.ts:38-46`; etiquetas/iconos en `format.ts:120-138`; leyenda en `MapScreen.tsx:36-54`; icono en `MapGraph.tsx:90`. La leyenda no incluye `wheel`, aunque todo mapa genera al menos uno (`generator.ts:371-391`).
- **Impacto:** añadir un tipo de nodo toca 8+ archivos; olvidar el array de `schema.ts` hace que los saves nuevos se rechacen en silencio. La UI ya muestra un tipo sin explicarlo en la leyenda.
- **Recomendación:** `NODE_META: Record<NodeType, {label, icon, legend, note, taskBearing, special, reward}>` como única fuente, consumida por generador, schema y UI; derivar la leyenda y los iconos.
- **Esfuerzo:** M.

#### ARQ-15 · Drift documental relevante

- **Evidencia:** `docs/ARCHITECTURE.md:12-41` omite 23 archivos de producción (`ui/lib` completo, `persistence.ts`, `content.ts`, `goalIcons.ts`, `onboarding.ts`, `DevPanel.tsx`, `juice.css`, `dev.css`, fixture). `:76-78` afirma una sola clave de `localStorage`, pero existen `lifespire:feedback-prefs` y claves `sessionStorage`. La interfaz `AppState` (`:584-617`) no refleja `rewardToast`, `reconcile`, `newId`, acciones dev ni selectores, y menciona `setDevOffset`, que no existe. `AGENTS.md:19-20` solo cita `app.css`/`ui.css`, pero se cargan también `m3.css`, `juice.css` y `dev.css`. `SPEC.md:9` omite `wheel`; `README.md:105-112` también.
- **Impacto:** la documentación de arquitectura ya no sirve como contrato; un nuevo colaborador implementará contra una estructura inexistente. `AGENTS.md` incumple su propia regla de registrar todos los `.md`.
- **Recomendación:** actualizar el árbol, la tabla de claves y la interfaz del store; enlazar `docs/UI.md`, `docs/PWA.md` y los documentos de playtest/release en `AGENTS.md`; añadir `wheel` a SPEC/README.
- **Esfuerzo:** S.

#### ARQ-16 · El CI deja fuera zonas que pueden romper el bucle

- **Evidencia:** el filtro `critical` de `.github/workflows/ci.yml:27-40` no incluye `src/ui/components/**`, `src/ui/lib/**`, `src/styles/**`, `src/ui/App.tsx` ni `src/ui/dev/**`. E2E usa `pnpm dev` (`playwright.config.ts:18`), no el build con service worker. No hay job de coverage, formato ni auditoría. `typecheck` no cubre `e2e/`. Solo Chromium.
- **Impacto:** un cambio en MapGraph, toasts, feedback o CSS puede romper E2E sin que CI lo ejecute. El offline/PWA real no se prueba.
- **Recomendación:** ampliar el filtro a `src/ui/**` y `src/styles/**`; añadir un job E2E contra `pnpm preview` para el service worker; `typecheck:e2e`; coverage con umbral mínimo en `domain/` y `state/`.
- **Esfuerzo:** S/M.

### P3 — Mejoras y robustez menor

| ID | Hallazgo | Evidencia | Recomendación | Esf. |
|---|---|---|---|---|
| ARQ-17 | Crash de “Begin a new run” con `goal.id = "__proto__"` | `newRun.ts:8,22,29-34` usa `Record<string,string>` y `raw.trim()`; `NewRunDialog.tsx:22-29` valida en render; no hay error boundary | `Map` u `Object.create(null)`, comprobar `typeof`/`Object.hasOwn`, validar formato de IDs | S |
| ARQ-18 | Sin error boundary global | `main.tsx:10-13` | Boundary con “exportar save / reset / onboarding” | S |
| ARQ-19 | Código y API muertos | `history/back` sin consumidor UI (`store.ts:199-204`); `NodeViewCopy` sin referencias; `closeRun`, `countActive*`, `createLootItemFromCatalog` solo tests; rama `import-error` sin productor; `IconButton.badge`/`Pips.warm` nunca se pasan | Borrar o conectar; dejar una sola API de cierre | S |
| ARQ-20 | Sin code splitting por pantalla | `ui/App.tsx` importa las 11 pantallas de forma estática; JS 453,73 kB | `lazy()` por pantalla o por flujo (onboarding, run, ajustes) | S |
| ARQ-21 | Cobertura E2E estrecha | Sin E2E de onboarding personalizado, CRUD de metas, import/export/recovery, nueva run ni PWA offline; solo Chromium | Añadir 3–5 flujos críticos y un proyecto WebKit móvil | M |
| ARQ-22 | Import sin límite de tamaño/cardinalidad | `SaveImport.tsx:36-47` lee el archivo completo; schema sin topes de arrays/strings | Límite de 1–2 MB, caps de longitud/cardinalidad, test de fuzz | S/M |
| ARQ-23 | PWA asume raíz y no hay CSP | `vite.config.ts` `start_url/scope: '/'`; fuentes absolutas; sin cabeceras | Desplegar en origen dedicado o ajustar `base`; CSP y `frame-ancestors` en el host | S |
| ARQ-24 | Detalles de consistencia | `SCHEMA_VERSION` en `balance.ts:3` y `types.ts:27`; `RUN_DAYS=7` hardcodeado ≥15 veces; `MIN_ACTIVE_TASKS=4` repetido en copy; fallback de IDs con `performance.now()` (`store.ts:113-127`); prefs de feedback fuera de `resetAll` | Derivar de constantes; unificar schemaVersion; usar `crypto.getRandomValues` como fallback; incluir prefs en reset | S |

---

## 5. Qué está bien hecho

- **Dominio puro y determinista:** sin `Date.now`, `Math.random`, React ni store; semillas estables, fixture golden y 3.000 mapas fuzzeados sin inválidos.
- **Transiciones atómicas:** onboarding, nueva run y resolución devuelven un único documento; `reconcile → finalize → set` es correcto; el cierre semanal es idempotente.
- **Persistencia defensiva:** save corrupto o de versión futura no se sobrescribe; se bloquean escrituras y se muestra Recovery. Fallo de cuota/privado se detecta y avisa sin romper la sesión.
- **Validación de mapas muy sólida:** capas, conexiones, alcanzabilidad, élites, boss y recompensas exactas a la tabla; bloquea mapas con recompensas infladas.
- **Renderizado seguro:** React escapa títulos y descripciones; iconos validados por enum cerrado; sin `dangerouslySetInnerHTML`, `eval`, `innerHTML` ni peticiones de red.
- **Privacidad por diseño:** sin backend, cuentas, telemetría, CDNs ni fuentes externas; PWA solo cachea assets, nunca el save.
- **Tests de dominio/estado:** 410 tests rápidos, con casos de medianoche, DST, reload, corrupción, import y cierre semanal.
- **Tooling sobrio:** solo 4 dependencias de runtime; lockfile con integridad; CI con permisos de lectura; `audit --prod` limpio.

---

## 6. Roadmap recomendado

### Fase 0 — Guardrails (1–2 días)

1. Activar `strict` en `domain/` y `state/`; añadir `typecheck:e2e`.
2. Error boundary global.
3. Límite de tamaño y cardinalidad en import.
4. Test de regresión para `grantsProgress` (ARQ-02).

### Fase 1 — Integridad de datos (2–4 días)

1. ARQ-01: revisión + listener de `storage` + bloqueo de pestaña obsoleta.
2. ARQ-04: `try/catch` total en el adaptador y `hasHydrated`.
3. ARQ-03: validación de jugabilidad en import; limpiar `currentNodeId` inválido.
4. ARQ-07: export del save bloqueado y backup antes de reset/import.
5. ARQ-08: clamp/validación de `onboardingDraft.step`.

### Fase 2 — Coste de escritura (1–2 días)

1. Persistir compacto y solo si cambia `document`.
2. Debounce + flush en `pagehide`/`visibilitychange`.
3. Sacar `view`/`toast`/`history` del `persist`.
4. ARQ-06: refresco al volver a foco y a medianoche.

### Fase 3 — Consolidación (3–5 días)

1. `commitDocument` y slices del store.
2. Registro `VIEWS` + `resolveView` único.
3. `ResetDataDialog`, `weeklyGoalRows`, `FormAlert`, `TextField`, `EffortPicker`, `EmptyState`.
4. `NODE_META` y leyenda completa.
5. Limpieza de CSS muerto y `--font-body`.
6. Actualizar `ARCHITECTURE.md`, `AGENTS.md`, `SPEC.md` y `README.md`.

### Fase 4 — Escala (cuando el roadmap la pida)

1. ADR de historial y almacenamiento async.
2. i18n: códigos de error en dominio, copy en UI.
3. Inyección del catálogo de loot y de la validación de setup en dominio.

### Lo que no recomiendo

- Reescribir el dominio o cambiar de store: el núcleo funciona y está probado.
- Introducir router, zod o una librería de estado: no resuelven los riesgos actuales.
- Fusionar todas las capas CSS: los overrides de accesibilidad y responsive son deliberados; solo hay que borrar lo muerto.

---

## 7. ADRs propuestos

| ADR | Decisión |
|---|---|
| **ADR-001 · Contrato de almacenamiento** | Documento versionado con `revision`/`updatedAt`, hidratación async y política de conflicto multi-pestaña |
| **ADR-002 · Historial de runs** | Run actual en el documento; resúmenes históricos en claves separadas/IndexedDB; evento de cierre auditable |
| **ADR-003 · Frontera de importación** | “Schema válido” no equivale a “partida jugable”: validar contenido, nodo actual, derivados y límites antes de reemplazar |
| **ADR-004 · Navegación** | Registro único de vistas con pantalla, tab, título y guarda; `View` fuera del dominio |
| **ADR-005 · Registro de contenido** | `NODE_META` y catálogo inyectable; dominio sin imports de `content/` |
| **ADR-006 · Baseline de tipos** | `strict` obligatorio en `domain/`, `state/` y `ui/lib`; E2E y configuración dentro del typecheck |
| **ADR-007 · Política de escritura** | Compacto en storage, sangría solo para exportar, escritura por cambio de documento y debounce |

---

## 8. Anexo — Evidencia y límites del estudio

### Comandos ejecutados por el agente principal

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm audit --prod
git log --oneline -15
```

### Comprobaciones estáticas destacadas

- `grep` de `Date.now`/`Math.random`/`localStorage`/React en `src/domain`: sin resultados.
- Imports `state`/`ui` desde `domain`/`content`: 0.
- Ciclos de archivo: 0 (Tarjan sobre el grafo de imports).
- `addEventListener('storage')`/`BroadcastChannel`/`navigator.locks`: 0.
- `dangerouslySetInnerHTML`/`innerHTML`/`eval`/`new Function`: 0 en `src/`.
- `tsconfig*.json`: sin `strict`.
- CSS: 39 selectores exactos duplicados; 79 clases compartidas.

### Lo que no se verificó

- **E2E omitido por petición**; no se ejecutó `pnpm test:e2e` ni se validó el service worker en un navegador real.
- **No se reprodujo la pérdida multi-pestaña** con dos contextos de navegador; el hallazgo se basa en el flujo de `persist` y la ausencia de sincronización.
- **No se midió el coste real de `localStorage.setItem` en Safari/Android**; las cifras de serialización son de Node y del tamaño del documento.
- **No se calculó coverage** porque el proyecto no tiene `@vitest/coverage-*` ni script.
- **No se auditó el despliegue real** (no hay configuración de hosting en el repo); los riesgos de CSP/PWA son condicionales.
- **No se ejecutaron PoCs** de import ni se tocaron datos de usuario.

---

*Informe generado el 2026-10-23 sobre `3027771`. Las referencias `archivo:línea` corresponden a ese commit y pueden desplazarse con cambios posteriores.*
