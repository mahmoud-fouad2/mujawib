# MUJAWIB Engineering Modernization

## Current Runtime Baseline

- Node.js: `24.16.0`
- pnpm: `11.22.0`
- TypeScript strict mode is enabled with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- Biome is the formatter/linter authority for repository code style.
- `pnpm check` runs the full safe gate: lint, typecheck, unit tests, contract tests, and a production build.

## Safe Update Policy

Patch/minor upgrades can be applied when `pnpm check` remains green.

Major upgrades are separate migration phases, deliberately deferred (not neglected — see the dependency audit):

- Next `15 -> 16`
- TypeScript `5 -> 7`

These require route-by-route visual QA because the project has a large RTL surface and a custom design-system CSS layer — there is no MUI, Primer, or styled-components in this codebase; layout and theming are hand-written CSS with design tokens.

## Product Bible Structure Direction

- Marketing content lives in `lib/marketing-content.ts` and is consumed by landing sections, side pages, and the console content-control surface.
- Operator Console routes should continue moving toward Product Bible patterns: list/detail/inspector, publish gates, action health, QA review, and clear managed-service workflows.
- Client Portal must remain client-safe: no prompt/model/SIP/API/schema details.

## Next Engineering Phase

1. Move repeated marketing and portal content into typed content records.
2. Add persistence behind the content records when the admin model is ready.
3. Split large CSS files into feature layers only after visual parity is stable.
4. Run a dedicated major-upgrade branch for Next and TypeScript.
