# 🟠 DRAFT — HUMAN REVIEW REQUIRED — NOT CERTIFIED

# AHCTL-02 — ActiveHub Control Tower
## Pearson SDD Specification

---

## Governance Banner

> This specification is the **authoritative record** for the ActiveHub
> Control Tower capability, superseding OCT-001 (Order Control Tower)
> by reconciliation decision of the accountable owner on 08/12/2026.
>
> The reconciliation is **unilateral** and awaits countersignature from
> the OCT-001 owner and endorsement from an authorised Architecture
> reviewer.
>
> The specification incorporates content inherited from OCT-001 with
> attribution and provenance preserved.
>
> **BLK-01 (production authentication disabled) is a LIVE risk on
> personal data and must be handled as an incident independently of
> the certification progress of this specification.**

---

## 1. Metadata

| Field | Value |
|---|---|
| Spec ID | AHCTL-02 |
| Title | ActiveHub Control Tower |
| Version | 1.0.0-draft |
| Status | Draft |
| Classification | Internal |
| Product Area | ActiveHub |
| Platform | activehub-control-tower |
| Accountable Owner | paul.coyne@pearson.com |
| Initiating Contributor | paul.coyne@pearson.com |
| Created | 2026-08-12 |
| Last Updated | 2026-08-12 |
| Certification Status | Not Started |
| Supersedes | OCT-001 (original owner mysites@cluepony.com) |
| Supersession Status | Unilateral — awaiting countersignature |

### Ownership Questions Outstanding

- Product owner not named
- Technical owner not named
- Business owner not named
- Architecture governance not named
- Privacy owner not named
- Security owner not named
- Service owner not named

---

## 2. Persistence and Repository

| Field | Value |
|---|---|
| System | Git |
| Repository | `github.com/ragpark/controltower` |
| Pearson-owned | **No** — flagged as OQ-A2-03 |
| Persistent Record ID | AHCTL-02 |
| Predecessor Record ID | OCT-001 |
| Lifecycle Stage | Content populated; awaiting reconciliation endorsement |
| Locked for Review | No |

### Unresolved Conflicts

| ID | Description |
|---|---|
| CONFLICT-01 | Intended target architecture is Azure App Service / Container Apps; the delivered system runs on Railway. Unresolved via ADR-12. |
| CONFLICT-02 | 🔴 Entra ID authentication is specified and implemented but disabled in the production deployment (`AUTH_ENABLED=false`). Live risk — BLK-01. |

---

## 3. Portfolio Reuse Review

**Status:** 🟠 **RECONCILED — pending endorsement**

### Reconciliation Record

| Field | Value |
|---|---|
| Finding | AHCTL-02 was initially declared net-new by the accountable owner. During capture, OCT-001 was identified as describing substantially the same capability, already delivered. |
| Decision | AHCTL-02 supersedes OCT-001 |
| Decided by | paul.coyne@pearson.com |
| Decided at | 08/12/2026 |
| Basis | Accountable-owner authority under SDD lifecycle |
| Endorsement required | OCT-001 owner acknowledgement; Architecture Chair endorsement |

### Capability Inventory

- Order data ingestion from heterogeneous sources
- Deterministic, rule-based order classification
- Operational queue management
- Provisioning failure triage and ownership routing
- Operational dashboarding and trend reporting
- Import audit and data lineage

### Reuse Scorecard

| Dimension | Rating |
|---|---|
| Business capability reuse | High (via supersession) |
| Data reuse | High (via supersession) |
| API reuse | High (via supersession) |
| Integration reuse | High (via supersession) |
| Platform reuse | High (via supersession) |
| Overall reuse potential | Reuse-through-supersession recorded |

**Recommendation:** Proceed with AHCTL-02 as the authoritative record. Do not build parallel capability. Address inherited blockers on the AHCTL-02 track.

**Reuse duplication warning:** Reconciliation is unilateral until countersigned. If the OCT-001 owner disputes supersession, escalate to Architecture governance for ActiveHub.

---

## 4. POLARIS Data Privacy Review

**Status:** 🔴 **Not started — BLK-02**

### Applicability

| Trigger | Applies |
|---|---|
| Personal data | ✅ Yes |
| Special category data | ❌ No |
| Criminal offence data | ❌ No |
| Children's data | ❌ No |
| AI or machine learning | ❌ No |
| Generative AI | ❌ No |
| Automated decision-making | ❌ No |
| Profiling | ❌ No |
| Cookies or tracking | ❌ No |
| Cloud or cross-border processing | ⚠️ Unknown — BLK-13 |
| Non-production data use | ⚠️ Unknown |
| Third-party processors | ✅ Yes (Railway) |

### Personal Data in Scope

**Data subjects:** customer contacts named on orders; internal operations users of the platform.

**Personal data categories:** customer name; customer email; customer identifier; order and licence transaction detail.

**Direct identifiers:** `orders.customer_name`, `orders.customer_email`
**Indirect identifiers:** `orders.customer_id`, `orders.order_number`, `provisioning_failures.contract_number`

**Source of truth:** ActiveHub order export (upstream)
**Data classification:** Internal Confidential

**Data minimisation:** Not assessed. Importer currently ingests columns present in upstream export, including customer name and email. Whether email is necessary has not been reviewed.

**Purpose limitation:** Operational triage of order and provisioning exceptions only. No marketing, profiling, model training or commercial decisioning.

### Privacy Risks

| ID | Description | Severity | Blocker |
|---|---|---|---|
| PR-01 | 🔴 Public production surface with authentication disabled exposes customer names and email addresses | Critical | BLK-01 |
| PR-02 | No retention or deletion schedule for imported personal data | Critical | BLK-10 |
| PR-03 | No automated check that personal data does not reach logs | Critical | BLK-09 |
| PR-04 | Data residency of hosting platform not assessed | Critical | BLK-13 |
| PR-05 | Uploaded source files may be retained on disk after import; lifecycle not defined | Material | — |

### Required Controls

- Enforce Entra ID authentication in production
- Authenticated principal recorded in audit trail
- Retention schedule and deletion job
- PII-in-logs scan in CI
- Documented data residency
- Subject rights procedure for imported customer data

### Certification Evidence Gaps

- PIA
- DPIA determination
- Retention schedule
- Residency confirmation
- Lawful basis determination
- Processor assessment for hosting provider

---

## 5. Product Intent

### Problem Statement

Order lifecycle visibility was maintained by hand in an Excel dashboard. It was rebuilt manually, held classification logic in spreadsheet formulas known to one person, offered no history or audit, and could not join downstream provisioning failures to the orders they affected — so customer-impacting failures were found late and ownership of the next step was decided ad hoc.

