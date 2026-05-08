# Conventions

## Git Workflow
- **Never automatically commit changes** — make the changes, run linting/checks, but let the user review and commit manually
- After making code changes, suggest the user review with `git diff` before committing
- Only stage files (`git add`) if explicitly requested by the user

## File Naming
- Use kebab-case for all file names (e.g. `my-component.tsx`, not `MyComponent.tsx`)

## Import Paths
- **Web app (`apps/web`)**: Use `~/` path alias for all imports (e.g. `import { Button } from "~/components/ui/button"`)
  - The `~/` alias maps to `src/*` in tsconfig
  - Never use `@/` in the web app — this will cause TypeScript errors
- **API app (`apps/api`)**: Use relative imports or `~/` alias
- Verify tsconfig.json path mappings before creating new imports

## Component Organization & Modularity
- **Prefer modular components**: Break large component files into smaller, focused modules
- **Extract reusable components**: When a component file contains multiple sub-components (like `CategoryInput`, `ConditionRowUI`, `ActionRowUI` in a dialog), consider extracting them into separate files
- **Use sub-directories for related components**: Group related components in a dedicated directory structure
  - Example: `rule-builder-dialog/` containing `index.tsx`, `category-input.tsx`, `condition-row.tsx`, `action-row.tsx`, `preview-row.tsx`
- **Extract utility functions**: Helper functions and type definitions should live in separate utility files when they grow beyond simple one-liners
- **Single Responsibility**: Each file should ideally export one primary component or function
- **Counter-example**: Avoid files that contain multiple components and multiple utility functions in a single 300+ line file. For stores or hooks with functions it's okay to have those be long files. This is mainly just for the .tsx files.

## State Management
- **Zustand for UI state, React Query for server state**
- **Default to plain Zustand**: Use standard `set` updates for most stores
- **Immer is opt-in, not default**: Only use for deeply nested or multi-field updates that are hard to read with plain updates
- **Avoid Immer for simple state**: Booleans, IDs, modals, tabs, shallow objects
- **Keep stores small**: If Immer feels needed everywhere, split the store
- **Use `useShallow` for object selectors**
- **Inject external deps via setters (not props)**
- **Expose focused selector hooks (e.g. `useFilterState`)**

## Linting
- After any code changes, run `pnpm --filter fin-web run check:write` from the project root, or `pnpm run check:write` from `apps/web/` to ensure code is in line with linting rules
- For the API app: `pnpm --filter fin-api run check` from the project root, or `pnpm run check` from `apps/api/`

## TypeScript — Avoiding Type Assertions

- **Shared-context procedures**: middleware should resolve a `userId: string` into context once rather than asserting per-procedure.
- **Double-calling functions to check + use**: assign to a `const` first, then narrow with `!== undefined`. Never call the same function twice to assert the second result.
- **`Map.get()` after `Map.set()`**: use `get()` → null check → `set()`, keeping a direct reference. Don't `.get()!` after `.set()`.
- **`array.at(-1)!`**: guard with `const last = arr.at(-1); if (!last) return ...` instead of asserting.
- **`biome-ignore` is acceptable** when suppression is genuinely the right answer (e.g. `document.cookie` — Cookie Store API not widely supported).

## API Handler Wrappers

All API handlers in `apps/api/src/server/handlers/` must use wrapper functions from `handler-wrappers.ts` instead of manual auth checks. Use `withAuth` for handlers that require authentication and `withPublic` for unauthenticated endpoints. These wrappers guarantee `userId` is a non-null string in authenticated handler context, eliminating the error-prone pattern of checking `if (!ctx.userId)` inside each handler.

## Conclusion
At the end of every prompt we run, especially the larger one, end with a commit message for me in the form of a codeblock so I can copy it. The commit message should be formatted like `feat (web): creates weekly chart usage report` where:
    - The prefix matches the branch type (feat|fix|chore)
    - the () represents where in the app changes were made. If changes were made in all platforms (web and api) then don't put anything. Else, specify which platform it was for.
    - The description is lowercase and concise
    - Keep it only one line and 5-7 words long. Very brief and to the point.

## PostHog Analytics Rules
- Event naming: `<domain>_<object>_<action>` (snake_case)
- Examples: `auth_login_completed`, `transaction_edit_completed`, `rule_created`, `forecast_viewed`
- Never use vague events like `button_clicked`
- Authenticated events should include:
  ```ts
  { userId?: string }
  ```
* If logged in → include `userId`
* Track page views manually on route change using:
  `$pageview` with `{ path }`
* Never send:
  * PII (email, account numbers)
  * raw transaction data
  * merchant names
* Only send:
  * counts, booleans, enums
* Track only meaningful actions (rules, forecasts)
* Avoid noisy or low-value events

## Logging Rules
- Use the shared logger, not raw `console.*` for app errors
- Log all meaningful failures, especially in `catch` blocks, error branches, and before re-throwing
- Use structured logs with useful context when available: `userId`, feature, operation, route/procedure
- Use `warn` for recoverable issues and `error` for failed operations
- Never log secrets, tokens, PII, account numbers, routing numbers, raw transaction descriptions, or full sensitive payloads
- Avoid noisy logs; prefer one high-quality log at the failure boundary