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

```bash
docker build -t openpoker .
docker run -p 3001:3001 openpoker
```

## Architecture

See [CLAUDE.md](./CLAUDE.md) for a full breakdown of the architecture, file structure, and Socket.io protocol.