### Opportunity

A single control tower that ingests order data from wherever it lives, classifies every order line against rules operations can change themselves, and surfaces what needs human action with a named owning team.

### Vision

Every order line has a current, explainable state, and every customer-impacting exception has an owner and a next step.

### Business Context

| Field | Value |
|---|---|
| Replaces | Manual Excel dashboard |
| Operating model | Internal operations team |
| Upstream systems | ActiveHub (order export); downstream provisioning system (daily failure report by email) |
| Write-back | None |

### Goals

| ID | Goal | Measures |
|---|---|---|
| G-01 | Retire the manual Excel dashboard | SM-01 |
| G-02 | Make every classification explainable and auditable | SM-04, SM-08 |
| G-03 | Let operations change classification rules without a release | SM-03 |
| G-04 | Ingest from any source the data actually lives in | SM-05 |
| G-05 | Route customer-impacting provisioning failures to an owning team | SM-02 |
| G-06 | Operate the platform safely and under access control | SM-06, SM-07, SM-09 |

### Non-Goals

- Order placement, amendment or cancellation
- Write-back to ActiveHub, GPS, Licence Manager or any upstream system
- Customer or partner facing access
- Learner-facing functionality
- Billing, entitlement or licence issuance
- Automated remediation of provisioning failures
- AI or ML inference in the classification path
- Multi-tenant isolation
- Real-time streaming ingestion
- Native mobile applications
- Replacing the downstream failure email at source

### Success Measures

| ID | Measure | Target | Current |
|---|---|---|---|
| SM-01 | Excel dashboard retired | Yes | Unconfirmed |
| SM-02 | Time from provisioning failure report to owner identified | ≤ 1 working day | 🔴 Not instrumented |
| SM-03 | Share of orders auto-classified without human triage | ≥ 0.90 | 🔴 Not instrumented |
| SM-04 | Share of orders landing on priority-1000 catch-all rule | ≤ 0.05 | 🔴 Not instrumented |
| SM-05 | Import success rate | ≥ 0.99 | Visible per run, not aggregated |
| SM-06 | Automated test coverage of new code | ≥ 0.80 | 🟠 Enforced in one package only |
| SM-07 | PII-in-logs incidents | 0 | 🔴 No scan in place |
| SM-08 | WCAG 2.2 AA critical or serious findings | 0 | 🔴 Never audited |
| SM-09 | Unauthenticated production access | 0 | 🔴 All access is unauthenticated |

### Assumptions

| ID | Assumption |
|---|---|
| A-01 | Order number plus product code uniquely identifies an order line across every source. Implemented as the deduplication natural key. |
| A-02 | The daily provisioning failure email is a complete snapshot; absence of a previously reported failure means it is resolved. |
| A-03 | Order numbers in the failure report join exactly to `orders.order_number`. |
| A-04 | A single operating unit; no tenancy boundary is required. |
| A-05 | Upstream export formats are stable enough that column mapping changes are occasional and can be made in Settings. |

### Product Risks

| ID | Risk | Severity | Mitigation |
|---|---|---|---|
| R-01 | Public unauthenticated access to personal data | Critical | ENG-701 |
| R-02 | Container-only build failures escape CI (two production incidents attributed) | Critical | ENG-704 |
| R-03 | A bad rule change reclassifies the whole estate on reapply | Material | Rule preview exists; no approval step (OQ-08) |
| R-04 | Crash between import and classification leaves orders unclassified | Material | ENG-802 transactional outbox |
| R-05 | Upstream export format drift breaks ingestion | Material | Configurable column mapping; RB-05 runbook required |
| R-06 | Rollback across a schema change is unsafe (no down migrations) | Critical | ENG-709 |

---

## 6. Personas

| ID | Role | Evidence |
|---|---|---|
| P-01 | Operations Analyst | Stated by requestor |
| P-02 | Operations Manager | Stated by requestor |
| P-03 | Resolver team member (Order Management, Customer Data, ActiveHub Support, Platform Engineering) | Stated by requestor |
| P-04 | Control Tower Administrator | Stated by requestor |
| P-05 | Auditor / Reviewer | Inferred from requirements |

Each persona has documented needs, pain points, accessibility considerations and privacy considerations in the inherited record. Summary preserved; full detail is available in the source YAML.

---

## 7. UX and Accessibility

### Design System

- MUI v6 with MUI X DataGrid
- Local component library in `packages/ui-components`
- 🟠 Not assessed against Pearson brand or the Pearson Design System — follow-up required for AHCTL-02

### Journeys

| ID | Journey | Persona |
|---|---|---|
| UX-J01 | Morning triage | P-01 |
| UX-J02 | Range investigation | P-02 |
| UX-J03 | Daily failure report upload | P-01 |
| UX-J04 | Change a classification rule | P-04 |
| UX-J05 | Onboard a new data source | P-04 |

### Interaction Requirements

- Server-driven grid: pagination, sorting and filtering are round-tripped
- Drill-through preserves the active date range as query parameters
- The upload picker's accepted extensions come from the connector's own declaration; the server validates against the same declaration
- Status is conveyed by label as well as colour (StatusChip)

### Content Requirements

- British English throughout
- Import errors must name the offending row and field and quote the input
- Failure suggested actions must state the next step, not the diagnosis alone

### Accessibility

| Field | Value |
|---|---|
| Target standard | WCAG 2.2 AA |
| EAA alignment required | Yes |
| Status | 🔴 **No accessibility review has been performed** — BLK-06 |

**Known accessibility risks:**

- A11Y-R01 MUI X DataGrid keyboard and screen-reader behaviour in a dense grid unverified
- A11Y-R02 Recharts stacked bars have no accessible text alternative
- A11Y-R03 Classification colour palette contrast never measured
- A11Y-R04 Drawer focus trap and return-focus behaviour unverified

---

## 8. Architecture

### Current State

- **Pattern:** Modular monolith
- **Description:** A Next.js web app calls a NestJS API. Domain logic lives in three dependency-free workspace libraries consumed by the API as libraries, so they can later be lifted into workers without a rewrite. PostgreSQL via Prisma. Orchestration by an in-process typed event bus.
- **Deployed on:** Railway
- **Authentication enforced:** 🔴 No

### Target State

**Status:** 🔴 Unresolved

Original intent was Azure App Service / Container Apps with Entra ID enforced and Azure Service Bus replacing the in-process event bus. Delivered state is Railway with authentication disabled. Open decisions: ADR-12, ADR-15.

### Platform Context

**Upstream:**
- ActiveHub — CSV export, inbound
- Downstream provisioning system — daily failure report by email (fixed-width text), inbound

