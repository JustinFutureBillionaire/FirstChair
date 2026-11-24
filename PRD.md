# SignalScout — Product Requirements Document (PRD)

**Version:** 1.0 (Hackathon MVP)
**Date:** 2026-11-24
**Team:** 2 people
**Status:** Approved for build

## 1. Summary

SignalScout is an evidence-grounded, multi-agent B2B go-to-market (GTM) engine. A seller describes what they sell; SignalScout infers the Ideal Customer Profile (ICP), discovers companies that need the product **now**, proves every claim with a verified source, builds a customer-specific **business case**, and drafts outreach that a human must approve before sending. Every opportunity is tracked on a pipeline dashboard.

**One-liner:** Find the right buyer, at the right moment, prove why with sources, and show why the purchase pays off.

**Market position:** B2B in general. **Beachhead for the hackathon:** AI / devtools startups. **Demo product:** Flexprice.

## 2. Problem

Early-stage B2B companies (especially founder-led AI/devtools startups with no sales team) run GTM across disconnected tools: static ICP decks, ad-hoc prospect searches, scattered enrichment tools, and generic cold email. This produces:

- **Wrong targets:** companies that match on paper but have no current need.
- **Wrong timing:** outreach that misses the buying window.
- **Low trust:** AI "personalization" that is vague or fabricated.
- **No economic argument:** messages describe features but never show why the purchase pays off for this specific buyer.

For every recommended prospect, a seller should be able to answer:

1. Why is this company a suitable customer?
2. What suggests it needs the product now?
3. Who would evaluate or buy it?
4. Under what assumptions is the purchase worthwhile?
5. What should we say when approaching them?

## 3. Goals and Non-Goals

### Goals (MVP)
- G1. Run the full pipeline end to end for **one demo product (Flexprice)** and **~5 deeply researched prospects**.
- G2. Every prospect claim carries a **verified** source citation.
- G3. Transparent Fit / Intent / Evidence Quality scores with a Tier (A/B/C).
- G4. Editable, deterministic **business case calculator** with input provenance and 3 scenarios.
- G5. Strict **human-in-the-loop (HITL)** approval bound to the exact message and recipient.
- G6. Genuine multi-agent handoffs in **Band**.
- G7. Real usage metering and credit-gated execution in **Flexprice**.
- G8. Measured discovery precision on a hand-labeled test set.

### Non-Goals (MVP)
- Sending via LinkedIn (drafts only, sent manually).
- Large-scale lead volume (depth over breadth).
- Deep competitive matrix (one simple comparison table only).
- A separate Security agent (folded into the Reviewer).
- Automated reply detection (outcomes may be entered manually and are labeled as such).
- Snyk (stretch only, if organizers confirm it is scored).

## 4. Target Users

| User | Description | Primary need |
|---|---|---|
| Founder (primary) | Seed to Series B AI/devtools founder doing founder-led sales | Find buyers with real, current need without a sales team |
| Small sales team | 1–5 reps at a B2B software or services company | Prioritized, evidence-backed leads and credible outreach |

## 5. User Flow

```
Product Intake → ICP Inference (human review) → Discovery & Signals → Knowledge Graph
→ Scoring & Tiering → Business Case → Contact Enrichment → Outreach Draft
→ Reviewer Check → HITL Approval → Send → Dashboard & Feedback
```

## 6. Functional Requirements

### 6.1 Product Intake & Value Proposition Extraction

**Inputs (chat or form):**

| Field | Description |
|---|---|
| Product description | What it does |
| Capabilities | Problems or tasks it addresses |
| Pricing | Subscription, usage charges, setup fees |
| Limitations | Where it performs poorly or needs extra work |
| Existing customers | Reference wins, if any |
| Commercial constraints | Target regions, company sizes, excluded customers |

**Output:** a structured Product Profile. Each capability is mapped to a **buyer benefit** (value proposition extraction).
- Example: capability "usage metering" → benefit "no engineering months spent building billing in-house."

**Acceptance criteria**
- [ ] Profile is generated as structured JSON and is editable in the UI.
- [ ] Every capability has at least one mapped benefit.

### 6.2 ICP Inference, Personas, and Expansion (core)

