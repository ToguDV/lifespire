# LifeSpire — guía para agentes

## Fuentes de verdad

- **Producto y reglas:** [`SPEC.md`](./SPEC.md) define el alcance de MVP-0, las reglas
  del juego, las recompensas, las pantallas y los criterios de aceptación. Cualquier
  decisión funcional debe poder rastrearse hasta ese documento (o a un issue de GitHub).
- **Diseño visual:** [`design/`](./design) es la propuesta **aceptada** y la referencia
  visual vinculante. En concreto:
  - [`design/DESIGN.md`](./design/DESIGN.md): sistema de diseño (color, tipografía,
    espaciado, componentes y reglas responsive).
  - [`design/assets/tokens.css`](./design/assets/tokens.css): tokens canónicos.
  - [`design/assets/app.css`](./design/assets/app.css): estilos del prototipo.
  - [`design/app.html`](./design/app.html): prototipo interactivo con las siete
    pantallas y sus estados.
  - [`design/captures/`](./design/captures): capturas de referencia desktop/mobile.
  - [`design/assets/fonts/`](./design/assets/fonts): Alegreya y Alegreya Sans
    (SIL OFL 1.1), autoalojadas.

No se debe inventar una dirección visual paralela, ni sustituir los tokens por
valores sueltos. Al implementar una pantalla, se reutilizan los tokens, clases,
componentes y jerarquías de `design/`. Las diferencias necesarias se documentan en
`docs/ARCHITECTURE.md` o en una nota de diseño.

La inspiración en *Slay the Spire* es exclusivamente mecánica: no se reutilizan
nombres, arte, layouts ni contenido del juego original.

## Rama y alcance

- El trabajo de MVP-0 vive en la rama `mvp-0`.
- `main` pertenece a otra línea del proyecto y **no debe modificarse**.
- No hay backend, cuentas ni sincronización en MVP-0.

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
pnpm test       # vitest run
pnpm build      # typecheck + build de producción
pnpm preview    # servir el build (PWA/offline)
```

## Reglas de trabajo

- La lógica de dominio (mapa, recompensas, ciclo de día, cierre de run) debe ser
  pura y testeable, sin `Math.random`, `Date.now` ni imports de UI/store.
- Inyectar la fecha/hora en toda lógica dependiente del calendario.
- Persistencia versionada en `localStorage`; export/import con el mismo esquema.
- Accesibilidad mínima: foco visible, objetivos táctiles de 44 px, contraste
  suficiente, navegación por teclado y respeto a `prefers-reduced-motion`.
- Los cambios deben dejar `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build`
  en verde.
