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

Both the backend (`npm run dev`) and frontend (`cd frontend && npm run dev`) must be running simultaneously in development. The frontend connects to `http://localhost:3001` via `VITE_API_URL` (set automatically by `frontend/.env.development` in dev mode; falls back to `window.location.origin` in production).

---

## Architecture

### Backend (src/)

State machine hosted in `src/game/Game.ts`. Game flow:

```
Waiting → PreFlop → Flop → Turn → River → Showdown → (back to Waiting)
```

**Entry point**: `src/server.ts` — Express + Socket.io, instantiates `RoomManager` and `SocketController`.

**Core files:**
- `src/game/Game.ts` — Orchestrator: holds mutable state, delegates to sub-modules below.
- `src/game/Dealing.ts` — Pure functions: `postBlinds`, `dealHoleCards`, `dealCommunityCards`.
- `src/game/BettingRound.ts` — Pure functions: action validation, turn advancement, round-over detection.
- `src/game/Showdown.ts` — `computeSidePots` and `resolveShowdown` (uses `HandEvaluator`).
- `src/game/serialize.ts` — `serializePublicState` and `serializePrivateState`.
- `src/RoomManager.ts` — Plain class (`new RoomManager()`), not a singleton. `Map<roomCode, Game>`. Instantiated in `server.ts` and injected into `SocketController`.
- `src/controllers/SocketController.ts` — WebSocket event dispatcher. Thin layer: validates, delegates to `RoomManager`/`Game`, emits results. Accepts `RoomManager` via constructor.
- `src/models/Player.ts` — Encapsulated player state. Game-logic fields (`chips`, `currentBet`, `currentAction`, `currentHand`, `contributedThisHand`) are private with readonly getters; infrastructure fields (`socketId`, `isDisconnected`) are public.
- `src/utils/HandEvaluator.ts` — Hand ranking and comparison. Fisher-Yates shuffle lives in `src/models/Deck.ts`.

**State separation**: `Game` exposes `getPublicState()` (broadcast to room) and `getPrivateState(playerId)` (hole cards, sent to individual). Never leak private state to the room broadcast.

**Encapsulation**: All mutable state on `Game` and `Player` is private. Callers use readonly getters and methods — no direct field mutation from outside the class.

### Shared types (shared/)

`shared/types.ts` is the source of truth for all cross-boundary types. Both `src/` and `frontend/src/` import from here. Do not duplicate type definitions elsewhere.

Key types:
- `GameState` enum: `Waiting | PreFlop | Flop | Turn | River | Showdown`
- `PlayerAction` enum: `None | Fold | Check | Call | Raise`
- `PublicGameState` — everything the table can see
- `PrivateGameState` — hole cards only

### Frontend (frontend/src/)

**Entry**: `main.tsx` → `App.tsx` → conditionally renders `JoinScreen` or `PokerTable`.

**Socket.io logic is split across three composable hooks**: `useSocket` (connection lifecycle + status), `useGameState` (server state listeners), `useGameActions` (emitters). `usePokerEngine` composes all three and is the only hook components import.

**Connection status** is a `ConnectionStatus` type (`'connecting' | 'connected' | 'reconnecting' | 'disconnected'`). The `ConnectionBanner` component renders a fixed banner for non-connected states; `ErrorToast` shows server error events with auto-dismiss.

**Auto-rejoin on page refresh**: on mount, `usePokerEngine` reads `?room=` from the URL and `playerName`/`playerId` from `localStorage`. If all three are present, it auto-emits `joinRoom`. On socket reconnect, the `connect` handler re-emits `joinRoom` using the current refs.

**URL routing**: after `joinRoom`, the URL is updated to `?room=<CODE>` via `history.replaceState`. Room code is also stored in localStorage as `playerName` (the name is stored too for auto-rejoin).

**Styling**: CSS Modules (`*.module.css`) per component for component-scoped styles. Global tokens (colors, spacing, radii) are CSS custom properties in `index.css`. Utility classes (`.glass-panel`, `.btn-*`, `.input-field`, `.animate-*`) remain global in `index.css`.

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

