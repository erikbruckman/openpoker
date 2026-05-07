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

## Deploying to GCP (Cloud Run)

### Prerequisites

- [`gcloud` CLI](https://cloud.google.com/sdk/docs/install) installed and authenticated (`gcloud auth login`)
- A GCP project with billing enabled

### First-time GCP setup

Run once per project (interactive — review each step):

```bash
# Set your project
gcloud config set project YOUR_PROJECT_ID

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

# Authorize Docker to push to Artifact Registry
gcloud auth configure-docker us-central1-docker.pkg.dev
```

### Standard deploy

```bash
npm run deploy
```

This builds the image via Cloud Build (always `linux/amd64`), deploys to Cloud Run, and updates `CORS_ORIGIN` to match the assigned URL. The final line prints the service URL.

Override defaults with env vars:

```bash
PROJECT_ID=my-project REGION=us-east1 npm run deploy
```

### Rollback

```bash
# List revisions
gcloud run revisions list --service=openpoker --region=us-central1

# Send 100% of traffic to a previous revision
gcloud run services update-traffic openpoker \
  --region=us-central1 \
  --to-revisions=REVISION_NAME=100
```

### View logs

```bash
gcloud run services logs read openpoker --region=us-central1 --limit=100
```

### Health check

```bash
curl https://YOUR_SERVICE_URL/healthz
# {"ok":true,"uptime":42.3}
```

### Uptime monitoring

In Cloud Console → Monitoring → Uptime checks, create an HTTPS check to `YOUR_SERVICE_URL/healthz`. For container-restart alerts (which wipe in-memory game state), create a log-based alert that fires on Cloud Run "container exited" log entries.

### Cost estimate

With `min-instances=1`, expect roughly $5–$10/month idle. See the [Cloud Run pricing page](https://cloud.google.com/run/pricing) for details.

### Local cross-build (faster alternative to Cloud Build)

If you have Docker Desktop with `buildx`, you can build locally for `linux/amd64`:

```bash
TAG=$(git rev-parse --short HEAD)
IMAGE="us-central1-docker.pkg.dev/YOUR_PROJECT/openpoker/server:${TAG}"
docker buildx build --platform linux/amd64 -t "${IMAGE}" --push .
```

Then deploy with `gcloud run deploy openpoker --image="${IMAGE}" ...` (same flags as `deploy.sh`).

### Custom domain (Cloudflare + Cloud Run)

If you have a domain (e.g., `openholdem.net`), you can map it to your Cloud Run service with DDoS protection via Cloudflare.

#### Step 1: Set up Cloudflare (one-time)

1. Create a free [Cloudflare](https://cloudflare.com) account
2. Add your domain: click "Add site" and enter `openholdem.net`
3. Cloudflare will scan your current DNS records. Review and continue.
4. Update your domain registrar's nameservers to Cloudflare's:
   - Cloudflare shows you two nameservers (e.g., `alma.ns.cloudflare.com`, `blake.ns.cloudflare.com`)
   - Log into your registrar (Squarespace, Namecheap, etc.)
   - Replace the nameservers with Cloudflare's
   - Wait 5–10 minutes for propagation
5. In Cloudflare dashboard, verify the domain is active (status should show "Active nameserver")

#### Step 2: Create the Cloud Run domain mapping

```bash
gcloud run domain-mappings create \
  --service=openpoker \
  --domain=openholdem.net \
  --region=us-central1
```

This returns a Cloud Run-managed certificate and a DNS target (e.g., `ghs.googlehosted.com`).

#### Step 3: Add DNS record in Cloudflare

1. In Cloudflare dashboard, go to DNS → Records
2. Add a `CNAME` record:
   - **Name**: `openholdem.net` (or `@` for the root domain)
   - **Target**: the DNS target from Step 2 (e.g., `ghs.googlehosted.com`)
   - **Proxy status**: "Proxied" (orange cloud) — this routes traffic through Cloudflare for DDoS protection
3. Save

#### Step 4: Verify and deploy

```bash
# Verify the domain is ready
curl https://openholdem.net/healthz

# Deploy with the new domain
npm run deploy
```

The deploy script will auto-update `CORS_ORIGIN` to include `https://openholdem.net`.

#### Optional: Cloudflare SSL/TLS settings

In Cloudflare dashboard → SSL/TLS:
- **Encryption mode**: set to "Full (strict)" — Cloudflare encrypts to Cloud Run's managed certificate
- **Always use HTTPS**: toggle on (auto-redirect HTTP → HTTPS)

#### Cost

- Cloudflare free tier: includes DDoS protection, DNS, SSL
- Cloud Run domain mapping: free
- Custom domain at registrar: ~$10–15/year

You're now running `https://openholdem.net` with DDoS protection in front of your Cloud Run service.

### Scaling beyond one instance

The app holds all game state in-memory. Running more than one instance splits Socket.io clients across machines, breaking in-progress hands. To scale horizontally, a Socket.io Redis adapter and an externalized `RoomManager` are required — see CLAUDE.md for details.

## Architecture

See [CLAUDE.md](./CLAUDE.md) for a full breakdown of the architecture, file structure, and Socket.io protocol.
