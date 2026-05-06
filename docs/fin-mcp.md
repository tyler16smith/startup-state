# Fin MCP

**Turn my existing internal MCP servers into a secure remote MCP layer with one public gateway**, then support different client profiles from that gateway.

## Implementation status

The first gateway slice now exists in the monorepo:

```txt
apps/mcp
packages/mcp-contracts
apps/api/prisma/migrations/20260504000000_add_mcp_gateway_auth_audit
```

This implementation adds a dedicated MCP app with Streamable HTTP and stdio transports, a shared contracts package for scopes/client profiles/tool schemas, Prisma-backed PAT/OAuth token storage, tool-call audit logging, Redis-backed rate limiting when Upstash env vars are present, and a curated first tool surface:

```txt
fin.getProfileSummary
fin.listAccounts
fin.listTransactions
fin.searchTransactions
fin.getSpendingBreakdown
fin.getBudgetStatus
fin.getForecast
fin.explainForecast
fin.listRules
fin.createRule
fin.applyRulesPreview
fin.updateTransactionCategory
```

The gateway intentionally does not expose admin, raw SQL, shell, billing, migration, broad REST passthrough, or arbitrary fetch tools.

### Local development

Install dependencies from the repo root:

```bash
pnpm install
```

Required env:

```bash
DATABASE_URL=postgres://...
MCP_BASE_URL=http://localhost:3010
WEB_APP_URL=http://localhost:3000
MCP_PORT=3010
```

Recommended production env:

```bash
MCP_TOKEN_PEPPER=replace-with-stable-secret
MCP_OAUTH_CHATGPT_REDIRECT_HOSTS=chatgpt.com
MCP_OAUTH_CLAUDE_REDIRECT_HOSTS=claude-callback-host.example
MCP_OAUTH_GEMINI_REDIRECT_HOSTS=gemini-callback-host.example
MCP_OAUTH_CONSUMER_REDIRECT_HOSTS=other-trusted-host.example
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
AXIOM_TOKEN=...
AXIOM_DATASET=...
```

Run the HTTP transport:

```bash
pnpm --filter @app/mcp run dev:http
```

Build and run the production HTTP server:

```bash
DATABASE_URL=<database-url> pnpm --filter fin-api exec prisma generate
pnpm --filter @app/mcp run build
PORT=8080 pnpm --filter @app/mcp run start
```

Build the Cloud Run container from the repository root:

```bash
docker build -t fin-mcp .
docker run --rm -p 8080:8080 --env-file apps/mcp/.env -e PORT=8080 fin-mcp
```

Run the local stdio transport:

```bash
FIN_MCP_TOKEN=fin_dev_... FIN_MCP_CLIENT_PROFILE=local-dev pnpm --filter @app/mcp run dev:stdio
```

Useful checks:

```bash
pnpm --filter @app/mcp run typecheck
pnpm --filter @app/mcp run check
pnpm --filter @app/mcp-contracts run typecheck
pnpm --filter @app/mcp-contracts run check
```

### Authentication and clients

PAT auth is implemented through reusable service functions in `apps/mcp/src/auth/pat-service.ts` and an authenticated web settings UI. Tokens are generated as opaque `fin_dev_*` values, stored only as peppered hashes, scoped, revocable, and tracked with `lastUsedAt`.

OAuth storage and token exchange are implemented in `apps/mcp/src/auth/oauth-service.ts`. The MCP app exposes metadata, `/oauth/register`, `/oauth/authorize`, `/oauth/token`, and `/oauth/revoke`; `/oauth/authorize` validates the request and redirects to the web consent page at `/mcp/oauth/authorize`. The token endpoint supports authorization-code exchange with PKCE and rotating refresh-token grants. Revocation accepts either access or refresh tokens. Connected OAuth clients can also be revoked from account settings. The HTTP OAuth endpoints accept the MCP `resource` parameter and reject it when it does not exactly match the protected resource URI, `${MCP_BASE_URL}/mcp`.

Remote MCP clients can register themselves dynamically as public PKCE clients. Dynamic registration supports two redirect policies:

- Local/IDE clients may use loopback callback URLs such as `http://localhost:<port>/oauth/callback`. These clients store no client secret and may request the full Fin MCP scope set.
- Hosted consumer apps must use HTTPS redirect hosts trusted by configuration. ChatGPT is enabled by default for `chatgpt.com` callbacks at `/connector/oauth/*` plus the legacy `/connector_platform_oauth_redirect` path. Claude, Gemini, and other hosted apps are enabled by setting `MCP_OAUTH_CLAUDE_REDIRECT_HOSTS`, `MCP_OAUTH_GEMINI_REDIRECT_HOSTS`, or `MCP_OAUTH_CONSUMER_REDIRECT_HOSTS` to comma-separated exact hostnames once the app gives us its callback domain.

Hosted clients are assigned specific client profiles instead of the local-dev profile. ChatGPT and Claude can request the normal read/write MCP scopes; Gemini and generic consumer registrations are read-scoped until their OAuth and confirmation behavior is verified. Confidential clients can still be registered manually in `McpOAuthClient` with a hashed client secret and must send `client_secret` to token and revoke requests.

Cursor, VS Code, Claude Desktop, or other stdio-only MCP clients can use `mcp-remote` without manually passing a bearer token:

```json
{
  "mcpServers": {
    "fin": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://mcp.financewithfin.com/mcp",
        "--transport",
        "http-only"
      ]
    }
  }
}
```

Direct HTTP clients can still send `Authorization: Bearer fin_dev_...` or an OAuth access token to `/mcp`.

Tool descriptors include MCP annotations derived from the canonical contract safety class and OpenAI-compatible `_meta.securitySchemes` entries derived from each tool's required scopes. This lets consumer hosts understand read-only versus mutation tools and present OAuth/approval UX from the tool list instead of relying on prose.

Local stdio clients can use:

```json
{
  "mcpServers": {
    "fin-local": {
      "command": "pnpm",
      "args": ["--filter", "@app/mcp", "run", "dev:stdio"],
      "env": {
        "DATABASE_URL": "${DATABASE_URL}",
        "FIN_MCP_TOKEN": "${FIN_MCP_TOKEN}",
        "FIN_MCP_CLIENT_PROFILE": "local-dev"
      }
    }
  }
}
```

### Migration note

The MCP Prisma models were added to `apps/api/prisma/schema.prisma` and a manual SQL migration was created. `prisma migrate dev` hit existing shadow-database drift in an older migration, so the migration was not applied automatically. Do not reset the shared database unless that is explicitly approved; apply/resolve the MCP migration through the normal drift-safe flow.

### Remaining work

Before production rollout, finish OAuth client registration/admin tooling, end-to-end MCP Inspector/Cursor/OpenClaw/ChatGPT protocol smoke tests, hosted Claude/Gemini redirect-domain verification, canonical reuse of existing forecast/rules services where needed, and ChatGPT Apps SDK widgets for richer chart/table experiences.

## Target architecture

```txt
ChatGPT / OpenAI API / Cursor / OpenClaw / Claude Desktop / Codex
                            |
                            v
                  https://mcp.finapp.com/mcp
                            |
                 Remote MCP Gateway / Router
                            |
        ------------------------------------------------
        |                 |                |           |
   Fin Read MCP      Fin Write MCP     Admin MCP   Dev MCP
   forecasts,        rules, budgets,   household,  logs,
   txns, accounts    imports, edits    billing     schema
        |
        v
 Existing Fin backend services
 Next.js API / Prisma / Neon / Plaid / Rules Engine
```

The key shift is: **your internal agent can keep calling local/internal MCP servers, but external clients should call a public, authenticated, rate-limited, scoped MCP gateway.**

MCP remote servers should generally use **Streamable HTTP** for remote connections; `stdio` is best reserved for local process-spawned integrations, and HTTP+SSE is now mostly compatibility/backward-support territory. The official TypeScript SDK supports Streamable HTTP, stdio, auth helpers, tools, resources, and prompts. ([GitHub][1])

---

## Plan

### Phase 1: Inventory and split your MCP surface area

Start by classifying every existing Fin MCP tool into one of these groups:

| Group                 | Examples                                                                         | External availability                   |
| --------------------- | -------------------------------------------------------------------------------- | --------------------------------------- |
| Read-only user tools  | `get_net_worth`, `list_transactions`, `forecast_cashflow`, `get_budget_status`   | Yes                                     |
| User write tools      | `create_rule`, `recategorize_transaction`, `sync_plaid_account`, `update_budget` | Yes, but gated                          |
| Dangerous/admin tools | backfills, migrations, impersonation, billing ops, raw SQL                       | No, internal only                       |
| Dev/debug tools       | logs, schema introspection, job queues                                           | Maybe Cursor-only, never ChatGPT public |

