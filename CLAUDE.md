# CLAUDE.md — OpenPoker

Real-time multiplayer Texas Hold 'Em poker engine. Node.js/Express backend with Socket.io, React/Vite frontend. No database — all state is in-memory.

---

## Commands

```bash
# Backend
npm install
npm run dev          # ts-node src/server.ts (port 3001)
npm run build        # tsc → dist/
npm test             # jest (HandEvaluator tests only)

# Frontend (separate process)
cd frontend && npm install
cd frontend && npm run dev   # Vite dev server (port 5173)
cd frontend && npm run build # tsc -b && vite build
cd frontend && npm run lint  # eslint

# Docker (full stack)
docker build -t openpoker .
docker run -p 3001:3001 openpoker
```

Both the backend (`npm run dev`) and frontend (`cd frontend && npm run dev`) must be running simultaneously in development. The frontend talks to `http://localhost:3001` (hardcoded in `frontend/src/hooks/usePokerEngine.ts`).

---

## Architecture

### Backend (src/)

State machine hosted in `Game.ts`. Game flow:

```
Waiting → PreFlop → Flop → Turn → River → Showdown → (back to Waiting)
```

**Entry point**: `src/server.ts` — Express + Socket.io, instantiates `SocketController`.

**Core files:**
- `src/Game.ts` — All game logic: dealing, betting rounds, pot management, winners, state transitions. This is the most complex file.
- `src/RoomManager.ts` — Singleton `Map<roomCode, Game>`. Creates rooms on `joinRoom`, removes them when empty.
- `src/controllers/SocketController.ts` — WebSocket event dispatcher. Thin layer: validates, delegates to `RoomManager`/`Game`, emits results.
- `src/models/Player.ts` — Player state: chips, currentBet, currentAction, isDisconnected, hole cards.
- `src/utils/HandEvaluator.ts` — Hand ranking and comparison. Fisher-Yates shuffle lives in `src/models/Deck.ts`.

**State separation**: `Game` exposes `getPublicState()` (broadcast to room) and `getPrivateState(playerId)` (hole cards, sent to individual). Never leak private state to the room broadcast.

### Shared types (shared/)

`shared/types.ts` is the source of truth for all cross-boundary types. Both `src/` and `frontend/src/` import from here. Do not duplicate type definitions elsewhere.

Key types:
- `GameState` enum: `Waiting | PreFlop | Flop | Turn | River | Showdown`
- `PlayerAction` enum: `None | Fold | Check | Call | Raise`
- `PublicGameState` — everything the table can see
- `PrivateGameState` — hole cards only

### Frontend (frontend/src/)

**Entry**: `main.tsx` → `App.tsx` → conditionally renders `JoinScreen` or `PokerTable`.

**All Socket.io logic is isolated in `hooks/usePokerEngine.ts`**. This hook owns the socket connection, game state, private state, and all emitters. Components receive state and callback props — they do not touch the socket directly.

**Player positioning** in `PokerTable.tsx` uses trigonometry to place players around an oval table with absolute positioning and CSS transforms.

---

## Socket.io Protocol

**Client → Server:**
| Event | Payload |
|-------|---------|
| `joinRoom` | `{playerName, roomCode, playerId?}` |
| `startHand` | `{roomCode}` |
| `playerAction` | `{roomCode, action: PlayerAction, amount?: number}` |

**Server → Client:**
| Event | Audience | Payload |
|-------|----------|---------|
| `roomJoined` | individual | `{playerId}` |
| `gameState` | room broadcast | `PublicGameState` |
| `privateState` | individual | `PrivateGameState` |
| `error` | individual | `string` |

Server emits `gameState` after every state-changing event. Always emit both `gameState` and `privateState` together after dealing cards.

---

## Conventions

- **No database.** State lives only in `RoomManager`'s in-memory map. Rooms are destroyed when the last player disconnects.
- **Player reconnection** uses `playerId` from `localStorage`. On `joinRoom`, if `playerId` matches an existing `player.isDisconnected === true` player, they rejoin without re-creating.
- **Disconnect handling**: if a player disconnects during an active hand, they are auto-folded. If between hands, they are removed from the room.
- **Strict TypeScript** is on for both backend and frontend. Do not use `any` or `@ts-ignore`.
- **No comments** except for non-obvious invariants (e.g., why a specific edge case in hand evaluation exists).
- All shared types live in `shared/types.ts`. Backend `tsconfig.json` and `frontend/tsconfig.app.json` both include `../shared`.

---

## Testing

Only `src/utils/HandEvaluator.ts` has tests (`HandEvaluator.test.ts` co-located). New tests for hand evaluation logic belong in that file.

For new game logic in `Game.ts`, add unit tests in a new file `src/__tests__/Game.test.ts` (Jest will pick it up automatically).

Run tests: `npm test` (from repo root).

---

## Key Complexity: HandEvaluator

`HandEvaluator.ts` is the trickiest module. It evaluates the best 5-card hand from a 7-card set (2 hole + 5 community). Edge cases:
- Low straight: A-2-3-4-5 (Ace acts as 1)
- Kicker comparison for pairs/two-pair/three-of-a-kind
- Royal Flush vs. regular Straight Flush

When editing hand evaluation logic, run `npm test` after every change.

---

## Gotchas

- The frontend Socket.io URL is hardcoded to `http://localhost:3001` in `usePokerEngine.ts:9`. For production or Docker, this must be parameterized via an env variable.
- `RoomManager` is a singleton (module-level instance). Tests that exercise it will share state unless the module cache is cleared.
- `src/models/PlayerAction.ts` is a thin re-export of `PlayerAction` from `shared/types.ts` — this exists for backwards compatibility. Import directly from `shared/types.ts` in new code.
- Vite proxying is not configured. The frontend and backend must run on different ports; CORS is enabled in `src/server.ts` for `*` origins in dev.
- `GameState.Showdown` transitions back to `GameState.Waiting` after the winner is announced — there is a delay (`setTimeout`) in `Game.ts` before the transition. Do not assume the state is synchronously updated.

---

## Common Tasks

**Add a new Socket.io event**: Define the handler in `SocketController.ts`, add the business logic to `Game.ts` or `RoomManager.ts`, update shared types if the payload is new.

**Add a new game action**: Add to `PlayerAction` enum in `shared/types.ts`, handle in `Game.handlePlayerAction()`, update `SocketController`, add action button in `PokerTable.tsx`.

**Add a new UI component**: Create in `frontend/src/components/`, import into `PokerTable.tsx` or `App.tsx`. No routing library — conditional rendering only.

**Change game rules** (e.g., blind amounts, starting chips): These are hardcoded in `Game.ts`. Search for numeric literals there.

---

## Maintaining This File

When you make changes that affect architecture, Socket.io protocol, file structure, or conventions, update this file. Ignore routine refactors, bug fixes, and internal changes — those don't change what an agent needs to know to work here effectively.

The goal is to keep this file high-signal: if a future agent reads it, they should have an accurate mental model of the codebase, not a change log.
