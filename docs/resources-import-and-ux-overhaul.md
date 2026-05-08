Build this as a **resource ingestion + review + publishing workflow**, not just a CSV upload, because these records will need deduping, taxonomy management, and ongoing edits.

## Goal

Add an **Upload CSV** flow for Utah startup resources that can ingest records like:

```txt
id, Title, description, Communities, Industries, Locations, Topics, link, email
```

Then expose those resources in the directory UI with filters for:

* Communities
* Industry
* Location
* Topic

The CSV uses `|` as the multi-value separator, so each uploaded resource can belong to many communities, industries, locations, and topics.

---

## Proposed build plan

### 1. Database model updates

I’d avoid storing the CSV values as raw strings. These should become normalized filterable entities.

Suggested Prisma shape:

```ts
Resource
- id
- externalId
- title
- description
- link
- email
- source
- status
- createdAt
- updatedAt
- lastImportedAt

Community
- id
- name
- slug

Industry
- id
- name
- slug

Location
- id
- name
- slug
- type // county, city, region, statewide, etc. optional

Topic
- id
- name
- slug

ResourceCommunity
ResourceIndustry
ResourceLocation
ResourceTopic
```

Important details:

* `externalId` maps to the CSV `id`, such as `2543`.
* Add a unique constraint on `externalId` when present.
* Also add a soft dedupe key, probably normalized `title + link`, because future CSVs may not always preserve the same ID.
* `status` should support something like:

  * `draft`
  * `needs_review`
  * `published`
  * `archived`
* `source` could be `csv_upload`, `admin_created`, etc.

---

### 2. CSV upload UX

Add an **Upload CSV** button in the resource directory admin area, not necessarily on the public-facing directory page unless admins use that same UI.

Upload flow:

1. Admin clicks **Upload CSV**
2. Modal or page opens with file dropzone
3. CSV is parsed client-side for quick validation
4. Server receives file and runs full validation
5. Show an import preview:

   * total rows
   * new resources
   * updated resources
   * duplicates
   * rows with errors
   * new taxonomy values detected
6. Admin confirms import
7. Import job runs
8. Admin sees import summary and can download error report if needed

For small CSVs like this one, synchronous import is probably fine. If you expect thousands of rows later, make it a background job.

---

### 3. CSV validation rules

Required columns:

```txt
id
Title
description
Communities
Industries
Locations
Topics
link
email
```

Required fields per row:

```txt
Title
description
Industries
Locations
Topics
```

Probably optional:

```txt
Communities
link
email
```

Validation should check:

* valid URL format for `link`
* valid email format when `email` exists
* non-empty title
* description length within UI-safe limits
* known taxonomy values, or intentionally allow new ones
* duplicate rows inside the same CSV
* duplicate existing resources in the DB

For this uploaded sample, I’d treat `Communities` as optional because many rows are blank.

---

### 4. Taxonomy handling

The CSV contains four major taxonomy groups:

```txt
Communities
Industries
Locations
Topics
```

Each value can be pipe-delimited:

```txt
Aerospace and Defense|Agriculture|Software and Information Technology
```

Import behavior should be configurable:

#### Recommended default

Automatically create missing taxonomy values, but mark the import as `needs_review` if new values are introduced.

Example:

```ts
{
  allowNewCommunities: true,
  allowNewIndustries: true,
  allowNewLocations: true,
  allowNewTopics: true,
  publishImmediately: false
}
```

This keeps the ingestion easy while preventing accidental bad filters like `Sofware` or `SaltLake`.

---

### 5. Dedupe and update logic

Use this import strategy:

#### Match priority

1. Match by `externalId`
2. If no `externalId` match, match by normalized `link`
3. If no link match, match by normalized `title`

#### For matched records

Update:

* title
* description
* link
* email
* taxonomy joins
* `lastImportedAt`

Do not blindly overwrite manually curated fields unless you track field ownership.

A safer version:

```ts
ResourceFieldOverride
- resourceId
- fieldName
- isManuallyEdited
```

But for the hackathon version, keep it simple and overwrite imported fields.

---

### 6. Resource directory UI updates

The current filters are:

