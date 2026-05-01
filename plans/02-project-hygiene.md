# Plan 02 — Project hygiene

## Context

The repo has accumulated several quality-of-life issues that aren't bugs but pollute the working tree and create confusion:

- No `.gitignore` at the repo root. `dist/`, `node_modules/`, and `errors.txt` are all sitting untracked, one stray `git add -A` away from being committed.
- `errors.txt` is a checked-in dump of build errors from a previous failed run.
- TypeScript versions diverge: root pins `^6.0.3`, frontend pins `~6.0.2`. Two TS versions in one repo will produce diverging diagnostics.
- `@types/node` diverges: `^25.6.0` (root) vs `^24.12.2` (frontend).
- `src/models/PlayerAction.ts` is a one-line backwards-compat re-export, flagged as cruft in `CLAUDE.md` but still present.
- `README.md` is 3 lines. `CLAUDE.md` is the real doc, but new contributors won't see it.
- `frontend/src/App.css` contains leftover Vite-template boilerplate (`.hero`, `.counter`, `#next-steps`).

**Depends on:** Plan 01 (don't try to lint/test a non-building project).

## Goal

Clean working tree, single source of truth for tooling versions, and a README that points at the real docs.

## Tasks

### A. Add `.gitignore` at repo root

```
node_modules/
dist/
*.log
.env
.env.local
.DS_Store
errors.txt
coverage/
.vite/
```

(Frontend's Vite-generated `frontend/.gitignore` already exists; verify and keep.)

### B. Delete leftover artifacts

- Delete `errors.txt`.
- Verify `dist/` is gitignored. (Don't `rm -rf` — just confirm git ignores it.)
- Delete `src/models/PlayerAction.ts` (the backwards-compat re-export). Update any imports (search: `from '.*PlayerAction'`) to import from `shared/types`.

### C. Align dependency versions

- Pin TypeScript to one exact version in both root and frontend `package.json`. Use whatever Plan 01 settled on.
- Align `@types/node` to one major version (24 if pinning to a Node 20 LTS Docker image, 25 if newer).
- Run `npm install` in both root and frontend to refresh `package-lock.json`.

### D. Remove frontend boilerplate

- Strip `.hero`, `.counter`, `#next-steps`, and any other unused Vite template CSS from `frontend/src/App.css`.
- Remove unused `React` import in `frontend/src/App.tsx:1` (JSX automatic runtime makes it unnecessary).

### E. Refresh README

- Replace the 3-line README with: project blurb, prerequisites (Node version), how to run dev (backend + frontend), how to test, link to `CLAUDE.md` for architecture details. Keep it short — README orients, CLAUDE.md instructs.

## Critical files

- `.gitignore` (new, at repo root)
- `package.json` (root + frontend)
- `frontend/src/App.css`
- `frontend/src/App.tsx`
- `README.md`
- `src/models/PlayerAction.ts` (deleted)

## Verification

- `git status` shows no untracked build artifacts (only intentional changes).
- `grep -r "from.*models/PlayerAction" src` finds nothing.
- Both `npm install`s install the same TypeScript version.
- README renders correctly on GitHub (preview or `glow`).