**Method**
1. **Product profile → benefits** (from 6.1).
2. **Lookalike:** if existing customers are given, extract shared traits (stack, stage, pricing model, hiring patterns). If none, search for public evidence of the pain.
3. **Structured ICP:** each field has `value`, `confidence` (0.00–1.00), `reason`, and `evidence[]`.
4. **Compile to queries:** the ICP becomes search queries, title filters, and signal rules.
5. **Human review:** user accepts, edits, or dismisses each field and each expansion segment. Discovery starts only after approval.
6. **Feedback:** rejected leads and corrected assumptions produce *suggested* ICP changes, always reviewable.

**ICP JSON schema (simplified)**

```json
{
  "icp_id": "uuid",
  "product_id": "uuid",
  "fields": {
    "segments":   { "value": ["AI API", "LLM apps", "devtools"], "confidence": 0.90, "reason": "...", "evidence": [] },
    "size":       { "value": { "employees": [10, 200], "stage": ["seed", "series_a", "series_b"] }, "confidence": 0.70, "reason": "..." },
    "traits":     { "value": ["charges or plans to charge by tokens/API calls/GPU time"], "confidence": 0.85, "reason": "..." },
    "personas":   { "value": [{ "title": "Founder", "when": "<50 employees" }, { "title": "Head of Engineering" }, { "title": "Head of Finance / RevOps" }], "confidence": 0.75 },
    "triggers":   { "value": ["hiring billing engineer", "pricing page moves to usage/credits", "public API launch", "new funding"], "confidence": 0.80 },
    "negatives":  { "value": ["seat-only consumer apps", "locked into enterprise billing contract"], "confidence": 0.65 },
    "regions":    { "value": ["US"], "confidence": 0.90 }
  },
  "expansion_segments": [
    { "segment": "GPU clouds", "reason": "...", "confidence": 0.55, "status": "suggested|accepted|dismissed" }
  ],
  "approved": false
}
```

**Acceptance criteria**
- [ ] Every ICP field displays confidence and a one-line reason.
- [ ] At least 2 expansion segments are suggested with reasons; user can accept or dismiss.
- [ ] Discovery is blocked until the ICP is approved.

### 6.3 Account Discovery & Buying-Signal Detection

**Two-stage funnel**
1. **Recall (cheap):** Tavily search with compiled queries → candidate list (~30–50).
2. **Precision (expensive, credit-gated):** for top candidates, the LLM reads the website, job posts, pricing page, and news, and extracts signals with citations.

**Evidence record (per claim)**

| Field | Description |
|---|---|
| `source_url` | Where the claim came from |
| `published_at` | Publication date if available |
| `quote` | Exact text supporting the claim |
| `why_it_matters` | Link to the product's value |
| `uncertainty` | What remains unknown |
| `verified` | Result of re-fetch + string match |
| `source_type` | first_party / third_party |

**Citation verification (mandatory):** the Reviewer re-fetches `source_url` and checks that `quote` appears on the page (normalized string match). Unverified claims are **removed** and never used in scoring or outreach.

**Negative signals** (layoffs, hiring freeze, out-of-region, excluded segment) reduce score or disqualify.

**Acceptance criteria**
- [ ] 100% of claims shown in the UI are verified.
- [ ] Each prospect shows at least 1 verified signal or is labeled "fit only, no intent."

### 6.4 Scoring

Scores are **transparent prioritization scores, not purchase probabilities.**

**Fit (0–50):** weighted match to approved ICP fields (segment, size, traits, region).

**Intent (0–50):** sum of verified signal weights with time decay, capped at 50.

```
signal_value = weight × 0.5 ^ (age_days / half_life_days)
```

| Signal | Weight | Half-life |
|---|---|---|
| Relevant job posting (e.g., billing engineer) | +25 | 30 days |
| Pricing page change to usage/credits | +20 | 60 days |
| New exec in relevant role (≤90 days) | +20 | 60 days |
| Funding round | +15 | 90 days |
| Public complaints about current tool | +20 | 45 days |
| Layoffs / hiring freeze | −40 | disqualify review |

**Evidence Quality (0–1):** average over used claims. Verified first-party = 1.0, verified third-party = 0.8, older than 180 days = ×0.7.

```
priority = fit + intent × evidence_quality
Tier A ≥ 70 · Tier B 50–69 · Tier C < 50
```

**Acceptance criteria**
- [ ] Clicking a score expands the evidence and per-signal math.
- [ ] Weights and half-lives live in one config file.

