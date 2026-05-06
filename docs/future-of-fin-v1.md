The Future of Fin

Fin Financial Brain Roadmap
North Star
Fin becomes the user’s canonical financial intelligence layer:
A clean, queryable, longitudinal model of their financial life that can forecast, simulate, explain, and eventually power agents.
Not “budgeting app first.”Not “MCP wrapper first.”Financial brain first.

Phase 1 — Financial Graph Foundation
Goal
Create a unified model for everything Fin knows about a user.
Own this really well
1. Accounts
2. Transactions
3. Categories
4. Hashtags
5. Income streams
6. Expenses
7. Assets
8. Liabilities
9. Investments
10. Goals / scenarios
Key idea
Every financial object should fit into one canonical model:
FinancialGraph
  ├─ Accounts
  ├─ Transactions
  ├─ CashFlow
  ├─ Assets
  ├─ Liabilities
  ├─ Investments
  ├─ InsurancePolicies
  ├─ Goals
  └─ Scenarios
First implementation focus
Build a service like:
getFinancialGraph(userId): Promise<FinancialGraph>
This should become the core object every future feature uses.

Phase 2 — Deterministic Domain Services
Goal
Move intelligence out of UI pages and into reusable services.
Examples:
getNetWorthSnapshot(userId)
getMonthlyCashFlow(userId, range)
getRecurringExpenses(userId)
getSavingsRate(userId)
getCategorySpend(userId, range)
getInvestmentProjection(userId, assumptions)
runScenario(userId, scenarioId)
compareScenarios(userId, scenarioA, scenarioB)
These should be:
* Typed
* Tested
* Deterministic
* Explainable
* Usable by web, mobile, API, and eventually MCP
The UI should consume these services.Agents should consume these services.The same truth everywhere.

Phase 3 — Simulation Engine
Goal
Make Fin excellent at “what happens if…”
Core simulations:
1. Cash flow projection
2. Net worth projection
3. Investment growth
4. Debt payoff
5. Goal feasibility
6. Scenario comparison
Example questions Fin should answer:
Can I afford this house?
What happens if I save $500 more per month?
Am I on track to retire by 55?
What if my expenses rise 8% next year?
Which scenario gets me to my goal fastest?
This is one of the biggest moats.

Phase 4 — Cross-Domain Expansion
Goal
Move beyond Plaid-style transactions/investments.
Start with narrow, high-value domains.
First cross-domain targets
1. Health insurance (see dedicated plan for this)
Support manual input first:
HealthInsurancePolicy
  deductible
  deductibleMet
  outOfPocketMax
  outOfPocketMet
  premium
  planYearStart
  planYearEnd
Then answer:
How much more until I meet my deductible?
Am I likely to hit my out-of-pocket max this year?
How much am I spending on healthcare monthly?
2. Real estate
PropertyAsset
  estimatedValue
  mortgageBalance
  appreciationRate
  rentalIncome?
  maintenanceAssumption?
3. Life / auto / home insurance
At first:
InsurancePolicy
  type
  provider
  premium
  coverageAmount
  renewalDate
  deductible?
Don’t automate ingestion yet.Just model it correctly.

Phase 5 — Longitudinal Memory
Goal
Fin should understand the user over time.
Track:
* Income trend
* Expense trend
* Savings rate trend
* Net worth trend
* Category drift
* Lifestyle inflation
* Goal progress
* Forecast accuracy
This enables insights like:
Your spending has increased 14% over the last 6 months, mostly from restaurants and home improvement.

At your current pace, your house down payment goal moved from August 2027 to February 2028.
This is where Fin becomes emotionally sticky.

Phase 6 — Insight Engine
Goal
Move from “show data” to “tell me what matters.”
Create insight primitives:
Insight
  id
  type
  severity
  title
  explanation
  supportingData
  recommendedAction?
  relatedEntities
Insight examples:
Your emergency fund covers 2.1 months of expenses.

You are projected to miss your goal by $8,400.

Your recurring expenses increased by $126/month.

You are likely to hit your health deductible in October.
This should not be random LLM commentary.It should be deterministic analysis, optionally explained by an LLM.

Phase 7 — Agent Tool Contract
Goal
Define the tool layer before building MCP.
Create an internal agent contract:
type FinTool =
  | "getFinancialSnapshot"
  | "getCashFlowSummary"
  | "getTransactions"
  | "getNetWorthProjection"
  | "runScenario"
  | "compareScenarios"
  | "getGoalProgress"
  | "getInsuranceSummary"
  | "getDeductibleProgress"
  | "getInsights";
Each tool should have:
* Typed input
* Typed output
* Permission checks
* Audit logging
* Safe defaults
* Clear descriptions
This becomes the layer MCP wraps.

Phase 8 — MCP Adapter
Goal
Expose Fin to agents.
Important: MCP should be thin.
MCP Tool → Fin Tool Contract → Domain Service → Financial Graph
Do not put business logic inside MCP handlers.
Example MCP tools:
get_financial_snapshot
get_cash_flow_summary
get_net_worth_projection
run_forecast_scenario
compare_financial_scenarios
get_deductible_progress
get_recent_insights
Initial MCP should be read/simulate only.
No:
* Moving money
* Changing investments
* Paying bills
* Deleting data
That comes much later.

The 5–10 Things Fin Must Do Extremely Well
1. Build a clean financial graph
Everything connects to everything else.
2. Normalize messy financial data
Transactions, categories, merchants, hashtags, accounts.
3. Forecast future financial state
Cash flow, investments, net worth, goals.
4. Run scenarios quickly
“What if…” becomes instant.
5. Track user progress over time
Memory is a moat.
6. Model cross-domain financial reality
Insurance, real estate, debt, taxes eventually.
7. Generate deterministic insights
Not vague AI advice — grounded, explainable conclusions.
8. Expose everything through typed tools
Web, mobile, MCP, agents all call the same backend truth.
9. Keep permissions/auditing clean
Users need to trust agent access.
10. Let agents handle presentation
Agents can generate charts, explanations, and custom views. Fin provides the truth.

What Agents Should Own
Let agents handle:
* Natural language interface
* Custom chart generation
* One-off dashboards
* Explanations
* Exploration
* Summaries
* “Show me this another way”
Do not depend on agents for:
* Data correctness
* Financial calculations
* Forecast logic
* Categorization truth
* Scenario math
* Permission boundaries
* Audit logs

Immediate Next 3 Builds
Build 1: FinancialGraph service
Create the canonical user financial state object.
Build 2: domain service layer
Extract reusable deterministic services:
cashFlowService
netWorthService
forecastService
scenarioService
insightService
Build 3: agent tool contract
Create typed internal tools before MCP:
apps/api/src/server/fin-tools/
packages/shared/src/fin-tools/
Then MCP becomes easy.

The core philosophy:
Build Fin so that an agent can ask better questions than a human UI ever could — and Fin can answer with real financial truth.
