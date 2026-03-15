/**
 * worker/index.js
 *
 * Cloudflare Worker — Anthropic API proxy for learn.funfairlabs.com
 *
 * Sits between the browser and api.anthropic.com:
 *   Browser → https://learn-proxy.funfairlabs.com/chat → Anthropic
 *
 * The ANTHROPIC_API_KEY is stored as a Cloudflare Secret — never in
 * source code or the browser. The key is injected at runtime by
 * the Workers runtime.
 *
 * Security:
 * - Only allows requests from learn.funfairlabs.com (Origin check)
 * - Rate limited to 20 requests per minute per IP
 * - Only forwards the specific fields needed — strips everything else
 */

const ALLOWED_ORIGINS = [
  'https://learn.funfairlabs.com',
  'http://localhost:3000',       // local dev
  'http://127.0.0.1:5500',       // VS Code Live Server
];

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const RATE_LIMIT_REQUESTS = 20;  // per window
const RATE_LIMIT_WINDOW   = 60;  // seconds

export default {
  async fetch(request, env, ctx) {

    const origin = request.headers.get('Origin') || '';

    // ── CORS preflight ─────────────────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      if (!ALLOWED_ORIGINS.includes(origin)) {
        return new Response('Forbidden', { status: 403 });
      }
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    // ── Only accept POST to /chat ──────────────────────────────────────────────
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/chat') {
      return new Response('Not found', { status: 404 });
    }

    // ── Origin check ───────────────────────────────────────────────────────────
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return new Response('Forbidden — origin not allowed', { status: 403 });
    }

    // ── Rate limiting (uses KV if bound, falls back to allowing) ───────────────
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (env.RATE_LIMIT_KV) {
      const key = `rl:${ip}`;
      const current = parseInt(await env.RATE_LIMIT_KV.get(key) || '0', 10);
      if (current >= RATE_LIMIT_REQUESTS) {
        return new Response('Too many requests', {
          status: 429,
          headers: { 'Retry-After': String(RATE_LIMIT_WINDOW), ...corsHeaders(origin) },
        });
      }
      ctx.waitUntil(
        env.RATE_LIMIT_KV.put(key, String(current + 1), { expirationTtl: RATE_LIMIT_WINDOW })
      );
    }

    // ── Parse and validate body ─────────────────────────────────────────────────
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400, headers: corsHeaders(origin) });
    }

    if (!body.messages || !Array.isArray(body.messages)) {
      return new Response('Missing messages', { status: 400, headers: corsHeaders(origin) });
    }

    // ── Forward to Anthropic — only pass what we need ──────────────────────────
    const payload = {
      model:      body.model      || 'claude-sonnet-4-20250514',
      max_tokens: Math.min(body.max_tokens || 1500, 2000), // cap at 2000
      messages:   body.messages,
    };
    if (body.system) payload.system = body.system;

    const anthropicRes = await fetch(ANTHROPIC_URL, {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    // ── Stream response back ───────────────────────────────────────────────────
    const responseBody = await anthropicRes.text();

    return new Response(responseBody, {
      status:  anthropicRes.status,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(origin),
      },
    });
  },
};

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age':       '86400',
  };
}
