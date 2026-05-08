Loaded Prisma config from prisma.config.ts.

-- AlterTable
ALTER TABLE "Biomarker" ADD COLUMN "source" TEXT;

-- CreateTable
CREATE TABLE "Medication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dosage" TEXT,
    "frequency" TEXT,
    "prescribedFor" TEXT,
    "category" TEXT NOT NULL DEFAULT 'supplement',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "discontinuedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Medication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNING',
    "plan" TEXT,
    "scratchpad" TEXT,
    "result" TEXT,
    "reviewItemIds" TEXT,
    "resumedAt" DATETIME,
    "reviewedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    CONSTRAINT "AgentSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgentSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentStepLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "agentClass" TEXT NOT NULL,
    "input" TEXT,
    "output" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "durationMs" INTEGER,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentStepLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AgentSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DriftSweep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "ranAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "biomarkersScanned" INTEGER NOT NULL DEFAULT 0,
    "driftsDetected" INTEGER NOT NULL DEFAULT 0,
    "findings" TEXT NOT NULL DEFAULT '[]',
    "triggerType" TEXT NOT NULL DEFAULT 'scheduled',
    "proactiveSessionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DriftSweep_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DriftNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "sweepId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "biomarkerNames" TEXT NOT NULL DEFAULT '[]',
    "sessionId" TEXT,
    "readAt" DATETIME,
    "dismissedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DriftNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GovernancePolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "autoApprove" BOOLEAN NOT NULL DEFAULT false,
    "minAdherenceRate" REAL NOT NULL DEFAULT 0.8,
    "requireLabReview" BOOLEAN NOT NULL DEFAULT false,
    "maxAutoApprovePerSession" INTEGER NOT NULL DEFAULT 3,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GovernanceAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "compoundName" TEXT NOT NULL,
    "riskCategory" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "policySnapshot" TEXT NOT NULL,
    "adherenceRate" REAL,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ClinicalSignature" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reviewItemId" TEXT NOT NULL,
    "sessionId" TEXT,
    "clinicianId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "rationale" TEXT NOT NULL,
    "compoundName" TEXT,
    "riskCategory" TEXT,
    "signatureHash" TEXT NOT NULL,
    "signedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clinicianName" TEXT NOT NULL,
    "clinicianEmail" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AdminImpersonationSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "stoppedAt" DATETIME
);

