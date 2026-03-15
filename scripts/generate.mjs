#!/usr/bin/env node
/**
 * scripts/generate.mjs — 9 topics, web search enabled, zero runtime cost.
 */

import Anthropic from '@anthropic-ai/sdk';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CONTENT_DIR = join(ROOT, 'content', 'recommendations');
const FORCE = process.env.FORCE_REGENERATE === 'true';

mkdirSync(CONTENT_DIR, { recursive: true });

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SHAPE = `{
  "topic": "<topic name>",
  "generated_at": "<ISO date>",
  "highlight": { "title": "...", "summary": "2-3 sentences", "url": "..." },
  "resources": [
    { "title": "...", "url": "...", "why_now": "1-2 sentences" },
    { "title": "...", "url": "...", "why_now": "1-2 sentences" },
    { "title": "...", "url": "...", "why_now": "1-2 sentences" },
    { "title": "...", "url": "...", "why_now": "1-2 sentences" }
  ],
  "claude_take": "2-3 sentence opinion"
}`;

const BASE = `Rules: exactly 4 resources, no paywalled links, be specific not generic.
Return ONLY the JSON object, no markdown fences, no preamble.`;

const TOPICS = [
  {
    slug: 'mcp-ai',
    title: 'MCP & AI Tooling',
    prompt: `Curate a weekly "what's worth knowing" for a senior developer site.
Topic: MCP (Model Context Protocol) and AI developer tooling. Search the web for what's current.
${SHAPE}
${BASE}
- Resources from last 30 days where possible
- claude_take: where MCP/AI tooling heads in 3-6 months`
  },
  {
    slug: 'gcp-infra',
    title: 'GCP & Cloud Infrastructure',
    prompt: `Curate a weekly "what's worth knowing" for a senior developer site.
Topic: GCP, Cloud Run, App Engine, cloud infrastructure patterns. Search the web.
${SHAPE}
${BASE}
- Focus on practical GCP: Cloud Run, cost optimisation, IAM, Secret Manager, Pub/Sub`
  },
  {
    slug: 'nextjs-fullstack',
    title: 'Next.js & Full-Stack',
    prompt: `Curate a weekly "what's worth knowing" for a senior developer site.
Topic: Next.js, React, full-stack TypeScript patterns. Search the web for what's current.
${SHAPE}
${BASE}`
  },
  {
    slug: 'devtools-workflow',
    title: 'Developer Tools & Workflow',
    prompt: `Curate a weekly "what's worth knowing" for a senior developer site.
Topic: Developer tooling, CLI tools, editors, workflow automation, GitHub Actions.
${SHAPE}
${BASE}`
  },
  {
    slug: 'tech-news',
    title: 'Tech & Learning',
    prompt: `Curate a weekly "what's worth knowing" for a family learning site.
Topic: Broader tech news, engineering culture, learning resources, industry trends.
${SHAPE}
${BASE}
- Mix of: longform essays, blog posts, learning resources, news`
  },
  {
    slug: 'architecture',
    title: 'Architecture & System Design',
    prompt: `Curate a weekly "what's worth knowing" for a mixed family learning site.
Audience: senior developers to curious adults with no technical background.
Topic: Software and systems architecture — patterns, principles, real-world examples.
${SHAPE}
${BASE}
- At least one beginner-accessible resource, at least one for experienced engineers
- summary must be understandable to a curious non-expert
- Real-world case studies preferred over pure theory`
  },
  {
    slug: 'leadership',
    title: 'Leadership & Team Craft',
    prompt: `Curate a weekly "what's worth knowing" for a family learning site.
Audience: professionals and adults who lead or aspire to lead people or projects.
Topic: Leadership, management, team dynamics, decision-making, organisational behaviour.
${SHAPE}
${BASE}
- Mix of: practical frameworks, essays, research, real-world stories
- Avoid generic motivational content — favour substance and nuance
- UK and global perspectives welcome`
  },
  {
    slug: 'networks',
    title: 'Networks & Infrastructure',
    prompt: `Curate a weekly "what's worth knowing" for a family learning site.
Audience: curious teenagers to adults with professional tech backgrounds.
Topic: Computer networks — LAN, WAN, DNS, TCP/IP, Wi-Fi, how the internet actually works.
${SHAPE}
${BASE}
- At least one resource accessible to a teenager or complete beginner
- At least one resource for someone with a technical background
- summary must be accessible to a curious 14-year-old
- Include real-world examples: BGP outages, what happens when you type a URL, etc.`
  },
  {
    slug: 'uk-education',
    title: 'UK Schools & Education',
    prompt: `Curate a weekly "what's worth knowing" for a UK family with school-age children.
Topic: UK school education — Y7-Y13 curriculum, SATs, GCSEs, A-Levels, revision strategies.
${SHAPE}
${BASE}
- Mix: some resources for students (revision, subject help), some for parents
- Cover a range of year groups across the 4 resources — not all GCSE/A-Level every week
- Free resources strongly preferred: BBC Bitesize, gov.uk, exam boards, Oak National Academy
- UK-specific only
- why_now must say who the resource is for: student / parent / both`
  },
];

