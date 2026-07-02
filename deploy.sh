#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
REGION="${GCP_REGION:-europe-west1}"
SERVICE="dj-tracklist"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE}"

echo "==> Building image"
docker build -t "${IMAGE}" .

echo "==> Pushing to GCR"
docker push "${IMAGE}"

echo "==> Deploying to Cloud Run"
gcloud run deploy "${SERVICE}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --set-env-vars "ACR_HOST=${ACR_HOST},ACR_ACCESS_KEY=${ACR_ACCESS_KEY},ACR_ACCESS_SECRET=${ACR_ACCESS_SECRET}" \
  --project "${PROJECT_ID}"

echo ""
echo "==> Deployed! Service URL:"
gcloud run services describe "${SERVICE}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --format "value(status.url)"
