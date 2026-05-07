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
