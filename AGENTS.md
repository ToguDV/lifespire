# LifeSpire — guía para agentes

## Fuentes de verdad

- **Producto y reglas:** [`SPEC.md`](./SPEC.md) define el alcance, las reglas
  del juego, las recompensas, las pantallas y los criterios de aceptación. Cualquier
  decisión funcional debe poder rastrearse hasta ese documento (o a un issue de GitHub).
- **Flujo de trabajo:** [`WORKFLOW.md`](./WORKFLOW.md) fija el formato de commits,
  el contenido de los PR, el requisito de TDD y la limpieza obligatoria al
  finalizar una sesión. Es vinculante para agentes y personas.
- **Diseño visual:** [`design/`](./design) es la propuesta **aceptada** y la referencia
  visual vinculante. En concreto:
  - [`design/DESIGN.md`](./design/DESIGN.md): sistema de diseño (color, tipografía,
    espaciado, componentes y reglas responsive).
  - [`design/assets/tokens.css`](./design/assets/tokens.css): tokens canónicos.
  - [`design/assets/app.css`](./design/assets/app.css): estilos del prototipo.
  - [`design/app.html`](./design/app.html): prototipo interactivo con las siete
    pantallas y sus estados.
  - [`design/captures/`](./design/captures): capturas reales del app (mapa en
    tema claro/oscuro, desktop y mobile).
  - [`design/assets/fonts/`](./design/assets/fonts): Alegreya y Alegreya Sans
    (SIL OFL 1.1), autoalojadas.

No se debe inventar una dirección visual paralela, ni sustituir los tokens por
valores sueltos. Al implementar una pantalla, se reutilizan los tokens, clases,
componentes y jerarquías de `design/`. Las diferencias necesarias se documentan en
`docs/ARCHITECTURE.md` o en una nota de diseño.

La inspiración en *Slay the Spire* es exclusivamente mecánica: no se reutilizan
nombres, arte, layouts ni contenido del juego original.

## Rama y alcance

- `main` es la línea principal de desarrollo y releases.
- Al iniciar una sesión, crea una rama propia (`feat/...`, `fix/...`, `docs/...`,
  `test/...`, `ci/...`) y abre un PR. Una rama por sesión; no reutilices ramas
  entre sesiones. El usuario revisa y aprueba el merge. Detalle en
  [`WORKFLOW.md`](./WORKFLOW.md).
- No reescribas el historial de `main` ni hagas force-push.
- No hay backend, cuentas ni sincronización en el alcance actual.

## Arquitectura

La estructura de módulos, los contratos de tipos y las decisiones de persistencia
están en [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md). Leerlo antes de tocar
dominio, estado o navegación.

## Comandos

```bash
pnpm install --frozen-lockfile
pnpm dev        # desarrollo
pnpm lint       # oxlint
pnpm typecheck  # tsc -b
pnpm test       # vitest run (unitarios)
pnpm test:e2e   # Playwright E2E (instala navegadores con test:e2e:install)
pnpm build      # typecheck + build de producción
pnpm preview    # servir el build (PWA/offline)
```

## Tests E2E y CI

- Los E2E viven en [`e2e/`](./e2e) y se configuran en
  [`playwright.config.ts`](./playwright.config.ts).
- El workflow [`ci.yml`](./.github/workflows/ci.yml) ejecuta lint, typecheck,
  tests y build siempre; el job `e2e` solo corre si cambian rutas críticas
  (dominio, estado/persistencia, contenido, shell, pantallas, config E2E,
  lockfile) o de forma manual (`workflow_dispatch`).
- No añadas E2E al camino de cada cambio: si tocas una ruta crítica, actualiza
  también `e2e/` para cubrir el comportamiento nuevo.

## Reglas de trabajo

- La lógica de dominio (mapa, recompensas, ciclo de día, cierre de run) debe ser
  pura y testeable, sin `Math.random`, `Date.now` ni imports de UI/store.
- Inyectar la fecha/hora en toda lógica dependiente del calendario.
- Persistencia versionada en `localStorage`; export/import con el mismo esquema.
- Accesibilidad mínima: foco visible, objetivos táctiles de 44 px, contraste
  suficiente, navegación por teclado y respeto a `prefers-reduced-motion`.
- Los cambios deben dejar `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build`
  en verde. Si el cambio toca rutas críticas, añade o actualiza el E2E
  correspondiente y verifica `pnpm test:e2e`.
- **Documentación obligatoria:** cada vez que se agregue, mueva o elimine un
  archivo `.md` (o un documento de referencia), actualiza esta guía
  (`AGENTS.md`) en el mismo cambio, registrándolo en «Fuentes de verdad» o en la
  sección correspondiente. Un documento nuevo sin referencia aquí se considera
  trabajo incompleto.
