# Auth + Prisma Migration Plan

## Objective
Move to an API-only server/data architecture where `apps/web` is a thin UI wrapper and `apps/api` owns all database and server logic.

## Current Status (Verified)
- `apps/web` auth still depends on Prisma through NextAuth config (`PrismaAdapter` + direct DB lookup).
- `apps/web` still has Prisma client usage and Prisma-related package scripts/dependencies.
- `apps/api` auth context can read web NextAuth session cookies, so auth behavior is currently coupled.
- Deleting web Prisma immediately is **not safe** yet.

## Risks If Web Prisma Is Removed Too Early
- Auth regression in credentials and/or OAuth sign-in flows.
- Build/install failures from leftover Prisma scripts/hooks in `apps/web`.
- Session/identity mismatches between web middleware/session and API handlers.

## Migration Phases

### Phase 0: Freeze + Baseline
- Do not delete any additional web auth/prisma files yet.
- Capture baseline behavior:
  - Credentials sign-in works.
  - Google sign-in works.
  - Middleware redirect protection works.
  - Dashboard/onboarding session reads work.

Exit criteria:
- Baseline behavior documented and reproducible.

### Phase 1: API-Backed Auth Contract
- Define API endpoints for web auth needs:
  - Validate credentials.
  - Resolve user profile needed for session token claims.
  - OAuth account link/create handling.
- Ensure payloads are minimal and do not expose sensitive data.

Exit criteria:
- Web can perform all auth checks without direct DB access.

### Phase 2: Refactor Web NextAuth Off Prisma
- Remove `PrismaAdapter` from web auth config.
- Replace web-side DB lookups with API calls in NextAuth authorize/callback flow.
- Keep session strategy as JWT in web.
- Ensure 2FA behavior remains intact (or explicitly document temporary constraints).

Exit criteria:
- Web auth path has zero direct Prisma usage.

### Phase 3: Remove Web Prisma Runtime Coupling
- Remove `apps/web` usage of Prisma client singleton.
- Remove Prisma deps/scripts from `apps/web/package.json` (including postinstall generation hooks if present).
- Remove/generated cleanup in `apps/web/generated/prisma` after validation.

Exit criteria:
- `apps/web` installs/builds without Prisma dependencies.

### Phase 4: Delete Web Prisma Artifacts
- Delete `apps/web/prisma` and remaining web Prisma generated artifacts.
- Re-run checks and smoke test auth flows.

Exit criteria:
- All checks pass and auth behavior matches baseline.

## Validation Checklist (Run After Each Phase)
- Typecheck/lint for changed app(s).
- Credentials login.
- Google OAuth login.
- 2FA path (if enabled on test account).
- Middleware redirects for signed-out/signed-in users.
- Dashboard page SSR session read.
- API requests from web with authenticated context.

## Rollback Strategy
- Keep refactor in small commits by phase.
- If auth regression appears:
  - Revert only the last phase.
  - Re-verify baseline tests.
  - Patch forward with targeted fix.

## Notes
- `apps/api` should remain source-of-truth for Prisma schema and migrations.
- Treat this plan as the checkpoint document to resume implementation safely.