-- CreateTable
CREATE TABLE "OmicsAssayBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "kind" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "assayVersion" TEXT NOT NULL,
    "pipelineVersion" TEXT NOT NULL,
    "reagentLot" TEXT,
    "runDate" DATETIME NOT NULL,
    "qcPassed" BOOLEAN NOT NULL DEFAULT false,
    "qcReportUri" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "OmicsSample" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "sampleType" TEXT NOT NULL,
    "collectedAt" DATETIME NOT NULL,
    "receivedAt" DATETIME,
    "externalId" TEXT,
    "qcPassed" BOOLEAN NOT NULL DEFAULT false,
    "qcMetrics" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OmicsSample_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OmicsSample_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "OmicsAssayBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OmicsMeasurement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "sampleId" TEXT NOT NULL,
    "analyteCode" TEXT,
    "geneSymbol" TEXT,
    "cpgSite" TEXT,
    "taxonId" INTEGER,
    "mutationHgvs" TEXT,
    "value" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "unitFreeText" TEXT,
    "limitOfDetection" REAL,
    "limitOfQuant" REAL,
    "isBelowLOD" BOOLEAN NOT NULL DEFAULT false,
    "qcFlag" TEXT,
    "measuredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OmicsMeasurement_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "OmicsSample" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PolygenicScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "trait" TEXT NOT NULL,
    "pgsCatalogId" TEXT,
    "score" REAL NOT NULL,
    "percentile" REAL,
    "ancestry" TEXT,
    "modelVersion" TEXT NOT NULL,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PolygenicScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MendelianRandomizationFinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT,
    "exposure" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "betaIvw" REAL NOT NULL,
    "seIvw" REAL NOT NULL,
    "pIvw" REAL NOT NULL,
    "nSnps" INTEGER NOT NULL,
    "egger" REAL,
    "source" TEXT NOT NULL,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MendelianRandomizationFinding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PhysiologicalTwin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "weightKg" REAL,
    "heightCm" REAL,
    "sexAtBirth" TEXT,
    "age" INTEGER,
    "ancestry" TEXT,
    "egfrMlMin" REAL,
    "childPughClass" TEXT,
    "parameterJson" TEXT NOT NULL,
    "hallmarkJson" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PhysiologicalTwin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TwinSimulationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "twinId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "intervention" TEXT NOT NULL,
    "compoundId" TEXT,
    "doseMg" REAL,
    "scheduleCron" TEXT,
    "horizonDays" INTEGER NOT NULL,
    "endpoint" TEXT NOT NULL,
    "predictedMean" REAL NOT NULL,
    "predictedSdLo" REAL NOT NULL,
    "predictedSdHi" REAL NOT NULL,
    "uncertaintyKind" TEXT NOT NULL,
    "inputsHash" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TwinSimulationRun_twinId_fkey" FOREIGN KEY ("twinId") REFERENCES "PhysiologicalTwin" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NofOneTrial" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "hypothesis" TEXT NOT NULL,
    "design" TEXT NOT NULL,
    "primaryEndpoint" TEXT NOT NULL,
    "secondaryEndpoints" TEXT NOT NULL,
    "preregisteredHash" TEXT NOT NULL,
    "preregisteredJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DESIGN',
    "bayesianStopJson" TEXT NOT NULL,
    "irbApprovalRef" TEXT,
    "startedAt" DATETIME,
    "stoppedAt" DATETIME,
    "stopReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NofOneTrial_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NofOneArm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trialId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "compoundId" TEXT,
    "doseMg" REAL,
    "scheduleCron" TEXT,
    CONSTRAINT "NofOneArm_trialId_fkey" FOREIGN KEY ("trialId") REFERENCES "NofOneTrial" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NofOnePeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trialId" TEXT NOT NULL,
    "armLabel" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "observations" TEXT NOT NULL,
    CONSTRAINT "NofOnePeriod_trialId_fkey" FOREIGN KEY ("trialId") REFERENCES "NofOneTrial" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PharmacogenomicProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "variantsJson" TEXT NOT NULL,
    "panelVendor" TEXT,
    "panelVersion" TEXT,
    "reportedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PharmacogenomicProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DrugDrugInteraction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "drugA" TEXT NOT NULL,
    "drugB" TEXT NOT NULL,
    "mechanism" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "evidenceGrade" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "notes" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "KgNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "kind" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "synonyms" TEXT,
    "attributes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "KgEdge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "fromNodeId" TEXT NOT NULL,
    "toNodeId" TEXT NOT NULL,
    "edgeType" TEXT NOT NULL,
    "evidenceGrade" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "pubmedIds" TEXT,
    "effectSize" REAL,
    "effectSizeUnit" TEXT,
    "confidence" REAL,
    "attributes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KgEdge_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "KgNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KgEdge_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "KgNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TumorProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "primarySite" TEXT NOT NULL,
    "histology" TEXT,
    "stageAjcc" TEXT,
    "diagnosedAt" DATETIME NOT NULL,
    "tmbPerMb" REAL,
    "msiStatus" TEXT,
    "hrdScore" REAL,
    "pdL1Cps" REAL,
    "driverMutations" TEXT NOT NULL,
    "neoantigensJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TumorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CtdnaTimepoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tumorProfileId" TEXT NOT NULL,
    "measuredAt" DATETIME NOT NULL,
    "vafMax" REAL,
    "copiesPerMl" REAL,
    "mrdStatus" TEXT NOT NULL,
    "panelVendor" TEXT,
    "panelVersion" TEXT,
    CONSTRAINT "CtdnaTimepoint_tumorProfileId_fkey" FOREIGN KEY ("tumorProfileId") REFERENCES "TumorProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecistAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tumorProfileId" TEXT NOT NULL,
    "assessedAt" DATETIME NOT NULL,
    "scheme" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "sumLongestDiameterMm" REAL,
    "notes" TEXT,
    CONSTRAINT "RecistAssessment_tumorProfileId_fkey" FOREIGN KEY ("tumorProfileId") REFERENCES "TumorProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TranscriptomicSignature" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "sourceAssay" TEXT NOT NULL,
    "upGenes" TEXT NOT NULL,
    "downGenes" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TranscriptomicSignature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DrugRepurposingScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "signatureId" TEXT NOT NULL,
    "compoundId" TEXT NOT NULL,
    "cmapScore" REAL NOT NULL,
    "source" TEXT NOT NULL,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DrugRepurposingScore_signatureId_fkey" FOREIGN KEY ("signatureId") REFERENCES "TranscriptomicSignature" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentClaim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "sessionId" TEXT NOT NULL,
    "agentClass" TEXT NOT NULL,
    "claimText" TEXT NOT NULL,
    "evidenceKind" TEXT NOT NULL,
    "evidenceRef" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CdiscOdmExport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "trialId" TEXT,
    "studyOid" TEXT NOT NULL,
    "documentXml" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LabResultReconciliation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "externalOrderId" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawPayload" TEXT NOT NULL,
    "parsedJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "matchedSampleId" TEXT,
    "notes" TEXT
);

