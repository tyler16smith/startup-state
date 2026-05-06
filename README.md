# Finance with Fin

A personal financial intelligence platform. Connect your bank accounts via Plaid, manage a complex rules engine, track net worth over time, model investment growth, and run scenario forecasts.

## Stack

- **Next.js 15** (App Router)
- **tRPC v11** — type-safe API layer
- **Prisma 6** + **Neon Postgres** — database
- **NextAuth v5** — Google SSO + email/password auth
- **Tailwind v4** + **shadcn/ui** — UI components
- **Recharts** — charts
- **Biome** — linting and formatting

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

4. **Run the dev server for the web app**
   ```bash
   pnpm dev
   ```

## Key Commands

```bash
pnpm dev              # Start web development server via Turborepo
pnpm build            # Build all packages and apps
pnpm lint             # Run lint across the workspace
pnpm typecheck        # Run TypeScript checks
pnpm db:studio        # Open Prisma Studio for apps/web
```

## Features

- **Plaid Integration** — Securely connect bank accounts for automatic transaction sync
- **Net Worth Chart** — Historical + multi-scenario forecasts (conservative / expected / aggressive)
- **Investments** — Track investment accounts with projected growth
- **Scenario Modeling** — Custom salary growth, return rate, expense, and inflation assumptions
- **Spending Intelligence** — Category breakdowns and month-over-month trends
