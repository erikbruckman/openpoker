# Plan 04 — Game logic correctness & input validation

## Context

The game engine has known correctness gaps and is loose at the network boundary. Most are surfaced by code comments ("ignoring all-ins for simplicity") or visible from reading `Game.ts` and `SocketController.ts`:

- **All-in / side-pot logic is missing.** `Game.ts:203-208` (`getNextActivePlayerIndex`) and `Game.ts:243-249` (`isBettingRoundOver`) explicitly defer this. A player going all-in below the current bet either hangs the betting round or gets miscounted at showdown.
- **Pot remainder lost.** `Game.ts:174` uses `Math.floor(pot / winners.length)` — odd chips disappear into the void.
- **No input validation in `SocketController`.** `playerName`, `roomCode`, `action`, `amount` are all destructured from the wire and passed to `Game` unchecked. Negative bets, NaN, Infinity, malformed action strings, multi-megabyte player names — all reach game state.
- **`playerId` reconnection is spoofable.** `SocketController.ts:40` trusts the `playerId` from `localStorage` directly. Any client that learns another player's UUID (e.g., from a network log) can hijack their seat.
- **0-chip players get assigned turn.** `getNextActivePlayerIndex` skips folded players but not zero-chip players, so a busted player can be asked to act.
- **Magic numbers.** Blinds (10/20) and starting chips (5000) are scattered as literals across `Game.ts` and `SocketController.ts`.

**Depends on:** Plan 01.

## Goal

The engine handles all-in correctly with side pots, validates all inputs at the socket boundary, gives no remainder chips to the void, binds `playerId` to its socket session, and has tests covering these scenarios.

## Tasks

### A. Side-pot logic

- Track each player's total contribution to the pot per hand (`Player.contributedThisHand`).
- On showdown, compute side pots: sort all-in players by contribution ascending; for each tier, the side pot includes everyone who contributed at least that much. Each pot is awarded to its eligible winners (best hand among contributors).
- Update `Game.ts` distribution loop accordingly.
- Reference: standard side-pot algorithm — search "poker side pot algorithm" if unfamiliar.

### B. Betting-round / turn logic for all-ins

- `isBettingRoundOver()` should treat an all-in player as having "acted" with their final bet. Specifically: betting round is over when every non-folded player has either (a) matched the highest bet, or (b) is all-in.
- `getNextActivePlayerIndex()` skips folded players AND all-in players AND zero-chip players.

### C. Pot remainder

- Distribute `Math.floor(pot / winners.length)` to each winner; assign the remainder to the winner closest to the dealer's left (standard rule), or the first winner in `winners` array if simpler. Document the choice in a one-line comment.

### D. SocketController input validation

Add a small validation helper module (`src/utils/validate.ts`):

- `playerName`: trim, 1–32 chars, charset `[A-Za-z0-9 _-]`.
- `roomCode`: trim, exact 4–8 chars `[A-Z0-9]`.
- `action`: must be one of `PlayerAction` enum values (runtime check, not just type assertion).
- `amount`: `Number.isFinite(amount) && amount >= 0 && Number.isInteger(amount)`.

On invalid input, emit `error` and return — do not proceed to `Game`.

### E. Lock down playerId reconnection

Keep using `playerId` for room-rejoin, but bind it to the socket on first join:

- When a new player joins, generate `playerId` server-side (don't trust client). Send back to client to store.
- On reconnect, the client sends `playerId`. Server checks: does this player exist? Is `player.isDisconnected === true`? If yes, allow reconnect and rebind socket. If `isDisconnected === false`, reject (someone else is currently connected as that player).
- Optional follow-up: signed token instead of bare UUID. Note as future hardening, don't implement here.

### F. Centralize game constants

Create `src/config/gameConfig.ts`:

```ts
export const GAME_CONFIG = {
  smallBlind: 10,
  bigBlind: 20,
  startingChips: 5000,
  minPlayers: 2,
  maxPlayers: 9,
} as const;
```

Replace literals in `Game.ts` and `SocketController.ts`.

### G. Tests

Create `src/__tests__/Game.test.ts` covering:

- A standard 2-player hand: blinds, deal, betting, showdown, winner.
- All-in scenario: short-stack player goes all-in for less than the call; side pot is computed correctly; main pot goes to one winner, side pot to another.
- Pot remainder: 3 winners split 100 chips → 33+33+34, total = 100.
- Invalid inputs: negative amount, NaN, oversized name, unknown action — all rejected at SocketController.
- Reconnect spoofing: rejecting a `playerId` that's currently connected.
- `getNextActivePlayerIndex` with zero-chip and all-in players.

## Critical files

- `src/Game.ts`
- `src/models/Player.ts`
- `src/controllers/SocketController.ts`
- `src/utils/validate.ts` (new)
- `src/config/gameConfig.ts` (new)
- `src/__tests__/Game.test.ts` (new)
- `shared/types.ts` (if `PlayerAction` runtime check needs an iterable list)

## Verification

- `npm test` covers all the new test cases.
- Manual playthrough with two clients confirms all-in works and side pots are awarded.
- Sending malformed payloads from a browser console reaches the server and returns an `error` event without crashing or mutating state.