### 6.5 Dynamic Knowledge Graph (Neo4j)

**Nodes:** `Company`, `Person`, `Product`, `Competitor`, `Signal`, `Source`, `BusinessCase`

**Edges:**

| Edge | Meaning |
|---|---|
| `(Person)-[:WORKS_AT]->(Company)` | Current role |
| `(Person)-[:PREVIOUSLY_WORKED_AT]->(Company)` | Past role (warm path) |
| `(Company)-[:HAS_SIGNAL]->(Signal)` | Buying signal |
| `(Signal)-[:SUPPORTED_BY]->(Source)` | Evidence |
| `(Company)-[:USES]->(Competitor)` | Current tool |
| `(Product)-[:COMPETES_WITH]->(Competitor)` | Competitive landscape |
| `(Company)-[:MATCHED_TO]->(Product)` | ICP match |
| `(BusinessCase)-[:EVALUATES]->(Product)` / `-[:FOR]->(Company)` | Financial analysis |
| `(Person)-[:CONTACTED_VIA]->(Message)` | Outreach |
| `(Person)-[:REPLIED_TO]->(Message)` | Reply |

**Required multi-hop queries (must affect recommendations):**
1. **Warm path:** companies with billing signals whose decision-maker previously worked at an existing customer.
2. **Displacement:** prospects that use a competitor and show recent dissatisfaction signals.

**Acceptance criteria**
- [ ] Both queries run live in the demo and change lead priority or outreach channel.
- [ ] Agent handoffs pass graph node IDs, preserving sources across agents.

### 6.6 Financial Qualification & Business Case

**Principle:** the LLM extracts inputs and explains results; **deterministic code** does all math.

**For AI/devtools, the default frame is build vs. buy.**

| Measure | Definition |
|---|---|
| TCO | Subscription + usage + setup + integration + maintenance |
| Expected benefit | Costs avoided (e.g., in-house build and maintenance) or capacity gained |
| Net benefit | Expected benefit − TCO |
| ROI | Net benefit ÷ TCO over a stated period |
| Payback period | Upfront cost ÷ monthly net benefit |
| Sensitivity | Conservative / base / optimistic scenarios |

**Input provenance (required for every input):** `user_provided` · `public` (with source) · `assumed` · `unknown`

**Illustrative example (Flexprice, Year 1):**
- Build in-house: 4 eng-months × $15k = $60k + 20% maintenance for 8 months ($24k) = **$84k** *(assumed)*
- Flexprice: $199/mo + 0.5% of billed volume *(public)*; at $1M billed ≈ $7.4k, plus 2 weeks integration ≈ $7.5k = **~$14.9k**
- Net benefit ≈ **$69k** (base scenario)

**Rules**
- Staff time gained is shown separately from cash savings.
- If assumptions do not support the deal, the UI says so clearly.
- A positive case does **not** imply the prospect has budget; the UI states this.

**Acceptance criteria**
- [ ] Editing any input recalculates all three scenarios instantly.
- [ ] Every number shows a provenance badge.
- [ ] Unit tests cover the calculator functions.

### 6.7 Competitive Positioning (light)

One table per prospect: our product vs. the prospect's current approach (including "build in-house") on price, key capabilities, implementation effort, switching cost, and expected value. Published competitor info keeps source and date.

### 6.8 Contact Enrichment

- Hunter.io: find business email for the target persona; run verification.
- Show verification status, including `uncertain`.
- Title normalization (e.g., "Head of Eng", "VP Engineering" → `eng_leader`); prefer people in role ≤90 days.

**Acceptance criteria**
- [ ] Only `valid` or user-confirmed emails can be sent to.

### 6.9 Outreach Generation

- Inputs: product profile, verified evidence, competitive position, approved business case.
- Channel routing: warm path found → intro request to mutual connection; otherwise → signal-based cold email.
- Financial claims are phrased **conditionally** ("If it saves ~4 engineer-months, the estimated benefit exceeds the cost...").
- Persona-specific tone, length, and CTA limits.
- LinkedIn: draft only.

### 6.10 Human-in-the-Loop Approval

- Reviewer agent checks claims, math, consistency, and link safety **before** the draft reaches the queue.
- User sees recipient, message, evidence, and financial claims; can approve, edit, or reject.
- **Approval is bound to a hash** of `recipient + subject + body`. Any change invalidates the approval.
- The send endpoint refuses any message without a matching approval hash.