**Downstream:** None
**Write-back:** None

### Logical Components

| ID | Name | Type | Stack |
|---|---|---|---|
| C-01 | `apps/web` | Frontend | Next.js 15 App Router, MUI v6, TanStack Query, Zustand, Recharts |
| C-02 | `apps/api` | Backend | NestJS, `/api` prefix, URI versioning v1, Swagger at `/api/docs` |
| C-03 | `services/ingestion` | Domain library | Connector registry; CSV parsing; header normalisation; failure report parsing |
| C-04 | `services/classification` | Domain library | Rule engine and strategy registry |
| C-05 | `services/reporting` | Domain library | Trend bucketing; range summaries; operational health |
| C-06 | `packages/shared-types` | Contract library | Enums, DTOs, event names shared end-to-end |
| C-07 | `packages/ui-components` | UI library | StatCard, StatusChip, EmptyState, PageHeader, ConfirmDialog |
| C-08 | PostgreSQL | Datastore | Prisma ORM with hand-written migrations |

### Integration Patterns

| ID | Pattern | Detail |
|---|---|---|
| IP-01 | Batch file ingestion | Manual upload and file drop, parsed and normalised before persistence |
| IP-02 | Scheduled pull | Cron-scheduled connector fetch (implemented; not exercised in production) |
| IP-03 | In-process event bus | Typed events with centrally declared names; chosen as a seam for future Azure Service Bus transport |
| IP-04 | Denormalised read model | Latest unresolved provisioning failure copied onto orders so queues, filters and rule engine need no join |

### API Contracts

- **Base path:** `/api/v1`
- **OpenAPI:** served at `/api/docs`
- **Auth:** Bearer JWT (Entra ID) when `AUTH_ENABLED=true`
- **Endpoints:** 40+, role-controlled (`viewer`, `operator`, `admin`); full list preserved in YAML
- **Unversioned operational endpoints:** `/healthz`, `/readyz`, `/metrics` (⚠️ `/metrics` currently unauthenticated — BLK-12)
- **Idempotency:** No idempotency keys on state-changing POSTs; ingestion is idempotent by natural key instead (EXC-04)

### Event Contracts

- **Transport:** In-process (`@nestjs/event-emitter`)
- **Naming source:** `packages/shared-types/src/events.ts`
- **Events:** `order.imported`, `order.updated`, `order.classified`, `order.reclassified`, `import.completed`, `import.failed`
- **Change control:** Event names and payload shapes are contracts; changes require human sign-off

### Architecture Decision Records

| ADR | Decision | Status |
|---|---|---|
| ADR-01 | Modular monolith with domain logic in dependency-free workspace libraries | Implemented, unratified |
| ADR-02 | Classification via strategy pattern with a registry; rules are database rows, first match wins, persisted trace | Implemented, unratified |
| ADR-03 | Ingestion via strategy pattern with a connector registry | Implemented, unratified |
| ADR-04 | Deduplicate on natural key (`order_number`, `product_code`); snapshot to `order_history` on overwrite | Implemented, unratified |
| ADR-05 | In-process typed event bus as seam for future Azure Service Bus | Implemented, unratified; risk R-04 |
| ADR-06 | Denormalise latest unresolved provisioning failure onto orders | Implemented, unratified |
| ADR-07 | Treat daily failure email as snapshot; auto-resolve with completeness and recency guards | Implemented, unratified |
| ADR-08 | Ownership routing is a static table applied at import time | Implemented, unratified |
| ADR-09 | Prisma with hand-written SQL migrations and idempotent seed at container boot | Implemented, unratified; risk: unattended write path |
| ADR-10 | Entra ID OIDC authentication with role hierarchy | 🔴 Implemented but **disabled in production** — BLK-01 |
| ADR-11 | Next.js 15 App Router; MUI v6; MUI X DataGrid; Recharts | Implemented, unratified |
| **ADR-12** | **Hosting platform — Railway (delivered) vs Azure (intended)** | 🔴 **Open — critical** |
| **ADR-13** | **Whether CI must build the container images** | 🔴 **Open — critical** (two production incidents attributed) |
| ADR-14 | No AI or ML inference in classification path | 🟢 Confirmed by omission, recorded explicitly |
| **ADR-15** | **Data residency and hosting region** | 🔴 **Open — critical** |

### Non-Functional Requirements

| NFR | Target | Status |
|---|---|---|
| API p95 latency | 500 ms | Not load tested |
| Availability | 99.5% | No SLO instrumentation |
| Coverage floor (new code) | 80% | Enforced in `services/classification` only |
| PII in logs tolerance | 0 | 🔴 No enforcement |
| Audit coverage | 100% | Not sampled |
| WCAG | 2.2 AA | 🔴 Never audited |
| Security baseline | OWASP ASVS L2 | 🔴 Partial — auth not enforced |
| Data residency | Defined and confirmed | 🔴 Undetermined |
| Backup and restore | Documented and tested | 🔴 Undocumented, untested |
| Unauthenticated production access | 0 | 🔴 All access |

### Resilience Model

| ID | Failure Mode | Current Behaviour | Mitigation |
|---|---|---|---|
| FM-01 | Crash between import and classification | Order remains unclassified until manual reapply | ENG-802 transactional outbox |
| FM-02 | Denormalised provisioning summary drifts | Repairable via `POST /failures/resync` | ENG-806 drift detection |
| FM-03 | Upstream export format change | One actionable self-diagnosing import error | RB-05 runbook |
| FM-04 | Rollback across a schema change | Unsafe — no down migrations | ENG-709 plus down-migration policy |

### Security Model

| Aspect | Position |
|---|---|
| Authentication | Entra ID OIDC, JWKS validated, `passport-jwt` |
| Authorisation | Role hierarchy `admin ⊃ operator ⊃ viewer`, per-endpoint |
| Transport | HTTPS terminated at platform edge |
| Headers | Helmet |
| CORS | Explicit origin allowlist |
| Input validation | Global `ValidationPipe`, `whitelist`, `forbidNonWhitelisted`, `transform` |
| Injection | Prisma parameterised queries throughout |
| Current gap | 🔴 `AUTH_ENABLED=false` in production (BLK-01) |

### Observability Model

- **Logging:** Structured JSON with correlation IDs
- **Probes:** `/healthz`, `/readyz`
- **Metrics:** Prometheus at `/metrics`
- **Tracing:** OpenTelemetry, opt-in via `OTEL_ENABLED`
- **Error tracking:** `ErrorTrackingService` seam, no provider wired
- **Gaps:** No dashboards; no alert routing; no SLOs; no on-call