```txt
Stage
Sector
Goal
Region
```

Update them to the CSV taxonomy:

```txt
Community
Industry
Location
Topic
```

Search should cover:

* title
* description
* link
* email
* taxonomy names

Card changes:

Current cards show category badges and tags. New cards should show:

* primary topic badge
* title
* description
* community chips
* industry chips
* location chips
* topic chips
* email if available
* open link button
* updated date

Example card structure:

```txt
[Funding]

Utah Small Business Credit Initiative

Description...

Communities: Women, Rural
Industries: Software and Information Technology, Manufacturing
Locations: Salt Lake, Utah, Weber
Topics: Funding, Start a Business

Updated May 7, 2026       Open ↗
```

To avoid card clutter, show the first few chips and collapse the rest:

```txt
Salt Lake, Utah, Weber +12 more
```

---

### 7. Filter behavior

Each filter should support multi-select.

Recommended behavior:

* Search text: fuzzy search across resource content
* Communities: OR within selected communities
* Industries: OR within selected industries
* Locations: OR within selected locations
* Topics: OR within selected topics
* Across filter groups: AND

Example:

```txt
Industry = Software OR Manufacturing
Location = Salt Lake OR Utah
Topic = Funding
```

Means:

```txt
(resource industry is Software or Manufacturing)
AND
(resource location is Salt Lake or Utah)
AND
(resource topic is Funding)
```

Add a visible active-filter bar:

```txt
Software and Information Technology ×
Salt Lake ×
Funding ×
Clear all
```

---

### 8. API routes / tRPC procedures

Suggested procedures:

```ts
resources.list
resources.getById
resources.create
resources.update
resources.archive
resources.importCsvPreview
resources.importCsvCommit

resourceTaxonomy.listCommunities
resourceTaxonomy.listIndustries
resourceTaxonomy.listLocations
resourceTaxonomy.listTopics
```

Import flow:

```ts
resources.importCsvPreview(file)
```

Returns:

```ts
{
  totalRows,
  validRows,
  invalidRows,
  newResources,
  updatedResources,
  duplicateRows,
  newTaxonomyValues,
  errors
}
```

Then:

```ts
resources.importCsvCommit(importSessionId)
```

This avoids importing immediately before the admin sees what will happen.

---

### 9. Implementation phases

### Phase 1 — Data model

* Add `Resource`
* Add taxonomy tables
* Add many-to-many join tables
* Add seed values from existing CSV
* Add migration
* Backfill existing resources if there are already records in the app

### Phase 2 — CSV parser and validator

* Parse CSV
* Normalize headers
* Split `|` values
* Validate required fields
* Validate URL/email
* Generate preview summary
* Store temporary import session

### Phase 3 — Import commit

* Upsert resources
* Upsert taxonomy values
* Replace taxonomy joins on update
* Save import metadata
* Return final summary

### Phase 4 — UI filters

* Replace current filters with:

  * Community
  * Industry
  * Location
  * Topic
* Add multi-select dropdowns
* Add search
* Add active-filter chips
* Update resource cards

### Phase 5 — Admin polish

* Upload CSV button
* Import preview table
* Error report
* Duplicate detection
* Confirmation screen
* Import history

---

## Nice-to-have later

* Manual admin editor for a single resource
* Archive resources missing from latest CSV
* Import diff view
* “Last seen in CSV” timestamp
* Public/private resource status
* Featured resources
* Bookmarking/saving resources
* Analytics: most-clicked resources, most-used filters
* AI cleanup for descriptions, broken links, and taxonomy suggestions

---

## Main questions

1. Should uploaded CSV rows be **published immediately**, or should they go into a **review state** first?

2. Is the CSV `id` stable across future uploads? In other words, should `2543` always refer to the same resource?

3. Should an upload **replace the whole resource directory**, or should it only **add/update** rows while leaving missing existing resources untouched?

4. Do you want admins to be able to create/edit resources manually after upload?

5. Are `Locations` always Utah counties, or could they include cities, regions, “Statewide”, or out-of-state locations later?

6. Should blank `Communities` mean “no specific community,” or should it behave like “Any”?
