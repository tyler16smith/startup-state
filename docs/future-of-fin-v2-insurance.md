# Fin Insurance Intelligence Plan

## Goal

Build insurance as a core part of Fin’s financial graph:

> Users upload insurance documents, Fin extracts structured policy data, links it to transactions, tracks costs and coverage over time, and makes it queryable by the app and future agents.

This should start PDF-first, API-later.

---

# Phase 1: Insurance Data Model

Start by adding insurance as first-class financial data, not just notes or attachments.

## Core entities

```ts
InsurancePolicy
  id
  userId
  householdId?
  type
  provider
  planName
  policyNumber?
  status
  effectiveStartDate?
  effectiveEndDate?
  renewalDate?
  premiumAmount?
  premiumFrequency
  documentSourceId?
  createdAt
  updatedAt
```

Policy types:

```ts
type InsurancePolicyType =
  | "health"
  | "dental"
  | "vision"
  | "auto"
  | "home"
  | "renters"
  | "life"
  | "disability"
  | "umbrella";
```

---

## Health insurance details

```ts
HealthInsuranceDetails
  id
  policyId
  planYearStart
  planYearEnd
  deductibleIndividual?
  deductibleFamily?
  outOfPocketMaxIndividual?
  outOfPocketMaxFamily?
  coinsuranceRate?
  primaryCareCopay?
  specialistCopay?
  urgentCareCopay?
  emergencyRoomCopay?
  prescriptionCopay?
  hsaEligible?
```

---

## Property/casualty details

For auto, home, renters, umbrella.

```ts
InsuranceCoverage
  id
  policyId
  name
  coverageType
  limitAmount?
  limitText?
  deductibleAmount?
  appliesTo?
```

Examples:

```txt
Bodily injury liability: $100,000 / $300,000
Property damage liability: $100,000
Collision deductible: $500
Comprehensive deductible: $500
Dwelling coverage: $650,000
Personal property: $120,000
Umbrella liability: $1,000,000
```

---

## Life insurance details

```ts
LifeInsuranceDetails
  id
  policyId
  insuredPersonName?
  coverageAmount
  policyKind // term, whole, universal, unknown
  termEndDate?
  beneficiariesText?
```

---

## Insurance document entity

Every uploaded PDF/image should be stored and linked.

```ts
InsuranceDocument
  id
  userId
  policyId?
  fileName
  fileType
  storageKey
  documentKind
  extractionStatus
  rawExtractedText?
  extractionJson?
  confidenceScore?
  createdAt
```

Document kinds:

```ts
type InsuranceDocumentKind =
  | "summary_of_benefits"
  | "insurance_card"
  | "explanation_of_benefits"
  | "auto_declaration_page"
  | "home_declaration_page"
  | "life_policy_statement"
  | "unknown";
```

---

# Phase 2: Upload + Extraction UX

## User flow

```txt
Insurance page
  → Add policy
  → Upload document
  → Fin reads it
  → Review extracted data
  → User confirms or edits
  → Policy is saved to financial graph
```

## Upload copy

Use plain language:

```txt
Upload your insurance document

Drop in a PDF, screenshot, or photo of your policy, benefits summary, declaration page, or insurance card.

Fin will extract the important details like deductible, premium, coverage limits, renewal date, and out-of-pocket maximum.
```

## Review screen

Do not silently save extracted values. Always show a confirmation step.

Example:

```txt
We found:

Provider: SelectHealth
Plan: Value Gold
Plan year: Jan 1, 2026 – Dec 31, 2026
Individual deductible: $3,000
Family deductible: $6,000
Individual out-of-pocket max: $7,500
Primary care copay: $30
Specialist copay: $60

[Confirm] [Edit]
```

## Confidence behavior

Use extraction confidence to guide UX.

```txt
High confidence: show normal confirmation
Medium confidence: highlight fields for review
Low confidence: ask user to manually confirm key fields
```

Do not pretend uncertain extracted data is reliable.

---

# Phase 3: Extraction Pipeline

## Pipeline steps

```txt
1. Upload file
2. Store original file securely
3. Extract text from PDF/image
4. Classify document type
5. Extract structured insurance data
6. Normalize values
7. Validate against schema
8. Generate review payload
9. User confirms
10. Save policy
```

## Extraction output format

Create strict schemas.