**Acceptance criteria**
- [ ] Editing one character after approval resets status to `pending`.
- [ ] Every send is logged with approver, timestamp, and hash.

### 6.11 Lead Management, Attribution & Feedback

- Kanban: **Matched → Contacted → Replied → Meeting Booked → Closed/Lost**
- Each opportunity stores research, business case, contacts, messages, activity history.
- **Attribution:** every action logged as `agent:<name>` or `human:<user>`.
- Analytics: stage conversion by segment and tier; warm vs. cold comparison; message variant comparison.
- Manual outcome entry allowed in MVP, labeled `manual`.

### 6.12 Precision Evaluation

- Before the demo, hand-label 20 companies as `good_fit` / `not_fit`.
- Report **Precision@5** of the ranked list against labels in the dashboard.

## 7. Multi-Agent Design (Band)

| Agent | Responsibility | Hands off to |
|---|---|---|
| Planner | Turns the approved ICP into a research plan; allocates credit budget per agent | Researcher |
| Researcher | Discovery, signal extraction, graph updates, enrichment | Financial Analyst |
| Financial Analyst | Extracts inputs, calls the calculator, explains scenarios | Writer |
| Writer | Drafts outreach from verified evidence and approved business case | Reviewer |
| Reviewer | Verifies citations, checks math and consistency, checks links and data exposure; rejects back to Writer or Researcher | Human (HITL) |

- All agents may share one model with different instructions and tools.
- Handoffs and rejections are visible in Band Desktop and summarized in SignalScout's "Agent Thinking" feed.
- Schema changes and sends always require human approval.
- *Integration details to confirm with Band docs / sponsor at kickoff.*

## 8. Usage Metering & Credits (Flexprice)

| Metered event | Trigger |
|---|---|
| `lead_enriched` | Successful Hunter lookup |
| `graph_query` | Multi-hop query executed |
| `business_case_generated` | Calculator run with extracted inputs |
| `outreach_sent` | Approved message sent |

- Before each billable operation: check access and wallet balance. Insufficient credits → operation blocked with a clear UI message.
- After success: send usage event.
- Per-agent credit allocation from the Planner.
- Two separate financial views: the **buyer's business case** and the **seller's SignalScout usage**.
- *API details to confirm with Flexprice docs at kickoff.*

## 9. Architecture & Tools

| Layer | Tool |
|---|---|
| Frontend | Next.js, Tailwind CSS, shadcn/Radix UI → Vercel |
| Backend worker | Python FastAPI → Railway |
| LLM | Claude API |
| Knowledge graph | Neo4j AuraDB (free) |
| App database | Supabase Postgres |
| Search & extraction | Tavily (Playwright fallback) |
| Enrichment & verification | Hunter.io |
| Email | Gmail API (approved test send to team inbox) |
| Multi-agent orchestration | **Band** (sponsor) |
| Metering & credits | **Flexprice** (sponsor) |
| Repository | GitHub (public) |
| Stretch | Snyk (only if confirmed as scored) |

### Postgres tables (MVP)
`products`, `icps`, `accounts`, `signals`, `sources`, `contacts`, `business_cases`, `messages`, `approvals`, `activities`, `usage_events`

### Key API endpoints (FastAPI)
| Method | Path | Purpose |
|---|---|---|
| POST | `/products` | Create product profile from intake |
| POST | `/icp/infer` | Generate ICP from product profile |
| PATCH | `/icp/{id}` | Edit / approve ICP |
| POST | `/discovery/run` | Run recall + precision discovery (credit-gated) |
| GET | `/accounts?tier=A` | Ranked prospects with evidence |
| POST | `/graph/query/{name}` | Run named multi-hop query |
| POST | `/business-case/{account_id}` | Build business case |
| POST | `/outreach/{account_id}` | Draft outreach |
| POST | `/approvals/{message_id}` | Approve / edit / reject |
| POST | `/send/{message_id}` | Send (requires valid approval hash) |
| GET | `/dashboard` | Pipeline, attribution, analytics, precision |

