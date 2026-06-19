-- AlterEnum: add LOOP queue
ALTER TYPE "OrchestrationJobQueue" ADD VALUE 'LOOP';

-- CreateEnum
CREATE TYPE "LoopCycleStatus" AS ENUM ('OBSERVE', 'PLAN', 'ACT', 'REFLECT', 'COMPLETE', 'FAILED');

-- CreateEnum
CREATE TYPE "LoopTriggerReason" AS ENUM ('BIOMARKER_INGEST', 'LAB_RESULT', 'WEARABLE_SYNC', 'PROTOCOL_CHANGE', 'SCHEDULED', 'MANUAL');

-- CreateTable
CREATE TABLE "PhysiologicalSnapshot" (
    "id"                     TEXT NOT NULL,
    "userId"                 TEXT NOT NULL,
    "tenantId"               TEXT NOT NULL DEFAULT 'default',
    "materializedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "biomarkersJson"         JSONB NOT NULL DEFAULT '{}',
    "riskScoresJson"         JSONB NOT NULL DEFAULT '{}',
    "activeProtocolId"       TEXT,
    "protocolAdherence"      DOUBLE PRECISION,
    "protocolWeeksActive"    DOUBLE PRECISION,
    "dysregulatedPathways"   JSONB NOT NULL DEFAULT '[]',
    "twinLastSimAt"          TIMESTAMP(3),
    "twinPredictionAccuracy" DOUBLE PRECISION,
    "pendingReflections"     JSONB NOT NULL DEFAULT '[]',
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhysiologicalSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoopCycle" (
    "id"             TEXT NOT NULL,
    "userId"         TEXT NOT NULL,
    "tenantId"       TEXT NOT NULL DEFAULT 'default',
    "status"         "LoopCycleStatus" NOT NULL DEFAULT 'OBSERVE',
    "triggeredBy"    "LoopTriggerReason" NOT NULL,
    "snapshotId"     TEXT,
    "agentSessionId" TEXT,
    "startedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt"    TIMESTAMP(3),
    "failedReason"   TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoopCycle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhysiologicalSnapshot_userId_materializedAt_idx" ON "PhysiologicalSnapshot"("userId", "materializedAt");
CREATE INDEX "PhysiologicalSnapshot_tenantId_materializedAt_idx" ON "PhysiologicalSnapshot"("tenantId", "materializedAt");

-- CreateIndex
CREATE INDEX "LoopCycle_userId_status_createdAt_idx" ON "LoopCycle"("userId", "status", "createdAt");
CREATE INDEX "LoopCycle_tenantId_status_createdAt_idx" ON "LoopCycle"("tenantId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "PhysiologicalSnapshot" ADD CONSTRAINT "PhysiologicalSnapshot_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoopCycle" ADD CONSTRAINT "LoopCycle_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoopCycle" ADD CONSTRAINT "LoopCycle_snapshotId_fkey"
    FOREIGN KEY ("snapshotId") REFERENCES "PhysiologicalSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
