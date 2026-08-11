# Sample data

Both files use the **ActiveHub orders export** schema (BigCommerce orders
reconciled against Licence Manager), which is the format the default column
mapping targets:

| Column | Canonical field |
|---|---|
| `order_source` | `orderSource` (sales channel) |
| `order_id` | `orderNumber` ✱ |
| `Custom Status` | `orderState` |
| `order_status` | `orderStatus` |
| `order_created_date_time` | `orderDate` (`dd/mm/yyyy hh:mm`) |
| `full_name` | `customerName` |
| `email` | `customerEmail` |
| `TEPAccountNumber` | `customerId` |
| `productcode` | `productCode` ✱ (ISBN) |
| `productlongname` | `productName` |
| `LicenceManagerOrderMatch` | `licenceOrderMatch` |
| `LicenceManagerISBNMatch` | `licenceIsbnMatch` |

✱ together these form the deduplication key.

## `activehub_orders_sample.csv` — 22 rows

Exercises every classification outcome:

- **Customer Impacted** — order `Complete` but `LicenceManagerOrderMatch = Not Match`
  (paid, no licence provisioned — the highest-priority operational failure)
- **Investigate Required** — order matched but ISBN did not (wrong product licensed),
  plus a stale `Incomplete` order from June
- **Completed** — complete and matched on both order and ISBN
- **Cancelled** — `Cancelled`, `Refunded` and `Declined` statuses
- **Pending** / **Placed** — `Incomplete`, `Awaiting Payment`, `Processing`, `Shipped`
- **Exception** — a row with neither name nor email
- **Deduplication** — order `137` appears twice with *different* ISBNs, so both
  rows are kept (the key is order + product, not order alone)
- **Rejected row** — order `156` carries `9.78141E+12`, see below
- **Filler rows** — trailing all-empty rows, as produced by Excel

## `activehub_orders_update_sample.csv` — 4 rows

Upload this second. It re-imports three existing orders with changed licence
flags (`Not Match` → `Match`), producing history snapshots and reclassification
out of the Customer Impacted queue, and adds one new order.

## Two hazards this data reproduces deliberately

**Excel-mangled ISBNs.** The real export contained `9.78141E+12` — Excel
converted the ISBN to scientific notation and the trailing digits are gone.
Expanding it would yield `9781410000000` and silently collapse *every* ISBN
sharing that prefix onto one product code, corrupting the deduplication key and
merging unrelated orders. These rows are therefore **rejected** with a message
telling the operator to re-export with the column formatted as text. Fix it at
source: in the export, format the ISBN column as Text, or open the CSV via
Data → From Text/CSV and set the column type to Text rather than double-clicking
the file.

**Sheet padding.** Exports arrive with thousands of empty rows (`,,,,,,`). These
are skipped entirely — they are neither counted in the row total nor reported as
failures, so an import of one real row reads as "1 row" rather than "1 of 2,281
with 2,280 errors".
