# LifeSpire — MVP-0

LifeSpire convierte tus metas y rutinas en un mapa diario de nodos: cada día
eliges un camino, cada nodo es una acción real (tarea, descanso, tesoro o el jefe
del día) y cada run dura 7 días. Es una web local-first, instalable como PWA y
funcional sin conexión después de la primera carga.

Este repositorio contiene **MVP-0**, una porción vertical para validar el bucle
central. No hay cuentas, backend, sincronización ni despliegue público.

- Especificación funcional: [`SPEC.md`](./SPEC.md)
- Diseño aceptado: [`design/`](./design) · [`DESIGN.md`](./design/DESIGN.md)
- Arquitectura y contratos: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- Guía para agentes: [`AGENTS.md`](./AGENTS.md)

## Rama

El desarrollo de MVP-0 vive en la rama `mvp-0`. `main` pertenece a otra línea del
proyecto y no debe modificarse.

```bash
git checkout mvp-0
```

## Requisitos

- Node 24 (ver `.nvmrc`)
- pnpm 11 (ver `packageManager` en `package.json`)

## Comandos

```bash
pnpm install --frozen-lockfile
pnpm dev        # servidor de desarrollo
pnpm lint       # oxlint
pnpm typecheck  # TypeScript
pnpm test       # Vitest
pnpm build      # typecheck + build de producción
pnpm preview    # sirve el build (probar PWA/offline)
```

## Alcance de MVP-0

Incluye onboarding con datos demo o propios, 1–3 metas con sus rutinas, runs de
7 días, mapas deterministas de 4 capas + jefe, recompensas inmediatas (XP, oro y
loot), progreso semanal, resúmenes de día y de run, nueva run conservando el
perfil, persistencia local con export/import y panel de desarrollo.

Fuera de alcance: cuentas, backend, notificaciones, combate, cartas, tienda,
recompensas con efectos, integraciones, verificación automática, social y apps
nativas.

## Persistencia

Todo el estado de juego se guarda en una única clave de `localStorage`
(`lifespire:mvp0`), con esquema versionado. Ajustes → exportar/importar permite
crear una copia JSON o restaurarla. El panel de desarrollo solo existe en
`pnpm dev`.
