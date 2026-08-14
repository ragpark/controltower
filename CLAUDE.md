# CLAUDE.md — ActiveHub Control Tower

This repository is governed by a Pearson Spec Driven Development record.
**The specification is the source of truth. Code is downstream of it.**

| | |
|---|---|
| Spec ID | **AHCTL-02** (supersedes OCT-001) |
| Normative record | `docs/sdd/control-tower-spec.yaml` |
| Generated pack | `docs/sdd/control-tower-delivery-pack.md` |
| Status | 🔴 **DRAFT — NOT CERTIFIED** |
| Live production risk | **BLK-01** — authentication disabled in production |

Read `docs/sdd/control-tower-spec.yaml` before starting work. This file is a
summary that binds unconditionally; the YAML is authoritative and wins on any
conflict.

---

## Session protocol

When asked to do work, before writing any code:

1. **Resolve the work to an ID.** Every change traces to a task
   (`ENG-xxx`), a requirement (`FR-xx`) or a blocker (`BLK-xx`) that exists in
   the YAML. If the request has no ID, say so and offer to draft the spec
   delta first — do not start building.
2. **Restate** the acceptance criteria and the guardrails that apply.
3. **Name the sign-off.** If the change touches anything in *Human sign-off
   required* below, say so up front. Do not proceed on assumed approval.
4. Then build.

If a decision belongs to the accountable owner, **stop and ask**. This is the
one case where blocking beats assuming a default.

## The two-PR model

Changes land as two pull requests, in order:

**PR 1 — spec delta.** The new or changed FR / ADR / ENG task, acceptance
criteria in Given/When/Then, traceability links. No code. Merged only when the
accountable owner has ratified the *what*.

**PR 2 — implementation.** The code, the tests, and the record update in the
same PR: contribution log entry, status flips, blocker closures, traceability
links completed.

Claude may **prepare** anything. Claude may **never**: mark a review gate
passed, close a blocker on its own judgement, ratify an ADR, approve a waiver,
or describe the specification as certified. (`ai_may_prepare: true`,
`ai_may_approve: false`.)

---

## Guardrails

These come from `agent_manifest.guardrails` in the YAML. They are not advisory.

### Forbidden without recorded human sign-off

- Store or log raw PII — `customer_name`, `customer_email` must never reach
  logs, metric labels, error payloads, event payloads or client telemetry
- Change the `AUTH_ENABLED` flag or any Entra ID configuration
- Change the RBAC role hierarchy or endpoint `@Roles()` decorations
- Change the audit write path, or land a decision path with no audit write
- Change the deduplication natural key `(order_number, product_code)`
- Change published event names or payload shapes
  (`packages/shared-types/src/events.ts`)
- Change retention, backup or restore configuration
- Write a migration that drops or renames a customer-data column
- Modify CI/CD pipeline files or deployment configuration
- Modify Dockerfile build stages without proving the image builds
- Commit directly to `main`
- Self-approve pull requests
- Force-push or rewrite history on a shared branch
- Send order or customer data to any third-party service or model
- Introduce AI/ML inference into the classification path
- Widen exposure or add multi-tenancy while **BLK-01** is open

### Required of every pull request

- References Spec ID `AHCTL-02` (and `OCT-001` where the codebase still
  references it), the relevant ADR(s), and the Task ID
- Unit tests; contract tests when an API route, DTO or event surface changed;
  accessibility checks for UI changes
- Passes PII-in-logs review
- Audit write for any state-changing operator action
- Correlation IDs and structured JSON logging
- Domain logic kept in the dependency-free `services/*` packages
- A regression test with every defect fix — failing before the fix
- States whether the **container images** were built (CI does not build them —
  BLK-05)
- Approved by a named human reviewer

### Human sign-off required for

Authentication/authorisation · audit path · event contracts · deduplication key
· retention or PII handling · migrations affecting customer data · CI/CD and
deployment config · hosting platform or residency · seeded classification rules
· introducing any AI/ML component.

---

## Build invariants

Each of these encodes a defect that reached production. Do not remove them.

- **BI-01** — `apps/api/tsconfig.build.json` keeps `rootDir: "src"` and excludes
  `prisma`. Without it, adding a file outside `src/` silently moves the emitted
  entrypoint from `dist/main.js` to `dist/src/main.js`; `npm run build` reports
  success and the container crash-loops on `MODULE_NOT_FOUND`.
- **BI-02** — the Dockerfile `test -f` entrypoint guards catch BI-01-class
  failures at image build time.
- **BI-03** — the web Dockerfile must copy and build every workspace package the
  app imports. npm creates a **dangling symlink** for a missing workspace and
  **exits 0**; the failure surfaces later as `MODULE_NOT_FOUND` during
  `next build`.

**CI does not build container images.** Two production incidents reached `main`
through that gap. Any change touching a Dockerfile, a workspace dependency or
the build output layout is not verified by a green CI run.

---

## Working in this codebase

```
apps/web            Next.js 15 App Router · MUI v6 · TanStack Query · Zustand · Recharts
apps/api            NestJS · prefix /api · URI versioning v1 · Swagger at /api/docs
services/*          ingestion · classification · reporting — domain logic, NO framework deps
packages/*          shared-types (enums, DTOs, event names) · ui-components
docs/sdd            The specification record
```

```bash
npm run build            # libs → api → web (order matters)
npm test                 # 204 unit/component tests across workspaces
npm run prisma:migrate   # deploy migrations
npm run dev:api          # and: npm run dev:web
```

**Where logic goes:** domain rules belong in `services/*`, which carry no Nest
and no Prisma dependency and are testable without a database. Nest modules
orchestrate; they do not hold business rules. New classification behaviour goes
behind the `RuleStrategy` registry; new ingestion behind the `SourceConnector`
registry — not by branching the orchestrator.

**House style:** TypeScript strict, no `any` in new code. British English in
user-facing copy. Error messages must be actionable and quote the offending
input rather than blaming the user.

---

## Keeping the record honest

- **The YAML is normative. The Markdown pack is generated** — do not hand-edit
  `control-tower-delivery-pack.md`. *(The generator is not yet built; until it
  is, treat any divergence as a defect in the pack, not in the YAML.)*
- **`review_and_warnings_summary` is derived, not hand-maintained.** Recount
  from the lists rather than copying it. The blocker counts were wrong (18/15/3
  against a list holding 22 open) and were corrected in delta **SD-01**; the
  open-question count of 11 was correct — 13 raised, 2 closed by
  reconciliation. **ENG-902** makes the recount mechanical.
- **Traceability resolves — BLK-18 remediated by ENG-900.** `FR-01…FR-19`,
  `ADR-01…ADR-15`, `TC-01…TC-18`, `UX-J01…J05`, `C-01…C-08`, the API and event
  contracts, the data entities and the personas are all defined in the YAML.
  The record is self-contained: **never defer to the delivery pack for
  detail** — and it is now safe for **ENG-901** to generate the pack from the
  YAML. BLK-18 stays open until the owner confirms; the remediation is
  recorded, not self-certified.
- Add a `contribution_log` entry for every change to the record.

## Open items Claude must not silently decide

- **BLK-01** — authentication is disabled in production, on a public URL, over
  customer names and email addresses. Whether this is handled as an incident or
  as backlog is the owner's call, not Claude's.
- **BLK-A2-02 / BLK-A2-05** — the supersession of OCT-001 is unilateral and
  awaits countersignature from the OCT-001 owner.
- **ADR-12** (Azure vs Railway), **ADR-15** (data residency) — open.
- 13 open questions in the YAML, most waiting on named owners (**BLK-07**).