function isStale(slug) {
  if (FORCE) return true;
  const path = join(CONTENT_DIR, `${slug}.json`);
  if (!existsSync(path)) return true;
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    const age = Date.now() - new Date(data.generated_at).getTime();
    return age > 6 * 24 * 60 * 60 * 1000;
  } catch { return true; }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Retry with exponential backoff — respects the retry-after header on 429s
async function callWithRetry(topic, maxRetries = 4) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: topic.prompt }]
      });
    } catch (err) {
      const is429 = err?.status === 429;
      const isLast = attempt === maxRetries;

      if (!is429 || isLast) throw err;

      // Respect retry-after header if present, else exponential backoff
      const retryAfter = parseInt(err?.headers?.['retry-after'] || '0', 10);
      const backoff = retryAfter > 0 ? retryAfter * 1000 : Math.min(30000, 5000 * attempt);
      console.log(`⏳ Rate limited on "${topic.title}" — waiting ${Math.round(backoff / 1000)}s (attempt ${attempt}/${maxRetries})...`);
      await sleep(backoff);
    }
  }
}

async function generateTopic(topic) {
  if (!isStale(topic.slug)) {
    console.log(`⏭  Skipping ${topic.title} (fresh)`);
    return;
  }
  console.log(`🔄 Generating: ${topic.title}...`);

  const response = await callWithRetry(topic);

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  const clean = text.replace(/^```json\s*/m, '').replace(/```\s*$/m, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch (e) {
    console.error(`❌ Failed to parse JSON for ${topic.title}:`, clean.slice(0, 300));
    throw e;
  }

  parsed.topic = topic.title;
  parsed.generated_at = (parsed.generated_at && !parsed.generated_at.includes('<'))
    ? parsed.generated_at : new Date().toISOString();

  writeFileSync(join(CONTENT_DIR, `${topic.slug}.json`), JSON.stringify(parsed, null, 2));
  console.log(`✅ Written: content/recommendations/${topic.slug}.json`);
}

// Filter to specific slugs if TOPIC_SLUGS env var is set (space-separated)
// e.g. TOPIC_SLUGS="uk-education" or TOPIC_SLUGS="nextjs-fullstack devtools-workflow tech-news"
const slugFilter = (process.env.TOPIC_SLUGS || '').trim().split(/\s+/).filter(Boolean);
const toRun = slugFilter.length > 0
  ? TOPICS.filter(t => slugFilter.includes(t.slug))
  : TOPICS;

if (toRun.length === 0) {
  console.log(`⚠️  No matching topics for TOPIC_SLUGS="${process.env.TOPIC_SLUGS}". Nothing to do.`);
  process.exit(0);
}

console.log(`FORCE_REGENERATE=${FORCE} | Running ${toRun.length} topic(s): ${toRun.map(t => t.slug).join(', ')}\n`);
for (let i = 0; i < toRun.length; i++) {
  await generateTopic(toRun[i]);
  // Only delay between topics, not after the last one
  if (i < toRun.length - 1) {
    console.log('⏸  Waiting 65s before next topic...');
    await sleep(65000);
  }
}
console.log('\n✨ Content generation complete.');
