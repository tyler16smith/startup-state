Absolutely. Here’s a strong coding-agent prompt you can paste directly into Cursor, Claude Code, Windsurf, etc.

````md
You are a senior full-stack engineer working inside an existing Next.js application.

Your task is to build the core product for a hackathon project called **Startup State Navigator**.

This app is for the Utah Governor’s Office of Economic Development hackathon. The product must help founders discover relevant state startup resources quickly and help investors explore Utah’s startup ecosystem through a beautiful interactive map.

The existing app already has:

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- Prisma
- Postgres via Neon
- pgvector support
- NextAuth basic user authentication
- RESTful API patterns already started
- An existing OpenAI-powered chat/agent system that works well

Important: **Do not rebuild the AI chat agent. Ignore the chat-agent implementation for now.** Focus on the core product, data model, pages, admin flows, REST endpoints, resource discovery, company map, and MCP-ready API design.

The app is currently fairly bare bones. First inspect the existing codebase, understand its structure, and adapt to its conventions. Do not randomly create a conflicting architecture. Preserve existing patterns where possible.

---

# Product Vision

Build **Startup State Navigator**:

> Personalized guidance for founders. A live map of Utah’s startup economy for the world.

The app has two primary modes:

1. **Founder Navigator**
   - A founder answers a short intake.
   - The app recommends the most relevant Utah startup resources.
   - The founder can browse, filter, save, and understand resources.
   - Recommendations should feel personalized and explain why each resource matches.

2. **Utah Startup Map**
   - A beautiful Mapbox-powered ecosystem map.
   - Investors and founders can explore Utah companies by location, sector, size, hiring status, and other filters.
   - Each company has a rich profile page.
   - Businesses can create or claim their listing with a basic verification flow.

The product must feel production-quality, state-government-ready, and polished enough to demo to investors.

---

# Important Build Principles

## 1. Preserve the existing app structure

Before coding:

- Inspect the project structure.
- Identify current app router/pages structure.
- Identify existing REST API conventions.
- Identify existing Prisma setup.
- Identify existing auth/session helpers.
- Identify existing UI/component conventions.
- Reuse existing layout, config, middleware, auth, and database utilities where possible.

Do not introduce unnecessary new frameworks.

## 2. Use REST endpoints

The app should expose clean RESTful endpoints because the system needs to be MCP-ready later.

Do not build the MCP server. Just make the API clean, documented, and easy to wrap.

## 3. Do not rebuild AI chat

There is already a custom OpenAI agent working. Leave that alone.

You may create data/service functions that the chat agent could later use, but do not rebuild chat UI or chat streaming unless a small placeholder hook is already present.

## 4. Structured recommendation first, vector search second

The recommendation experience must work reliably even if embeddings are unavailable.

Use:

1. Structured metadata matching
2. Full-text/keyword search
3. pgvector semantic search where appropriate

The app should not depend on LLM calls to show recommendations.

## 5. Real data will be ingested later

Do not spend time creating a big fake dataset.

Build robust import flows and data models so real hackathon-provided spreadsheets can be ingested after the core build.

Small placeholder examples are fine only where necessary for UI empty states.

---

# Core Deliverables

Build the following:

## Public Pages

### `/`

Landing page with two clear entry points:

- “I’m building a company”
- “I’m exploring Utah’s startup ecosystem”

The landing page should be polished, modern, and investor-ready.

Include sections like:

- Personalized startup guidance
- Utah startup ecosystem map
- Resource discovery in under two minutes
- Admin-updatable content
- Built for founders and investors

Use shadcn/ui components and Tailwind.

---

### `/founder`

Founder intake flow.

This should feel fast and polished.

Collect:

- Founder/company stage
- Location or region in Utah
- Industry/sector
- Primary goals
- Business type
- Funding needs
- Hiring status
- Whether they want mentorship, capital, education, grants, networking, exporting, legal help, etc.

The intake can be a multi-step form or a single clean form.

After submission, route to:

```txt
/founder/results
````

Store the intake in the database if the user is authenticated.

If not authenticated, keep it client-side/session-based enough to show results.

---

### `/founder/results`

Show personalized recommendations.

Must include:

* Top recommended resources
* Explanation for each recommendation
* Matching badges/tags
* “Why this matches you”
* Filters/sorting
* Empty states
* Ability to save resources if logged in
* CTA to browse all resources
* CTA to view relevant companies on the map

The result page should feel like an action plan, not a search-results page.

Example card content:

```txt
Recommended because:
You are a pre-revenue founder in Southern Utah looking for capital and mentorship.
```

---

### `/resources`

Resource directory.

Features:

* Search
* Filter by stage
* Filter by sector
* Filter by goal/category
* Filter by region
* Filter by business type
* Sort by relevance/name/recently updated
* Clean card/grid layout
* Resource detail links

---

### `/resources/[id]`

Resource detail page.

Show:

* Name
* Description
* Category
* Website/link
* Contact info if available
* Tags
* Stage fit
* Sector fit
* Region fit
* Eligibility information
* Related resources
* Last updated
* Admin-edit button if admin

---

### `/map`

Mapbox GL interactive Utah startup map.

Use Mapbox GL JS.

Assume a Mapbox token is provided via:

```txt
NEXT_PUBLIC_MAPBOX_TOKEN
```

Features:

* Utah-centered map
* Company markers
* Marker clustering if supported and practical
* Sidebar/list panel
* Search companies
* Filter by:

  * Sector
  * Employee count / size
  * Stage
  * Hiring status
  * Location/region
* Click marker to show company preview
* Click through to company profile
* Empty states
* Loading states
* Responsive design

This needs to look beautiful. Use a refined, modern style. Avoid a generic “pins on a map” feel.

Include a non-map fallback/list view if Mapbox token is missing.

---

### `/companies/[id]`

Company profile page.

Must include all required fields:

* Name
* Website
* Employees
* Sector
* Year founded
* LinkedIn
* Description
* Address
* Hiring status
* Job postings
* Photo gallery

Also include:

* Claim this listing button
* Edit button if current user is approved owner or admin
* Related companies by sector/location
* Map preview if coordinates exist

---

### `/companies/new`

Self-service company creation page.

Authenticated users can submit a new company listing.

Fields should include all required company profile fields.

Initial status should be something like:

```ts
PENDING_REVIEW
```

unless existing conventions suggest otherwise.

---

### `/companies/[id]/claim`

Basic claim flow.

Keep it simple for the hackathon.

Flow:

1. User must be authenticated.
2. User enters a work email and short explanation.
3. If possible, compare email domain to company website domain.
4. Create a claim request.
5. Show pending review state.

Do not implement complex email verification unless the existing app already has an easy pattern.

Claim statuses:

```ts
PENDING
APPROVED
REJECTED
```

If approved later by admin, user can edit the company.

---

## Admin Pages

Create an admin area.

If no role system exists, add basic role support.

### Roles

Add user roles:

```ts
USER
ADMIN
COMPANY_OWNER
PENDING_COMPANY_OWNER
```

Use the existing NextAuth user/session setup and Prisma model. Extend it safely.

Add server-side authorization helpers such as:

```ts
requireAuth()
requireAdmin()
getCurrentUser()
```

Adapt names to existing conventions.

Do not break existing auth.

---

### `/admin`

Admin dashboard.

Show:

* Resource count
* Company count
* Pending company claims
* Pending company submissions
* Recently updated resources
* Recently updated companies
* Quick links

---

### `/admin/resources`

Admin resource management.

Features:

* List resources
* Search/filter
* Create resource
* Edit resource
* Delete/archive resource
* Published/draft status
* Last updated timestamp
* CSV import button
* Optional “recompute embeddings” button

---

### `/admin/resources/new`

Create resource.

---

### `/admin/resources/[id]/edit`

Edit resource.

On save:

* Update resource
* Update metadata
* Set updated timestamp
* Recompute embedding if embedding utility exists or can be implemented safely

---

### `/admin/companies`

Admin company management.

Features:

* List companies
* Search/filter
* Create company
* Edit company
* Delete/archive company
* Review status
* Claim status
* CSV import button

---

### `/admin/companies/new`

Create company.

---

### `/admin/companies/[id]/edit`

Edit company.

---

### `/admin/claims`

Admin review page for company claims.

Features:

* View pending claims
* Approve claim
* Reject claim
* See user info
* See company info
* See work email
* See domain match signal

When claim is approved:

* Mark claim as approved
* Associate user with company ownership
* Allow user to edit that company

---

## Data Model

Inspect the existing Prisma schema first and adapt names to existing conventions.

Add or extend models as needed.

Suggested models:

```prisma
enum UserRole {
  USER
  ADMIN
  COMPANY_OWNER
  PENDING_COMPANY_OWNER
}

