# Plan 07 — Production deployment to GCP Cloud Run

## Context

After Plans 01–06, the app builds, packages into a single Docker image (frontend served as static files by the Express/Socket.io backend), reads its config from env vars, has CORS controls, reconnect logic, URL-shareable rooms, and a validated game engine. It still runs only on `localhost`.

The user has a GCP business subscription and wants a public deployment. The single hard architectural constraint that shapes every decision in this plan is:

> **All game state is in-memory in `RoomManager`.** Restarting a container drops every active hand. Splitting traffic across multiple instances means Socket.io clients land on different machines and lose their game.

Cloud Run is the right service: it runs container images, supports WebSockets natively, terminates HTTPS with a managed certificate, scales horizontally if/when we externalize state, and has a generous free tier. The constraint above means we deploy a **pinned single instance** — `min=1, max=1` — and document the upgrade path to multi-instance (Socket.io Redis adapter + externalized rooms) as future work.

**Depends on:** Plans 01 (build), 03 (Dockerfile + env config), and ideally 06 (URL routing — so refresh-after-deploy actually works).

## Goal

`./scripts/deploy.sh` produces a running Cloud Run service at `https://openpoker-<hash>-uc.a.run.app` (or a custom domain) that:

1. Serves the React app over HTTPS.
2. Accepts Socket.io WebSocket connections at the same origin.
3. Reads config (port, CORS allow-list) from Cloud Run env vars.
4. Survives an instance restart cleanly (state loss is acceptable; no crash loops).
5. Streams structured logs to Cloud Logging and exposes a health endpoint.

Two clients on different networks can join the same room URL and play a hand end-to-end.

## Architecture decisions

| Decision | Choice | Reason |
|---|---|---|
| Compute | Cloud Run (managed) | Native WebSocket support, scale-to-N, zero ops |
| Region | `us-central1` | Free-tier favorable, low latency for North American users |
| Image registry | Artifact Registry (`us-central1-docker.pkg.dev`) | Container Registry is deprecated |
| Instances | `--min-instances=1 --max-instances=1` | In-memory state cannot survive horizontal scaling |
| Session affinity | `--session-affinity` enabled | No-op at max=1, but keeps the door open for max>1 later |
| HTTPS | Managed certificate on `*.run.app` | Free, automatic |
| Secrets | Env vars only (no secrets needed yet) | Avoid Secret Manager complexity until justified |
| CI/CD | Manual `deploy.sh` initially; GitHub Actions optional | Keep the first deploy simple |

## Tasks

### A. One-time GCP project setup

Run these as the user (interactive `gcloud auth login` required first):

```bash
# Pick or create a project
gcloud config set project $PROJECT_ID

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com

# Set default region
gcloud config set run/region us-central1
gcloud config set artifacts/location us-central1

# Create the Artifact Registry repo
gcloud artifacts repositories create openpoker \
  --repository-format=docker \
  --location=us-central1 \
  --description="OpenPoker container images"

# Configure local docker to push to Artifact Registry
gcloud auth configure-docker us-central1-docker.pkg.dev
```

These steps are one-time per project. Document them in `README.md` under "First-time GCP setup". Do not script them — they're interactive and the user should review each step.

### B. Make the server Cloud Run-friendly

Cloud Run injects `PORT` and expects the container to listen on `0.0.0.0`. Plan 03 already reads `PORT` from env, but verify two things in `src/server.ts`:

1. `app.listen(PORT, '0.0.0.0', ...)` — explicit host bind. Default Express bind is fine, but make it explicit so behavior on Cloud Run is unambiguous.
2. Add a lightweight health endpoint **before** any auth/CORS middleware:

   ```ts
   app.get('/healthz', (_req, res) => res.status(200).json({ ok: true, uptime: process.uptime() }));
   ```

   Cloud Run uses TCP startup probes by default; `/healthz` is for our own uptime checks (Task H) and for ad-hoc curl debugging.

3. Trust the proxy so `req.ip` and `req.protocol` reflect the original client (Cloud Run terminates HTTPS upstream):

   ```ts
   app.set('trust proxy', true);
   ```

### C. Same-origin Socket.io URL

Plan 03 made the Socket.io URL env-driven (`VITE_API_URL`). On Cloud Run, frontend and backend ship in one container at the same origin, so the client should connect to **the page's own origin** with no separate URL configured.

In `frontend/src/hooks/useSocket.ts` (or wherever the socket is constructed after the Plan 06 split):