`src/utils/HandEvaluator.test.ts` — hand evaluation edge cases.

`src/__tests__/Game.test.ts` — game flow integration tests, `RoomManager` isolation tests, side-pot unit tests (via `resolveShowdown`/`computeSidePots` directly), and input validation.

Run tests: `npm test` (from repo root).

---

## Key Complexity: HandEvaluator

`HandEvaluator.ts` is the trickiest module. It evaluates the best 5-card hand from a 7-card set (2 hole + 5 community). Edge cases:
- Low straight: A-2-3-4-5 (Ace acts as 1)
- Kicker comparison for pairs/two-pair/three-of-a-kind
- Royal Flush vs. regular Straight Flush

When editing hand evaluation logic, run `npm test` after every change.

---

## Deployment

The app is deployed to GCP Cloud Run (`us-central1`) as a single instance. Deploy script: `npm run deploy` (runs `scripts/deploy.sh`).

**Single-instance constraint**: all game state lives in `RoomManager`'s in-memory map. Running `--max-instances` above 1 splits Socket.io clients across machines and breaks active hands. The deploy script explicitly sets `--min-instances=1 --max-instances=1`. To safely scale beyond one instance, add a Socket.io Redis adapter and externalize `RoomManager` to a shared store first.

**Session affinity** (`--session-affinity`) is enabled so any future increase to `max-instances` routes each client consistently to the same instance.

**Health endpoint**: `GET /healthz` returns `{"ok":true,"uptime":<seconds>}`. It is placed before CORS middleware so Cloud Run and monitoring tools can reach it without any auth headers.

**Custom domain**: Map a domain to Cloud Run with `gcloud run domain-mappings create --service=openpoker --domain=openholdem.net --region=us-central1`. For DDoS protection and DNS, use Cloudflare as a reverse proxy — see README for step-by-step setup.

---

## Gotchas

- The Socket.io URL in `usePokerEngine.ts` reads `VITE_API_URL` and falls back to `window.location.origin`. In dev, Vite loads `frontend/.env.development` automatically (`VITE_API_URL=http://localhost:3001`). In the prod Docker image no env var is set, so the client connects to the same origin that served the page.
- `src/models/PlayerAction.ts` is a thin re-export of `PlayerAction` from `shared/types.ts` — this exists for backwards compatibility. Import directly from `shared/types.ts` in new code.
- Vite proxying is not configured. The frontend and backend must run on different ports; CORS is enabled in `src/server.ts` for `*` origins in dev.
- `GameState.Showdown` transitions back to `GameState.Waiting` synchronously (no `setTimeout`) — `scoreHand()` calls `endHand()` inline.
- `src/Game.ts` is a thin re-export shim (`export { Game } from './game/Game'`). Prefer importing from `./game/Game` directly in new code.

---

## Common Tasks

**Add a new Socket.io event**: Define the handler in `SocketController.ts`, add the business logic to `src/game/Game.ts` or `RoomManager.ts`, update shared types if the payload is new.

**Add a new game action**: Add to `PlayerAction` enum in `shared/types.ts`, handle in `BettingRound.applyPlayerAction()` and `Game.handlePlayerAction()`, update `SocketController`, add action button in `PokerTable.tsx`.

**Add a new UI component**: Create in `frontend/src/components/`, import into `PokerTable.tsx` or `App.tsx`. No routing library — conditional rendering only.

**Change game rules** (e.g., blind amounts, starting chips): These live in `src/config/gameConfig.ts`.

---

## Maintaining This File

When you make changes that affect architecture, Socket.io protocol, file structure, or conventions, update this file. Ignore routine refactors, bug fixes, and internal changes — those don't change what an agent needs to know to work here effectively.

The goal is to keep this file high-signal: if a future agent reads it, they should have an accurate mental model of the codebase, not a change log.
