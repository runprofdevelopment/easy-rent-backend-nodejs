#!/usr/bin/env bash

set -euo pipefail

DEPLOY_ENV="${1:-}"

if [[ "${DEPLOY_ENV}" != "staging" && "${DEPLOY_ENV}" != "production" ]]; then
  echo "Usage: $0 <staging|production>"
  exit 1
fi

REGION="${REGION:-us-central1}"
EMAIL_PROVIDER="${EMAIL_PROVIDER:-nodemailer}"
EMAIL_SMTP_HOST="${EMAIL_SMTP_HOST:-smtp.gmail.com}"
EMAIL_SMTP_PORT="${EMAIL_SMTP_PORT:-465}"
EMAIL_SECURE="${EMAIL_SECURE:-true}"
EMAIL_USER="${EMAIL_USER:-mohamedelnemr.runprof@gmail.com}"
EMAIL_FROM="${EMAIL_FROM:-Sayes <mohamedelnemr.runprof@gmail.com>}"

if [[ "${DEPLOY_ENV}" == "staging" ]]; then
  PROJECT_ID="${PROJECT_ID:-easy-rent-staging}"
  SERVICE_NAME="${SERVICE_NAME:-easy-rent-backend-staging}"
  NODE_ENV_VALUE="staging"
  FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID:-easy-rent-staging}"
  PASSWORD_RESET_REDIRECT_URL="${PASSWORD_RESET_REDIRECT_URL:-http://localhost:8080}"
  LOGIN_BASE_URL="${LOGIN_BASE_URL:-https://{databaseId}.example.com/{lang}/login}"
  EMAIL_PASSWORD_SECRET="${EMAIL_PASSWORD_SECRET:-email-password-staging}"
else
  PROJECT_ID="${PROJECT_ID:-easy-rent-244ce}"
  SERVICE_NAME="${SERVICE_NAME:-easy-rent-backend}"
  NODE_ENV_VALUE="production"
  FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID:-easy-rent-244ce}"
  PASSWORD_RESET_REDIRECT_URL="${PASSWORD_RESET_REDIRECT_URL:-https://your-production-domain.com}"
  LOGIN_BASE_URL="${LOGIN_BASE_URL:-https://{databaseId}.example.com/{lang}/login}"
  EMAIL_PASSWORD_SECRET="${EMAIL_PASSWORD_SECRET:-email-password}"
fi

if [[ -z "${EMAIL_USER}" ]]; then
  echo "EMAIL_USER is required."
  exit 1
fi

echo "Deploying ${DEPLOY_ENV} to Cloud Run..."
echo "  Project:  ${PROJECT_ID}"
echo "  Service:  ${SERVICE_NAME}"
echo "  Region:   ${REGION}"
echo "  Firebase: ${FIREBASE_PROJECT_ID}"

gcloud config set project "${PROJECT_ID}"

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com

gcloud run deploy "${SERVICE_NAME}" \
  --source . \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "^#^NODE_ENV=${NODE_ENV_VALUE}#FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}#PASSWORD_RESET_REDIRECT_URL=${PASSWORD_RESET_REDIRECT_URL}#LOGIN_BASE_URL=${LOGIN_BASE_URL}#EMAIL_PROVIDER=${EMAIL_PROVIDER}#EMAIL_SMTP_HOST=${EMAIL_SMTP_HOST}#EMAIL_SMTP_PORT=${EMAIL_SMTP_PORT}#EMAIL_SECURE=${EMAIL_SECURE}#EMAIL_USER=${EMAIL_USER}#EMAIL_FROM=${EMAIL_FROM}" \
  --set-secrets "EMAIL_PASSWORD=${EMAIL_PASSWORD_SECRET}:latest"
