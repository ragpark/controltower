# Order Control Tower — Database ERD

PostgreSQL, managed by Prisma (`apps/api/prisma/schema.prisma`).
Raw SQL migration: `infrastructure/migrations/0001_init.sql`.

```mermaid
erDiagram
    sources ||--o{ import_runs : "has runs"
    sources ||--o{ orders : "provides"
    import_runs ||--o{ orders : "imported in"
    orders ||--o{ order_history : "versions"
    orders ||--o{ rule_executions : "evaluation trace"
    classification_rules ||--o{ rule_executions : "evaluated as"

    sources {
        uuid id PK
        text name UK
        SourceType type "CSV_UPLOAD | CSV_FILE | REST_API | SHAREPOINT | SFTP | AZURE_BLOB | TABLEAU"
        SourceStatus status "ACTIVE | DISABLED | ERROR"
        boolean enabled
        text schedule "cron expression, nullable"
        jsonb config_json "connector config + column mapping"
        timestamptz last_run_at
        timestamptz created_at
        timestamptz updated_at
    }

    import_runs {
        uuid id PK
        uuid source_id FK
        text filename
        int total_rows
        int imported_rows
        int successful_rows
        int failed_rows
        timestamptz start_time
        timestamptz end_time
        ImportRunStatus status "RUNNING | COMPLETED | COMPLETED_WITH_ERRORS | FAILED"
        jsonb log "structured row/step log"
        text triggered_by
    }

    orders {
        uuid id PK
        text source_order_id
        text order_number "UK with product_code"
        text customer_id
        text customer_name
        text product_code "UK with order_number"
        text product_name
        text order_status "raw status from source"
        text order_state "normalised operational state"
        Classification classification "PENDING | PLACED | COMPLETED | CANCELLED | CUSTOMER_IMPACTED | INVESTIGATE_REQUIRED | EXCEPTION"
        text classification_reason
        timestamptz classified_at
        int quantity
        decimal value
        timestamptz order_date
        timestamptz created_at
        timestamptz updated_at
        timestamptz imported_at
        text source_file
        uuid source_id FK
        uuid import_run_id FK
    }

    order_history {
        uuid id PK
        uuid order_id FK
        jsonb snapshot "full order state before change"
        text_arr changed_fields
        uuid import_run_id
        timestamptz created_at
    }

    classification_rules {
        uuid id PK
        text name UK
        text description
        int priority "ascending — lower evaluates first"
        boolean enabled
        text strategy "strategy key: field-match | order-age | always"
        jsonb rule_definition
        Classification outcome
        timestamptz created_at
        timestamptz updated_at
    }

    rule_executions {
        uuid id PK
        uuid order_id FK
        uuid rule_id FK "SET NULL on rule delete"
        text rule_name
        int priority
        boolean matched
        Classification outcome
        jsonb detail "per-condition evaluation detail"
        uuid evaluation_id "groups one evaluation pass"
        timestamptz evaluated_at
    }

    audit_logs {
        uuid id PK
        text entity_type
        text entity_id
        text action
        text changed_by
        jsonb changes
        timestamptz timestamp
    }

    saved_views {
        uuid id PK
        text name
        text queue
        jsonb config "filters + sort + columns"
        text created_by
        timestamptz created_at
        timestamptz updated_at
    }

    daily_aggregates {
        uuid id PK
        date date "UK with classification"
        Classification classification
        int count
    }
```

## Key constraints

| Constraint | Purpose |
|---|---|
| `orders (order_number, product_code)` unique | Deduplication natural key — re-imports update in place |
| `order_history.order_id` FK cascade | History travels with the order |
| `rule_executions.rule_id` FK `SET NULL` | Trace survives rule deletion (name retained) |
| `daily_aggregates (date, classification)` unique | Idempotent aggregate upserts |
| Indexes on `orders.classification`, `orders.order_date`, `orders.customer_name`, `audit_logs (entity_type, entity_id)` | Queue filtering, trends, audit drill-down |
