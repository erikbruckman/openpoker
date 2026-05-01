# Plan 01 — Fix the broken build

## Context

The build is currently broken with 88 TypeScript errors (see `errors.txt` at repo root before it gets deleted in Plan 02). The errors fall into two categories:

1. **~30 module-system errors** (TS1295, TS1287, TS1484): TypeScript 6.0.x enables `verbatimModuleSyntax` more aggressively, which conflicts with `"type": "commonjs"` in `package.json`. ES `import`/`export` syntax is rejected.
2. **~58 real null-safety errors** (TS2532, TS18048, TS2322, TS2345, TS2488): genuine bugs in `Game.ts`, `Deck.ts`, `HandEvaluator.ts` where the code accesses array indices and assumes the result is defined.

`npm run build` and `cd frontend && npm run build` both fail. `npm test` may still pass because Jest uses ts-jest with looser settings, but the issues are real.

This plan is a hard prerequisite for every other plan — nothing else can land cleanly until the build is green.

## Goal

`npm run build` and `cd frontend && npm run build` both succeed with zero errors. `npm test` still passes.

## Tasks

### A. Resolve the module-system conflict

Two options — pick one:

- **Option 1 (recommended): Switch backend to ESM.** Set `"type": "module"` in root `package.json`. Update root `tsconfig.json`: `"module": "node16"` (or `"nodenext"`), `"moduleResolution": "node16"`. Add `.js` extensions to relative imports (TypeScript will require this under node16 ESM). Update `ts-node` invocation in scripts (`"dev": "node --loader ts-node/esm src/server.ts"` or migrate to `tsx`). This aligns backend and frontend, both ESM.
- **Option 2: Keep CommonJS, disable `verbatimModuleSyntax`.** Add `"verbatimModuleSyntax": false` to root `tsconfig.json` `compilerOptions`. Quicker; keeps backend on CommonJS but diverges from frontend.

Recommend Option 1 — long-term cleaner, keeps the codebase uniform.

### B. Fix null-safety errors

Most errors come from unchecked array index access (e.g., `players[0]` returns `Player | undefined` under strict mode). Approach:

- Walk through `errors.txt` and fix each TS2532/TS18048/TS2322/TS2345/TS2488 error individually. Patterns:
  - `const x = arr[i]; if (!x) continue;` then use `x` (now narrowed to non-undefined).
  - For invariants that can't be undefined, use `arr[i]!` sparingly (only with a comment explaining why).
- Specific hot spots:
  - `Game.ts:71-72` — `sbPlayer`/`bbPlayer` from `players[idx]` need guards.
  - `Game.ts:144, 158-164, 193, 204-213` — player iteration.
  - `Deck.ts:39` — `cards.pop()` returns `Card | undefined`; `deal()` must handle empty deck (throw or guard).
  - `HandEvaluator.ts` — most errors are in the rank-counting loops; iterations on map values that are typed as possibly undefined.

After fixing, consider enabling `"noUncheckedIndexedAccess": true` in root tsconfig (it's currently `false`) to prevent regressions. **Don't enable it as part of this plan** — that would surface new errors. Note it as a follow-up.

## Critical files

- `package.json` (root)
- `tsconfig.json` (root)
- `src/Game.ts`
- `src/models/Deck.ts`
- `src/utils/HandEvaluator.ts`

## Verification

- `npm run build` exits 0.
- `cd frontend && npm run build` exits 0.
- `npm test` still passes (HandEvaluator.test.ts).
- `npm run dev` starts the server without runtime errors.
- `cd frontend && npm run dev` starts Vite without errors.