```ts
const SOCKET_URL = import.meta.env.VITE_API_URL || window.location.origin;
```

Behavior:
- **Dev**: `VITE_API_URL=http://localhost:3001` (set in `frontend/.env.development` or `.env.example`) so Vite at `:5173` talks to the backend at `:3001`.
- **Prod**: `VITE_API_URL` is unset at build time → client connects to whatever origin served the page.

Build the frontend with no `VITE_API_URL` for the prod image. Update `Dockerfile`'s `frontend-builder` stage to either omit the var or pass `VITE_API_URL=` explicitly.

### D. CORS for the deployed origin

Plan 03 added `CORS_ORIGIN` as a comma-separated allow-list. For the same-origin prod deploy, CORS preflight isn't actually triggered (no cross-origin request), but Socket.io still validates the `Origin` header against its `cors` config. Two safe options:

1. **Recommended**: deploy first to learn the autogenerated `*.run.app` URL, then update `CORS_ORIGIN` and redeploy. `deploy.sh` (Task F) handles this in one run.
2. **Alternative**: in `src/server.ts`, when `CORS_ORIGIN` is unset, allow same-origin only. Adds a small bit of code but eliminates the two-pass dance. Keep this as a fallback if the Task F flow proves annoying.

Go with option 1 first. Revisit if it gets in the way.

### E. Build for `linux/amd64`

Cloud Run runs `linux/amd64`. If the user is on Apple Silicon (likely — `darwin` arm64 in this environment), `docker build` produces an arm64 image by default, which Cloud Run will reject at startup.

Two options:

1. **Local cross-build**: `docker buildx build --platform linux/amd64 -t ... .` — requires `buildx` (default on recent Docker Desktop).
2. **Cloud Build**: `gcloud builds submit --tag us-central1-docker.pkg.dev/$PROJECT/openpoker/server:$TAG .` — builds in GCP, no local Docker needed, slightly slower per build but always correct architecture.

Default `deploy.sh` to Cloud Build (option 2) — fewer foot-guns. Document option 1 as a faster local alternative.

### F. Deploy script

Create `scripts/deploy.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project)}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-openpoker}"
REPO="${REPO:-openpoker}"
TAG="${TAG:-$(git rev-parse --short HEAD)}"

IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/server:${TAG}"

echo "Building & pushing ${IMAGE}…"
gcloud builds submit --tag "${IMAGE}" .

echo "Deploying to Cloud Run…"
gcloud run deploy "${SERVICE}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --port 3001 \
  --min-instances 1 \
  --max-instances 1 \
  --cpu 1 \
  --memory 512Mi \
  --concurrency 80 \
  --timeout 3600 \
  --session-affinity

URL="$(gcloud run services describe "${SERVICE}" --region "${REGION}" --format='value(status.url)')"
echo "Service URL: ${URL}"

echo "Updating CORS_ORIGIN to match service URL…"
gcloud run services update "${SERVICE}" \
  --region "${REGION}" \
  --update-env-vars "CORS_ORIGIN=${URL}"

echo "Done. Open ${URL}"
```

Notes on the flag choices:

- `--port 3001` matches what the app already listens on; Cloud Run also injects `PORT`, so the server uses whichever the env says. Either works.
- `--timeout 3600` (60 min) is the WebSocket request timeout. After 60 min the connection is closed and Socket.io reconnects (Plan 06 handles this).
- `--concurrency 80` is the per-instance request cap. Each WebSocket counts as one in-flight request. 80 is plenty for a poker table; raise if multiple concurrent rooms strain it. Don't lower below ~10 — the static asset requests on first load also count.
- `--cpu 1 --memory 512Mi` is small and cheap. Bump if Node hits memory pressure (game state is tiny; this is fine).
- `--allow-unauthenticated` is required for public traffic. The app has no auth model anyway.

`chmod +x scripts/deploy.sh` and add a `package.json` script: `"deploy": "./scripts/deploy.sh"`.

### G. .gcloudignore

Add `.gcloudignore` at repo root so `gcloud builds submit` doesn't upload `node_modules`, `.git`, `dist/`, etc. Mirror `.dockerignore` plus `.git/`:

```
node_modules
**/node_modules
dist
**/dist
.git
.gitignore
.env*
errors.txt
plans
```

### H. Observability

Cloud Logging is automatic — `console.log` from the container appears in the Cloud Run logs UI immediately. Two small additions:

1. **Uptime check**: `gcloud monitoring uptime create http openpoker-uptime --resource-type=uptime-url --resource-labels=host=<service-host>,project_id=$PROJECT --path=/healthz`. Cloud Console UI is easier than the CLI here; document the click-path in README.
2. **Alert on container restarts**: a log-based alert that fires when the Cloud Run service emits a "container exited" event. Restarts wipe game state, so this is the one thing the user actually wants paged on.

Skip metrics/tracing infrastructure (OpenTelemetry, etc.) — out of scope for v1.

### I. Document everything

Add a "Deploying to GCP" section to `README.md`:

- Prerequisites: `gcloud` CLI, GCP project with billing enabled.
- One-time setup commands from Task A.
- Standard deploy: `npm run deploy`.
- How to roll back: `gcloud run services update-traffic openpoker --to-revisions=<previous-revision>=100`.
- How to view logs: `gcloud run services logs read openpoker --region=us-central1 --limit=100`.
- Cost estimate: with `min-instances=1`, expect ~$5–$10/month idle. Mention Cloud Run pricing page.

Update `CLAUDE.md`:

- New "Deployment" section noting the single-instance constraint and where the deploy script lives.
- Update the "Gotchas" entry that says the Socket.io URL is hardcoded — it isn't anymore after Plan 03 + this plan.
- Note that `min-instances=1, max-instances=1` is intentional and tied to in-memory state. Anyone wanting to bump `max-instances` must first introduce a Socket.io Redis adapter and externalize `RoomManager`.

### J. Optional: GitHub Actions auto-deploy

If the user wants push-to-deploy, add `.github/workflows/deploy.yml`:

- Trigger on push to `master` (or a `release` branch).
- Auth via Workload Identity Federation (no long-lived JSON keys). The user creates a WIF pool + provider in GCP and stores `WIF_PROVIDER` and `WIF_SERVICE_ACCOUNT` as GitHub secrets.
- Steps: checkout → `google-github-actions/auth@v2` → `gcloud builds submit` → `gcloud run deploy`.

This is **optional**. Don't gate the plan on it. Mark explicitly as "Stage J — only if requested." The user may prefer manual control over deploys for now.

## Critical files

- `src/server.ts` — `0.0.0.0` bind, `/healthz`, `trust proxy`
- `frontend/src/hooks/useSocket.ts` — default to `window.location.origin`
- `Dockerfile` — pass empty `VITE_API_URL` to the frontend builder
- `scripts/deploy.sh` (new)
- `.gcloudignore` (new)
- `package.json` — `"deploy"` script
- `README.md` — deploy section
- `CLAUDE.md` — deployment + single-instance notes
- `.github/workflows/deploy.yml` (optional, Task J)

## Verification

Manual end-to-end:

1. Run `npm run deploy`. Final output prints a `*.run.app` URL.
2. `curl https://<service>.run.app/healthz` returns `{"ok":true,...}`.
3. Open the URL in a browser. React app loads. DevTools Network tab shows a `101 Switching Protocols` for `/socket.io/?EIO=4&transport=websocket`.
4. From a second device on a different network (or a phone on cellular), open the same URL with `?room=ABCD`. Both clients see each other in the lobby.
5. Play a complete hand to showdown. Hole cards are private to each client; community cards match.
6. In Cloud Console, kill the running revision (deploy a no-op revision or use `gcloud run services update`). Both clients show the "Reconnecting" banner from Plan 06; the new revision boots; clients reconnect — game state is **expected to be lost** (in-memory). Verify no crash loop, no error spam.
7. `gcloud run services logs read openpoker --limit=20` shows recent connect/disconnect events with no stack traces.

Cost sanity check:

- After 24 hours, check the Cloud Run billing report. Expect <$0.50/day with `min-instances=1`. If higher, investigate (likely a cold-start storm or runaway logs).

## Out of scope (future work)

- **Multi-instance scaling.** Requires Socket.io Redis adapter and an externalized `RoomManager`. New plan when there's actual demand.
- **Persistence.** State is still in-memory. A Cloud SQL or Firestore-backed `RoomManager` is its own plan.
- **Custom domain.** `gcloud run domain-mappings create --service=openpoker --domain=...` is straightforward but needs a domain the user owns and DNS verification. Document briefly in README; defer the actual mapping to when the user has a domain in mind.
- **CDN in front of static assets.** Cloud Run already does HTTP/2 and gzip; a Cloud CDN layer is unnecessary at this scale.
- **Per-PR preview environments.** Possible with Cloud Run revisions + traffic tags, but premature.
