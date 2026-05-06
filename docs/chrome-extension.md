# Fin Retail Sync Chrome Extension — Implementation Plan

## Goal

Build a Manifest V3 Chrome extension for Fin that lets users import retail purchase/order data from retailers like Amazon, Walmart, and Target into Fin.

The extension should:

- Let users authenticate with their Fin account.
- Let users connect supported retailers one at a time.
- Request narrow host permissions per retailer.
- Use a user-initiated sync flow.
- Open retailer order pages in an inactive/background tab when possible.
- Scrape order/item data from the retailer page HTML using content scripts.
- Store parsed sync results locally in the extension.
- Send normalized retail order data to the Fin API.
- Provide an extension “home” page where users can review scraped data by retailer.
- Avoid doing full categorization/editing inside the extension. That belongs in the Fin web app.

Use **WXT + React + TypeScript** for the extension. WXT has strong MV3 support and works well with React/TypeScript. Chrome MV3 uses service workers instead of persistent background pages, and content scripts run in isolated page contexts, so architecture should keep orchestration in the background worker and DOM parsing in content scripts. Chrome also requires host permissions or `activeTab` access to inject scripts into retailer pages. :contentReference[oaicite:0]{index=0}

---

## Product Positioning

Do not frame this as “silent background scraping.”

Frame it as:

> Browser-assisted retail purchase import.

The user explicitly chooses which retailers to connect and clicks sync. The extension may open an inactive tab and scrape the page, but the sync should be user-triggered and transparent.

This matters for trust, reliability, and Chrome Web Store policy. Chrome’s Limited Use policy requires data use to match disclosed practices and to be limited to what is necessary for the user-facing feature. :contentReference[oaicite:1]{index=1}

---

## Monorepo Structure

Add:

```txt
apps/extension
packages/retail-sync
````

Recommended structure:

```txt
apps/extension
  entrypoints/
    popup/
      App.tsx
      main.tsx
    sidepanel/
      App.tsx
      main.tsx
    background.ts
    amazon.content.ts
    walmart.content.ts
    target.content.ts
  components/
    RetailerCard.tsx
    SyncStatusBadge.tsx
    OrderPreviewList.tsx
    ItemPreviewRow.tsx
  lib/
    auth.ts
    chrome-storage.ts
    fin-api.ts
    messaging.ts
    permissions.ts
    sync-orchestrator.ts
    retailers.ts
  wxt.config.ts
  package.json
  tsconfig.json

packages/retail-sync
  src/
    schemas.ts
    normalized-types.ts
    retailers/
      amazon/
        parser.ts
        selectors.ts
        fixtures/
      walmart/
        parser.ts
        selectors.ts
        fixtures/
      target/
        parser.ts
        selectors.ts
        fixtures/
    validation.ts
    dedupe.ts
```

Use `packages/retail-sync` for parser/domain logic so it can be tested outside the extension.

---

## Extension Framework

Use **WXT**.

Reasons:

* React + TypeScript friendly.
* Good MV3 support.
* Good dev server/build ergonomics.
* Supports popup, content scripts, background service workers, options pages, and side panels.
* Easier than raw Vite extension setup.

Do not use a raw Chrome extension setup unless WXT blocks something important.

---

## MV3 Permissions

Start minimal.

Use:

```ts
permissions: [
  "storage",
  "tabs",
  "scripting",
  "cookies"
]
```

Use optional host permissions:

```ts
optional_host_permissions: [
  "https://www.amazon.com/*",
  "https://smile.amazon.com/*",
  "https://www.walmart.com/*",
  "https://www.target.com/*"
]
```

Important rules:

* Request host permissions only when user connects a retailer.
* Do not request `<all_urls>`.
* Do not transmit retailer cookies to Fin.
* Use cookies only locally to detect likely login state.
* Do not attempt to bypass MFA, CAPTCHA, bot protection, or login walls.

---

## High-Level Architecture

```txt
Popup / Home UI
  ↓
Background service worker
  ↓
Inactive retailer tab
  ↓
Retailer content script
  ↓
Parse DOM into normalized orders
  ↓
Background validates + stores locally
  ↓
Background sends to Fin API
  ↓
Extension home shows imported data
```

Responsibilities:

### Popup / Home UI

* Login/logout with Fin.
* Show connected retailers.
* Show sync status.
* Let user start retailer sync.
* Show recently scraped orders/items.
* Show errors like “Amazon login required.”
* Link to Fin web app for categorization/reconciliation.

### Background Service Worker

* Owns sync orchestration.
* Opens inactive tabs.
* Injects or communicates with content scripts.
* Receives parsed data.
* Validates data.
* Writes local sync cache.
* Calls Fin API.
* Closes temporary tabs when safe.

### Content Scripts

* Run on retailer order pages.
* Read DOM/HTML.
* Extract order cards, totals, dates, order IDs, item titles, item prices, quantities, product URLs, image URLs, SKUs/ASINs when available.
* Return normalized data to background worker.
* Do not call Fin API directly.

### `packages/retail-sync`

* Defines normalized schemas.
* Contains retailer parser logic.
* Contains test fixtures.
* Contains dedupe helpers.
* Contains validation.

---

## User Flows

### 1. First install

```txt
User installs extension
  ↓
