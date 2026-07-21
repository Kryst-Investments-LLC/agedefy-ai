-- CreateTable
CREATE TABLE "public"."PrivacyBudgetEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "epsilon" DOUBLE PRECISION NOT NULL,
    "spentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivacyBudgetEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrivacyBudgetEntry_tenantId_scope_spentAt_idx" ON "public"."PrivacyBudgetEntry"("tenantId", "scope", "spentAt");
