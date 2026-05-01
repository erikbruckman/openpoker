# Plan 06 — Frontend reliability & UX

## Context

`frontend/src/hooks/usePokerEngine.ts` is 90 lines today but already mixes connection lifecycle, server state, and action emitters in a single hook. Several real reliability problems:

- **No reconnection logic.** Socket is created once on mount; if the server restarts, the client hangs forever.
- **No error/disconnect UX.** Errors set a string in state; disconnects flip `isConnected` and `hasJoinedRoom` to false. There is no banner, no retry button, no recovery — user must refresh.
- **`setState` inside `useEffect`** at `usePokerEngine.ts:23-35` triggers cascading renders.
- **Stale closures** in `joinRoom`/`startHand`/`takeAction` — they capture `socket` and `roomCode` and have no defensive checks.
- **Type imports duplicated.** Components import `GameState`, `PlayerAction` from `usePokerEngine` instead of `shared/types`. Two import paths for the same type.
- **No URL routing.** Refreshing drops the user back to the join screen — can't share room URLs.
- **Inline styles everywhere.** `PokerTable.tsx` and `PlayingCard.tsx` use inline styles with hardcoded pixel values; styling is scattered across `App.css`, `index.css`, and inline.
- **No input validation** on `JoinScreen` (empty after trim, but no length cap, no charset) or bet input (can be negative).

**Depends on:** Plan 01 (build).

## Goal

The frontend recovers gracefully from disconnects, types come from a single source, room URLs are shareable, and styling is consistent.

## Tasks

### A. Reconnection & error UX

- Configure Socket.io client with `reconnection: true` + reasonable retry settings (already a default; verify and tune).
- Listen for `reconnect_attempt`, `reconnect`, `reconnect_failed`. Surface state: `Connecting | Connected | Reconnecting | Disconnected`.
- On `reconnect`, re-emit `joinRoom` with the stored `playerId` to rejoin automatically.
- Add a top-of-screen banner component for non-connected states with a "Retry" button.
- Add an error toast for server `error` events with auto-dismiss.

### B. Refactor `usePokerEngine`

Split into composable hooks:

- `useSocket(url)` — connection lifecycle, returns `{ socket, status }`.
- `useGameState(socket)` — listens for `gameState`/`privateState`, returns `{ publicState, privateState, error }`.
- `useGameActions(socket, roomCode)` — returns `{ joinRoom, startHand, takeAction }`.

`usePokerEngine` becomes a thin composition, or removed in favor of components composing the three hooks directly.

### C. Single source of truth for types

- Components import `GameState`, `PlayerAction`, `PublicGameState`, etc. directly from `shared/types`.
- Remove the re-exports from `usePokerEngine.ts`.

### D. URL-based routing for rooms

- No need for a routing library; use `window.location.hash` or `history.pushState` with a single `?room=ABCD` query param.
- On mount, if URL has a room code, prefill `JoinScreen`. After joining, set the URL.
- On reconnect, the URL is the source of truth for the room code.

### E. Styling pass

- Pick one approach: CSS Modules (lowest friction with current setup), Tailwind (more refactor), or plain CSS files per component. Document in `CLAUDE.md`.
- Consolidate inline styles from `PokerTable.tsx`, `PlayingCard.tsx`, `JoinScreen.tsx` into the chosen system.
- Define a small set of design tokens (spacing, colors, radii) in CSS custom properties.

### F. Input validation

- `JoinScreen`: validate name length (1–32), room code format (4–8 alphanumerics).
- `PokerTable` bet input: clamp to `[0, player.chips]`, integers only, disable raise button when invalid.
- These are UX guards — server still validates (Plan 04).

### G. Loading & empty states

- Replace generic "Loading table state…" with: spinner during socket connect, "Waiting for other players" when in `GameState.Waiting`, etc.
- Timeout: if connection doesn't establish in 10s, show error banner.

## Critical files

- `frontend/src/hooks/usePokerEngine.ts` → split into `useSocket.ts`, `useGameState.ts`, `useGameActions.ts`
- `frontend/src/components/PokerTable.tsx`
- `frontend/src/components/JoinScreen.tsx`
- `frontend/src/components/PlayingCard.tsx`
- `frontend/src/App.tsx`
- `frontend/src/components/ConnectionBanner.tsx` (new)
- `frontend/src/App.css`, `frontend/src/index.css`
- `shared/types.ts` (unchanged, but components now import from here)

## Verification

- Stop the backend server while the frontend is connected: client shows "Reconnecting" banner; restart server, client auto-rejoins room and game state restores.
- Open `http://localhost:5173/?room=ABCD`, name field is enabled, room field is prefilled. Submit; URL updates if needed.
- Refresh the page mid-hand: client rejoins automatically via URL + stored `playerId`.
- All component imports of game types resolve to `shared/types`.
- Negative bet amounts and oversized names are rejected client-side.