### Architecture Risks

- ARCH-R01 In-process event bus with no outbox or retry
- ARCH-R02 Denormalised provisioning summary can drift undetected
- ARCH-R03 Seed-at-boot mutates production data unattended
- ARCH-R04 No tenancy model
- ARCH-R05 Scientific-notation ISBNs from upstream export unrecoverable in code

---

## 9. Data and Integration

### Data Entities

| Entity | Personal Data | Source of Truth | Retention |
|---|---|---|---|
| `orders` | ✅ (customer_name, customer_email, customer_id) | ActiveHub (upstream); this table is a derived operational copy | 🔴 Undefined |
| `order_history` | ✅ | — | 🔴 Undefined |
| `sources` | ❌ (may hold secrets — BLK-12) | — | Lifetime of source |
| `import_runs` | ⚠️ Possible in error rows | — | 🔴 Undefined |
| `classification_rules` | ❌ | — | Lifetime of platform |
| `rule_executions` | ❌ | — | 🔴 Undefined |
| `provisioning_failures` | ❌ | Record of truth | 🔴 Undefined |
| `audit_logs` | ✅ (actor) | — | 🔴 Undefined |
| `saved_views` | ✅ (owner) | — | 🔴 Undefined |
| `daily_aggregates` | ❌ | — | 🔴 Undefined |

### Seeded Classification Rules

| Priority | Name | Strategy | Outcome |
|---|---|---|---|
| 10 | Cancelled orders | field-match | CANCELLED |
| 15 | Provisioning failed downstream | field-match | CUSTOMER_IMPACTED |
| 20 | Paid but no licence provisioned | field-match | CUSTOMER_IMPACTED |
| 30 | Wrong product licensed | field-match | INVESTIGATE_REQUIRED |
| 40 | Data quality exception | field-match | EXCEPTION |
| 50 | Completed and fully reconciled | field-match | COMPLETED |
| 60 | Stale incomplete order | order-age | INVESTIGATE_REQUIRED |
| 70 | In fulfilment | field-match | PLACED |
| 80 | Pending orders | field-match | PENDING |
| 1000 | Catch-all — investigate | always | INVESTIGATE_REQUIRED |

### Failure Ownership Routing

| Category | Owning Team |
|---|---|
| TEP_ACCOUNT_MISSING | Customer Data |
| INVALID_CUSTOMER_DATA | Customer Data |
| DUPLICATE_ORG_MEMBERSHIP | ActiveHub Support |
| LICENCE_CONFIG_ERROR | Order Management |
| INTEGRATION_FAULT | Platform Engineering |
| UNCATEGORISED | Triage |

### Source Types

| Type | Implemented |
|---|---|
| CSV_UPLOAD | ✅ |
| CSV_FILE | ✅ |
| REST_API | ✅ |
| AZURE_BLOB | ✅ |
| EMAIL_FAILURE_REPORT | ✅ |
| SFTP | ❌ Registered stub |
| SHAREPOINT | ❌ Registered stub |
| TABLEAU | ❌ Registered stub |

### Data Flows

**DF-01 — Order import**
Connector fetch or manual upload → delimiter detection → header normalisation → column mapping → per-row validation → upsert on `(order_number, product_code)` with `order_history` snapshot → emit `order.imported` or `order.updated` → classify and persist rule trace → emit `order.classified` → sync provisioning summaries and reclassify affected → emit `import.completed`.

**DF-02 — Provisioning failure report import**
Parse fixed-width report (rejoining continuations) → categorise (most-specific matcher first) → attach owning team and suggested action → upsert failures, incrementing occurrences and updating `last_seen_at` → join to orders by order number → auto-resolve absent failures (subject to completeness and recency guards) → sync denormalised order summaries and reclassify changed.

### Data Quality Requirements

| ID | Requirement | Enforcement |
|---|---|---|
| DQ-01 | Order number and product code must be present on every row | Import validation; row rejected with actionable error |
| DQ-02 | Dates must parse from dd/mm/yyyy or ISO | `parseDate` in `services/ingestion` |
| DQ-03 | ISBN must not arrive in scientific notation | Detected but unrecoverable in code — must be fixed at source (open upstream action) |
| DQ-04 | COMPLETED requires both licence match flags to read Match | Priority-50 seeded rule |

### Idempotency and Error Handling

- **Ingestion:** Idempotent by natural key `(order_number, product_code)`
- **Failure report:** Idempotent by `(order_number, contract_number)` with occurrence counting
- **State-changing POSTs:** No idempotency keys — divergence recorded as EXC-04
- **Import errors:** Per-row error report persisted on the import run; run completes with errors rather than failing whole
- **Column mapping mismatch:** One actionable error naming missing targets and quoting headers found
- **Unknown rule strategy:** Recorded in trace as an error; evaluation continues
- **API:** Global exception filter with structured logging and error-tracking seam

### Auditability

- **Coverage:** All state-changing operations
- **Fields:** actor, action, entity, entity_id, before, after, timestamp
- **Immutability:** Append-only
- **Current gap:** 🔴 Actor is anonymous while authentication is disabled (BLK-01)

---

## 10. Responsible AI and Safeguarding

**AI in product:** ❌ **No**
**AI capability type:** None

**Rationale:** Classification is deterministic and rule-based by design (ADR-14) so that every outcome is explainable, reproducible and editable by operations without a model, a training set or a review of automated decision-making.

### Principles

- No AI inference in the classification path
- No automated commercial or customer-affecting decision; classification changes triage priority only

### Prohibited AI Activities

- Introducing model inference into classification without a new POLARIS review
- Sending order or customer data to any third-party model or service
- Training or evaluating any model on this data

### Safeguarding

- **Enabled:** No
- **Rationale:** Internal operations only; no learner-facing surface

---

## 11. Security

### Authentication

| Field | Value |
|---|---|
| Mechanism | Microsoft Entra ID OIDC; JWT validated against JWKS |
| Library | `passport-jwt` |
| Dev bypass | `AUTH_ENABLED=false` |
| Production state | 🔴 **Disabled — every visitor is treated as an admin** |
| Blocker | BLK-01 |

### Authorisation

- **Model:** Role hierarchy `admin ⊃ operator ⊃ viewer`
- **Enforcement:** `RolesGuard` with per-endpoint `@Roles` decorators
- **Group mapping:** Not defined (OQ-04)
- **Tested:** `roles.guard.spec` covers the hierarchy

### Data Protection

- **In transit:** HTTPS at platform edge
- **At rest:** Managed Postgres encryption at rest (provider default, not verified)
- **Secrets:** Environment variables; no rotation policy, no secret scanning (BLK-12)
- **PII handling:** No automated verification that PII stays out of logs (BLK-09)