For external agents, expose **fewer tools than your internal agent has**. I’d aim for 8–15 high-value tools at first, not 60 tiny ones. Cursor has documented MCP tool integration, but too many tools can degrade agent behavior, and some clients impose practical ceilings. ([Cursor][2])

A good first public Fin MCP set:

```txt
fin.getProfileSummary
fin.listAccounts
fin.listTransactions
fin.searchTransactions
fin.getSpendingBreakdown
fin.getBudgetStatus
fin.getForecast
fin.explainForecast
fin.listRules
fin.createRule
fin.applyRulesPreview
fin.updateTransactionCategory
```

Keep mutations separate from reads so approval and auditing are easy.

---

### Phase 2: Build a public MCP gateway

Create a dedicated package/app in your monorepo, probably:

```txt
apps/mcp
```

or, if you want to reuse your existing API infra:

```txt
apps/api/src/mcp
```

I’d prefer `apps/mcp` because MCP has different auth, streaming, observability, and rate-limiting concerns than your REST API.

Suggested stack:

```txt
apps/mcp
  Next.js / Hono / Express / Fastify
  @modelcontextprotocol/sdk
  Zod schemas
  Prisma client
  shared auth/session utilities
  shared Fin domain services
```

Expose:

```txt
POST /mcp
GET  /mcp
GET  /.well-known/oauth-protected-resource
GET  /.well-known/oauth-authorization-server
```

The MCP spec provides transport-level authorization for HTTP-based transports, and OAuth 2.1 is the production-grade direction for remote restricted servers. ([Model Context Protocol][3])

---

### Phase 3: Auth model

You need two auth modes.

#### 1. Personal/local developer mode

For Cursor, OpenClaw, Claude Desktop, Codex CLI, and local testing:

```txt
Authorization: Bearer fin_dev_xxx
```

Use scoped personal access tokens:

```txt
mcp:read
mcp:write
mcp:transactions:read
mcp:transactions:write
mcp:rules:write
mcp:forecast:read
```

This is easiest for IDEs and local agents.

#### 2. Hosted ChatGPT / OpenAI / external app mode

For ChatGPT and other hosted clients, implement OAuth/OIDC:

```txt
Client -> Fin OAuth authorize
User logs into Fin
User consents to scopes
Client receives token
Client calls https://mcp.finapp.com/mcp
```

Since Fin already has NextAuth v5, I’d either:

1. Add a proper OAuth authorization server layer, or
2. Use Auth0/WorkOS/Clerk/Supabase Auth as the OAuth provider and map tokens back to Fin users.

For ChatGPT specifically, OpenAI’s current docs distinguish between OpenAI-maintained connectors and custom remote MCP servers; remote MCP servers can be public internet servers that implement MCP. ([OpenAI Developers][4]) ChatGPT full MCP connector/developer mode support is currently documented for Business and Enterprise/Edu workspaces on ChatGPT web. ([OpenAI Help Center][5])

---

### Phase 4: Make tools safe by design

Every external tool should have:

```ts
{
  name: "fin.createRule",
  description: "Create a transaction categorization rule for the authenticated user.",
  inputSchema: z.object({
    merchantContains: z.string().min(2).max(100),
    categoryId: z.string(),
    hashtags: z.array(z.string()).max(10),
    applyToHistorical: z.boolean().default(false),
  }),
}
```

For mutations, return previews when possible:

```txt
User asks: “Create a rule for Home Depot as Repairs #rentalA”

Tool 1: fin.applyRulesPreview
Returns: 38 historical transactions would change

Tool 2: fin.createRule
Requires approval / explicit user confirmation depending on client
```

Do **not** let external MCP clients run raw queries, call arbitrary endpoints, or pass through unvalidated filters. Treat every tool like a public API endpoint with strong schema validation.

---

### Phase 5: Add client-specific setup paths

## ChatGPT

There are two tracks.

### Track A: plain MCP connector

Expose the remote MCP endpoint:

```txt
https://mcp.finapp.com/mcp
```

Use OAuth-backed auth and a small tool list. This lets ChatGPT discover and call your tools.

OpenAI’s Apps SDK guide describes connecting a backend MCP server to ChatGPT, defining tools, registering UI templates, and optionally tying results to interactive widgets. ([OpenAI Developers][6])

