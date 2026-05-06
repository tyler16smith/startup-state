# Task 3: Add SQLite Foundation for Desktop App

## Goal

Add the local SQLite foundation for `apps/desktop`.

This task should create the infrastructure for a local database, but it should **not yet replace the dashboard stub repository** unless trivial. The main goal is to prove that the desktop app can create, migrate, and query a local SQLite database.

## Requirements

### 1. Local Database Location

On app startup, resolve an OS-appropriate app data directory.

Use Electron’s app path utilities.

Target locations:

```txt
macOS:
~/Library/Application Support/Fin/fin.db

Windows:
%APPDATA%/Fin/fin.db

Linux:
~/.config/Fin/fin.db
````

Do not store the database inside the app bundle.

---

## 2. Add SQLite Prisma Package

Create a new package:

```txt
packages/db-sqlite
```

Suggested structure:

```txt
packages/db-sqlite/
  package.json
  tsconfig.json
  prisma/
    schema.prisma
  src/
    index.ts
    createSqliteClient.ts
    ensureLocalDatabase.ts
    migrations.ts
```

Use existing monorepo package naming conventions.

---

## 3. Prisma SQLite Schema

Create an initial SQLite schema that supports the minimum local data model.

Start small.

Include:

```txt
LocalUser
Account
Transaction
```

Keep fields aligned with the cloud schema where possible.

Recommended direction:

```prisma
model LocalUser {
  id        String   @id
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  accounts     Account[]
  transactions Transaction[]
}

model Account {
  id             String   @id
  userId         String
  name           String
  type           String
  institutionName String?
  currentBalance Decimal?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  user         LocalUser     @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions Transaction[]
}

model Transaction {
  id           String   @id
  userId       String
  accountId    String?
  date         DateTime
  amount       Decimal
  merchantName String?
  description  String?
  categoryName String?
  pending      Boolean  @default(false)
  source       String   @default("manual")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  user    LocalUser @relation(fields: [userId], references: [id], onDelete: Cascade)
  account Account?  @relation(fields: [accountId], references: [id], onDelete: SetNull)
}
```

Adjust as needed based on existing app types.

Do not attempt to fully mirror the cloud schema yet.

---

## 4. Migrations

Add a migration workflow for local SQLite.

The app should be able to:

```txt
1. Create the DB file if missing
2. Run migrations
3. Seed a default local user if missing
```

Default local user:

```txt
id = "local-user"
```

Use the simplest reliable approach compatible with Electron packaging.

Document any Prisma/Electron packaging caveats discovered.

---

## 5. Desktop App Startup

In `apps/desktop`, initialize the local database from the Electron main process.

Startup flow:

```txt
Electron app ready
  ↓
resolve local DB path
  ↓
ensure local app data directory exists
  ↓
initialize Prisma SQLite client
  ↓
run migrations / ensure schema
  ↓
seed local user
  ↓
open window
```

Do not expose the Prisma client to the renderer.

---

## 6. Add Minimal IPC Health Check

Expose a narrow desktop API:

```ts
window.finDesktop.localDb.getStatus()
```

Return:

```ts
{
  ok: boolean;
  dbPath: string;
  hasLocalUser: boolean;
}
```

This is only for development/debugging.

Use the preload bridge.

Do not expose arbitrary DB access.

---

## 7. Settings Page UI

Update the desktop Settings page to call:

```ts
window.finDesktop.localDb.getStatus()
```

Display:

```txt
Local database: Ready
Path: [db path]
Local user: Created
```

Keep it simple.

---

## 8. Add First Real Local Query

Add a minimal query through the local SQLite client to confirm the database works.

Examples:

```txt
count local users
count accounts
count transactions
```

Do not build full dashboard functionality yet.

---

## 9. Security

Keep Electron security settings:

```txt
contextIsolation: true
nodeIntegration: false
sandbox: true if compatible
minimal preload API
```

Renderer must not import:

```txt
fs
path
prisma
electron main modules
```

---

## 10. Acceptance Criteria

Must satisfy:

```txt
- packages/db-sqlite exists
- SQLite Prisma schema exists
- Desktop app creates local app data directory
- Desktop app creates or opens fin.db
- Migrations/schema initialization works
- Default local user is created if missing
- Desktop Settings page shows DB status
- Renderer has no direct filesystem or Prisma access
- TypeScript passes
- Desktop dev app runs
- Desktop build passes if practical
```

---

## 11. Do Not Implement

Do not add:

```txt
- Plaid
- CSV import
- encryption
- transaction import UI
- real dashboard replacement
- full local repository layer
- auto-updates
- signing/notarization
```

---

## 12. Output

After implementation, provide:

```txt
1. Files changed
2. How the local DB path is resolved
3. How migrations run
4. How to test locally
5. Any Prisma/Electron packaging concerns
6. Recommended next step
```

````

```md
# Task 4: Replace Desktop Dashboard Stub With SQLite Repository

## Goal

Replace the desktop dashboard stub repository with a real SQLite-backed repository.

This task wires the existing shared dashboard domain service to the local SQLite database in `apps/desktop`.

At the end:

```txt
Desktop Dashboard
  ↓
window.finDesktop.dashboard.getSummary()
  ↓
Electron preload
  ↓
Electron main IPC handler
  ↓
shared dashboard domain service
  ↓
SQLite dashboard repository
  ↓
local fin.db
````

No cloud API should be used by desktop for this dashboard summary.

---

## Prerequisites

This assumes these already exist:

```txt
apps/desktop
packages/domain
packages/data-access
packages/db-sqlite
```

And:

```txt
packages/domain/dashboard
```

already has:

```txt
getDashboardSummary
calculateDashboardSummary
DashboardSummary types
```

And:

```txt
packages/data-access
```

already has:

```txt
DashboardRepository interface
```

---

## 1. Add SQLite Dashboard Repository

In:

```txt
packages/db-sqlite
```

add:

```txt
src/repositories/SqliteDashboardRepository.ts
```

It should implement the existing `DashboardRepository` interface.

Required methods should match the interface from Task 2, likely:

```ts
listTransactionsForSummary(input)
listAccountsForSummary(input)
listInvestmentsForSummary(input)
```

If investments are not yet in the SQLite schema, return an empty array for now and leave a TODO.

Do not change the shared interface unless absolutely necessary.

---

## 2. Use Local Prisma Client

Repository should use the SQLite Prisma client created in Task 3.

Example shape:

```ts
export function createSqliteDashboardRepository(
  prisma: SqlitePrismaClient
): DashboardRepository {
  return {
    async listTransactionsForSummary(input) {
      const transactions = await prisma.transaction.findMany({
        where: {
          userId: input.userId,
          date: {
            gte: input.startDate,
            lte: input.endDate,
          },
        },
        orderBy: {
          date: "desc",
        },
      });

      return transactions.map(mapSqliteTransactionToDashboardTransaction);
    },

    async listAccountsForSummary(input) {
      const accounts = await prisma.account.findMany({
        where: {
          userId: input.userId,
        },
      });

      return accounts.map(mapSqliteAccountToDashboardAccount);
    },

    async listInvestmentsForSummary() {
      return [];
    },
  };
}
```

Be careful with optional date filters.

---

## 3. Add Mapper Functions

Do not leak Prisma model types into `packages/domain`.

Add mapper helpers inside `packages/db-sqlite`.

Example:

```txt
src/mappers/dashboardMappers.ts
```

Responsibilities:

```txt
SQLite Transaction → DashboardTransaction
SQLite Account → DashboardAccount
```

Handle Decimal conversion carefully.

The shared domain service should receive plain serializable values.

---

## 4. Wire Electron Main To Real Repository

Update the existing dashboard IPC handler.

Replace:

```txt
createStubDashboardRepository()
```

with:

```txt
createSqliteDashboardRepository(sqlitePrisma)
```

Flow:

```ts
ipcMain.handle("dashboard:getSummary", async (_event, input) => {
  const ctx = {
    userId: "local-user",
    repositories: {
      dashboard: createSqliteDashboardRepository(sqlitePrisma),
    },
  };

  return getDashboardSummary(ctx, input);
});
```

Keep IPC input validation.

---

## 5. Seed Sample Local Data For Development

Add a development-only seed helper so the desktop dashboard can show real local data.

Example:

```txt
packages/db-sqlite/src/seedDevData.ts
```

Seed only when:

```txt
NODE_ENV === "development"
```

or behind a clearly named flag.

Seed:

```txt
1 local user
2 accounts
10-20 transactions over recent months
```

Make it idempotent.

Do not seed duplicate transactions on every launch.

---

## 6. Update Desktop Dashboard UI

Update:

```txt
apps/desktop/src/routes/Dashboard.tsx
```

to call:

```ts
window.finDesktop.dashboard.getSummary()
```

Render simple values from the real shared summary.

Examples:

```txt
Net worth
Monthly income
Monthly expenses
Monthly net
Transaction count
Account count
```

Keep UI simple.

Do not recreate the full web dashboard yet.

---

## 7. Remove Stub Usage

Do not necessarily delete the stub file if useful for tests, but desktop runtime should no longer use it.

Add a comment if retained:

```txt
Only used for tests/dev fallback.
```

---

## 8. Keep Boundaries Clean

`apps/desktop` may import:

```txt
packages/domain
packages/db-sqlite
packages/data-access types
```

But renderer code should not import `packages/db-sqlite`.

Allowed:

```txt
Electron main process imports db-sqlite
Renderer imports only UI/client types
```

Not allowed:

```txt
apps/desktop/src/** importing Prisma or db-sqlite
```

---

## 9. Error Handling

If local DB query fails:

```txt
- log in main process
- return a safe error to renderer
- UI shows simple error state
```

Do not crash the app window for dashboard query failures.

---

## 10. Acceptance Criteria

Must satisfy:

```txt
- SqliteDashboardRepository implements DashboardRepository
- Desktop dashboard IPC uses SQLite repo, not stub repo
- Shared getDashboardSummary service is still used
- Local DB is queried through Electron main process
- Renderer has no direct DB access
- Dashboard page displays data from local SQLite
- Development seed data is idempotent
- TypeScript passes
- Desktop app runs
- Existing cloud API dashboard still works
- No SQLite code leaks into packages/domain
```

---

## 11. Do Not Implement

Do not add:

```txt
- CSV import
- OFX/QFX/QBO import
- Plaid local sync
- encryption
- production installer
- auto-updates
- full transaction management
- full web dashboard parity
```

---

## 12. Testing / Verification

Run:

```bash
pnpm --filter desktop dev
pnpm --filter desktop typecheck
pnpm --filter db-sqlite typecheck
pnpm --filter domain typecheck
pnpm --filter data-access typecheck
```

Use actual package names.

Manual verification:

```txt
1. Launch desktop app
2. Open Settings
3. Confirm local DB is ready
4. Open Dashboard
5. Confirm values come from SQLite seed data
6. Restart app
7. Confirm seed data was not duplicated
```

---

## 13. Output

After implementation, provide:

```txt
1. Files changed
2. Repository implementation summary
3. IPC flow summary
4. How sample data seeding works
5. How to verify dashboard is using SQLite
6. Follow-up recommendations
```