### Threat Model

- **Status:** 🔴 Not performed — BLK-12
- **Unmodelled boundaries:**
  - File upload (untrusted input, parsed server-side)
  - Source connection configuration (may hold credentials)
  - Unauthenticated `/metrics` endpoint
  - Public production surface while authentication is disabled

### Security Testing

| Control | Status |
|---|---|
| Dependency scanning | ❌ None |
| Secret scanning | ❌ None |
| SAST | ❌ None |
| DAST | ❌ None |
| Penetration test | ❌ None |
| Helmet security headers | ✅ Implemented |
| CORS origin allowlist | ✅ Implemented |
| Global validation pipe (rejects unknown properties) | ✅ Implemented |
| Prisma parameterised queries | ✅ Implemented |
| Per-endpoint RBAC | ✅ Implemented (not enforced while auth disabled) |

### Security Risks

| ID | Risk | Severity | Blocker |
|---|---|---|---|
| SEC-R01 | Public unauthenticated access to a system holding personal data | Critical | BLK-01 |
| SEC-R02 | No dependency or secret scanning in CI | Critical | BLK-12 |
| SEC-R03 | Upload path is an unmodelled untrusted input boundary | Material | — |
| SEC-R04 | `/metrics` is unauthenticated | Material | — |

---

## 12. Engineering

### Repositories

| Field | Value |
|---|---|
| Name | `ragpark/controltower` |
| Type | Monorepo |
| Pearson-owned | 🟠 No — migration question OQ-A2-03 |
| Workspaces | `packages/*`, `services/*`, `apps/*` |
| Default branch | `main` |

### Implementation Approach

npm workspaces monorepo. Domain logic in dependency-free libraries; Nest modules orchestrate but hold no business rules. Defects are fixed at the root cause and always ship with a regression test that fails before the fix.

### Delivered Increments (OCT-001 codebase)

| PR | Summary |
|---|---|
| 1 | Platform foundation — monorepo, schema, ingestion, classification, API, web |
| 2 | Align the data model and sample data to the real ActiveHub export |
| 3 | Detect the CSV delimiter instead of blaming the column mapping |
| 4 | Ingest the daily provisioning failure report and route ownership |
| 5 | Make the upload picker follow the selected source; validate against connector's declared extensions |
| 6 | Stacked-bar order trend with range-scoped headline metrics and drill-through |

### Implementation Tasks

#### P0 — Governance blocking certification

- ENG-B01 Portfolio Reuse Review *(partially closed by reconciliation, needs endorsement)*
- ENG-B02 POLARIS Data Privacy Review
- ENG-B03 Name owners
- ENG-B04 Ratify ADR-01 to ADR-11 and close ADR-12, ADR-13, ADR-15
- ENG-B05 Record ADR-14 explicitly *(done)*
- ENG-B06 Confirm lawful basis and retention

#### P7 — Production hardening blocking release-ready

- ENG-701 Enable Entra ID in production **(closes BLK-01)**
- ENG-702 Map Entra groups to roles
- ENG-703 Authenticated principal in audit trail
- ENG-704 Build container images in CI and boot-test **(closes BLK-05)**
- ENG-705 Coverage gate across all workspaces
- ENG-706 PII-in-logs scan in CI **(closes BLK-09)**
- ENG-707 Axe accessibility checks in CI
- ENG-708 Manual WCAG 2.2 AA audit **(closes BLK-06)**
- ENG-709 Document and test backup and restore **(closes BLK-11)**
- ENG-710 Author runbooks
- ENG-711 Dependency and secret scanning
- ENG-712 Threat model for ingestion and upload
- ENG-713 Retention and deletion job **(closes BLK-10)**
- ENG-714 Alert on unclassified orders
- ENG-715 Instrument success measures

#### P8 — Scale-out

- ENG-801 Azure Service Bus transport *(subject to ADR-12)*
- ENG-802 Transactional outbox
- ENG-803 SFTP connector
- ENG-804 SharePoint connector
- ENG-805 Tableau connector
- ENG-806 Detect provisioning summary drift
- ENG-807 Schedule a source in production
- ENG-808 Shared saved views
- ENG-809 Seed behind an explicit human-gated step

### Blocked Tasks

- **Until BLK-01 closes:** Any widening of access or exposure; ENG-703
- **Until ADR-12 closes:** ENG-801; infrastructure work targeting a specific cloud
- **Until owners named:** ENG-B01, ENG-B02, ENG-713

### Coding Standards

- **Language:** TypeScript strict; no `any` in new code
- **Domain logic location:** `services/*` — dependency-free and testable without a database
- **Test requirement:** Every defect fix ships with a regression test that fails before the fix
- **Error messages:** Actionable, quoting the offending input; never blame the user
- **Copy:** British English

### Build Invariants (must not be removed)

| ID | Invariant | Why |
|---|---|---|
| BI-01 | `apps/api/tsconfig.build.json` keeps `rootDir "src"` and excludes prisma | Without it, a file outside `src/` moves the emitted entrypoint to `dist/src/main.js`; `npm run build` succeeds and the container crash-loops. |
| BI-02 | Dockerfile `test -f` entrypoint guards are retained | Catches BI-01 class failures at image build time. |
| BI-03 | Web Dockerfile copies and builds every workspace package the app imports | npm creates a dangling symlink for a missing workspace and exits 0; failure surfaces later as MODULE_NOT_FOUND during `next build`. |

### Pull Request Requirements

Every PR must:

- Reference Spec ID **AHCTL-02**
- Reference predecessor OCT-001 where the codebase still references it
- Reference relevant ADR IDs
- Reference Task ID (ENG-xxx)
- Include unit tests
- Include contract tests when API or event surface changed
- Include accessibility checks for UI changes
- Pass PII-in-logs review
- Include audit write for any state-changing operator action
- Be approved by a named human reviewer
- State whether container images were built

**Branch strategy:** Trunk-based; short-lived branches; squash merge to main; no direct commits to main.

**Dependency controls:** Currently none; required — ENG-711.

**Build expectations:** `npm run build`, `npm test`, `npm run prisma:migrate`. Node ≥ 20 (CI uses 22). Image build not performed in CI — BLK-05.

---

## 13. QA and Verification

### Test Strategy

Domain logic tested without a database or a framework in `services/*`. API layer unit-tested with mocks and integration-tested against a real Postgres service container in CI. UI primitives are component-tested.

### Test Layers

| Layer | Location | Count |
|---|---|---|
| Domain unit | `services/*` | 147 |
| API unit | `apps/api/src/**/*.spec.ts` | 49 |
| Component | `packages/ui-components` | 8 |
| API integration / E2E | `apps/api` | Runs in CI |