### Track B: ChatGPT App with UI

This is the better long-term product experience for Fin.

Use MCP tools plus widgets for things like:

```txt
Net worth chart
Forecast scenario comparison
Budget overrun table
Transaction search results
Rule preview before/after
```

ChatGPT Apps are built on MCP and can render interactive UI inside ChatGPT. OpenAI’s examples repo includes MCP servers that expose UI components as tools. ([GitHub][7])

For Fin, this is the product-grade path:

```txt
Tool: fin.getForecast
Result: structured JSON
Widget: Recharts-powered forecast chart
```

---

## Cursor

Cursor supports MCP via `mcp.json`. ([Cursor][2])

You’d support both local and remote config.

### Remote Fin MCP

```json
{
  "mcpServers": {
    "fin": {
      "url": "https://mcp.finapp.com/mcp",
      "headers": {
        "Authorization": "Bearer ${FIN_MCP_TOKEN}"
      }
    }
  }
}
```

### Local dev MCP

```json
{
  "mcpServers": {
    "fin-local": {
      "command": "pnpm",
      "args": ["--filter", "@app/mcp", "dev:stdio"],
      "env": {
        "DATABASE_URL": "${DATABASE_URL}",
        "FIN_MCP_TOKEN": "${FIN_MCP_TOKEN}"
      }
    }
  }
}
```

Use Cursor primarily for developer/admin-safe tools:

```txt
fin.inspectOpenApi
fin.getPrismaModelSummary
fin.searchTransactionsTestData
fin.previewRuleAgainstFixture
```

I would **not** give Cursor production mutation access by default.

---

## OpenClaw

OpenClaw has MCP support for serving and managing MCP server definitions; its docs describe `openclaw mcp serve` for making OpenClaw act as an MCP server, and `list/show/set/unset` for managing outbound MCP server definitions. ([OpenClaw][8])

For your case, you probably want OpenClaw as an MCP **client** to your Fin MCP server:

```bash
openclaw mcp set fin \
  --url https://mcp.finapp.com/mcp \
  --header "Authorization=Bearer $FIN_MCP_TOKEN"
```

Use it for operational workflows:

```txt
“Investigate why forecast changed for user X”
“Compare Plaid sync result before/after rules”
“Create a bug report from anomalous transaction data”
```

---

### Phase 6: Tool design for Fin

I’d shape your MCP API around product workflows, not database tables.

Good tools:

```txt
fin.getFinancialSnapshot
Input: { householdId?, dateRange? }
Output: income, expenses, net worth, debt, cash runway

fin.searchTransactions
Input: { query?, categories?, hashtags?, dateRange?, amountRange? }
Output: normalized transaction cards

fin.explainSpendingChange
Input: { currentPeriod, previousPeriod }
Output: drivers, merchant deltas, category deltas

fin.getForecast
Input: { scenarioId?, years?, assumptions? }
Output: yearly/monthly projection series

fin.compareScenarios
Input: { scenarioIds[] }
Output: scenario comparison

fin.previewRule
Input: { condition, actions }
Output: affected transaction count and samples

fin.createRule
Input: { condition, actions, applyToHistorical }
Output: created rule and job id

fin.getBudgetVariance
Input: { month }
Output: over/under by category
```

Avoid:

```txt
fin.queryDatabase
fin.callRestEndpoint
fin.updateUser
fin.syncEverything
fin.runJob
```

Those are too broad and dangerous.

---

### Phase 7: Security requirements

For a finance app, I’d treat external MCP as a high-risk API surface.

Minimum controls:

```txt
OAuth or PAT auth
Per-user and per-household authorization
Tool-level scopes
Read/write separation
Explicit confirmation for mutations
Strict Zod input validation
No arbitrary SQL
No arbitrary URL fetches
No hidden admin tools
Rate limits by user/client/tool
Audit logs for every tool call
Replay protection where relevant
PII redaction in logs
Environment isolation: dev/staging/prod
```

