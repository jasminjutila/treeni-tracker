#!/bin/bash
# Treeni-tracker deploy: Cloud Run (illusian-pitch-processor)
set -euo pipefail
cd "$(dirname "$0")"

PROJECT=illusian-pitch-processor
REGION=europe-north1
SERVICE=treeni-tracker

source .env  # APP_TOKEN

if [ -z "${APP_TOKEN:-}" ]; then
  echo "VIRHE: APP_TOKEN puuttuu .env-tiedostosta." >&2
  exit 1
fi

echo "==> Otetaan tarvittavat APIt käyttöön..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  firestore.googleapis.com --project=$PROJECT

echo "==> Deploy Cloud Runiin (buildaus pilvessä)..."
gcloud run deploy $SERVICE \
  --source=. \
  --project=$PROJECT \
  --region=$REGION \
  --allow-unauthenticated \
  --memory=256Mi \
  --min-instances=0 \
  --max-instances=2 \
  --set-env-vars="APP_TOKEN=$APP_TOKEN"

URL=$(gcloud run services describe $SERVICE --project=$PROJECT --region=$REGION --format='value(status.url)')
echo ""
echo "✅ Valmis! Sovellus: $URL/$APP_TOKEN/"