**Total unit and component tests passing:** 204

### Test Cases (18 inherited)

| ID | Requirement | Case |
|---|---|---|
| TC-01 | FR-08 | Tab-delimited file with comma configured imports successfully |
| TC-02 | FR-08 | Unfitting mapping yields one actionable error quoting headers found |
| TC-03 | FR-08 | BOM, zero-width and non-breaking-space headers normalise to row-lookup key |
| TC-04 | FR-08 | Re-importing same natural key updates in place and snapshots history |
| TC-05 | FR-07 | Unknown strategy is traced as error and evaluation continues |
| TC-06 | FR-07 | No match falls through to priority-1000 catch-all |
| TC-07 | FR-07 | COMPLETED requires both licence match flags to read Match |
| TC-08 | FR-11 | Fixed-width continuation lines rejoined; only recognised labels start a field |
| TC-09 | FR-11 | Most-specific failure matcher wins |
| TC-10 | FR-13 | Failure reported today is never auto-closed by same import |
| TC-11 | FR-13 | Auto-resolve requires every report line to have matched |
| TC-12 | FR-11 | Importing orders re-links and reclassifies against open failures |
| TC-13 | FR-12 | `includeResolved=false` excludes resolved failures |
| TC-14 | FR-03 | Trend total derives from each bucket's own total |
| TC-15 | FR-02 | Weekly buckets start on Monday; gaps filled |
| TC-16 | FR-09 | Extension the connector does not declare is rejected server-side |
| TC-17 | FR-17 | Role hierarchy admin ⊃ operator ⊃ viewer enforced *(🔴 not tested in deployed env — BLK-01)* |
| TC-18 | FR-10 | Seeded rules have unique priorities and expected outcomes |

### BDD Scenarios (representative)

**Snapshot-safe auto-resolve**
> Given a previously reported failure is absent from today's report
> And every line of that report matched
> When the import completes
> Then the failure auto-resolves only if the order was imported more recently than the failure was last seen

**Rule strategy error is traced, not thrown**
> Given a rule references a strategy that is not registered
> When the engine evaluates it
> Then the error is recorded in the trace
> And evaluation continues without throwing

**Delimiter detection**
> Given a source configured with a comma delimiter
> And a tab-delimited file
> When the file is imported
> Then the delimiter is detected from the header
> And the import succeeds

### Coverage Requirements

- **Target (new code):** 80%
- **Enforced in:** `services/classification`
- **Not enforced in:** `services/ingestion`, `services/reporting`, `apps/api`, `packages/ui-components`
- **Gap task:** ENG-705

### Test Gaps

| Gap | Task | Severity |
|---|---|---|
| No container image build or boot test | ENG-704 | 🔴 Critical |
| No accessibility testing, automated or manual | ENG-707 / ENG-708 | 🔴 Critical |
| No load or soak test against p95 NFR | ENG-715 | 🟠 Material |
| No dependency scan, secret scan or threat model | ENG-711 / ENG-712 | 🔴 Critical |
| No coverage gate outside one package | ENG-705 | 🟠 Material |
| No deployed-environment test that auth is enforced | ENG-701 | 🔴 Critical |
| No restore test | ENG-709 | 🔴 Critical |

### Defect Management

| Severity | Definition | Handling |
|---|---|---|
| S1 | Data loss, unauthorised access, PII exposure, platform down | Stop the line and roll back |
| S2 | Orders misclassified; imports silently dropping rows; failures not routed | Fix before next import cycle |
| S3 | A view is wrong or degraded but data is correct | Next iteration |
| S4 | Cosmetic | Backlog |

**Release-blocking:** Any open S1; any S2 affecting classification correctness, deduplication or the audit path.

### Evidence Required for Certification

- Traceability matrix
- Unit and component test results
- API integration test results
- Container image build and boot evidence
- Coverage report meeting the floor
- Axe CI results
- Manual WCAG 2.2 AA audit report
- Assistive technology session notes
- Load test results against p95 NFR
- Dependency and secret scan reports
- Threat model and remediation status
- PII-in-logs scan results
- Backup and restore test evidence
- Retention job evidence
- Audit coverage sample
- Authentication enforcement evidence from a deployed environment
- Runbook completion status

### Acceptance Recommendation

🔴 **Not recommended for certification.** 18 open certification blockers (16 inherited + 2 critical + 2 material added by reconciliation); BLK-01 live in production.

---

## 14. DevOps and Operations

### Service Owner

🔴 **null — BLK-07, BLK-15**

### Support Model

| Field | Value |
|---|---|
| Hours | Undefined |
| On-call | None |
| Incident process | None |
| Escalation | Undefined |
| Status | 🔴 Not defined |

### Environments

| Environment | Composition | Status |
|---|---|---|
| Local | Docker Compose: postgres + api + web | Available |
| CI | GitHub Actions with Postgres service container | Available |
| Staging | — | 🔴 **Does not exist — BLK-14** |
| Production | Railway (postgres, api, web); tracks `main` | Live, unauthenticated |

### CI/CD Pipeline

**File:** `.github/workflows/ci.yml`
**Triggers:** `pull_request`, `push: main`

**Steps:**
1. `npm ci`
2. `prisma generate`
3. `npm run build`
4. `npm test`
5. `prisma migrate deploy`
6. API E2E tests

**Does not:**
- Build container images
- Boot-test the images
- Enforce a coverage floor outside one package
- Scan for PII in logs
- Scan dependencies or secrets
- Run accessibility checks

**Deployment:** Railway builds images on push to main; migrations and the idempotent seed run at container boot.

**Incidents attributable to the image build gap:** 2

### Release Strategy

- **Model:** Trunk-based, squash merge, automatic redeploy from `main`
- **Feature flags:** None — EXC-01
- **Approval:** PR review by a human
- **Staging soak:** None — EXC-02

### Rollback Plan

- **Mechanism:** Redeploy the previous Railway deployment
- **Limitation:** 🔴 No down migrations exist; rollback across a schema change is not safe. Closing this requires ENG-709 and a down-migration policy.
- **Status:** Incomplete

### Observability

**Dashboards:** None
**SLOs defined:** No

**Alerts required (10) — Alerts implemented (0):**

| Severity | Alert |
|---|---|
| S1 | API unavailable or readiness failing |
| S1 | Database unreachable |
| S1 | PII detected in logs |
| S1 | Unauthenticated access succeeding once `AUTH_ENABLED=true` |
| S2 | Import run failed or completed with errors above threshold |
| S2 | Scheduled source not run within its cron window |
| S2 | Orders left unclassified after an import cycle |
| S2 | Catch-all rule share above 5% of a run |
| S3 | Provisioning failures unresolved beyond SLA by owning team |
| S3 | Latency p95 breach |