Opens popup
  ↓
Sees “Connect Fin”
  ↓
Clicks login
  ↓
Fin web app opens OAuth/session exchange page
  ↓
Extension receives extension auth token
  ↓
Popup shows retailer connection cards
```

### 2. Connect Amazon

```txt
User clicks “Connect Amazon”
  ↓
Extension requests amazon.com host permission
  ↓
If granted, extension stores RetailConnection locally
  ↓
User sees “Amazon connected”
```

### 3. Sync Amazon

```txt
User clicks “Sync Amazon”
  ↓
Background checks for Amazon session cookies locally
  ↓
Background opens https://www.amazon.com/your-orders/orders in inactive tab
  ↓
Waits for page load
  ↓
Injects content script / sends scrape message
  ↓
Content script parses visible orders
  ↓
If logged out, return LOGIN_REQUIRED
  ↓
If orders found, return normalized order payload
  ↓
Background validates payload
  ↓
Background stores local copy
  ↓
Background posts data to Fin API
  ↓
Popup/home updates sync status
```

### 4. Login required

```txt
Amazon tab opens
  ↓
Content script detects sign-in page
  ↓
Background marks sync as LOGIN_REQUIRED
  ↓
Popup says “Amazon login required”
  ↓
User clicks “Open Amazon”
  ↓
Tab becomes active
  ↓
User logs in manually
  ↓
User returns to extension and clicks “Continue sync”
```

### 5. View scraped data

The extension should have a home page, ideally as a popup with a “Open full view” button or Chrome side panel.

Home should show:

```txt
Retail Sync

Connected retailers:
- Amazon: connected, last synced 2 minutes ago
- Walmart: not connected
- Target: not connected

Recent imports:
Amazon
  Order #123-4567890-1234567
  Date: Apr 22, 2026
  Total: $84.21
  Items:
    - Dog food — $42.99
    - USB-C cable — $13.99
    - Household cleaner — $8.49

Actions:
- Sync again
- Delete local import cache
- Open in Fin
```

Do not build advanced categorization here. Just show what was scraped.

---

## Local Storage Model

Use `chrome.storage.local`.

Store only what is needed.

```ts
type ExtensionState = {
  auth: {
    finUserId: string;
    accessToken: string;
    expiresAt: string;
  } | null;

  retailConnections: RetailConnectionState[];

  importsByRetailer: Record<string, RetailImportSnapshot[]>;

  syncRuns: RetailSyncRun[];
};
```

Connection:

```ts
type RetailConnectionState = {
  retailer: "amazon" | "walmart" | "target";
  enabled: boolean;
  permissionGranted: boolean;
  lastSyncedAt: string | null;
  lastStatus:
    | "never_synced"
    | "syncing"
    | "success"
    | "login_required"
    | "permission_required"
    | "parse_error"
    | "api_error";
};
```

Sync run:

```ts
type RetailSyncRun = {
  id: string;
  retailer: "amazon" | "walmart" | "target";
  startedAt: string;
  completedAt: string | null;
  status: "success" | "failed" | "partial";
  ordersFound: number;
  ordersUploaded: number;
  errorCode?: string;
  errorMessage?: string;
};
```

---

## Normalized Retail Schema

Create in `packages/retail-sync/src/normalized-types.ts`.

```ts
export type Retailer = "amazon" | "walmart" | "target";

export type RetailOrderImport = {
  retailer: Retailer;
  externalOrderId: string;
  orderDate: string | null;
  orderUrl?: string;
  currency: "USD";

  subtotal?: number | null;
  tax?: number | null;
  shipping?: number | null;
  discount?: number | null;
  total?: number | null;

  items: RetailOrderItemImport[];

  raw: {
    sourceUrl: string;
    scrapedAt: string;
    parserVersion: string;
    pageHash?: string;
  };
};

