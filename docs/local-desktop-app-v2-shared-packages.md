````md
# Task: Refactor Dashboard Summary Into Shared Domain Service

## Goal

Refactor the dashboard summary logic into a shared domain service that can be used by both:

```txt
apps/api      → real Postgres-backed implementation
apps/desktop  → stub repository implementation for now
````

Do **not** add SQLite yet.

This task proves the shared architecture pattern without committing to the full local database layer.

---

## Desired End State

```txt
apps/api
  ↓
packages/domain/dashboard
  ↓
packages/data-access repository interfaces
  ↓
current Postgres/Prisma queries

apps/desktop
  ↓
Electron IPC handler
  ↓
packages/domain/dashboard
  ↓
stub in-memory repository
```

---

## Requirements

### 1. Inspect Current Dashboard Logic

Find the current dashboard summary implementation used by the web/API app.

Identify:

* transaction queries
* investment queries
* account/net worth queries
* monthly cash flow calculations
* forecast calculations
* budget or category summary logic
* any dashboard DTO/response shape currently returned to the web app

Do **not** change behavior intentionally.

The cloud dashboard response should remain compatible with the existing web app.

---

## 2. Create Shared Packages

Add or extend these packages as needed:

```txt
packages/domain
packages/data-access
```

If they already exist, use existing conventions.

Suggested structure:

```txt
packages/domain/
  package.json
  tsconfig.json
  src/
    dashboard/
      getDashboardSummary.ts
      calculateDashboardSummary.ts
      types.ts
      index.ts
    index.ts

packages/data-access/
  package.json
  tsconfig.json
  src/
    repositories/
      DashboardRepository.ts
    index.ts
```

Keep package names consistent with the monorepo.

---

## 3. Define Repository Interface

Create a dashboard-specific repository interface for now.

Do not over-generalize yet.

Example:

```ts
export type DashboardTransaction = {
  id: string;
  date: Date;
  amount: number;
  merchantName?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  accountId?: string | null;
};

export type DashboardAccount = {
  id: string;
  name: string;
  type: string;
  currentBalance: number;
};

export type DashboardInvestment = {
  id: string;
  name: string;
  currentBalance: number;
  contributionAmount?: number | null;
  growthRate?: number | null;
};