### Environment variables
`ANTHROPIC_API_KEY`, `TAVILY_API_KEY`, `HUNTER_API_KEY`, `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `GMAIL_OAUTH_*`, `BAND_*`, `FLEXPRICE_API_KEY`

## 10. UI Requirements

- Hybrid layout: clean editorial style + dense spreadsheet-like data grid.
- Inline indicators: verification status, confidence, provenance badges.
- Collapsible **Agent Thinking** panel: live reasoning steps, graph traversals, validation logs.
- Score chip: 0–100 + Tier A/B/C; click to expand evidence.
- Screens: Intake · ICP Review · Prospects Grid · Account Detail (evidence, graph, business case, competitive table) · Approval Queue · Dashboard · Credits.

## 11. Demo Script (2.5 minutes)

1. **Intake (20s):** enter Flexprice → ICP with confidence and reasons.
2. **Top 5 leads (30s):** verified citations, tiers; show Precision@5 on labeled set.
3. **Band (25s):** Reviewer rejects an unsourced claim; Writer revises.
4. **Business case (25s):** move a slider; ROI and payback update live.
5. **HITL (20s):** edit one word → approval resets → re-approve → send.
6. **Flexprice (15s):** wallet hits zero → enrichment blocked.
7. **Dashboard (15s):** Kanban, AI vs. human attribution, warm vs. cold.

## 12. Build Plan (today)

**Rule:** the thin end-to-end pipeline must work by the halfway mark. Depth comes after.

| Phase | Person A (backend & agents) | Person B (frontend & money) |
|---|---|---|
| 1. Setup | Repo, FastAPI, Neo4j, Supabase, keys | Next.js scaffold, layout, intake form |
| 2. Thin pipeline | Tavily discovery → Claude extraction with citations → save | ICP review UI, prospects grid |
| 3. Core depth | Citation verifier, scoring, graph writes | Business case calculator + tests, approval queue with hash |
| 4. Integrations | Band agents + handoffs, Hunter enrichment | Flexprice gating + usage events, dashboard |
| 5. Proof | Graph queries, precision eval | Agent Thinking panel, polish |
| 6. Ship | Deploy, README, architecture doc | Record demo video |

**Cut order if behind:** competitive table → warm-path routing → expansion segments. **Never cut:** citation verification, the calculator, HITL.

## 13. Judging Criteria Mapping

| Criterion | Weight | How we score |
|---|---|---|
| ICP & Discovery Quality | 20% | Confidence-scored ICP, verified citations, Precision@5, expansion segments |
| Enrichment & Outreach | 20% | Verified emails, signal + business-case personalization, hash-bound HITL |
| Dashboard & Lead Mgmt | 15% | Kanban, agent/human attribution, conversion analytics |
| Startup Viability | 15% | Real pain, clear beachhead, business case as differentiator, data flywheel |
| Technical Execution & Demo | 10% | Working end-to-end prototype |
| Band Integration | 20% | Real handoffs, Reviewer rejections, human approval room |
| Flexprice Integration | 20% | Metered events, per-agent wallets, credit-gated execution |

## 14. Success Metrics

- End-to-end run completes for Flexprice with 5 prospects.
- 100% of displayed claims verified.
- Precision@5 ≥ 0.8 on the labeled set.
- Every send has a matching approval hash.
- ≥ 4 metered event types recorded in Flexprice.
- ≥ 1 visible agent rejection-and-revision loop in Band.

## 15. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Scope too wide | 5 deep prospects; strict cut order |
| Hallucinated claims | Re-fetch + string-match verifier; drop unverified |
| Sparse graph data | Preload real company and people data before demo |
| Sponsor API unfamiliarity | Read Band/Flexprice docs first hour; ask sponsor mentors early |
| API rate limits / free tiers | Cache results; pre-run discovery before recording |
| LinkedIn restrictions | Draft-only LinkedIn messages |
| Financial overclaiming | Conditional phrasing, provenance badges, "not proof of budget" note |

## 16. Long-Term Vision

Every reply, meeting, and closed deal reveals which signals and which business-case assumptions actually predict buying. That data recalibrates scores and default assumptions, better scores attract more sellers, and more sellers generate more data. The flywheel compounds into a **proprietary buying-signal and value graph** that competitors cannot copy by adding another AI SDR feature.

**Expansion path:** AI/devtools → general B2B SaaS → B2B services → traditional industries.

## 17. Open Questions

- Is Snyk scored? (confirm with organizers)
- Band integration method: SDK, CLI, or rooms API?
- Flexprice: hosted sandbox or self-hosted for the demo?
- Which 20 companies form the labeled precision set?