export type RetailOrderItemImport = {
  externalItemId?: string | null;
  title: string;
  quantity?: number | null;
  unitPrice?: number | null;
  totalPrice?: number | null;
  productUrl?: string | null;
  imageUrl?: string | null;
  sku?: string | null;
  asin?: string | null;
};
```

Validation:

* Use Zod.
* Reject empty orders.
* Reject orders without `externalOrderId` unless retailer genuinely does not expose one.
* Allow item prices to be null.
* Allow total to be null.
* Keep parser resilient.

---

## Fin API Endpoints

Add to `apps/api`.

### Auth

```txt
POST /extension/auth/start
POST /extension/auth/exchange
POST /extension/auth/refresh
POST /extension/auth/revoke
```

Purpose:

* Let the extension authenticate without stealing web cookies.
* Use a short-lived exchange from the Fin web app.
* Store an extension access token in `chrome.storage.local`.

### Retail connections

```txt
GET    /retail/connections
POST   /retail/connections
PATCH  /retail/connections/:id
DELETE /retail/connections/:id
```

### Retail imports

```txt
POST /retail/imports
GET  /retail/imports
GET  /retail/imports/:id
```

`POST /retail/imports` accepts:

```ts
type CreateRetailImportRequest = {
  retailer: "amazon" | "walmart" | "target";
  orders: RetailOrderImport[];
  syncRunId: string;
};
```

The API should:

* Authenticate user.
* Validate payload.
* Dedupe by `(userId, retailer, externalOrderId)`.
* Upsert orders.
* Upsert items.
* Store raw parse metadata.
* Return counts: created, updated, skipped.

---

## Database Model

Add Prisma models roughly like:

```prisma
model RetailConnection {
  id             String   @id @default(cuid())
  userId         String
  retailer       String
  status         String
  lastSyncedAt   DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([userId, retailer])
}

model RetailOrder {
  id              String   @id @default(cuid())
  userId          String
  retailer        String
  externalOrderId String
  orderDate       DateTime?
  orderUrl        String?
  currency        String   @default("USD")
  subtotal        Decimal?
  tax             Decimal?
  shipping        Decimal?
  discount        Decimal?
  total           Decimal?
  sourceUrl       String?
  scrapedAt       DateTime
  parserVersion   String
  pageHash        String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  items RetailOrderItem[]

  @@unique([userId, retailer, externalOrderId])
}

model RetailOrderItem {
  id             String   @id @default(cuid())
  retailOrderId  String
  externalItemId String?
  title          String
  quantity       Int?
  unitPrice      Decimal?
  totalPrice     Decimal?
  productUrl     String?
  imageUrl       String?
  sku            String?
  asin           String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  retailOrder RetailOrder @relation(fields: [retailOrderId], references: [id], onDelete: Cascade)
}
```

Later we can add reconciliation:

```prisma
model RetailOrderTransactionMatch {
  id            String @id @default(cuid())
  retailOrderId String
  transactionId String
  confidence    Float
  status        String
}
```

But do not build reconciliation in V1 unless needed.

---

## Retailer Parser Strategy

Each retailer gets a parser module.

```ts
export type RetailerParser = {
  retailer: Retailer;
  parserVersion: string;
  canParse(url: string, document: Document): boolean;
  detectState(document: Document): RetailerPageState;
  parseOrders(document: Document, url: string): RetailOrderImport[];
};
```

Page states:

```ts
type RetailerPageState =
  | "orders_page"
  | "login_required"
  | "captcha_or_bot_check"
  | "unsupported_page"
  | "empty_orders"
  | "unknown";
```

Parser rules:

1. Prefer structured embedded data if available.
2. Then use stable semantic selectors.
3. Then fallback to text extraction.
4. Never fail the whole sync because one item cannot be parsed.
5. Return partial results with warnings.

---

## Amazon V1 Scope

Start with Amazon only.

Support:

* Current orders page.
* Visible page import.
* Basic pagination only if easy.
* Order ID.
* Order date.
* Order total.
* Item title.
* Item image.
* Item URL.
* Item price when visible.

Do not support in V1:

* Archived orders.
* Digital orders.
* Business accounts.
* Multiple countries.
* Returns/refunds.
* Subscribe & Save nuance.
* Full automatic historical crawling.

Add Walmart and Target after Amazon parser architecture is stable.

---

## Background Sync Orchestrator

Create `apps/extension/lib/sync-orchestrator.ts`.

Core function:

```ts
export async function syncRetailer(retailer: Retailer): Promise<SyncResult>
```

Steps:

1. Check Fin auth.
2. Ensure host permission.
3. Optionally check local cookies for likely login.
4. Open retailer orders URL in inactive tab.
5. Wait for complete load.
6. Inject scraper or message content script.
7. Receive parse result.
8. Validate normalized orders.
9. Store local import snapshot.
10. POST to Fin API.
11. Update sync run.
12. Close temporary tab if it was opened by the extension.

Important: MV3 service workers are not persistent. Persist sync state frequently in `chrome.storage.local`.

---

## Messaging

Use typed messages.

```ts
type ExtensionMessage =
  | { type: "SYNC_RETAILER"; retailer: Retailer }
  | { type: "SCRAPE_RETAILER_PAGE"; retailer: Retailer }
  | { type: "SCRAPE_RESULT"; payload: ScrapeResult }
  | { type: "AUTH_UPDATED" };