export type DashboardRepository = {
  listTransactionsForSummary(input: {
    userId: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<DashboardTransaction[]>;

  listAccountsForSummary(input: {
    userId: string;
  }): Promise<DashboardAccount[]>;

  listInvestmentsForSummary(input: {
    userId: string;
  }): Promise<DashboardInvestment[]>;
};
```

Adjust fields to match the actual current dashboard needs.

---

## 4. Create Shared App Context

Create a minimal context for the domain service.

```ts
export type DashboardServiceContext = {
  userId: string;
  repositories: {
    dashboard: DashboardRepository;
  };
  logger?: {
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, meta?: Record<string, unknown>): void;
  };
};
```

Keep it small.

Do not add analytics unless already clearly needed.

---

## 5. Move Pure Calculation Logic

Move pure dashboard calculations into:

```txt
packages/domain/src/dashboard/calculateDashboardSummary.ts
```

Rules:

* no Prisma imports
* no Next.js imports
* no Electron imports
* no React imports
* no environment variables
* deterministic calculation from input data

Good:

```ts
export function calculateDashboardSummary(input: CalculateDashboardSummaryInput): DashboardSummary {
  // pure calculation only
}
```

Bad:

```ts
const transactions = await prisma.transaction.findMany(...)
```

---

## 6. Create Shared Service Function

Create:

```txt
packages/domain/src/dashboard/getDashboardSummary.ts
```

Example shape:

```ts
export async function getDashboardSummary(
  ctx: DashboardServiceContext,
  input: GetDashboardSummaryInput
): Promise<DashboardSummary> {
  const [transactions, accounts, investments] = await Promise.all([
    ctx.repositories.dashboard.listTransactionsForSummary({
      userId: ctx.userId,
      startDate: input.startDate,
      endDate: input.endDate,
    }),
    ctx.repositories.dashboard.listAccountsForSummary({
      userId: ctx.userId,
    }),
    ctx.repositories.dashboard.listInvestmentsForSummary({
      userId: ctx.userId,
    }),
  ]);

  return calculateDashboardSummary({
    transactions,
    accounts,
    investments,
    forecastMonths: input.forecastMonths,
  });
}
```

Preserve current response shape as much as possible.

---

## 7. Wire apps/api To Shared Service

Update the existing dashboard summary API route/handler.

It should now do:

```txt
1. Validate session/auth
2. Parse input
3. Create Postgres-backed dashboard repository
4. Call getDashboardSummary
5. Return existing-compatible response
```

Create a Postgres implementation near current API/db code for now.

Possible location:

```txt
apps/api/src/server/repositories/PostgresDashboardRepository.ts
```

or if the repo has another convention, follow it.

Do not create `packages/db-postgres` yet unless it is trivial and clearly aligned.

The repository implementation can use existing Prisma client and existing query logic.

Important:

* keep auth/permissions in `apps/api`
* keep Prisma in the repository implementation
* keep domain package Prisma-free

---

## 8. Wire apps/desktop To Shared Service With Stub Repo

Add an Electron IPC handler in `apps/desktop`.

Renderer should be able to call something like:

```ts
const summary = await window.finDesktop.dashboard.getSummary();
```

Preload should expose:

```ts
dashboard: {
  getSummary: () => ipcRenderer.invoke("dashboard:getSummary"),
}
```

Main process should register:

```ts
ipcMain.handle("dashboard:getSummary", async () => {
  return getDashboardSummary(
    {
      userId: "local-user",
      repositories: {
        dashboard: createStubDashboardRepository(),
      },
    },
    {
      forecastMonths: 12,
    }
  );
});
```

Stub repository should return hardcoded sample local data.

Example location:

```txt
apps/desktop/electron/stubs/createStubDashboardRepository.ts
```

The desktop dashboard page should display at least a few values from the returned summary, even if simple.

Example:

```txt
Net worth
Monthly income
Monthly expenses
Monthly net
```

Do not add SQLite.

---

## 9. Validate IPC Inputs/Outputs

Use `zod` if already available.

At minimum:

* validate IPC input shape
* avoid exposing generic invoke wrappers
* keep preload API narrow and typed

Do not expose Node, Prisma, filesystem, or shell access to renderer.

---

## 10. Preserve Existing Web Behavior

The existing web dashboard should continue working.

Do not break:

* response shape expected by `apps/web`
* auth behavior
* API route paths
* existing dashboard components

If response shape needs to change internally, adapt it in `apps/api` before returning.

---

## 11. Package Exports

Make imports clean.

Example:

```ts
import { getDashboardSummary } from "@app/domain/dashboard";
import type { DashboardRepository } from "@app/data-access";
```

Use whatever package alias convention exists in the monorepo.

Avoid deep brittle imports.

---

## 12. Typecheck / Build

Run relevant checks:

```bash
pnpm --filter domain typecheck
pnpm --filter data-access typecheck
pnpm --filter api typecheck
pnpm --filter desktop typecheck
pnpm --filter web typecheck
```

Also run builds where practical:

```bash
pnpm --filter api build
pnpm --filter desktop build
pnpm --filter web build
```

Use actual package names from the repo.

---

## 13. Acceptance Criteria

Must satisfy:

* Dashboard summary calculation lives in `packages/domain`
* Repository interface lives in `packages/data-access`
* Domain package has no Prisma/Next/Electron/React imports
* Existing API dashboard route uses shared service
* Existing web dashboard still works
* Desktop app exposes `window.finDesktop.dashboard.getSummary`
* Desktop app calls shared service through Electron main process
* Desktop uses stub repository only
* No SQLite added
* No Prisma schema changes required
* TypeScript passes
* Build passes where applicable

---

## 14. Important Constraints

Do **not**:

* add SQLite
* add local Prisma schema
* implement real desktop persistence
* rewrite all API routes
* extract every repository type
* refactor unrelated dashboard UI
* add Plaid local sync
* add CSV import
* move auth into shared packages
* import from `apps/api` inside `apps/desktop`

Keep this as one vertical slice.

---

## 15. Recommended Implementation Order

1. Locate current dashboard summary API route and calculation logic.
2. Identify exact dashboard response shape.
3. Create `packages/data-access` repository interface.
4. Create `packages/domain` dashboard types and pure calculator.
5. Move/port dashboard summary logic into domain service.
6. Implement Postgres dashboard repository using existing Prisma queries.
7. Update API route to call shared service.
8. Confirm web dashboard still works.
9. Add desktop stub dashboard repository.
10. Add Electron IPC handler.
11. Update preload typings.
12. Update desktop Dashboard route to call and render summary.
13. Run typechecks/builds.
14. Document any follow-up refactors needed.

---

## Summary

This task proves the future architecture:

```txt
shared product intelligence
+ cloud data adapter
+ desktop local adapter
```

without introducing SQLite or a large backend rewrite yet.