-- CreateTable
CREATE TABLE "AgentPromptVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentClass" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "promptText" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "signature" TEXT,
    "signedBy" TEXT,
    "signedAt" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AgentSessionReplayManifest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "scratchpadHash" TEXT NOT NULL,
    "modelIds" TEXT NOT NULL,
    "promptHashes" TEXT NOT NULL,
    "inputsHash" TEXT NOT NULL,
    "determinismOk" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "JurisdictionGateDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "sessionId" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "ruleSetVersion" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EvalBenchRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "benchName" TEXT NOT NULL,
    "benchVersion" TEXT NOT NULL,
    "datasetHash" TEXT NOT NULL,
    "metricsJson" TEXT NOT NULL,
    "agentClass" TEXT,
    "modelVersion" TEXT,
    "ranAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Compound" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "aliases" TEXT,
    "category" TEXT NOT NULL,
    "riskCategory" TEXT NOT NULL DEFAULT 'GREEN',
    "description" TEXT,
    "casNumber" TEXT,
    "pubChemCid" TEXT,
    "mechanism" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Compound" ("aliases", "casNumber", "category", "createdAt", "description", "id", "mechanism", "name", "pubChemCid", "updatedAt") SELECT "aliases", "casNumber", "category", "createdAt", "description", "id", "mechanism", "name", "pubChemCid", "updatedAt" FROM "Compound";
DROP TABLE "Compound";
ALTER TABLE "new_Compound" RENAME TO "Compound";
CREATE UNIQUE INDEX "Compound_name_key" ON "Compound"("name");
CREATE UNIQUE INDEX "Compound_casNumber_key" ON "Compound"("casNumber");
CREATE TABLE "new_UserProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "dateOfBirth" DATETIME,
    "biologicalSex" TEXT,
    "longevityGoal" TEXT,
    "riskTolerance" TEXT,
    "dietaryPattern" TEXT,
    "activityLevel" TEXT,
    "sleepQuality" INTEGER,
    "stressLevel" INTEGER,
    "healthConditions" TEXT NOT NULL DEFAULT '[]',
    "supplementStack" TEXT NOT NULL DEFAULT '[]',
    "healthGoals" TEXT NOT NULL DEFAULT '[]',
    "primaryMotivation" TEXT,
    "onboardingCompletedAt" DATETIME,
    "timezone" TEXT,
    "quietHoursStart" INTEGER,
    "quietHoursEnd" INTEGER,
    "driftNotificationsOn" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserProfile" ("activityLevel", "biologicalSex", "createdAt", "dateOfBirth", "dietaryPattern", "healthConditions", "healthGoals", "id", "longevityGoal", "onboardingCompletedAt", "primaryMotivation", "riskTolerance", "sleepQuality", "stressLevel", "supplementStack", "tenantId", "updatedAt", "userId") SELECT "activityLevel", "biologicalSex", "createdAt", "dateOfBirth", "dietaryPattern", "healthConditions", "healthGoals", "id", "longevityGoal", "onboardingCompletedAt", "primaryMotivation", "riskTolerance", "sleepQuality", "stressLevel", "supplementStack", "tenantId", "updatedAt", "userId" FROM "UserProfile";
DROP TABLE "UserProfile";
ALTER TABLE "new_UserProfile" RENAME TO "UserProfile";
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Medication_userId_active_idx" ON "Medication"("userId", "active");

-- CreateIndex
CREATE INDEX "Medication_tenantId_userId_idx" ON "Medication"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "AgentSession_userId_idx" ON "AgentSession"("userId");

-- CreateIndex
CREATE INDEX "AgentSession_tenantId_idx" ON "AgentSession"("tenantId");

-- CreateIndex
CREATE INDEX "AgentSession_status_idx" ON "AgentSession"("status");

-- CreateIndex
CREATE INDEX "AgentStepLog_sessionId_idx" ON "AgentStepLog"("sessionId");

