# Task: Create Electron Desktop Shell (`apps/desktop`)

## Goal

Create a new Electron-based desktop app inside the monorepo at:

```txt
apps/desktop
```

This is a **foundational shell only**.

Do NOT implement:

* database
* Prisma
* Plaid
* CSV import
* backend logic
* shared architecture refactor

We are only proving:

```txt
Electron app boots
React UI renders
Basic layout + routing works
Secure Electron setup is in place
```

---

## Monorepo Context

Existing apps:

```txt
apps/web
apps/api
apps/marketing
apps/ios
```

Packages:

```txt
packages/shared
packages/client-ts
packages/openapi
```

Stack:

* TypeScript
* pnpm workspace
* Tailwind
* shadcn/ui
* Biome

---

## Requirements

### 1. Create App Structure

```txt
apps/desktop/
  package.json
  tsconfig.json
  vite.config.ts
  electron/
    main.ts
    preload.ts
  src/
    main.tsx
    App.tsx
    styles.css
    routes/
      Dashboard.tsx
      Transactions.tsx
      Settings.tsx
    components/
      DesktopShell.tsx
      Sidebar.tsx
  public/
  README.md
```

Follow existing repo conventions for naming and config where possible.

---

## 2. Tech Stack

Use:

* Electron
* Vite
* React
* TypeScript
* Tailwind (if easy to wire in)

Prefer:

* `electron-vite` or similar minimal setup

---

## 3. Scripts

Add working scripts:

```json
{
  "dev": "...",
  "build": "...",
  "preview": "...",
  "typecheck": "tsc --noEmit",
  "lint": "biome check ."
}
```

Must support:

```bash
pnpm --filter desktop dev
pnpm --filter desktop build
pnpm --filter desktop typecheck
```

Match naming conventions of other apps.

---

## 4. Electron Setup (IMPORTANT)

### main.ts

* create BrowserWindow
* load renderer
* handle dev vs prod URL
* basic window config

### preload.ts

Expose minimal safe API:

```ts
contextBridge.exposeInMainWorld("finDesktop", {
  platform: process.platform,
  version: "0.0.1",
});
```

Add TypeScript types for `window.finDesktop`.

---

## 5. Security (REQUIRED)

BrowserWindow config must include:

```ts
contextIsolation: true
nodeIntegration: false
enableRemoteModule: false
```

If compatible:

```ts
sandbox: true
```

Do NOT expose Node APIs directly to the renderer.

All future functionality must go through preload.

---

## 6. Renderer App

### Entry

```txt
src/main.tsx
```

Standard React root.

---

### App Layout

Create a simple desktop UI shell:

```txt
┌──────────────────────────────────────────────┐
│ Fin Desktop                                  │
├──────────────┬───────────────────────────────┤
│ Dashboard    │                               │
│ Transactions │       Main content area        │
│ Settings     │                               │
└──────────────┴───────────────────────────────┘
```

---

### Sidebar Component

Left nav with:

* Dashboard
* Transactions
* Settings

Simple active state.

---

### Routing

Use one of:

* React Router
* or simple state-based routing

Keep it minimal.

---

### Routes

#### Dashboard.tsx

```txt
Fin Desktop

Your financial data will live locally on this device.
```

---

#### Transactions.tsx

```txt
Transactions

CSV, OFX, QFX, QBO, and Plaid-powered local sync coming soon.
```

---

#### Settings.tsx

```txt
Settings

Local database: Coming soon
Encryption: Coming soon
Bank sync: Coming soon
```

---

## 7. Styling

* Use Tailwind if easy
* Otherwise minimal CSS
* Keep it clean but not over-polished

---

## 8. Workspace Integration

Ensure:

```bash
pnpm install
```

picks up the new app.

Update workspace config if needed.

---

## 9. README

Create:

```txt
apps/desktop/README.md
```

Include:

### What this is

Electron-based local desktop app shell for Fin.

### Current state

* UI shell only
* no data layer
* no database
* no sync

### Future architecture (important)

```txt
Renderer (React UI)
  ↓
Preload bridge
  ↓
Electron main process
  ↓
Local services
  ↓
SQLite database
```

List future modules:

* SQLite database
* Prisma SQLite
* CSV/OFX import
* Plaid local sync
* rules engine
* forecasting engine

---

## 10. Acceptance Criteria

Must pass all:

* App runs with `pnpm --filter desktop dev`
* Window opens successfully
* React UI renders
* Sidebar navigation works
* No runtime errors
* TypeScript passes
* Build succeeds
* Preload is wired correctly
* Security settings are correct
* No large changes to other apps
* README exists and is accurate

---

## 11. Constraints

Do NOT:

* import from apps/api
* implement backend logic
* add Prisma
* add SQLite
* add Plaid
* refactor existing architecture
* move shared code yet

Keep this focused and minimal.

---

## 12. Output

After implementation:

Provide:

1. File tree
2. Key files (main.ts, preload.ts, App.tsx)
3. How to run
4. Any issues encountered
5. Suggestions for next step (brief)

---

## Summary

This task is only about:

```txt
Getting a secure Electron + React desktop shell running inside the monorepo.
```
