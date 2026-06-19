-- CRO orchestration: partner directory + escrow work orders + status events.

-- CreateEnum
CREATE TYPE "public"."CroWorkOrderStatus" AS ENUM ('DRAFT', 'QUOTED', 'FUNDED', 'IN_PROGRESS', 'DELIVERED', 'RECONCILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."CroPartner" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "capabilities" JSONB NOT NULL,
    "turnaroundDays" INTEGER,
    "pricingJson" JSONB,
    "contactEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CroPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CroWorkOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "candidateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "croPartnerId" TEXT NOT NULL,
    "assayType" TEXT NOT NULL,
    "requestedAssays" JSONB NOT NULL,
    "milestonePlan" JSONB NOT NULL,
    "quoteCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "escrowTransactionId" TEXT,
    "submissionId" TEXT,
    "fepGateScoreAtOrder" DOUBLE PRECISION,
    "status" "public"."CroWorkOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CroWorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CroWorkOrderEvent" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "fromStatus" "public"."CroWorkOrderStatus",
    "toStatus" "public"."CroWorkOrderStatus" NOT NULL,
    "actorUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CroWorkOrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CroPartner_tenantId_status_idx" ON "public"."CroPartner"("tenantId", "status");

-- CreateIndex
CREATE INDEX "CroWorkOrder_tenantId_status_idx" ON "public"."CroWorkOrder"("tenantId", "status");

-- CreateIndex
CREATE INDEX "CroWorkOrder_candidateId_idx" ON "public"."CroWorkOrder"("candidateId");

-- CreateIndex
CREATE INDEX "CroWorkOrder_croPartnerId_status_idx" ON "public"."CroWorkOrder"("croPartnerId", "status");

-- CreateIndex
CREATE INDEX "CroWorkOrder_userId_status_idx" ON "public"."CroWorkOrder"("userId", "status");

-- CreateIndex
CREATE INDEX "CroWorkOrderEvent_workOrderId_createdAt_idx" ON "public"."CroWorkOrderEvent"("workOrderId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."CroWorkOrder" ADD CONSTRAINT "CroWorkOrder_croPartnerId_fkey" FOREIGN KEY ("croPartnerId") REFERENCES "public"."CroPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CroWorkOrderEvent" ADD CONSTRAINT "CroWorkOrderEvent_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "public"."CroWorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