-- CreateIndex
CREATE INDEX "DriftSweep_userId_ranAt_idx" ON "DriftSweep"("userId", "ranAt");

-- CreateIndex
CREATE INDEX "DriftSweep_tenantId_ranAt_idx" ON "DriftSweep"("tenantId", "ranAt");

-- CreateIndex
CREATE INDEX "DriftNotification_userId_readAt_idx" ON "DriftNotification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "DriftNotification_userId_createdAt_idx" ON "DriftNotification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GovernancePolicy_category_key" ON "GovernancePolicy"("category");

-- CreateIndex
CREATE INDEX "GovernanceAuditLog_sessionId_idx" ON "GovernanceAuditLog"("sessionId");

-- CreateIndex
CREATE INDEX "GovernanceAuditLog_userId_createdAt_idx" ON "GovernanceAuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "GovernanceAuditLog_decision_createdAt_idx" ON "GovernanceAuditLog"("decision", "createdAt");

-- CreateIndex
CREATE INDEX "ClinicalSignature_sessionId_idx" ON "ClinicalSignature"("sessionId");

-- CreateIndex
CREATE INDEX "ClinicalSignature_clinicianId_signedAt_idx" ON "ClinicalSignature"("clinicianId", "signedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalSignature_reviewItemId_clinicianId_key" ON "ClinicalSignature"("reviewItemId", "clinicianId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminImpersonationSession_adminUserId_key" ON "AdminImpersonationSession"("adminUserId");

-- CreateIndex
CREATE INDEX "AdminImpersonationSession_targetUserId_idx" ON "AdminImpersonationSession"("targetUserId");

-- CreateIndex
CREATE INDEX "AdminImpersonationSession_expiresAt_idx" ON "AdminImpersonationSession"("expiresAt");

-- CreateIndex
CREATE INDEX "OmicsAssayBatch_tenantId_kind_runDate_idx" ON "OmicsAssayBatch"("tenantId", "kind", "runDate");

-- CreateIndex
CREATE INDEX "OmicsSample_userId_collectedAt_idx" ON "OmicsSample"("userId", "collectedAt");

-- CreateIndex
CREATE INDEX "OmicsSample_tenantId_sampleType_idx" ON "OmicsSample"("tenantId", "sampleType");

-- CreateIndex
CREATE INDEX "OmicsMeasurement_sampleId_idx" ON "OmicsMeasurement"("sampleId");

-- CreateIndex
CREATE INDEX "OmicsMeasurement_tenantId_analyteCode_idx" ON "OmicsMeasurement"("tenantId", "analyteCode");

-- CreateIndex
CREATE INDEX "OmicsMeasurement_tenantId_geneSymbol_idx" ON "OmicsMeasurement"("tenantId", "geneSymbol");

-- CreateIndex
CREATE INDEX "OmicsMeasurement_tenantId_cpgSite_idx" ON "OmicsMeasurement"("tenantId", "cpgSite");

-- CreateIndex
CREATE INDEX "PolygenicScore_userId_trait_idx" ON "PolygenicScore"("userId", "trait");

-- CreateIndex
CREATE INDEX "MendelianRandomizationFinding_exposure_outcome_idx" ON "MendelianRandomizationFinding"("exposure", "outcome");

-- CreateIndex
CREATE INDEX "MendelianRandomizationFinding_userId_idx" ON "MendelianRandomizationFinding"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PhysiologicalTwin_userId_key" ON "PhysiologicalTwin"("userId");

-- CreateIndex
CREATE INDEX "PhysiologicalTwin_tenantId_idx" ON "PhysiologicalTwin"("tenantId");

-- CreateIndex
CREATE INDEX "TwinSimulationRun_userId_endpoint_createdAt_idx" ON "TwinSimulationRun"("userId", "endpoint", "createdAt");

-- CreateIndex
CREATE INDEX "TwinSimulationRun_inputsHash_idx" ON "TwinSimulationRun"("inputsHash");

-- CreateIndex
CREATE INDEX "NofOneTrial_userId_status_idx" ON "NofOneTrial"("userId", "status");

-- CreateIndex
CREATE INDEX "NofOneTrial_tenantId_status_idx" ON "NofOneTrial"("tenantId", "status");

-- CreateIndex
CREATE INDEX "NofOneArm_trialId_idx" ON "NofOneArm"("trialId");

-- CreateIndex
CREATE INDEX "NofOnePeriod_trialId_orderIndex_idx" ON "NofOnePeriod"("trialId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "PharmacogenomicProfile_userId_key" ON "PharmacogenomicProfile"("userId");

-- CreateIndex
CREATE INDEX "PharmacogenomicProfile_tenantId_idx" ON "PharmacogenomicProfile"("tenantId");

-- CreateIndex
CREATE INDEX "DrugDrugInteraction_drugA_idx" ON "DrugDrugInteraction"("drugA");

-- CreateIndex
CREATE INDEX "DrugDrugInteraction_drugB_idx" ON "DrugDrugInteraction"("drugB");

-- CreateIndex
CREATE UNIQUE INDEX "DrugDrugInteraction_drugA_drugB_mechanism_key" ON "DrugDrugInteraction"("drugA", "drugB", "mechanism");

-- CreateIndex
CREATE INDEX "KgNode_tenantId_kind_idx" ON "KgNode"("tenantId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "KgNode_tenantId_kind_externalId_key" ON "KgNode"("tenantId", "kind", "externalId");

-- CreateIndex
CREATE INDEX "KgEdge_fromNodeId_edgeType_idx" ON "KgEdge"("fromNodeId", "edgeType");

-- CreateIndex
CREATE INDEX "KgEdge_toNodeId_edgeType_idx" ON "KgEdge"("toNodeId", "edgeType");

-- CreateIndex
CREATE INDEX "KgEdge_tenantId_edgeType_evidenceGrade_idx" ON "KgEdge"("tenantId", "edgeType", "evidenceGrade");

-- CreateIndex
CREATE INDEX "TumorProfile_userId_diagnosedAt_idx" ON "TumorProfile"("userId", "diagnosedAt");

-- CreateIndex
CREATE INDEX "CtdnaTimepoint_tumorProfileId_measuredAt_idx" ON "CtdnaTimepoint"("tumorProfileId", "measuredAt");

-- CreateIndex
CREATE INDEX "RecistAssessment_tumorProfileId_assessedAt_idx" ON "RecistAssessment"("tumorProfileId", "assessedAt");

-- CreateIndex
CREATE INDEX "TranscriptomicSignature_userId_idx" ON "TranscriptomicSignature"("userId");

-- CreateIndex
CREATE INDEX "DrugRepurposingScore_signatureId_cmapScore_idx" ON "DrugRepurposingScore"("signatureId", "cmapScore");

-- CreateIndex
CREATE INDEX "DrugRepurposingScore_compoundId_idx" ON "DrugRepurposingScore"("compoundId");

-- CreateIndex
CREATE INDEX "AgentClaim_sessionId_idx" ON "AgentClaim"("sessionId");

-- CreateIndex
CREATE INDEX "AgentClaim_tenantId_agentClass_createdAt_idx" ON "AgentClaim"("tenantId", "agentClass", "createdAt");

-- CreateIndex
CREATE INDEX "CdiscOdmExport_tenantId_studyOid_idx" ON "CdiscOdmExport"("tenantId", "studyOid");

-- CreateIndex
CREATE INDEX "LabResultReconciliation_tenantId_status_idx" ON "LabResultReconciliation"("tenantId", "status");

-- CreateIndex
CREATE INDEX "LabResultReconciliation_externalOrderId_idx" ON "LabResultReconciliation"("externalOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentPromptVersion_contentHash_key" ON "AgentPromptVersion"("contentHash");

-- CreateIndex
CREATE INDEX "AgentPromptVersion_agentClass_active_idx" ON "AgentPromptVersion"("agentClass", "active");

-- CreateIndex
CREATE UNIQUE INDEX "AgentSessionReplayManifest_sessionId_key" ON "AgentSessionReplayManifest"("sessionId");

-- CreateIndex
CREATE INDEX "AgentSessionReplayManifest_scratchpadHash_idx" ON "AgentSessionReplayManifest"("scratchpadHash");

-- CreateIndex
CREATE INDEX "JurisdictionGateDecision_sessionId_idx" ON "JurisdictionGateDecision"("sessionId");

-- CreateIndex
CREATE INDEX "JurisdictionGateDecision_tenantId_jurisdiction_decision_idx" ON "JurisdictionGateDecision"("tenantId", "jurisdiction", "decision");

-- CreateIndex
CREATE INDEX "EvalBenchRun_benchName_ranAt_idx" ON "EvalBenchRun"("benchName", "ranAt");