enum FounderStage {
  IDEA
  PRE_REVENUE
  EARLY_REVENUE
  GROWTH
  SCALING
}

enum HiringStatus {
  NOT_HIRING
  HIRING
  ACTIVELY_HIRING
  UNKNOWN
}

enum CompanyStatus {
  DRAFT
  PENDING_REVIEW
  PUBLISHED
  ARCHIVED
}

enum ClaimStatus {
  PENDING
  APPROVED
  REJECTED
}

enum ResourceStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}
```

Adjust enum names if project conventions differ.

### User

Extend existing User model with:

```prisma
role UserRole @default(USER)
```

Be careful with NextAuth compatibility.

---

### Resource

Suggested fields:

```prisma
model Resource {
  id              String   @id @default(cuid())
  name            String
  slug            String   @unique
  description     String
  shortDescription String?
  websiteUrl      String?
  contactName     String?
  contactEmail    String?
  contactPhone    String?
  category        String?
  subcategory     String?
  status          ResourceStatus @default(PUBLISHED)

  stages          String[] // or normalized table if existing patterns prefer
  sectors         String[]
  goals           String[]
  regions         String[]
  businessTypes   String[]
  eligibilityTags String[]

  city            String?
  county          String?
  state           String? @default("UT")

  source          String?
  sourceId        String?
  lastSyncedAt    DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  embedding       ResourceEmbedding?
}
```

If scalar lists are not ideal in the current database setup, use JSON fields or join tables. Prefer practical implementation speed.

---

### ResourceEmbedding

Use pgvector.

Check how pgvector is currently configured in the project.

Suggested:

```prisma
model ResourceEmbedding {
  id         String   @id @default(cuid())
  resourceId String  @unique
  resource   Resource @relation(fields: [resourceId], references: [id], onDelete: Cascade)

  content    String
  embedding  Unsupported("vector(1536)")?

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

If OpenAI embedding dimension differs in the existing app, use existing dimension.

---

### FounderProfile

```prisma
model FounderProfile {
  id            String   @id @default(cuid())
  userId        String?
  user          User?    @relation(fields: [userId], references: [id], onDelete: SetNull)

  stage         String?
  city          String?
  county        String?
  region        String?
  sectors       String[]
  goals         String[]
  businessTypes String[]
  fundingNeeds  String[]
  hiringStatus  String?

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

---

### SavedResource

```prisma
model SavedResource {
  id         String   @id @default(cuid())
  userId     String
  resourceId String

  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  resource   Resource @relation(fields: [resourceId], references: [id], onDelete: Cascade)

  createdAt  DateTime @default(now())

  @@unique([userId, resourceId])
}
```

---

### Company

```prisma
model Company {
  id            String   @id @default(cuid())
  name          String
  slug          String   @unique
  websiteUrl    String?
  linkedinUrl   String?
  description   String?
  sector        String?
  stage         String?

  employees     Int?
  employeeRange String?
  yearFounded   Int?

  address       String?
  city          String?
  county        String?
  state         String? @default("UT")
  postalCode    String?
  latitude      Float?
  longitude     Float?

  hiringStatus  HiringStatus @default(UNKNOWN)
  jobPostingsUrl String?

  status        CompanyStatus @default(PUBLISHED)

  source        String?
  sourceId      String?
  lastSyncedAt  DateTime?

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  photos        CompanyPhoto[]
  claims        CompanyClaim[]
  owners        CompanyOwner[]
}
```

---

### CompanyPhoto

```prisma
model CompanyPhoto {
  id          String   @id @default(cuid())
  companyId   String
  company     Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  url         String
  altText     String?
  sortOrder   Int      @default(0)

  createdAt   DateTime @default(now())
}
```

---

### CompanyClaim

```prisma
model CompanyClaim {
  id             String   @id @default(cuid())
  companyId      String
  company        Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  userId         String
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  workEmail      String
  explanation    String?
  domainMatches  Boolean  @default(false)

  status         ClaimStatus @default(PENDING)
  reviewedAt     DateTime?
  reviewedById   String?

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

---

### CompanyOwner

```prisma
model CompanyOwner {
  id         String   @id @default(cuid())
  companyId  String
  userId     String

  company    Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
  user       User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt  DateTime @default(now())

  @@unique([companyId, userId])
}
```

---

# Recommendation Engine

Create a reusable service, for example:

```txt
src/lib/recommendations/resource-recommender.ts
```

Adapt location to existing project conventions.

The recommender should accept a founder profile/intake object and return ranked resources.

Use a scoring model like:

```ts
score =
  stageMatch * 30 +
  goalMatch * 25 +
  sectorMatch * 15 +
  locationMatch * 15 +
  businessTypeMatch * 10 +
  keywordOrSemanticMatch * 5
```

Return:

```ts
type ResourceRecommendation = {
  resource: Resource
  score: number
  reasons: string[]
  matchedFields: {
    stage?: boolean
    goals?: string[]
    sectors?: string[]
    regions?: string[]
    businessTypes?: string[]
  }
}
```

Every recommendation card should show human-readable reasons.

Example:

```txt
Recommended because you are an early-stage founder in Southern Utah looking for mentorship and capital.
```

Important: this cannot depend on OpenAI chat. It must work with normal database data.

If pgvector search is easy to add, include semantic search as an enhancement, but do not block the core feature on embeddings.

---

# Embeddings / pgvector

Since Neon supports pgvector, add support for resource embeddings where practical.

Requirements:

* Generate embeddings for resources on create/update/import if existing OpenAI utilities are available.
* Store resource embedding content.
* Add a reusable semantic search function.
* If OpenAI env vars/utilities are missing, fail gracefully.
* Structured recommendations must still work.

Use existing OpenAI configuration if present.

Do not create a second conflicting OpenAI client if one already exists.

If adding embedding generation, use current recommended OpenAI embedding model available in project config or a clear constant like:

```ts
text-embedding-3-small
```

Keep it easy to change.

---

# REST API Endpoints

Use the existing project’s API route conventions.

Create clean REST endpoints.

## Public Resource Endpoints

```txt
GET    /api/resources
GET    /api/resources/:id
GET    /api/resources/search
POST   /api/resources/recommend
POST   /api/resources/save
DELETE /api/resources/save/:resourceId
```

If App Router route handlers are used, implement appropriately.

### `GET /api/resources`

Query params:

```txt
q
stage
sector
goal
region
businessType
status
limit
offset
```

Return paginated resources.

### `POST /api/resources/recommend`

Body:

```ts
{
  stage?: string
  city?: string
  county?: string
  region?: string
  sectors?: string[]
  goals?: string[]
  businessTypes?: string[]
  fundingNeeds?: string[]
  hiringStatus?: string
}
```

Return ranked recommendations with reasons.

---

## Admin Resource Endpoints

```txt
POST   /api/admin/resources
PATCH  /api/admin/resources/:id
DELETE /api/admin/resources/:id
POST   /api/admin/resources/import
POST   /api/admin/resources/:id/reindex
POST   /api/admin/resources/reindex
```

Admin endpoints must require admin role.

---

## Public Company Endpoints

```txt
GET    /api/companies
GET    /api/companies/:id
GET    /api/companies/search
POST   /api/companies
POST   /api/companies/:id/claim
```

### `GET /api/companies`

Query params:

```txt
q
sector
stage
hiringStatus
employeeMin
employeeMax
city
county
region
bounds
limit
offset
```

Return companies with coordinates and metadata for map rendering.

---

## Admin Company Endpoints

```txt
POST   /api/admin/companies
PATCH  /api/admin/companies/:id
DELETE /api/admin/companies/:id
POST   /api/admin/companies/import
GET    /api/admin/claims
POST   /api/admin/claims/:id/approve
POST   /api/admin/claims/:id/reject
```

---

## MCP-Ready Public API Design

Even though MCP is not being built here, make sure services are clean and reusable.

Create service-layer functions that can be reused by both REST and future MCP tools:

```ts
searchResources()
getResourceById()
recommendResources()
searchCompanies()
getCompanyById()
createCompanyClaim()
```

Do not put all logic directly inside route handlers.

---

# CSV Import

Build admin CSV import for resources and companies.

Use a practical CSV parser.

If the project already has a preferred parser, use that.

Otherwise install a small dependency if appropriate, such as:

```txt
papaparse
```

or implement server-side parsing with an existing package.

## Resource import

Allow admins to upload a CSV.

Map columns flexibly where possible:

* name
* description
* short description
* website
* category
* subcategory
* stage
* sector
* goal
* region
* business type
* eligibility
* contact email
* contact phone
* city
* county

Support comma-separated values for array fields.

Show import preview if practical. If not, import directly and show success/error summary.

## Company import

Map:

* name
* website
* employees
* employee range
* sector
* stage
* year founded
* linkedin
* description
* address
* city
* county
* state
* postal code
* latitude
* longitude
* hiring status
* job postings
* photos

Support comma-separated photo URLs.

Do not require all fields to be present, but the company profile UI should support all required fields.

---

# UI / Design Direction

The app should look like a premium civic-tech product, not a generic admin dashboard.

Use:

* shadcn/ui
* Tailwind
* Clean typography
* Large confident headings
* Generous spacing
* Polished cards
* Subtle gradients
* Professional Utah/startup feel
* Clear CTAs
* Beautiful empty states
* Loading skeletons where useful

Avoid:

* Cluttered forms
* Tiny text
* Generic CRUD-only pages
* Developer-looking UI
* Anything that feels like a raw spreadsheet viewer

---

# Suggested Navigation

Main nav:

* Navigator
* Resources
* Map
* Companies
* Admin, only for admins

User menu:

* Saved resources
* My company claims
* Sign out

---

# Components to Build

Create reusable components where appropriate.

Suggested:

```txt
ResourceCard
ResourceFilters
ResourceRecommendationCard
FounderIntakeForm
RecommendationReasons
CompanyMap
CompanyMarker
CompanyPreviewCard
CompanyFilters
CompanyProfileHeader
CompanyProfileDetails
CompanyPhotoGallery
ClaimCompanyForm
AdminStatsCard
CsvImportDialog
EmptyState
LoadingState
```

Adapt names to current conventions.

---

# Forms and Validation

Use existing form/validation libraries if present.

If not present, use:

* react-hook-form
* zod

Create schemas for:

* Founder intake
* Resource create/edit
* Company create/edit
* Company claim
* CSV import validation

Do not allow unsafe raw inputs.

Validate URLs, emails, numbers, enums, and required fields.

---

# Authorization Rules

Basic rules:

* Anyone can view published resources.
* Anyone can view published companies.
* Authenticated users can save resources.
* Authenticated users can submit companies.
* Authenticated users can claim companies.
* Admins can manage all resources.
* Admins can manage all companies.
* Admins can approve/reject claims.
* Approved company owners can edit their own companies.
* Pending owners cannot edit until approved.

Implement authorization at the server/API layer, not only in UI.

---

# Slugs

Generate slugs for resources and companies.

Use a safe slug utility.

Handle duplicates by appending a short suffix.

Examples:

```txt
small-business-development-center
small-business-development-center-2
```

---

# Search

Implement search that works well enough for demo:

Resources:

* Search by name, description, category, tags
* Filter by metadata fields

Companies:

* Search by name, description, sector, city, county
* Filter by map fields

Use Prisma queries first.

Use Postgres full-text or pgvector only if easy and safe.

---

# Mapbox Requirements

Use Mapbox GL JS.

Add package if needed:

```txt
mapbox-gl
```

Add CSS import as required by Mapbox.

Environment variable:

```txt
NEXT_PUBLIC_MAPBOX_TOKEN
```

If token is missing:

* Show a polished fallback list/grid view
* Show a small admin/developer note in non-production only

Map should:

* Center on Utah
* Start with a statewide zoom
* Show company markers
* Fit/filter markers based on selected filters
* Allow selecting a company
* Show preview card
* Link to full profile

Prefer a visually impressive but reliable implementation.

---

# Empty States

Because real data may be ingested later, build excellent empty states.

Examples:

Resources empty state:

```txt
No resources match these filters yet.
Try removing a filter or importing resources from the admin panel.
```

Companies empty state:

```txt
No companies found for this view.
Adjust your filters or add a company listing.
```

Map missing token:

```txt
Map view needs a Mapbox token. You can still browse companies below.
```

---

# Error Handling

Implement:

* API error responses with useful messages
* Form error states
* Toast notifications
* Loading states
* Empty states
* Graceful handling for missing optional fields

Do not crash the page because optional imported data is missing.

---

# Environment Variables

Use existing env conventions.

Potential env vars:

```txt
DATABASE_URL
NEXTAUTH_SECRET
NEXTAUTH_URL
NEXT_PUBLIC_MAPBOX_TOKEN
OPENAI_API_KEY
```

Do not expose server-only keys to the client.

---

# Migration / Prisma

After schema changes:

* Update Prisma schema
* Create migration
* Run Prisma generate
* Ensure existing NextAuth models are not broken
* Ensure pgvector type is supported
* Add indexes where useful

Suggested indexes:

```prisma
@@index([status])
@@index([slug])
@@index([city])
@@index([county])
@@index([sector])
```

For companies with map:

```prisma
@@index([latitude, longitude])
```

Use valid Prisma syntax based on actual schema.

---

# Seed / Demo Data

Do not create a large fake dataset.

But create minimal optional seed data only if needed for local development and UI testing:

* 2 resources
* 2 companies

Make the seed easy to delete or skip.

Real hackathon data will be ingested later through CSV import/admin flows.

---

# Testing / Quality Checks

After implementation:

Run all relevant checks available in the project:

```txt
npm run lint
npm run typecheck
npm run build
```

If scripts differ, inspect package.json and run the appropriate equivalents.

Fix TypeScript errors.

Fix lint errors that block build.

Make sure all pages compile.

---

# Acceptance Criteria

The build is complete when the following work:

## Founder Navigator

* User can open `/founder`.
* User can complete intake.
* User can see personalized resource recommendations.
* Recommendations include clear reasons.
* User can browse/filter resources.
* Resource detail page works.
* Logged-in user can save resources if auth exists.

## Admin Resource Management

* Admin can create resources.
* Admin can edit resources.
* Admin can delete/archive resources.
* Admin can import resources from CSV.
* Resource updates show on public pages without redeploy.

## Startup Map

* User can open `/map`.
* User can view company markers if Mapbox token exists.
* User can browse companies in fallback/list mode.
* User can filter companies.
* User can open a company profile.
* Company profile includes required fields.

## Company Self-Service

* Authenticated user can create company listing.
* Authenticated user can submit claim.
* Claim is pending by default.
* Admin can approve/reject claim.
* Approved owner can edit their company.

## Admin Company Management

* Admin can create companies.
* Admin can edit companies.
* Admin can delete/archive companies.
* Admin can import companies from CSV.
* Admin can review claims.

## REST API

* Public resource endpoints work.
* Public company endpoints work.
* Recommendation endpoint works.
* Admin endpoints require admin.
* Endpoints are service-based and clean enough to wrap with MCP later.

## Production Quality

* UI is polished.
* Forms are validated.
* Empty states are good.
* Loading states are good.
* Errors are handled.
* Build passes.

---

# Implementation Order

Work in this order:

1. Inspect existing project structure and conventions.
2. Update Prisma schema safely.
3. Add auth roles and authorization helpers.
4. Build service layer:

   * resources
   * companies
   * recommendations
   * claims
   * imports
5. Build REST API endpoints.
6. Build public resource pages.
7. Build founder intake and recommendation results.
8. Build company pages.
9. Build Mapbox map page.
10. Build company claim flow.
11. Build admin resource pages.
12. Build admin company pages.
13. Build CSV import.
14. Polish UI.
15. Run lint/typecheck/build and fix issues.

---

# Notes on Existing AI Agent

Do not rebuild the custom chat agent.

However, design the following functions so the existing agent or future MCP server can use them later:

```ts
recommendResourcesForFounderProfile()
searchResources()
searchCompanies()
getCompanyProfile()
getResourceDetails()
```

Keep these independent from React components.

---

# Tone of the Product

This should feel like:

* “The official operating system for building a company in Utah”
* Fast enough for a founder working 100-hour weeks
* Beautiful enough for international investors
* Practical enough for a government website
* Easy enough for non-technical staff to update

Prioritize reliability, polish, and demo readiness over unnecessary complexity.

---

# Final Reminder

Do not overbuild.

The most important hackathon-winning experience is:

1. Founder answers intake.
2. App shows personalized top resources with reasons.
3. Investor opens beautiful Utah startup map.
4. Company profile pages look rich and complete.
5. Admin updates content without redeployment.
6. REST endpoints are clean and MCP-ready.

Build that exceptionally well.

Do not to make major package/library changes without checking what already exists**. With hackathon codebases, dependency churn can eat hours.