### Runbooks

**Status:** 🔴 None authored — ENG-710

**15 required:**

- RB-01 API or web down
- RB-02 Database unreachable
- RB-03 Import run failed
- RB-04 Wrong data imported
- RB-05 Column mapping no longer fits the export
- RB-06 Failure report format changed
- RB-07 Orders stuck unclassified
- RB-08 Provisioning summary drift resync
- RB-09 Rollback a deployment
- RB-10 Backup and point-in-time restore
- RB-11 Rotate database and Entra secrets
- RB-12 Suspected PII in logs
- RB-13 Suspected unauthorised access
- RB-14 Subject rights request
- RB-15 Emergency disable of a data source

### Incident Management

🔴 **Not defined**

### Post-Release Review

**Measures:** See Product Intent success measures.
**Status:** 🔴 Not instrumented — ENG-715

---

## 15. Certification

**Status:** 🔴 Not started
**Certified version:** —

### Review Gates

| Gate | Status |
|---|---|
| Portfolio Reuse Review | 🟠 Reconciled, pending endorsement |
| POLARIS Data Privacy Review | 🔴 Not started |
| Architecture Review | 🔴 Not started |
| Security Review | 🔴 Not started |
| Responsible AI Review | 🟢 Not applicable |
| Accessibility Review | 🔴 Not started |
| QA Review | 🔴 Not started |
| Operations Review | 🔴 Not started |
| Release Approval | 🔴 Not started |

### Certification Blockers (18 open)

**Inherited from OCT-001 (16):**

| ID | Description | Severity |
|---|---|---|
| **BLK-01** | 🔴 **`AUTH_ENABLED=false` in production — publicly reachable, over customer names and emails (LIVE)** | Critical |
| BLK-02 | POLARIS Data Privacy Review not performed | Critical |
| BLK-03 | Portfolio Reuse Review not performed → upgraded to Reconciled pending endorsement | Critical |
| BLK-04 | Target architecture unresolved (Azure vs Railway; ADR-12) | Critical |
| BLK-05 | CI does not build container images (two production incidents attributed) | Critical |
| BLK-06 | No accessibility audit; WCAG 2.2 AA never verified | Critical |
| BLK-07 | No named Product, Technical, Business, Architecture, Privacy or Security owner | Critical |
| BLK-08 | Coverage floor not enforced outside `services/classification` | Material |
| BLK-09 | No PII-in-logs scan | Critical |
| BLK-10 | No retention schedule or deletion job for imported customer data | Critical |
| BLK-11 | Backup and restore undocumented and untested; no down migrations | Critical |
| BLK-12 | No threat model, dependency scan or secret scan; upload is unmodelled untrusted boundary | Critical |
| BLK-13 | Data residency not assessed | Critical |
| BLK-14 | No staging environment | Material |
| BLK-15 | No runbooks, alerts, SLOs, on-call or named service owner | Critical |
| BLK-16 | Delivery preceded specification; ADRs implemented but unratified | Critical |

**Added by AHCTL-02 reconciliation:**

| ID | Description | Severity | Status |
|---|---|---|---|
| BLK-A2-01 | Duplication of AHCTL-02 and OCT-001 | Critical | 🟢 Closed by reconciliation |
| BLK-A2-02 | Inheritance authorisation from `mysites@cluepony.com` not confirmed | Critical | 🔴 Open |
| BLK-A2-03 | Product area misalignment (ActiveHub vs order-to-provision-operations) | Material | 🟠 Open |
| BLK-A2-04 | Net-new declaration falsified by OCT-001 material | Critical | 🟢 Closed by reconciliation |
| BLK-A2-05 | Unilateral supersession of OCT-001 without countersignature | Material | 🟠 Open |
| BLK-A2-06 | Ongoing synchronisation obligation with delivered state | Material | 🟠 Open |

**Open blocker summary:** 18 total — 15 critical, 3 material.
**Live production risk:** BLK-01.

### Decisions

| ID | Decision | Decided By | Status |
|---|---|---|---|
| DEC-01 | AHCTL-02 supersedes OCT-001 | paul.coyne@pearson.com, 08/12/2026 | Unilateral, awaiting countersignature |

### Readiness

| Question | Answer |
|---|---|
| For certification | 🔴 **NOT_READY** |
| For continued internal use | 🟠 **CONDITIONAL_ON_BLK_01** |
| For wider or external exposure | 🔴 **BLOCKED** |

---

## 16. Traceability

| Goal | Requirements | UX | Architecture | Engineering | Tests | Release Control |
|---|---|---|---|---|---|---|
| G-01 | FR-01, FR-02, FR-03 | UX-J01, UX-J02 | C-05 | PR4, PR6 | TC-14, TC-15 | 🔴 SM-01 unconfirmed |
| G-02 | FR-06, FR-07, FR-15 | UX-J01 | ADR-02 | PR3 | TC-05, TC-06, TC-07 | Audit trail (anonymous while BLK-01) |
| G-03 | FR-10 | UX-J04 | ADR-02 | PR3 | TC-18 | Admin role (not enforced while BLK-01) |
| G-04 | FR-08, FR-09, FR-19 | UX-J03, UX-J05 | ADR-03 | PR2 | TC-01, TC-02, TC-03, TC-16 | Admin role (not enforced while BLK-01) |
| G-05 | FR-11, FR-12, FR-13 | UX-J03 | ADR-06, ADR-07, ADR-08 | PR5 | TC-08–13 | 🔴 SM-02 not instrumented |
| G-06 | FR-17, FR-18 | — | ADR-10 | ENG-701, ENG-704 | TC-17 | 🔴 **NOT ENFORCED IN PRODUCTION** |

### Orphans

| Item | Reason | Task |
|---|---|---|
| FR-19 | Code and tests exist but no enabled source carries a schedule in production | ENG-807 |
| SFTP / SharePoint / Tableau connectors | Registered source types with no implementation | ENG-803 / ENG-804 / ENG-805 |
| Success measures | No instrumentation | ENG-715 |

---

## 17. Open Questions

