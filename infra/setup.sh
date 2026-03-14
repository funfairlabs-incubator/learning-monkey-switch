#!/usr/bin/env bash
# infra/setup.sh
#
# One-time setup for learn.funfairlabs.com
# Reuses the existing classcharts GCP project and GCS bucket.
#
# Usage:
#   chmod +x infra/setup.sh
#   ./infra/setup.sh

set -euo pipefail

GCP_PROJECT="classcharts"
GCS_BUCKET="classcharts-attachments"
REGION="europe-west2"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  learn.funfairlabs.com — setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 1. Apply CORS to existing GCS bucket ──────────────────────────────────────

echo "→ Applying CORS config to gs://$GCS_BUCKET..."
gcloud storage buckets update "gs://$GCS_BUCKET" \
  --cors-file="infra/gcs-cors.json" \
  --project="$GCP_PROJECT"

# ── 2. Upload initial allowed-users file ─────────────────────────────────────

echo "→ Uploading learn-allowed-users.json..."
echo "  Edit infra/learn-allowed-users.json first with your Gmail address."
read -p "  Press enter to continue, Ctrl+C to abort..."
gsutil cp infra/learn-allowed-users.json "gs://$GCS_BUCKET/learn-allowed-users.json"
# Make it publicly readable (only email list, no sensitive content)
gsutil acl ch -u AllUsers:R "gs://$GCS_BUCKET/learn-allowed-users.json"

# ── 3. Reminder: GitHub Secrets needed ───────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  GitHub Secrets to add:"
echo "  (Settings → Secrets and variables → Actions)"
echo ""
echo "  ANTHROPIC_API_KEY   → your Anthropic API key"
echo "  GOOGLE_CLIENT_ID    → reuse from ClassCharts OAuth app"
echo "                        (add learn.funfairlabs.com to authorised origins)"
echo "  GCS_BUCKET          → classcharts-attachments"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 4. Reminder: Google OAuth origins ────────────────────────────────────────

echo "  Google Cloud Console → APIs & Services → Credentials"
echo "  → Your OAuth 2.0 Client ID → Authorised JavaScript origins"
echo "  → Add: https://learn.funfairlabs.com"
echo ""

# ── 5. Reminder: DNS ─────────────────────────────────────────────────────────

echo "  DNS — add CNAME:"
echo "  learn.funfairlabs.com  →  funfairlabs-incubator.github.io"
echo ""

# ── 6. Reminder: GitHub Pages ────────────────────────────────────────────────

echo "  GitHub → funfairlabs-incubator/funfairlabs-learn"
echo "  → Settings → Pages → Source: gh-pages branch"
echo "  → Custom domain: learn.funfairlabs.com"
echo "  → Enforce HTTPS: ✓"
echo ""
echo "✅ Setup complete. Run 'npm run refresh' to generate first content."
