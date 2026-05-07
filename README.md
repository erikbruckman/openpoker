# openpoker

Real-time multiplayer Texas Hold 'Em poker engine. Players join rooms by code, and the game runs entirely in-memory — no database required.

## Prerequisites

- Node.js 20+

## Running in development

Both servers must run simultaneously:

```bash
# Backend (port 3001)
npm install
npm run dev

# Frontend (port 5173) — in a separate terminal
cd frontend && npm install
cd frontend && npm run dev
```

Open `http://localhost:5173` in your browser.

## Running tests

```bash
npm test
```

## Docker

Build and run the full stack (backend + frontend) in a single image:

```bash
docker build -t openpoker .
docker run -p 3001:3001 openpoker
```

Open `http://localhost:3001` in your browser.

## Deploying

### Environment variables

**Backend** (set at `docker run` time or in your hosting platform):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Port the server listens on |
| `CORS_ORIGIN` | `*` | Comma-separated list of allowed origins (e.g. `https://example.com`) |

**Frontend** (set at `docker build` time via `--build-arg`):

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:3001` | URL the browser connects to for Socket.io |

### Sample deploy

```bash
# Build with a custom API URL baked into the frontend
docker build \
  --build-arg VITE_API_URL=https://poker.example.com \
  -t openpoker .

# Run with CORS restricted to that origin
docker run -p 3001:3001 \
  -e CORS_ORIGIN=https://poker.example.com \
  openpoker
```

For local development without Docker, copy the example env files:

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

## Architecture

See [CLAUDE.md](./CLAUDE.md) for a full breakdown of the architecture, file structure, and Socket.io protocol.
