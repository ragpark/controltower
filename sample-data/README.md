# Sample data

- `orders_sample.csv` — 24 rows covering every classification outcome:
  completed, placed, pending, cancelled, customer-impacted (failed delivery /
  returns / customer hold), a data-quality exception (missing customer), an
  unrecognised status (falls through to *Investigate Required*), stale open
  orders, and an in-file duplicate (`ORD-1002` appears twice with different
  product codes — both kept; duplicates share the *(orderNumber, productCode)*
  key only when both fields match).
- `orders_update_sample.csv` — a follow-up file that updates three existing
  orders (status changes → history snapshots + reclassification) and adds one
  new order. Upload it second to see deduplication and record history working.

Dates use the UK `dd/mm/yyyy` export format on purpose — the parser accepts
both this and ISO 8601.

Upload via **Import History → Upload CSV** (against the seeded
"Manual CSV upload" source) or:

```bash
curl -F sourceId=<source-id> -F file=@sample-data/orders_sample.csv \
  http://localhost:4000/api/v1/imports/upload
```
