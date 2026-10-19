# ADR-013: Toolchain, repository and license

- **Status:** Accepted
- **Date:** 2026-10-18
- **Related:** [`ARCHITECTURE.md` §13, §14](../../ARCHITECTURE.md), [`AGENTS.md`](../../AGENTS.md), ADR-001

## Context

A monorepo shared by several apps and packages needs one pinned toolchain, otherwise CI, contributors and the two other clients disagree about the Node version, the package manager or the formatting. The project is also public-facing, so licensing and contribution flow are decisions, not defaults.

## Decision

The toolchain is **Node 24 LTS + pnpm 11**, pinned through `packageManager` and corepack. TypeScript runs in **strict mode** everywhere. Linting and formatting are **ESLint 9 (flat config) + Prettier 3**, with shared bases in `packages/config`. Packages are scoped as **`@lifespire/*`**, with the base `tsconfig`, ESLint, Prettier and Vitest configuration in `packages/config`. The **repository is public under the MIT license**, uses **Conventional Commits**, and follows **trunk-based development**: `main` is protected and large changes arrive through pull requests, with **GitHub Actions** running lint, typecheck, tests and builds.

## Consequences

- + One pinned toolchain means CI, local machines and contributors get the same result.
- + Conventional Commits enable generated changelogs and a readable history.
- + An MIT license removes friction for readers and contributors.
- − Trunk-based work on a protected `main` requires discipline: short-lived branches and PR reviews.
- − The version pins must be bumped deliberately across the monorepo, not ad hoc per package.