Given recent MCP security discussion around local `stdio` and unsafe execution patterns, avoid exposing any tool that shells out or executes untrusted client-provided commands. A recent security report focused on RCE risk around insecure `stdio` handling and unsanitized input, which reinforces keeping production remote MCP tools narrow, validated, and non-executable. ([Tom's Hardware][9])

---

### Phase 8: Observability

Create an `mcp_tool_calls` table:

```prisma
model McpToolCall {
  id            String   @id @default(cuid())
  userId        String?
  householdId   String?
  clientName    String?
  toolName      String
  inputHash     String
  status        String
  durationMs    Int
  errorCode     String?
  createdAt     DateTime @default(now())
}
```

Log:

```txt
client
tool
user
household
scopes
duration
result size
mutation target
approval status
```

Do not log full transaction payloads unless explicitly redacted.

---

### Phase 9: Dev/staging/prod rollout

I’d roll this out like this:

| Milestone | Goal                                              |
| --------- | ------------------------------------------------- |
| M1        | Local stdio MCP server for Cursor                 |
| M2        | Remote Streamable HTTP MCP server on staging      |
| M3        | PAT auth for dev clients                          |
| M4        | Read-only production tools                        |
| M5        | OAuth support                                     |
| M6        | ChatGPT custom connector                          |
| M7        | Mutation tools with previews/approval             |
| M8        | ChatGPT App widgets for charts/tables             |
| M9        | Public documentation and user-facing connect flow |

---

## Concrete repo changes

```txt
apps/mcp
  src/server.ts
  src/auth/verifyToken.ts
  src/transports/http.ts
  src/transports/stdio.ts
  src/tools/financialSnapshot.ts
  src/tools/transactions.ts
  src/tools/forecast.ts
  src/tools/rules.ts
  src/resources/categories.ts
  src/resources/accounts.ts
  src/audit/logToolCall.ts

packages/mcp-contracts
  src/tools.ts
  src/scopes.ts
  src/schemas.ts

packages/shared
  src/finance/domain-services/*
```

Scripts:

```json
{
  "scripts": {
    "dev:http": "tsx src/server.ts --transport=http",
    "dev:stdio": "tsx src/server.ts --transport=stdio",
    "start": "node dist/server.js"
  }
}
```

---

## Recommended first implementation slice

Build this first:

```txt
Remote endpoint:
https://mcp-staging.finapp.com/mcp

Auth:
Personal access token only

Tools:
fin.getFinancialSnapshot
fin.searchTransactions
fin.getForecast
fin.previewRule

Clients:
Cursor
OpenClaw
MCP Inspector
OpenAI API remote MCP
```

Then add:

```txt
OAuth
ChatGPT connector
Mutation tools
ChatGPT widgets
```

This gives you fast validation without committing to the full ChatGPT App surface immediately.

---

## Core decision

Do **not** expose your existing internal MCP servers directly.

Instead, create a **Fin MCP Gateway** that:

```txt
normalizes tools
enforces auth/scopes
routes to internal services
audits every call
supports Streamable HTTP for hosted clients
supports stdio for local IDE clients
keeps dangerous/admin tools private
```

That gives ChatGPT, Cursor, OpenClaw, Codex, Claude Desktop, and future MCP clients one clean integration point without coupling them to your internal server layout.

[1]: https://github.com/modelcontextprotocol/typescript-sdk?utm_source=chatgpt.com "GitHub - modelcontextprotocol/typescript-sdk: The official TypeScript ..."
[2]: https://cursor.com/docs/mcp?utm_source=chatgpt.com "Model Context Protocol (MCP) | Cursor Docs"
[3]: https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization?utm_source=chatgpt.com "Authorization - Model Context Protocol"
[4]: https://developers.openai.com/api/docs/guides/tools-connectors-mcp?utm_source=chatgpt.com "MCP and Connectors | OpenAI API"
[5]: https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt-beta?utm_source=chatgpt.com "Developer mode, and MCP apps in ChatGPT [beta] - OpenAI Help Center"
[6]: https://developers.openai.com/apps-sdk/build/mcp-server?utm_source=chatgpt.com "Build your MCP server – Apps SDK | OpenAI Developers"
[7]: https://github.com/openai/openai-apps-sdk-examples?utm_source=chatgpt.com "GitHub - openai/openai-apps-sdk-examples: Example apps for the Apps SDK"
[8]: https://docs.openclaw.ai/cli/mcp?utm_source=chatgpt.com "MCP - OpenClaw"
[9]: https://www.tomshardware.com/tech-industry/artificial-intelligence/anthropics-model-context-protocol-has-critical-security-flaw-exposed?utm_source=chatgpt.com "Anthropic's Model Context Protocol includes a critical remote code execution vulnerability - newly discovered exploit puts 200,000 AI servers at risk"
