# API Contracts (v1)

Base URL: `/api/v1`. All endpoints require `Authorization: Bearer <JWT>` when
`AUTH_ENABLED=true`. Swagger UI is served at `/api/docs` (OpenAPI JSON at
`/api/docs-json`). Roles: `admin` ⊃ `operator` ⊃ `viewer`.

Standard error shape:

```json
{ "statusCode": 400, "message": ["orderNumber must be a string"], "error": "Bad Request" }
```

Paginated list shape:

```json
{ "items": [], "total": 0, "page": 1, "pageSize": 25 }
```

## Orders

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/orders` | viewer | Paged list. Query: `page`, `pageSize`, `search`, `classification`, `sourceId`, `customerName`, `productCode`, `orderState`, `dateFrom`, `dateTo`, `sortBy`, `sortDir` |
| GET | `/orders/export` | viewer | CSV export with the same filters |
| GET | `/orders/:id` | viewer | Order detail: order + source + latest import run |
| GET | `/orders/:id/trace` | viewer | Rule execution trace of latest evaluation (grouped by `evaluationId`) |
| GET | `/orders/:id/history` | viewer | Version history snapshots |
| GET | `/orders/:id/related` | viewer | Other orders sharing `orderNumber` or `customerId` |
| GET | `/orders/:id/audit` | viewer | Audit entries for the order |
| POST | `/orders/bulk` | operator | `{ ids: string[], action: "reclassify"\|"rerun-rules", classification?, reason? }` |

## Sources (Settings)

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/sources` | viewer | List sources with last run summary |
| POST | `/sources` | admin | Create `{ name, type, schedule?, enabled?, configJson }` |
| GET | `/sources/:id` | viewer | Detail |
| PATCH | `/sources/:id` | admin | Update (schedule changes re-register cron) |
| DELETE | `/sources/:id` | admin | Delete (blocked while orders reference it) |
| POST | `/sources/:id/test` | admin | Connector connectivity/config test → `{ ok, message }` |
| POST | `/sources/:id/run` | operator | Trigger an import now → import run |
| GET | `/sources/:id/runs` | viewer | Import history for the source |
| GET | `/sources/types` | viewer | Supported connector types + config schema hints |

## Imports

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/imports/upload` | operator | multipart `file` (+ `sourceId`) — runs the full pipeline |
| GET | `/imports/runs` | viewer | Paged run history. Query: `sourceId`, `status`, `page`, `pageSize` |
| GET | `/imports/runs/:id` | viewer | Run detail incl. structured log |

## Classification Rules

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/rules` | viewer | Rules ordered by priority |
| POST | `/rules` | admin | Create `{ name, priority, strategy, ruleDefinition, outcome, enabled?, description? }` |
| PATCH | `/rules/:id` | admin | Update |
| DELETE | `/rules/:id` | admin | Delete (trace rows keep the rule name) |
| POST | `/rules/preview` | admin | Evaluate a candidate rule against a sample order without persisting |
| POST | `/rules/reapply` | operator | Re-run the engine across all (or filtered) orders |

## Dashboard

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/dashboard/summary` | viewer | Executive summary counts |
| GET | `/dashboard/by-status` | viewer | Orders per classification |
| GET | `/dashboard/by-product` | viewer | Top products (`limit`) |
| GET | `/dashboard/by-source` | viewer | Orders per source |
| GET | `/dashboard/trend?granularity=daily\|weekly\|monthly&days=30` | viewer | Trend buckets per classification |
| GET | `/dashboard/health` | viewer | Success rate, import failures, stale imports, data-quality issues |

## Saved Views / Audit / Ops

| Method | Path | Role | Description |
|---|---|---|---|
| GET/POST | `/views` · DELETE `/views/:id` | viewer | Saved queue views (filters + sort) |
| GET | `/audit` | viewer | Paged audit log (`entityType`, `entityId`, `action`) |
| GET | `/healthz` | public | Liveness |
| GET | `/readyz` | public | Readiness (DB round-trip) |
| GET | `/metrics` | public | Prometheus metrics |