```ts
type ExtractedInsurancePolicy = {
  documentKind: InsuranceDocumentKind;
  policyType: InsurancePolicyType;
  provider?: string;
  planName?: string;
  policyNumber?: string;
  effectiveStartDate?: string;
  effectiveEndDate?: string;
  renewalDate?: string;
  premiumAmount?: number;
  premiumFrequency?: "monthly" | "quarterly" | "semiannual" | "annual" | "unknown";
  health?: ExtractedHealthInsuranceDetails;
  coverages?: ExtractedCoverage[];
  life?: ExtractedLifeInsuranceDetails;
  confidence: {
    overall: number;
    fields: Record<string, number>;
  };
  warnings: string[];
};
```

## Validation rules

Examples:

```txt
deductible cannot be negative
out-of-pocket max should be greater than or equal to deductible
plan year end should be after plan year start
premium frequency must be known or explicitly unknown
coverage limits should preserve raw text if numeric parsing is uncertain
```

## Store both raw and normalized values

For insurance, never throw away the raw extracted text/value.

Example:

```ts
{
  field: "bodilyInjuryLiability",
  rawValue: "$100,000 each person / $300,000 each accident",
  normalized: {
    perPerson: 100000,
    perAccident: 300000
  }
}
```

This matters because insurance documents are full of weird formats.

---

# Phase 4: Link Insurance to Transactions

This is where Fin becomes much more than a document parser.

## Add insurance transaction tags

Add system hashtags or metadata:

```txt
#healthcare
#medical
#pharmacy
#health-insurance-premium
#auto-insurance
#home-insurance
#life-insurance
#deductible-eligible
#hsa
#fsa
```

## Detect premiums

Automatically identify recurring payments to:

```txt
SelectHealth
Blue Cross
UnitedHealthcare
GEICO
Progressive
State Farm
Allstate
Liberty Mutual
Lemonade
Northwestern Mutual
```

Create a transaction linking table:

```ts
InsurancePolicyTransaction
  id
  policyId
  transactionId
  relationshipType
  confidence
  userConfirmed
```

Relationship types:

```ts
type InsuranceTransactionRelationship =
  | "premium"
  | "claim_payment"
  | "medical_expense"
  | "pharmacy_expense"
  | "reimbursement"
  | "hsa_contribution"
  | "hsa_distribution";
```

## Matching behavior

When Fin detects likely insurance transactions, show:

```txt
We found 6 transactions that may belong to your SelectHealth plan.

$342.18 monthly premium to SelectHealth
$84.21 pharmacy purchase at CVS
$127.00 medical bill from Intermountain Health

Confirm?
```

---

# Phase 5: Health Deductible Tracker

This should be the first “wow” feature.

## User question

```txt
How much more until I meet my deductible?
```

## Required data

```txt
1. Health policy deductible
2. Plan year dates
3. Deductible-eligible healthcare transactions
4. User-confirmed exclusions
5. Optional EOB uploads later
```

## Deterministic calculation

```ts
deductibleRemaining =
  deductibleAmount - confirmedDeductibleEligibleSpendForPlanYear
```

## Important nuance

Not all healthcare spend counts toward deductible.

So v1 should be transparent:

```txt
You have $820 remaining before your individual deductible is met.

I counted $2,180 of healthcare expenses since Jan 1, 2026 that you marked or confirmed as deductible-eligible.

Some expenses may not count toward your deductible, such as copays, premiums, or certain pharmacy purchases.
```

## Track confidence

```ts
DeductibleProgress
  policyId
  planYearStart
  planYearEnd
  deductibleAmount
  confirmedEligibleSpend
  estimatedEligibleSpend
  excludedSpend
  remaining
  confidence
```

Show two modes:

```txt
Confirmed: based only on user-confirmed deductible-eligible transactions
Estimated: includes likely eligible transactions Fin detected
```

This avoids giving false precision.

---

# Phase 6: Insurance Dashboard

Keep this simple. Don’t overbuild the UI.

## Insurance overview

Cards:

```txt
Health Insurance
Provider: SelectHealth
Deductible remaining: $820
OOP max remaining: $5,320
Plan year ends: Dec 31, 2026

Auto Insurance
Provider: GEICO
Premium: $126/mo
Renewal: Aug 15, 2026

Life Insurance
Coverage: $500,000
Premium: $38/mo
Term ends: 2046
```

## Core questions to support

```txt
How much do I pay for insurance per month?
How much more until I meet my deductible?
When do my policies renew?
What is my auto deductible?
How much life insurance coverage do I have?
What policies are missing documents?
```

This is already agent-ready.

---

# Phase 7: Financial Graph Integration

Insurance should affect the rest of Fin.

## Cash flow

Premiums are recurring expenses.

