# @lifespire/config

Shared, runtime-free configuration for every package in the LifeSpire monorepo
(see ADR-013). It exposes four tooling bases through `exports`, so a package
only imports what it needs and never copies rules.

| Export | Resolves to | Use |
| --- | --- | --- |
| `@lifespire/config/tsconfig.base.json` | `tsconfig.base.json` | Strict TypeScript base (`extends` it) for platform-neutral packages (engine, shared-types). |
| `@lifespire/config/tsconfig.react.json` | `tsconfig.react.json` | Extends the base and adds `jsx: react-jsx` plus the DOM libs, for web/desktop. |
| `@lifespire/config/eslint` | `eslint.config.js` | Flat ESLint config: `@eslint/js` + `typescript-eslint` recommended, plus React Hooks / React Refresh on JSX/TSX. |
| `@lifespire/config/prettier` | `prettier.config.js` | Prettier options (2 spaces, single quotes, trailing commas, 100 columns). |
| `@lifespire/config/vitest` | `vitest.base.ts` | Base Vitest config (node environment, globals on) to spread with `mergeConfig`. |

## Usage

```jsonc
// tsconfig.json
{ "extends": "@lifespire/config/tsconfig.base.json", "include": ["src"] }
```

```js
// eslint.config.js
import config from '@lifespire/config/eslint';
export default config;
```

```ts
// vitest.config.ts
import { defineConfig, mergeConfig } from 'vitest/config';
import base from '@lifespire/config/vitest';

export default mergeConfig(base, defineConfig({ test: { name: 'my-package' } }));
```

This package has no runtime dependencies; its dependencies are tooling only.
