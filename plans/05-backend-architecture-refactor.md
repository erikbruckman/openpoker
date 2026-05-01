# Plan 05 — Backend architecture refactor

## Context

`Game.ts` is 303 lines and owns: dealing, blinds, betting validation, state machine, hand evaluation orchestration, pot distribution, winner determination, and serialization for both public and private state. Not yet a god object, but on its way — and Plan 04 will add side-pot logic, which will push it further.

`RoomManager` is a module-level singleton (`src/RoomManager.ts:1-14`). This makes any test that exercises real game flow share state across runs (CLAUDE.md flags this gotcha). It blocks unit testing.

`Game` and `Player` expose mutable public fields (`public players: Player[] = []`, `public currentBet`). Any caller can bypass the methods and mutate state directly.

**Depends on:** Plan 01 (build) and Plan 04 (correctness — refactoring around incomplete logic is wasted work).

## Goal

`Game.ts` is split into composable pieces. `RoomManager` is injectable. Game state is encapsulated. Test coverage of game flow is in place.

## Tasks

### A. Decompose `Game.ts`

After Plan 04 lands side-pot logic, the seams are clearer. Split into:

- `src/game/Game.ts` — state holder + orchestrator. Owns the state machine and delegates.
- `src/game/Dealing.ts` — pure functions: deal hole cards, deal community, post blinds.
- `src/game/BettingRound.ts` — turn advancement, action validation, round-over detection.
- `src/game/Showdown.ts` — hand evaluation + side-pot distribution (uses `HandEvaluator`).
- `src/game/serialize.ts` — `getPublicState` and `getPrivateState`.

Pure modules where possible — they take state and return new state, no mutation. `Game.ts` retains the mutable state and applies the returned diffs.

### B. Encapsulate state

- Make mutable fields on `Game` and `Player` private. Expose `readonly` getters.
- All state changes go through methods.

### C. Make `RoomManager` injectable

- Remove the module-level singleton. Export the class.
- Instantiate in `src/server.ts` and pass into `SocketController`'s constructor.
- Tests can `new RoomManager()` per test.

### D. Tests

Expand `src/__tests__/Game.test.ts` with structural tests now possible:

- Run a full hand by feeding actions in sequence; assert state transitions and chip totals.
- Test `RoomManager` create/join/leave/destroy in isolation (no module-cache hacks needed).

### E. Update `CLAUDE.md`

The architecture section needs updating: new file layout, no more singleton gotcha, encapsulated state.

## Critical files

- `src/Game.ts` → split into `src/game/*.ts`
- `src/RoomManager.ts`
- `src/server.ts`
- `src/controllers/SocketController.ts`
- `src/models/Player.ts`
- `src/__tests__/*.test.ts`
- `CLAUDE.md`

## Verification

- `npm test` passes with substantially more coverage.
- `npm run build` and `npm run dev` still work.
- Two-client manual playthrough still works end-to-end.
- No module-level singleton remains in `RoomManager.ts`.