```txt
Monthly insurance cost:
Health premium: $342
Auto premium: $126
Life premium: $38
Total: $506/mo
```

## Forecasting

Add insurance assumptions to scenarios:

```ts
InsuranceScenarioAssumption
  policyId
  premiumGrowthRate
  expectedAnnualOutOfPocketSpend
  deductibleMetExpectedMonth?
```

Example scenario:

```txt
If healthcare premiums increase 8% next year, your projected monthly expenses increase by $27/mo.
```

## Goals

Insurance can impact:

* emergency fund target
* healthcare savings
* HSA contributions
* home ownership costs
* risk planning

---

# Phase 8: Agent Tool Contract

Before MCP, define internal tools.

## Insurance tools

```ts
getInsuranceSummary(userId)
getInsurancePolicies(userId)
getPolicyDetails(userId, policyId)
getDeductibleProgress(userId, policyId)
getInsuranceMonthlyCost(userId)
getUpcomingPolicyRenewals(userId)
findInsuranceRelatedTransactions(userId, policyId)
```

## Agent-style outputs

Example:

```ts
type GetDeductibleProgressResult = {
  policyId: string;
  policyName: string;
  provider: string;
  planYear: {
    start: string;
    end: string;
  };
  deductible: {
    individual?: number;
    family?: number;
  };
  progress: {
    confirmedEligibleSpend: number;
    estimatedEligibleSpend: number;
    remaining: number;
    percentMet: number;
  };
  confidence: "low" | "medium" | "high";
  explanation: string;
  caveats: string[];
};
```

This becomes easy to expose through MCP later.

---

# Phase 9: API Integrations Later

Do not start here.

Once the PDF/manual flow works, selectively add APIs.

## Health

Potential later use cases:

```txt
eligibility checks
benefit verification
deductible / accumulator data
claims data if accessible
```

But health insurance APIs are fragmented and often provider-oriented.

## Auto/home/renters

Potential API partners later:

```txt
Canopy Connect
MeasureOne
InsurGrid
```

Use them to reduce manual uploads where possible.

## Strategy

```txt
PDF-first gives coverage.
APIs improve convenience.
```

Do not let APIs define your data model.

Your financial graph should define the model. APIs are just ingestion paths.

---

# Phase 10: Security + Trust

Insurance data is sensitive.

## Must-haves

```txt
encrypted file storage
encrypted extracted text
strict user ownership checks
audit log for document access
ability to delete document and extracted data
clear confirmation before saving extracted values
```

## Data retention options

Let users choose:

```txt
Keep original document
Delete original after extraction
Keep only structured policy data
```

This is a strong trust feature.

---

# Suggested Implementation Order

## Build 1: Insurance schema

Add:

```txt
InsurancePolicy
HealthInsuranceDetails
InsuranceCoverage
LifeInsuranceDetails
InsuranceDocument
InsurancePolicyTransaction
```

## Build 2: Insurance page + manual policy creation

Before AI extraction, users should be able to manually add a policy.

This gives you a working product even if extraction is imperfect.

## Build 3: Document upload

Upload PDF/image and store it securely.

## Build 4: Extraction pipeline

Extract structured JSON and show review screen.

## Build 5: Confirm/edit extracted policy

Save reviewed data into canonical schema.

## Build 6: Premium transaction detection

Find recurring premiums and link them to policies.

## Build 7: Deductible tracker

Start with confirmed/estimated deductible-eligible healthcare spend.

## Build 8: Insurance agent tools

Expose internal typed tools.

## Build 9: MCP adapter later

Expose insurance tools to ChatGPT/Claude/local agents.

---

# First MVP Scope

Keep the first version narrow.

## MVP supports

```txt
Health insurance PDF upload
Manual health insurance policy creation
Extract deductible, OOP max, copays, plan dates, provider, plan name
Review + confirm
Detect healthcare transactions
Mark transactions as deductible-eligible
Answer: “How much more until I meet my deductible?”
```

That’s enough for a strong wedge.

---

# The “wow” demo

The user uploads a health insurance PDF.

Fin says:

```txt
I found your SelectHealth plan.

Your individual deductible is $3,000 and your plan year runs Jan 1–Dec 31.

Based on your confirmed healthcare expenses this year, you have about $820 remaining before you meet your deductible.
```

Then the user asks:

```txt
Should I schedule a procedure now or later?
```

Fin can respond:

```txt
Based on your current deductible progress, if the procedure is flexible, it may be financially better after you meet your deductible. You are projected to reach it around October if healthcare spending continues at the current pace.
```

That is much more valuable than “AI can see my bank transactions.”
