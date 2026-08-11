-- ActiveHub order model alignment: sales channel, customer email and the
-- Licence Manager reconciliation flags carried by the ActiveHub export.

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "order_source" TEXT,
                     ADD COLUMN     "customer_email" TEXT,
                     ADD COLUMN     "licence_order_match" TEXT,
                     ADD COLUMN     "licence_isbn_match" TEXT;

-- CreateIndex
CREATE INDEX "orders_customer_email_idx" ON "orders"("customer_email");

-- CreateIndex
CREATE INDEX "orders_order_source_idx" ON "orders"("order_source");