```

Content script response:

```ts
type ScrapeResult = {
  retailer: Retailer;
  pageState: RetailerPageState;
  orders: RetailOrderImport[];
  warnings: string[];
  parserVersion: string;
};
```

---

## Extension Home UI

Build a real homepage-like view, either:

* Popup for quick controls.
* Side panel/full extension page for detailed review.

Recommended:

```txt
Popup
  - Compact status
  - Sync buttons
  - Open Retail Sync Home

Side panel or extension page
  - Full retailer dashboard
  - Scraped orders/items
```

Home page sections:

```txt
Header:
  Fin Retail Sync
  Connected as user@email.com

Retailers:
  Amazon card
    Status
    Last sync
    Orders imported
    Sync button
    Manage permission

  Walmart card
  Target card

Recent scraped data:
  Filter by retailer
  List order cards
  Expand order to see items

Data controls:
  Clear local cache
  Disconnect retailer
  Open imported data in Fin
```

Order card:

```txt
Amazon
Order #123-4567890-1234567
Apr 22, 2026 · $84.21 · 3 items

- Dog food — $42.99
- USB-C cable — $13.99
- Household cleaner — $8.49
```

Do not add category editing here.

Add a CTA:

```txt
“Categorize and reconcile in Fin”
```

---

## Security / Privacy Requirements

Must-have:

* No retailer passwords collected.
* No retailer cookies sent to Fin.
* No hidden credential capture.
* No bypassing CAPTCHA/MFA.
* No broad browsing history collection.
* Only scrape supported retailer order pages.
* Disclose exactly what data is collected:

  * order IDs
  * order dates
  * item names
  * item prices
  * order totals
  * product URLs/images
* Let user delete local cache.
* Let user disconnect a retailer.
* Let user revoke extension auth.

Chrome Web Store review will care about narrow purpose, minimal permissions, and clear disclosure. ([Chrome for Developers][1])

---

## V1 Build Phases

### Phase 1 — Extension shell

* Add `apps/extension`.
* Configure WXT + React + TypeScript.
* Add popup UI.
* Add side panel or extension home page.
* Add shared styling compatible with Fin design system where practical.
* Add storage wrapper.
* Add typed message utilities.

### Phase 2 — Fin extension auth

* Add extension auth endpoints.
* Add login button in extension.
* Implement auth exchange with Fin web app.
* Store extension token locally.
* Show logged-in state.

### Phase 3 — Amazon permission + sync skeleton

* Add Amazon retailer card.
* Request optional host permission.
* Open Amazon orders page in inactive tab.
* Detect login required vs orders page.
* Show sync status.

### Phase 4 — Amazon parser

* Implement Amazon content script.
* Parse visible orders.
* Normalize data.
* Store local snapshots.
* Show scraped data in extension home.

### Phase 5 — API upload

* Add retail import API endpoint.
* Add Prisma models.
* Upload parsed orders.
* Dedupe by external order ID.
* Show uploaded counts.

### Phase 6 — Walmart/Target adapter foundation

* Add disabled cards or “coming soon” state.
* Add parser interface.
* Add retailer config registry.
* Do not implement full Walmart/Target until Amazon path is stable.

---

## Acceptance Criteria

V1 is complete when:

* User can install extension locally.
* User can authenticate with Fin.
* User can grant Amazon permission only.
* User can click “Sync Amazon.”
* Extension opens Amazon orders page in inactive tab.
* If logged out, user gets a clear “login required” message.
* If logged in, extension parses visible Amazon orders.
* Parsed orders appear in extension home.
* Parsed orders upload to Fin API.
* Duplicate sync does not create duplicate orders.
* User can clear local scraped cache.
* User can disconnect Amazon.
* No retailer cookies are sent to Fin.
* No `<all_urls>` permission is used.

---

## Non-Goals for V1

Do not build:

* Fully silent periodic background sync.
* Full historical crawling.
* Advanced categorization in the extension.
* Plaid transaction matching.
* Refund handling.
* Multi-country Amazon support.
* Mobile support.
* Browser support beyond Chrome.
* Anything that bypasses retailer login, CAPTCHA, MFA, or anti-bot systems.

---

## Final Recommendation

Build this as a transparent, user-triggered retail import assistant.

The technical architecture can still feel magical:

* User clicks sync.
* Extension opens Amazon in an inactive tab.
* It scrapes the orders page.
* It imports the data into Fin.

But keep the permission model, copy, and implementation honest: this is browser-assisted import, not silent account scraping.

```
::contentReference[oaicite:3]{index=3}
```

[1]: https://developer.chrome.com/docs/webstore/program-policies/policies?utm_source=chatgpt.com "Chrome Web Store - Program Policies | Chrome for Developers"
