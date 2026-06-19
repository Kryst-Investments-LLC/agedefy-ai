-- CreateTable: ProtocolOutcome
CREATE TABLE "ProtocolOutcome" (
    "id"                     TEXT NOT NULL,
    "userId"                 TEXT NOT NULL,
    "tenantId"               TEXT NOT NULL DEFAULT 'default',
    "loopCycleId"            TEXT NOT NULL,
    "protocolId"             TEXT,
    "cycleStartDate"         TIMESTAMP(3) NOT NULL,
    "cycleEndDate"           TIMESTAMP(3),
    "targetBiomarkers"       JSONB NOT NULL DEFAULT '[]',
    "observedBiomarkers"     JSONB NOT NULL DEFAULT '[]',
    "twinSimulationId"       TEXT,
    "twinPredictionAccuracy" DOUBLE PRECISION,
    "agentAccuracyScores"    JSONB NOT NULL DEFAULT '[]',
    "overallEfficacy"        DOUBLE PRECISION,
    "reflectedAt"            TIMESTAMP(3),
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtocolOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ReflectionReport
CREATE TABLE "ReflectionReport" (
    "id"                TEXT NOT NULL,
    "userId"            TEXT NOT NULL,
    "tenantId"          TEXT NOT NULL DEFAULT 'default',
    "loopCycleId"       TEXT NOT NULL,
    "protocolOutcomeId" TEXT,
    "insights"          JSONB NOT NULL DEFAULT '[]',
    "agentScoreDeltas"  JSONB NOT NULL DEFAULT '{}',
    "twinAccuracyDelta" DOUBLE PRECISION,
    "priorAdjustments"  JSONB NOT NULL DEFAULT '[]',
    "disclaimer"        TEXT NOT NULL DEFAULT 'Retrospective research analysis — not medical advice.',
    "signedVc"          JSONB,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReflectionReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable: UserTwinPrior
CREATE TABLE "UserTwinPrior" (
    "id"                TEXT NOT NULL,
    "userId"            TEXT NOT NULL,
    "tenantId"          TEXT NOT NULL DEFAULT 'default',
    "compoundId"        TEXT NOT NULL,
    "outcomeKey"        TEXT NOT NULL,
    "prior"             DOUBLE PRECISION NOT NULL,
    "populationDefault" DOUBLE PRECISION NOT NULL,
    "n"                 INTEGER NOT NULL DEFAULT 0,
    "updatedAt"         TIMESTAMP(3) NOT NULL,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTwinPrior_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProtocolOutcome_loopCycleId_key" ON "ProtocolOutcome"("loopCycleId");
CREATE INDEX "ProtocolOutcome_userId_createdAt_idx" ON "ProtocolOutcome"("userId", "createdAt");
CREATE INDEX "ProtocolOutcome_loopCycleId_idx" ON "ProtocolOutcome"("loopCycleId");

CREATE UNIQUE INDEX "ReflectionReport_loopCycleId_key" ON "ReflectionReport"("loopCycleId");
CREATE INDEX "ReflectionReport_userId_createdAt_idx" ON "ReflectionReport"("userId", "createdAt");

CREATE UNIQUE INDEX "UserTwinPrior_userId_compoundId_outcomeKey_key"
    ON "UserTwinPrior"("userId", "compoundId", "outcomeKey");
CREATE INDEX "UserTwinPrior_userId_idx" ON "UserTwinPrior"("userId");

-- AddForeignKey
ALTER TABLE "ProtocolOutcome" ADD CONSTRAINT "ProtocolOutcome_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProtocolOutcome" ADD CONSTRAINT "ProtocolOutcome_protocolId_fkey"
    FOREIGN KEY ("protocolId") REFERENCES "Protocol"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProtocolOutcome" ADD CONSTRAINT "ProtocolOutcome_loopCycleId_fkey"
    FOREIGN KEY ("loopCycleId") REFERENCES "LoopCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReflectionReport" ADD CONSTRAINT "ReflectionReport_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReflectionReport" ADD CONSTRAINT "ReflectionReport_loopCycleId_fkey"
    FOREIGN KEY ("loopCycleId") REFERENCES "LoopCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserTwinPrior" ADD CONSTRAINT "UserTwinPrior_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
