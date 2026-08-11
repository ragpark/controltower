# Order Control Tower

A production-ready operational platform that replaces the Tableau/ Excel order dashboard:
configurable data-source ingestion, a database-driven classification rule
engine, operational queues, executive dashboards, and full audit/traceability —
built as a modern SaaS-style web application.

| Layer | Tech |
|---|---|
| Frontend | React 19 · Next.js 15 · TypeScript · Material UI · TanStack Query · Zustand · Recharts |
| Backend | Node.js · NestJS 11 · TypeScript · event-driven orchestration |
| Data | PostgreSQL 16 · Prisma ORM |
| Auth | Microsoft Entra ID (OIDC) with RBAC app roles (`admin` / `operator` / `viewer`) |
| Ops | Docker · Docker Compose · Azure Container Apps / App Service · OpenTelemetry · Prometheus metrics |

📐 [Architecture diagram](docs/architecture.md) · 🗄️ [Database ERD](docs/erd.md) · 🔌 [API contracts](docs/api-contracts.md) · 🚀 [Deployment](infrastructure/deployment/README.md)

## Repository layout

```
apps/
  web/                  Next.js frontend (dashboard, queues, settings)
  api/                  NestJS API (REST v1, orchestration, auth, observability)
services/
  ingestion/            Connector registry + CSV parsing/mapping/validation/dedup
  classification/       Rule engine (strategy pattern, priority evaluation, tracing)
  reporting/            Trend bucketing + operational health calculators
packages/
  shared-types/         Enums, DTOs and event contracts shared end-to-end
  ui-components/        Reusable MUI components (+ component tests)
infrastructure/
  docker-compose/       Local/single-VM stack (db + api + web)
  migrations/           SQL copy of the Prisma migration history
  deployment/           Azure Container Apps Bicep + App Service guide
sample-data/            CSVs exercising every classification outcome
docs/                   Architecture, ERD, API contracts
```

The three `services/*` packages hold the domain logic and are consumed by the
API as libraries (modular monolith). They have no NestJS or Prisma
dependencies, so any of them can be split into a standalone worker later
without rewriting the domain code.

## Quick start (Docker)

```bash
docker compose -f infrastructure/docker-compose/docker-compose.yml up --build
```

- Web: http://localhost:3000 · API: http://localhost:4000 · Swagger: http://localhost:4000/api/docs
- Migrations apply and default rules/sources seed automatically.
- Go to **Import History**, pick the *ActiveHub manual upload* source and upload
  [`sample-data/activehub_orders_sample.csv`](sample-data/activehub_orders_sample.csv),
  then `activehub_orders_update_sample.csv` to see dedup + record history +
  reclassification.

## Quick start (local development)

```bash
npm install
docker compose -f infrastructure/docker-compose/docker-compose.yml up -d db

cp .env.example .env                       # defaults work out of the box
npm run prisma:generate
npm run prisma:migrate                     # apply migrations
npm run prisma:seed                        # default rules + sources

npm run build:libs                         # build shared packages once
npm run dev:api                            # NestJS on :4000
npm run dev:web                            # Next.js on :3000  (second terminal)
```

Auth is **off by default** (`AUTH_ENABLED=false`) — the API injects a local
admin identity so the whole stack runs without an Entra tenant. Flip
`AUTH_ENABLED` / `NEXT_PUBLIC_AUTH_ENABLED` to `true` and fill in the Entra
settings for real environments (see
[deployment guide](infrastructure/deployment/README.md#entra-id-setup)).

## How it works

### Ingestion orchestration (event-driven)

Per import: **detect → fetch → parse/map → validate → dedupe → persist
(+history) → classify → aggregate → publish**. Scheduled sources get a cron
job each (managed from Settings); manual uploads hit the same pipeline.
Events (`OrderImported`, `OrderUpdated`, `OrderClassified`,
`OrderReclassified`, `ImportCompleted`, `ImportFailed`) drive the audit trail
and daily aggregates, and are centrally typed so the in-process bus can be
swapped for Azure Service Bus.

Connectors implement one interface and register in a registry — CSV upload,
CSV file drop, REST API and Azure Blob (SAS) are implemented; SFTP,
SharePoint and Tableau are registered as planned connectors that surface
cleanly in the UI. All source configuration (connector settings, column
mapping, delimiter, schedule) is editable in **Settings → Data Sources**,
including *Test connection*, *Run now* and per-source import history.

### Data model

The canonical order model targets the **ActiveHub orders export** — BigCommerce
orders reconciled against Licence Manager — carrying the sales channel, customer
name/email/TEP account, ISBN, store status, custom status and the two Licence
Manager match flags. Every source maps its own headers onto these canonical
fields in Settings, so the model is not tied to one export format. See
[`sample-data/README.md`](sample-data/README.md) for the full column mapping.

Two real-world export hazards are handled explicitly: sheets padded with
thousands of empty rows are skipped (not counted, not reported as errors), and
ISBNs that Excel mangled into scientific notation (`9.78141E+12`) are **rejected
with actionable guidance** rather than expanded — expanding them would collapse
every ISBN sharing a prefix onto one deduplication key.

### Deduplication & history

Natural key **(orderNumber, productCode)** — a unique constraint enforces it.
Re-imports update the existing order; the previous state is snapshotted into
`order_history` with the changed fields, and changed orders are re-classified.
A licence flag flipping `Not Match` → `Match` therefore moves the order out of
the Customer Impacted queue automatically, with the change recorded in history.

### Rule engine

Rules live in the `classification_rules` table and are evaluated in ascending
priority; the first match wins, with `INVESTIGATE_REQUIRED` as fallback.
Strategies (strategy pattern): `field-match` (AND/OR conditions, 13
operators), `order-age` (stale-order detection), `always` (catch-all). New
strategies are one class + one registry line; new *rules* need no code at all —
they're created in **Settings → Classification Rules**, previewed against a
sample order, and re-applied to existing orders on demand. Every evaluation
is persisted to `rule_executions`, so each order shows the exact rule trace
that produced its classification.

### Security & observability

Helmet, strict CORS, global validation (whitelist + reject unknown),
parameterised queries via Prisma, upload size/type limits, RBAC on every
route, audit log on every mutation. Structured JSON logs, `/healthz` +
`/readyz` + Prometheus `/metrics`, opt-in OpenTelemetry (OTLP), and an
error-tracking seam for Sentry/App Insights.

## Testing

```bash
npm test                                   # unit + component tests (no DB needed)
npm run test:coverage                      # with coverage (80% target on core logic)
DATABASE_URL=… npm run test:e2e -w @control-tower/api   # API integration tests
```

- **Unit**: rule engine, strategies, CSV parsing/mapping, dedup/change
  detection, trend/health calculators, RBAC guard, rules service,
  classification service (~110 tests).
- **Integration/API**: e2e suite boots the app against PostgreSQL and drives
  the real pipeline: create source → upload CSV → orders classified → trace,
  dashboard, validation errors. CI runs it against a Postgres service.
- **Component**: React Testing Library tests for the shared UI components.

## API surface

REST under `/api/v1` with Swagger at `/api/docs` — orders/queues (list,
filter, export, bulk actions, trace/history/related/audit), sources (CRUD,
test, run, runs), imports (upload, run history + logs), rules (CRUD, preview,
reapply), dashboard (summary, breakdowns, trends, health), saved views,
audit. Full table: [docs/api-contracts.md](docs/api-contracts.md).