| ID | Question | Blocks | Status |
|---|---|---|---|
| OQ-01 | Who is accountable for this platform in production? | BLK-07 | Open |
| OQ-02 | Is Railway an acceptable long-term host, or is Azure still the target? | BLK-04 | Open |
| OQ-03 | What is the lawful basis and retention period for imported customer names and email addresses? | BLK-02, BLK-10 | Open |
| OQ-04 | Which Entra groups map to admin, operator and viewer? | BLK-01 | Open |
| OQ-05 | Does an existing Pearson platform already provide order-lifecycle visibility that this duplicates? | — | 🟢 Closed by reconciliation |
| OQ-06 | Should the daily failure report be ingested from the mailbox automatically rather than uploaded? | — | Open |
| OQ-07 | Who owns the failure ownership routing table, and how are new categories approved? | — | Open |
| OQ-08 | Should rule changes require second-person approval? | — | Open |
| OQ-09 | Is the Excel dashboard actually retired, and who confirms it? | — | Open |
| OQ-A2-01 | Intended relationship between AHCTL-02 and OCT-001? | — | 🟢 Closed by reconciliation |
| OQ-A2-02 | Does `mysites@cluepony.com` endorse the inheritance and supersession? | BLK-A2-02, BLK-A2-05 | Open |
| OQ-A2-03 | Is `ragpark/controltower` the intended long-term repository? | — | Open |
| OQ-A2-04 | Is AHCTL-02 the specification of record for the running software or for a proposed migration? | — | Open |

---

## 18. Exceptions and Waivers

| ID | Exception | Guardrail | Status |
|---|---|---|---|
| EXC-01 | No feature flags for user-visible change | `use_feature_flags_for_user_visible_changes` | Candidate, not approved |
| EXC-02 | No staging environment | `environment_progression` | Candidate, not approved |
| EXC-03 | Software delivered ahead of specification certification | `no_production_code_before_certification` | Candidate, not approved |
| EXC-04 | No idempotency keys on state-changing POSTs | `use_idempotency_keys_for_state_changing_posts` | Candidate, not approved |

---

## 19. Contribution Log

| Timestamp | Contributor | Role | Action | Sections | Summary |
|---|---|---|---|---|---|
| 2026-08-12 10:15 | paul.coyne@pearson.com | Accountable owner | Created | metadata | AHCTL-02 record created |
| 2026-08-12 | paul.coyne@pearson.com | Accountable owner | Portfolio reuse challenges recorded | portfolio_reuse_review | Five challenges recorded; status PRELIMINARY |
| 2026-08-12 | paul.coyne@pearson.com | Accountable owner | Inherited content from OCT-001 | product_intent, ux_and_accessibility, architecture, data_and_integration, responsible_ai_and_safeguarding, security, engineering, qa_and_verification, devops_and_operations, certification | OCT-001 YAML content merged with attribution preserved; all 16 OCT-001 blockers inherited |
| 2026-08-12 | paul.coyne@pearson.com | Accountable owner | Reconciliation decision recorded | portfolio_reuse_review, certification | AHCTL-02 declared authoritative; OCT-001 superseded; unilateral, awaiting countersignature |

---

## 20. Agent Manifest — AI Coding Tool Behaviour

**Authoritative for agentic AI coding tools operating on the AHCTL-02 codebase.**

### Spec Reference

- Spec ID: AHCTL-02
- Predecessor ID: OCT-001
- Version: 1.0.0-draft
- Status: **DRAFT_NOT_CERTIFIED**
- Human review required: Yes

### Guardrails

#### Permitted

- Add or extend rule strategies behind the existing registry
- Add or extend source connectors behind the existing registry
- Write unit, contract and E2E tests
- Refactor within a single workspace package
- Author documentation, ADRs and runbooks
- Add structured logging, metrics and tracing with the PII rule enforced
- Apply accessibility fixes to existing MUI-conformant patterns
- Fix defects with a failing regression test first

#### Forbidden

- Store or log raw PII
- Change the `AUTH_ENABLED` flag or Entra configuration
- Change the RBAC role hierarchy or endpoint role decorations
- Change the audit write path or land a decision path without an audit write
- Change the deduplication natural key `(order_number, product_code)`
- Change published event names or payload shapes
- Change retention, backup or restore configuration
- Write a migration that drops or renames a customer data column
- Modify CI/CD pipeline files or deployment configuration
- Modify Dockerfile build stages without proving the image builds
- Commit directly to `main`
- Self-approve pull requests
- Force-push or rewrite history on a shared branch
- Send order or customer data to any third-party service or model
- Introduce AI or ML inference into the classification path
- Widen exposure or add multi-tenancy until BLK-01 closes

#### Required

- Link PRs to Spec ID **AHCTL-02**
- Link PRs to predecessor OCT-001 where the codebase still references it
- Link PRs to relevant ADRs
- Link PRs to Task ID
- Include unit tests
- Include contract tests when API or event surface changed
- Include accessibility checks for UI changes
- Pass PII-in-logs review
- Include audit write for state-changing operator actions
- Use correlation IDs
- Use structured JSON logging
- Keep domain logic in dependency-free `services/*` packages
- Ship a regression test with every defect fix
- State whether container images were built
- Human reviewer approval

### Human Sign-Off Required For

- Authentication and authorisation changes
- Audit path changes
- Event contract changes
- Deduplication key changes
- Retention or PII handling changes
- Database migrations affecting customer data
- CI/CD and deployment configuration changes
- Hosting platform or residency-affecting changes
- Seeded classification rule changes
- Introduction of any AI/ML component

### NFR Targets

| NFR | Target |
|---|---|
| API p95 | 500 ms |
| Availability | 99.5% |
| Coverage floor (new code) | 80% |
| PII in logs tolerance | 0 |
| Audit coverage required | 100% |
| WCAG | 2.2 AA |
| Security baseline | OWASP ASVS L2 |
| Unauthenticated production access | 0 |

---

## 21. Review and Warnings Summary

| Item | Count / Status |
|---|---|
| Certification blockers open | 18 |
| Critical blockers open | 15 |
| Material blockers open | 3 |
| Live production risks | BLK-01 |
| Warnings | 8 |
| Open questions | 11 (of 13 raised; 2 closed by reconciliation) |
| Exception candidates | 4 (none approved) |
| Unresolved conflicts | 2 |
| Readiness for certification | 🔴 NOT_READY |
| Readiness for continued internal use | 🟠 CONDITIONAL_ON_BLK_01 |
| Readiness for wider exposure | 🔴 BLOCKED |
| Reconciliation status | Unilateral, awaiting countersignature |

---

## End of Specification

**This specification is DRAFT — HUMAN REVIEW REQUIRED — NOT CERTIFIED.**

No item in this document authorises implementation of new work, does not authorise release, does not authorise acceptance of any risk, and does not certify the software already delivered under the OCT-001 identifier.

**BLK-01 is a LIVE production issue and requires immediate incident-track attention regardless of specification progress.**
