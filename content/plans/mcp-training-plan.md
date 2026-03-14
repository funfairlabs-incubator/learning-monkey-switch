# MCP Deep-Dive Training Plan

> Last reviewed: March 2026 · Maintained by Claude

This plan takes you from zero to confidently building and consuming MCP (Model Context Protocol) servers. It assumes solid TypeScript and a working knowledge of REST APIs.

---

## What is MCP and why does it matter?

MCP is Anthropic's open protocol for connecting AI models to external tools, data sources, and services. Think of it as a standardised plugin system — instead of every AI vendor inventing their own function-calling format, MCP defines a universal interface that any client (Claude, Cursor, your own app) can speak to any server (filesystem, GitHub, databases, Slack, etc.).

The key insight: **MCP separates the tool implementation from the model**. You write an MCP server once, and any MCP-compatible client can use it.

---

## Phase 1 — Foundations (Week 1)

#### Goals
Understand the protocol, run existing servers, inspect traffic.

### Core reading

- [MCP specification](https://modelcontextprotocol.io/docs/concepts/architecture) — architecture overview, transport types (stdio, SSE, HTTP)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) — the reference implementation
- [MCP server examples](https://github.com/modelcontextprotocol/servers) — official reference servers (filesystem, GitHub, Postgres, etc.)

### Hands-on

1. Install the MCP inspector: `npx @modelcontextprotocol/inspector`
2. Run the filesystem server against a local directory
3. Connect Claude Desktop to it via `claude_desktop_config.json`
4. Inspect the protocol messages in the inspector — see how `tools/list` and `tools/call` work

### Checkpoint
You can explain: tools vs resources vs prompts, stdio transport vs HTTP/SSE, and what a capability negotiation looks like.

---

## Phase 2 — Building a server (Week 2)

#### Goals
Write your own MCP server from scratch using the TypeScript SDK.

### The pattern

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({ name: 'my-server', version: '1.0.0' });

server.tool(
  'get_weather',
  { location: z.string().describe('City name') },
  async ({ location }) => {
    // Call your API
    const data = await fetchWeather(location);
    return { content: [{ type: 'text', text: JSON.stringify(data) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Exercise
Build a server that exposes tools against a domain you already know — e.g. wrapping the ClassCharts API, or your GCS bucket. Start with 2-3 tools, test with the inspector, then connect it to Claude Desktop.

### Resources vs Tools
- **Tools** — Claude calls these to perform actions or fetch data
- **Resources** — Claude reads these (like files or database rows); similar to GET, not POST
- **Prompts** — reusable prompt templates the user invokes

Most real servers start with tools only. Add resources when you have structured data Claude should be able to browse.

---

## Phase 3 — HTTP transport and deployment (Week 3)

#### Goals
Move from stdio (local) to HTTP/SSE (deployed, multi-client).

### Why HTTP matters
stdio servers run as child processes on the same machine. HTTP/SSE servers can be deployed to Cloud Run, called from web apps, and shared between multiple Claude instances.

### The two HTTP options

**SSE (Server-Sent Events)** — older, supported by Claude Desktop and many clients:
```typescript
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';

const app = express();
app.get('/sse', (req, res) => {
  const transport = new SSEServerTransport('/message', res);
  server.connect(transport);
});
```

**Streamable HTTP** — newer, preferred for Cloud Run:
```typescript
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
```

### Deploying to Cloud Run

1. Containerise with a minimal Dockerfile (Node 20 alpine)
2. Add `/health` endpoint returning 200
3. `gcloud run deploy my-mcp-server --source . --region europe-west2 --allow-unauthenticated`
4. Wire the URL into your Claude config or app

### Auth on Cloud Run
For private servers, add Bearer token validation. The client sends `Authorization: Bearer <token>` in the request headers. Validate against a secret stored in Secret Manager.

---

## Phase 4 — MCP in your apps (Week 4)

#### Goals
Use the MCP TypeScript client to call servers from your own code (not just Claude Desktop).

### The client

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const client = new Client({ name: 'my-app', version: '1.0.0' }, { capabilities: {} });
const transport = new SSEClientTransport(new URL('https://my-server.run.app/sse'));
await client.connect(transport);

const tools = await client.listTools();
const result = await client.callTool({ name: 'get_weather', arguments: { location: 'London' } });
```

### Patterns worth knowing

- **Tool discovery at runtime** — list tools, feed the list to Claude as part of the system prompt, let Claude decide which to call
- **Chaining servers** — one Claude conversation can use tools from multiple MCP servers simultaneously (via the Anthropic API `mcp_servers` param)
- **Remote MCP via the Anthropic API** — pass `mcp_servers: [{ type: 'url', url: '...' }]` directly to the API; the API handles the connection lifecycle

---

## Reference

| Concept | Quick description |
|---|---|
| `tools/list` | Claude asks server what tools are available |
| `tools/call` | Claude invokes a specific tool with args |
| `resources/list` | Claude asks what readable resources exist |
| `resources/read` | Claude reads a resource by URI |
| `prompts/list` | List reusable prompt templates |
| `initialize` | Capability negotiation on connect |
| stdio transport | Child process, local only |
| SSE transport | HTTP, works over network |
| Streamable HTTP | Newer HTTP transport, preferred for Cloud Run |

---

## Further reading

- [MCP specification changelog](https://modelcontextprotocol.io/specification/changelog)
- [Anthropic API — remote MCP docs](https://docs.anthropic.com/en/docs/build-with-claude/mcp)
- [Awesome MCP servers](https://github.com/punkpeye/awesome-mcp-servers)
