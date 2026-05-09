# Startup State

A platform built for Utah's Governor's Office of Economic Development (GOED) to connect founders with resources and help investors discover Utah companies.

## What It Does

**For founders** — Answer a short intake and receive a personalized, ranked list of GOED resources matched to your startup stage, sector, goals, and eligibility. Save resources, generate a navigator plan, and track your progress.

**For investors** — Explore Utah's startup ecosystem via an interactive map and searchable directory. Filter companies by sector, stage, hiring status, location, and more. View rich company profiles with ownership, jobs, photos, and ecosystem context.

**For admins** — Manage resources and company listings from an admin dashboard without redeployment. Approve company ownership claims and keep content up to date.

## Stack

- **Next.js 15** (App Router) + **Turborepo** monorepo
- **tRPC v11** — type-safe API layer
- **Prisma 6** + **Neon Postgres** — database
- **NextAuth v5** — Google SSO + email/password auth
- **Tailwind v4** + **shadcn/ui** — UI components
- **AI Agent (Fin)** — OpenAI-powered assistant with MCP tool integration
- **Biome** — linting and formatting

## Monorepo Structure

```
apps/
  web/        # Next.js front-end
  api/        # Next.js API (tRPC + REST handlers)
  mcp/        # Model Context Protocol server
packages/
  shared/     # Shared types and utilities
  mcp-contracts/  # MCP tool/schema contracts
  client-ts/  # Typed API client
```

## Getting Started

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Set up environment variables** — copy `.env.example` to `.env` and fill in:
   ```
   AUTH_SECRET=
   AUTH_GOOGLE_ID=
   AUTH_GOOGLE_SECRET=
   DATABASE_URL=
   ```

3. **Push the database schema**
   ```bash
   pnpm db:push
   ```

4. **Run the dev server**
   ```bash
   pnpm dev
   ```

## Key Commands

```bash
pnpm dev                          # Start all dev servers via Turborepo
pnpm build                        # Build all packages and apps
pnpm typecheck                    # Run TypeScript checks across all workspaces
pnpm --filter @app/web check:write   # Lint + format the web app
pnpm --filter @app/api run check     # Lint + format the API
pnpm db:studio                    # Open Prisma Studio
```

## Features

- **Founder Navigator** — Intake form → personalized ranked resources with match reasoning
- **Utah Startup Map** — Interactive map + list view, filterable by sector, stage, hiring, and location
- **Company Profiles** — Rich profiles with ownership claims, jobs, photos, and ecosystem tags
- **Navigator Plans** — Saved, shareable resource plans generated from founder intake
- **Resource Directory** — Admin-managed resource listings with filtering by stage, goal, sector, community, and region
- **AI Agent** — Fin, an OpenAI-powered assistant with access to resources, companies, and navigator tools via MCP
- **Admin Dashboard** — Manage resources, companies, and ownership claims without redeployment
