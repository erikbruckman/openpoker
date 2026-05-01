# OpenPoker — Remediation Plans

Six self-contained plans that together address the architectural and structural issues found in the early-stage codebase. Each plan is sized for a single focused agent run and lists its own context, goal, tasks, critical files, and verification steps.

## Dependency order

```
01 (build) ─┬─→ 02 (hygiene)
            ├─→ 03 (deploy)        all three can proceed in parallel after 01
            └─→ 04 (correctness) ──→ 05 (refactor)
                              ↘─→ 06 (frontend)   06 can also start after 01
```

Plan 01 is a hard prerequisite for every other plan — nothing else builds cleanly until it lands.

## Plans

| # | Plan | Scope |
|---|------|-------|
| 01 | [Fix the broken build](./01-fix-build.md) | Resolve TS module-system conflict; fix ~58 null-safety bugs in `Game.ts`/`Deck.ts`/`HandEvaluator.ts`. |
| 02 | [Project hygiene](./02-project-hygiene.md) | `.gitignore`, delete `errors.txt`, dedupe TS versions, refresh README, drop dead re-exports & Vite boilerplate. |
| 03 | [Deployment & env config](./03-deployment-and-env-config.md) | Frontend env-driven Socket.io URL, three-stage Dockerfile, CORS allow-list, `.env.example`. |
| 04 | [Game logic correctness & validation](./04-game-logic-correctness.md) | All-in / side-pot logic, pot-remainder fix, SocketController input validation, lock down playerId reconnect. |
| 05 | [Backend architecture refactor](./05-backend-architecture-refactor.md) | Split `Game.ts`, encapsulate state, dependency-inject `RoomManager`, expand tests. |
| 06 | [Frontend reliability & UX](./06-frontend-reliability-and-ux.md) | Reconnect logic, error UX, hook split, URL routing, styling consolidation. |

## Out of scope (future work)

- Persistence — still in-memory by design.
- Production observability (logging, metrics, tracing).
- CI/CD pipeline (no `.github/workflows`).
- Frontend test infrastructure.
