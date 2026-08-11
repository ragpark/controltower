-- Downstream provisioning failures reported by the daily fulfilment email,
-- joined to orders by order number, with ownership routing for the next step.

-- AlterEnum
ALTER TYPE "SourceType" ADD VALUE 'EMAIL_FAILURE_REPORT';

-- CreateEnum
CREATE TYPE "FailureCategory" AS ENUM ('TEP_ACCOUNT_MISSING', 'INVALID_CUSTOMER_DATA', 'DUPLICATE_ORG_MEMBERSHIP', 'LICENCE_CONFIG_ERROR', 'INTEGRATION_FAULT', 'UNCATEGORISED');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "provisioning_category" "FailureCategory",
                     ADD COLUMN     "provisioning_owner" TEXT,
                     ADD COLUMN     "provisioning_failed_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "provisioning_failures" (
    "id" UUID NOT NULL,
    "order_number" TEXT NOT NULL,
    "contract_number" TEXT NOT NULL DEFAULT '',
    "order_date" TIMESTAMP(3),
    "raw_message" TEXT NOT NULL,
    "category" "FailureCategory" NOT NULL,
    "owner" TEXT NOT NULL,
    "suggested_action" TEXT NOT NULL,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,
    "resolution_note" TEXT,
    "import_run_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provisioning_failures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "provisioning_failures_order_number_contract_number_key" ON "provisioning_failures"("order_number", "contract_number");

-- CreateIndex
CREATE INDEX "provisioning_failures_category_idx" ON "provisioning_failures"("category");

-- CreateIndex
CREATE INDEX "provisioning_failures_owner_idx" ON "provisioning_failures"("owner");

-- CreateIndex
CREATE INDEX "provisioning_failures_resolved_at_idx" ON "provisioning_failures"("resolved_at");

-- CreateIndex
CREATE INDEX "orders_provisioning_category_idx" ON "orders"("provisioning_category");
