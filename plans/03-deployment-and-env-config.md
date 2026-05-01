# Plan 03 — Deployment & environment config

## Context

Two fundamental deployment blockers:

1. **Frontend Socket.io URL is hardcoded** to `http://localhost:3001` at `frontend/src/hooks/usePokerEngine.ts:9`. Any deploy that isn't localhost will fail to connect.
2. **`Dockerfile` only builds the backend.** It runs `tsc` against `src/`, copies `dist/`, and runs `node dist/server.js` — frontend is not built or served. CLAUDE.md claims `docker run -p 3001:3001 openpoker` is "full stack"; that is not true.

Also: backend CORS is `*` in dev with no env-driven allow-list for prod, and there's no `.env.example` documenting any of this.

**Depends on:** Plan 01 (build must work before docker build can succeed).

## Goal

`docker build && docker run` produces a single image that serves the React app and the Socket.io backend together, configurable via env vars, with a CORS allow-list.

## Tasks

### A. Frontend env config

- Update `frontend/src/hooks/usePokerEngine.ts` to read `import.meta.env.VITE_API_URL` (Vite's standard env mechanism), defaulting to `http://localhost:3001` for dev.
- Add `frontend/.env.example` with `VITE_API_URL=http://localhost:3001`.
- Document in README.

### B. Backend env config

- `src/server.ts`: read `PORT` from env, default 3001. Read `CORS_ORIGIN` from env (comma-separated allow-list), default to `*` in dev only.
- Add `.env.example` at repo root with `PORT=3001` and `CORS_ORIGIN=http://localhost:5173`.

### C. Dockerfile: build & serve frontend

Two stages → three stages:

1. **frontend-builder**: `node:20-alpine`, `WORKDIR /build`, copy `frontend/package*.json`, `npm ci`, copy `frontend/`, copy `shared/` (frontend tsconfig references it), `npm run build` → produces `frontend/dist`.
2. **backend-builder**: copy root `package*.json`, `npm ci`, copy `tsconfig.json`, `src/`, `shared/`, `npm run build` → produces `dist/`.
3. **runtime**: `node:20-alpine`, copy backend `dist/` and `node_modules` (production-only), copy `frontend-builder`'s `frontend/dist` to e.g. `public/`. Backend serves static files from `public/` via `express.static`. `EXPOSE 3001`, `CMD ["node", "dist/server.js"]`.

Add `app.use(express.static(...))` to `src/server.ts` (only when `NODE_ENV=production` or always; both fine).

### D. Update `.dockerignore`

Verify it excludes `node_modules/`, `dist/`, `frontend/dist/`, `frontend/node_modules/`, `errors.txt`, `.env*`. Add what's missing.

### E. Document deploy

In README, add a "Deploying" section: how to set env vars, what the Docker image exposes, sample `docker run` command.

## Critical files

- `frontend/src/hooks/usePokerEngine.ts`
- `frontend/.env.example` (new)
- `.env.example` (new, repo root)
- `src/server.ts`
- `Dockerfile`
- `.dockerignore`
- `README.md`

## Verification

- `docker build -t openpoker .` succeeds.
- `docker run -p 3001:3001 -e CORS_ORIGIN=http://localhost:3001 openpoker` serves the React app at `http://localhost:3001/` and accepts Socket.io connections at the same origin.
- Setting `VITE_API_URL` at frontend build time changes the URL the client connects to.
- Frontend dev (`cd frontend && npm run dev`) still works against backend dev (`npm run dev`).
