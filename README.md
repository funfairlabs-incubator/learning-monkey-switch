# learn.funfairlabs.com

A personal learning site maintained by Claude. Static HTML, deployed to GitHub Pages via GitHub Actions.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  GitHub Actions                                         │
│  ┌──────────────────┐    ┌──────────────────────────┐   │
│  │  Weekly cron     │    │  Manual workflow_dispatch │   │
│  │  (Sunday 08:00)  │    │  (run from Actions tab)  │   │
│  └────────┬─────────┘    └────────────┬─────────────┘   │
│           └──────────────┬────────────┘                  │
│                          ▼                               │
│              scripts/generate.mjs                        │
│              (calls Anthropic API)                       │
│                          │                               │
│              ┌───────────┴───────────┐                  │
│              ▼                       ▼                   │
│        content/                   public/               │
│        recommendations/           (static HTML)         │
│        plans/ (private)                                  │
│              └───────────┬───────────┘                  │
│                          ▼                               │
│                   GitHub Pages deploy                    │
└─────────────────────────────────────────────────────────┘
```

## Public section (`/`)

Claude-generated recommendations across:
- MCP / AI tooling
- GCP & cloud infrastructure
- Next.js & full-stack
- Developer tools & workflow
- Broader tech news & learning

Refreshed weekly (Sunday 08:00 UTC) or on-demand via manual trigger.
Zero runtime AI cost — all generation happens at build time.

## Private section (`/plans/`)

Training plans and guides, gated behind Google OAuth.
Same whitelist pattern as ClassCharts ORC (allowed-users.json in GCS).

Current plans:
- MCP deep-dive
- GCP / Cloud Run / GAE
- Next.js & full-stack patterns
- AI/Claude integration patterns

## Repo layout

```
.github/
  workflows/
    generate-and-deploy.yml   # Weekly + manual trigger
    deploy-only.yml           # Deploy without regenerating (CSS/template fixes)
scripts/
  generate.mjs                # Calls Claude API, writes content JSON + HTML
  build.mjs                   # Assembles final static site from templates + content
  auth-check.mjs              # Validates GCS whitelist for protected routes
content/
  recommendations/            # Claude-generated JSON (committed, auditable)
    mcp-ai.json
    gcp-infra.json
    nextjs-fullstack.json
    devtools-workflow.json
    tech-news.json
  plans/                      # Training plan markdown (committed, versioned)
    mcp-training-plan.md
    gcp-guide.md
    nextjs-patterns.md
    ai-claude-patterns.md
public/                       # Static output (committed, served by Pages)
  index.html
  plans/
    index.html                # Auth-gated shell (OAuth handled client-side)
  css/
    style.css
  js/
    auth.js                   # Google OAuth client-side flow
    app.js
src/
  templates/
    base.html
    card.html
    plan.html
```

## Setup

### 1. GitHub Secrets required

```
ANTHROPIC_API_KEY       # For content generation
GCS_BUCKET              # classcharts-attachments (reuse existing bucket)
GOOGLE_CLIENT_ID        # OAuth client ID (reuse from ClassCharts)
```

### 2. DNS

Add CNAME record:
```
learn.funfairlabs.com  →  funfairlabs-incubator.github.io
```

### 3. GitHub Pages

Settings → Pages → Source: `gh-pages` branch (auto-created by workflow).
Custom domain: `learn.funfairlabs.com`.

### 4. Allowed users

Reuse the same `allowed-users.json` in GCS from ClassCharts ORC, or create a
separate one at `gs://classcharts-attachments/learn-allowed-users.json`.

## Triggering a manual refresh

Actions tab → "Generate and Deploy" → Run workflow.
Optionally tick "Force regenerate all topics" to skip the cache check.

## Content philosophy

Claude generates recommendations with web search enabled, so content reflects
what's actually current — not training data. Each topic section includes:
- 3–5 curated resources with a plain-English "why this matters now"
- One "this week's highlight" callout
- A brief Claude commentary on where the space is heading

Plans are Markdown, versioned in git. Claude regenerates them on request or when
a scheduled review flags them as stale (> 60 days since last significant update).
