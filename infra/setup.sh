#!/usr/bin/env bash
# infra/setup.sh
#
# One-time setup for learn.funfairlabs.com
# GCP project: learning-monkey-switch
# Region: europe-west2 (London), regional storage class
#
# Usage:
#   Edit infra/learn-allowed-users.json with real email addresses first
#   chmod +x infra/setup.sh
#   ./infra/setup.sh

set -euo pipefail

GCP_PROJECT="learning-monkey-switch"
GCS_BUCKET="learning-monkey-switch"
REGION="europe-west2"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  learn.funfairlabs.com — setup"
echo "  Project : $GCP_PROJECT"
echo "  Bucket  : gs://$GCS_BUCKET"
echo "  Region  : $REGION (London)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 1. Set active project ─────────────────────────────────────────────────────

echo "→ Setting active project..."
gcloud config set project "$GCP_PROJECT"

# ── 2. Enable Storage API ─────────────────────────────────────────────────────

echo "→ Enabling Cloud Storage API..."
gcloud services enable storage.googleapis.com

# ── 3. Create bucket (regional, London) ──────────────────────────────────────

echo "→ Creating bucket gs://$GCS_BUCKET..."
if gsutil ls "gs://$GCS_BUCKET" &>/dev/null; then
  echo "  Bucket already exists, skipping creation."
else
  gsutil mb -p "$GCP_PROJECT" \
    -c STANDARD \
    -l "$REGION" \
    "gs://$GCS_BUCKET"
  echo "  Bucket created (STANDARD, $REGION)."
fi

# ── 4. Apply CORS ─────────────────────────────────────────────────────────────

echo "→ Applying CORS config..."
gcloud storage buckets update "gs://$GCS_BUCKET" \
  --cors-file="infra/gcs-cors.json" \
  --project="$GCP_PROJECT"

# ── 5. Upload allowed-users file ─────────────────────────────────────────────

echo ""
echo "→ Uploading learn-allowed-users.json..."
echo "  Make sure infra/learn-allowed-users.json contains your real Gmail addresses."
read -p "  Press enter to continue, Ctrl+C to abort..."

gsutil cp infra/learn-allowed-users.json \
  "gs://$GCS_BUCKET/learn-allowed-users.json"

# Make publicly readable (contains only email addresses + roles, no secrets)
gsutil acl ch -u AllUsers:R \
  "gs://$GCS_BUCKET/learn-allowed-users.json"

echo "  Uploaded and set public-read."

# ── 6. GitHub Secrets reminder ────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  GitHub Secrets to add:"
echo "  Repo → Settings → Secrets and variables → Actions"
echo ""
echo "  ANTHROPIC_API_KEY   → your Anthropic API key"
echo "  GOOGLE_CLIENT_ID    → OAuth client ID"
echo "                        (add learn.funfairlabs.com to authorised origins)"
echo "  GCS_BUCKET          → learning-monkey-switch"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 7. OAuth reminder ─────────────────────────────────────────────────────────

echo "  Google Cloud Console → APIs & Services → Credentials"
echo "  → OAuth 2.0 Client ID → Authorised JavaScript origins"
echo "  → Add: https://learn.funfairlabs.com"
echo ""

# ── 8. DNS reminder ───────────────────────────────────────────────────────────

echo "  DNS — add CNAME:"
echo "  learn.funfairlabs.com  →  funfairlabs-incubator.github.io"
echo ""

# ── 9. GitHub Pages reminder ──────────────────────────────────────────────────

echo "  GitHub → funfairlabs-incubator/learning-monkey-switch"
echo "  → Settings → Pages → Source: gh-pages branch"
echo "  → Custom domain: learn.funfairlabs.com"
echo "  → Enforce HTTPS: ✓"
echo ""
echo "✅ Setup complete."
echo "   Run first content generation:"
echo "   Actions → Generate and Deploy → Run workflow → ✓ Force regenerate all topics"
