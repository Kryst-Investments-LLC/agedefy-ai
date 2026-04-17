-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" DATETIME,
    "passwordHash" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "discoveryTier" TEXT DEFAULT 'explorer',
    "defaultTenantId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_defaultTenantId_fkey" FOREIGN KEY ("defaultTenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserMfaSecret" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "backupCodes" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserMfaSecret_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActiveSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    CONSTRAINT "ActiveSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isolationMode" TEXT NOT NULL DEFAULT 'shared',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'enterprise',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Organization_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrganizationMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "status" TEXT NOT NULL DEFAULT 'active',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrganizationMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserProfile" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserConsentGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "legalBasis" TEXT,
    "scopes" JSONB NOT NULL,
    "gdprConsents" JSONB,
    "consentVersion" INTEGER NOT NULL DEFAULT 1,
    "effectiveAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "revokedAt" DATETIME,
    "revocationReason" TEXT,
    "policyVersion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserConsentGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INACTIVE',
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "billingCycle" TEXT NOT NULL,
    "regionTier" TEXT,
    "seatQuantity" INTEGER NOT NULL DEFAULT 1,
    "stripeCheckoutSessionId" TEXT,
    "stripeSubscriptionId" TEXT,
    "currentPeriodEnd" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BillingRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "regionTier" TEXT,
    "pricingModel" TEXT,
    "aiCreditPackKey" TEXT,
    "aiCreditSource" TEXT,
    "aiCreditsDelta" INTEGER NOT NULL DEFAULT 0,
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "consultationRequestId" TEXT,
    "labOrderId" TEXT,
    "paidAt" DATETIME,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BillingRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BillingRecord_consultationRequestId_fkey" FOREIGN KEY ("consultationRequestId") REFERENCES "ConsultationRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BillingRecord_labOrderId_fkey" FOREIGN KEY ("labOrderId") REFERENCES "LabOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Biomarker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "target" REAL,
    "trend" TEXT NOT NULL DEFAULT 'STABLE',
    "measuredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "protocolId" TEXT,
    CONSTRAINT "Biomarker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Biomarker_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "Protocol" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Protocol" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "contraindicationScore" REAL,
    CONSTRAINT "Protocol_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorUserId" TEXT,
    "actorEmail" TEXT,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT,
    "prevHash" TEXT,
    "entryHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "actorUserId" TEXT,
    "requestFingerprint" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "responseStatus" INTEGER,
    "responseBody" JSONB,
    "errorMessage" TEXT,
    "completedAt" DATETIME,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DependencyCircuitBreaker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dependency" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'CLOSED',
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "lastFailureAt" DATETIME,
    "lastSuccessAt" DATETIME,
    "openedAt" DATETIME,
    "nextAttemptAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ReviewItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "details" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReviewItem_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResearchCollection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ResearchCollection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResearchEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "collectionId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "authors" TEXT,
    "abstract" TEXT,
    "url" TEXT,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResearchEntry_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "ResearchCollection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvidenceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "assignedReviewerId" TEXT,
    "researchEntryId" TEXT,
    "title" TEXT NOT NULL,
    "diseaseArea" TEXT,
    "sourceLabel" TEXT NOT NULL,
    "externalId" TEXT,
    "sourceUrl" TEXT,
    "abstract" TEXT,
    "populationSummary" TEXT,
    "interventionSummary" TEXT,
    "outcomeSummary" TEXT,
    "biomarkerTargets" TEXT,
    "contraindications" TEXT,
    "studyType" TEXT NOT NULL,
    "evidenceDirection" TEXT NOT NULL DEFAULT 'SUPPORTIVE',
    "reviewStatus" TEXT NOT NULL DEFAULT 'AUTO_QUEUED',
    "provenanceType" TEXT NOT NULL DEFAULT 'MANUAL',
    "provenanceDetail" TEXT,
    "automationSource" TEXT,
    "evidenceScore" REAL NOT NULL DEFAULT 0,
    "uncertaintyScore" REAL NOT NULL DEFAULT 0.5,
    "reviewConfidence" REAL NOT NULL DEFAULT 0.5,
    "sourceCapturedAt" DATETIME,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "verificationNotes" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EvidenceRecord_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EvidenceRecord_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EvidenceRecord_assignedReviewerId_fkey" FOREIGN KEY ("assignedReviewerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EvidenceRecord_researchEntryId_fkey" FOREIGN KEY ("researchEntryId") REFERENCES "ResearchEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Hypothesis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "targetCondition" TEXT,
    "rationale" TEXT NOT NULL,
    "proposedMechanism" TEXT,
    "suggestedTests" TEXT,
    "suggestedInterventions" TEXT,
    "cohortDefinition" TEXT,
    "priorityScore" REAL NOT NULL DEFAULT 0.25,
    "averageEvidenceScore" REAL NOT NULL DEFAULT 0.25,
    "evidenceCoverageScore" REAL NOT NULL DEFAULT 0,
    "contraindicationScore" REAL NOT NULL DEFAULT 0.25,
    "confidenceScore" REAL NOT NULL DEFAULT 0.5,
    "uncertaintyScore" REAL NOT NULL DEFAULT 0.5,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Hypothesis_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvidenceReviewEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "evidenceRecordId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "previousStatus" TEXT,
    "nextStatus" TEXT,
    "previousAssignedReviewerId" TEXT,
    "nextAssignedReviewerId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvidenceReviewEvent_evidenceRecordId_fkey" FOREIGN KEY ("evidenceRecordId") REFERENCES "EvidenceRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EvidenceReviewEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HypothesisPriorityChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hypothesisId" TEXT NOT NULL,
    "evidenceReviewEventId" TEXT NOT NULL,
    "evidenceRecordId" TEXT NOT NULL,
    "previousPriorityScore" REAL NOT NULL,
    "newPriorityScore" REAL NOT NULL,
    "previousConfidenceScore" REAL NOT NULL,
    "newConfidenceScore" REAL NOT NULL,
    "previousStatus" TEXT NOT NULL,
    "newStatus" TEXT NOT NULL,
    "delta" REAL NOT NULL,
    "rationale" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HypothesisPriorityChange_hypothesisId_fkey" FOREIGN KEY ("hypothesisId") REFERENCES "Hypothesis" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HypothesisPriorityChange_evidenceReviewEventId_fkey" FOREIGN KEY ("evidenceReviewEventId") REFERENCES "EvidenceReviewEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HypothesisPriorityChange_evidenceRecordId_fkey" FOREIGN KEY ("evidenceRecordId") REFERENCES "EvidenceRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HypothesisEvidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hypothesisId" TEXT NOT NULL,
    "evidenceRecordId" TEXT NOT NULL,
    "weight" REAL NOT NULL DEFAULT 1,
    "rationale" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HypothesisEvidence_hypothesisId_fkey" FOREIGN KEY ("hypothesisId") REFERENCES "Hypothesis" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HypothesisEvidence_evidenceRecordId_fkey" FOREIGN KEY ("evidenceRecordId") REFERENCES "EvidenceRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PatientCohort" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "ownerUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "focusArea" TEXT NOT NULL,
    "inclusionCriteria" TEXT NOT NULL,
    "exclusionCriteria" TEXT,
    "biomarkerFocus" TEXT,
    "cohortSize" INTEGER NOT NULL DEFAULT 0,
    "stratificationAxes" TEXT,
    "stratificationSummary" TEXT,
    "estimatedEligibleShare" REAL NOT NULL DEFAULT 0,
    "confidenceScore" REAL NOT NULL DEFAULT 0.5,
    "readinessScore" REAL NOT NULL DEFAULT 0,
    "riskBand" TEXT NOT NULL DEFAULT 'MODERATE',
    "outcomeSummary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PatientCohort_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AIResearchRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "workflowType" TEXT NOT NULL,
    "inputSummary" TEXT NOT NULL,
    "outputSummary" TEXT NOT NULL,
    "citations" TEXT,
    "uncertaintyScore" REAL NOT NULL DEFAULT 0.5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIResearchRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClinicianTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "dueAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClinicianTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PartnerDataRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "partnerId" TEXT,
    "label" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartnerDataRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Compound" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "aliases" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "casNumber" TEXT,
    "pubChemCid" TEXT,
    "mechanism" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Pathway" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CompoundPathway" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "compoundId" TEXT NOT NULL,
    "pathwayId" TEXT NOT NULL,
    "effect" TEXT NOT NULL,
    "strength" TEXT,
    "evidence" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompoundPathway_compoundId_fkey" FOREIGN KEY ("compoundId") REFERENCES "Compound" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompoundPathway_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "Pathway" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompoundInteraction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "compoundAId" TEXT NOT NULL,
    "compoundBId" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "description" TEXT,
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompoundInteraction_compoundAId_fkey" FOREIGN KEY ("compoundAId") REFERENCES "Compound" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompoundInteraction_compoundBId_fkey" FOREIGN KEY ("compoundBId") REFERENCES "Compound" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompoundBiomarkerEffect" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "compoundId" TEXT NOT NULL,
    "biomarkerName" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "magnitude" TEXT,
    "evidence" TEXT,
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompoundBiomarkerEffect_compoundId_fkey" FOREIGN KEY ("compoundId") REFERENCES "Compound" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompoundStudyLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "compoundId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT,
    "url" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompoundStudyLink_compoundId_fkey" FOREIGN KEY ("compoundId") REFERENCES "Compound" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MechanisticModel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL,
    "source" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MechanisticModel_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ModelConfidenceScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mechanisticModelId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "rationale" TEXT,
    "version" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModelConfidenceScore_mechanisticModelId_fkey" FOREIGN KEY ("mechanisticModelId") REFERENCES "MechanisticModel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommunityPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "authorId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CommunityPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LearnArticle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "authorId" TEXT NOT NULL,
    "topic" TEXT NOT NULL DEFAULT 'OVERVIEW',
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewedBy" TEXT,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LearnArticle_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LabTestPanel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "biomarkers" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "turnaroundDays" INTEGER NOT NULL DEFAULT 5,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LabOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "panelId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "orderedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LabOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LabOrder_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "LabTestPanel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LabResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "biomarkerName" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "refLow" REAL,
    "refHigh" REAL,
    "flag" TEXT,
    "protocolId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LabResult_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "LabOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LabResult_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "Protocol" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TelehealthProvider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "bio" TEXT,
    "licenseStates" TEXT,
    "acceptingNew" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ConsultationRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "providerId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'INITIAL',
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "scheduledAt" DATETIME,
    "completedAt" DATETIME,
    "summary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConsultationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConsultationRequest_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "TelehealthProvider" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdverseEventReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "protocolId" TEXT,
    "severity" TEXT NOT NULL,
    "seriousness" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "suspectedCause" TEXT,
    "symptoms" JSONB NOT NULL,
    "detectedBy" TEXT NOT NULL,
    "onsetAt" DATETIME,
    "resolvedAt" DATETIME,
    "outcome" TEXT,
    "escalationRequired" BOOLEAN NOT NULL DEFAULT false,
    "regulatorReportable" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdverseEventReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AdverseEventReport_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "Protocol" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AeonForgeCandidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "rawResponse" JSONB NOT NULL,
    "candidates" JSONB NOT NULL,
    "simulationScore" REAL,
    "healthspanDelta" INTEGER,
    "safetyScore" REAL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AeonForgeCandidate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SimulationResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "aeonForgeCandidateId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "confidence" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SimulationResult_aeonForgeCandidateId_fkey" FOREIGN KEY ("aeonForgeCandidateId") REFERENCES "AeonForgeCandidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VirtualTwinRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "aeonForgeCandidateId" TEXT NOT NULL,
    "twinProfile" JSONB NOT NULL,
    "predictedOutcomes" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VirtualTwinRun_aeonForgeCandidateId_fkey" FOREIGN KEY ("aeonForgeCandidateId") REFERENCES "AeonForgeCandidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CanonicalHealthEventRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "recordedAt" DATETIME NOT NULL,
    "emittedAt" DATETIME NOT NULL,
    "storedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "partitionKey" TEXT NOT NULL,
    "sequence" INTEGER,
    "idempotencyKey" TEXT,
    "envelope" JSONB NOT NULL,
    "event" JSONB NOT NULL
);

-- CreateTable
CREATE TABLE "CanonicalHealthEventOutboxRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventRecordId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "partitionKey" TEXT NOT NULL,
    "message" JSONB NOT NULL,
    "headers" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "availableAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OrchestrationJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT,
    "queue" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "dedupeKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "lastError" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "availableAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leasedAt" DATETIME,
    "leaseExpiresAt" DATETIME,
    "completedAt" DATETIME,
    "canceledAt" DATETIME,
    "retainedUntil" DATETIME,
    "createdByUserId" TEXT,
    "parentJobId" TEXT,
    "correlationId" TEXT,
    "requestId" TEXT,
    "traceContext" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrchestrationJob_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OrchestrationJob_parentJobId_fkey" FOREIGN KEY ("parentJobId") REFERENCES "OrchestrationJob" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'SUPPLEMENT',
    "description" TEXT,
    "ingredients" TEXT,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "imageUrl" TEXT,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "thirdPartyTested" BOOLEAN NOT NULL DEFAULT false,
    "coaUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MarketplaceOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "shippingAddress" TEXT,
    "trackingNumber" TEXT,
    "orderedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shippedAt" DATETIME,
    "deliveredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MarketplaceOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketplaceOrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "priceCents" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketplaceOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MarketplaceOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketplaceOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InterventionOutcome" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "protocolId" TEXT,
    "biomarkerName" TEXT NOT NULL,
    "baselineValue" REAL NOT NULL,
    "latestValue" REAL NOT NULL,
    "delta" REAL NOT NULL,
    "confidenceScore" REAL NOT NULL DEFAULT 0.5,
    "observedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InterventionOutcome_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InterventionOutcome_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "Protocol" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrialMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "cohortId" TEXT,
    "trialExternalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "condition" TEXT,
    "matchScore" REAL NOT NULL,
    "rationale" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CANDIDATE',
    "reviewerId" TEXT,
    "reviewNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrialMatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrialMatch_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "PatientCohort" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TrialMatch_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrialMatchReviewEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trialMatchId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "previousStatus" TEXT,
    "nextStatus" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrialMatchReviewEvent_trialMatchId_fkey" FOREIGN KEY ("trialMatchId") REFERENCES "TrialMatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrialMatchReviewEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketplaceScientist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "institution" TEXT,
    "specialty" TEXT,
    "biography" TEXT,
    "categories" JSONB NOT NULL,
    "fundingStage" TEXT NOT NULL DEFAULT 'pre-seed',
    "reputationScore" REAL NOT NULL DEFAULT 0.45,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "publishedDiscoveryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MarketplaceScientist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketplaceSponsor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "organizationName" TEXT NOT NULL,
    "organizationType" TEXT NOT NULL DEFAULT 'venture',
    "thesis" TEXT NOT NULL,
    "preferredCategories" JSONB NOT NULL,
    "preferredStages" JSONB NOT NULL,
    "maxBudgetCents" INTEGER NOT NULL DEFAULT 250000,
    "minImpactScore" REAL NOT NULL DEFAULT 0.5,
    "capitalAvailableCents" INTEGER NOT NULL DEFAULT 1000000,
    "dueDiligenceLevel" TEXT NOT NULL DEFAULT 'standard',
    "geographyFocus" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MarketplaceSponsor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketplaceSponsor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketplaceDiscovery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "scientistId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "developmentStage" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scientificImpactScore" REAL NOT NULL DEFAULT 0.5,
    "commercialReadiness" REAL NOT NULL DEFAULT 0.4,
    "fundingGoalCents" INTEGER NOT NULL DEFAULT 50000,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "evidenceSummary" TEXT,
    "evidenceLinks" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MarketplaceDiscovery_scientistId_fkey" FOREIGN KEY ("scientistId") REFERENCES "MarketplaceScientist" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketplaceFundingRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "discoveryId" TEXT NOT NULL,
    "scientistId" TEXT NOT NULL,
    "requestedAmountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "useOfFunds" TEXT NOT NULL,
    "timelineMonths" INTEGER NOT NULL DEFAULT 12,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "milestonePlan" JSONB NOT NULL,
    "evidenceUploads" JSONB NOT NULL,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MarketplaceFundingRequest_discoveryId_fkey" FOREIGN KEY ("discoveryId") REFERENCES "MarketplaceDiscovery" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketplaceFundingRequest_scientistId_fkey" FOREIGN KEY ("scientistId") REFERENCES "MarketplaceScientist" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketplaceMatchScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "discoveryId" TEXT NOT NULL,
    "scientistId" TEXT NOT NULL,
    "sponsorId" TEXT NOT NULL,
    "overallScore" REAL NOT NULL,
    "ruleBasedScore" REAL NOT NULL,
    "aiAugmentedScore" REAL,
    "weightedBreakdown" JSONB NOT NULL,
    "sponsorPreferenceFit" REAL NOT NULL DEFAULT 0,
    "metadataFit" REAL NOT NULL DEFAULT 0,
    "rationale" TEXT NOT NULL,
    "rank" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MarketplaceMatchScore_discoveryId_fkey" FOREIGN KEY ("discoveryId") REFERENCES "MarketplaceDiscovery" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketplaceMatchScore_scientistId_fkey" FOREIGN KEY ("scientistId") REFERENCES "MarketplaceScientist" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketplaceMatchScore_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "MarketplaceSponsor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketplaceDealRoom" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "discoveryId" TEXT NOT NULL,
    "scientistId" TEXT NOT NULL,
    "sponsorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "ndaRequired" BOOLEAN NOT NULL DEFAULT true,
    "ndaAcceptedAt" DATETIME,
    "agreementStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "agreementTerms" JSONB NOT NULL,
    "documentVault" JSONB NOT NULL,
    "lastActivityAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MarketplaceDealRoom_discoveryId_fkey" FOREIGN KEY ("discoveryId") REFERENCES "MarketplaceDiscovery" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketplaceDealRoom_scientistId_fkey" FOREIGN KEY ("scientistId") REFERENCES "MarketplaceScientist" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketplaceDealRoom_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "MarketplaceSponsor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketplaceMessageThread" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "dealRoomId" TEXT NOT NULL,
    "senderUserId" TEXT,
    "senderRole" TEXT NOT NULL,
    "messageType" TEXT NOT NULL DEFAULT 'MESSAGE',
    "body" TEXT NOT NULL,
    "attachments" JSONB NOT NULL,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketplaceMessageThread_dealRoomId_fkey" FOREIGN KEY ("dealRoomId") REFERENCES "MarketplaceDealRoom" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketplaceMessageThread_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketplaceTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "dealRoomId" TEXT NOT NULL,
    "discoveryId" TEXT NOT NULL,
    "sponsorId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "platformFeeCents" INTEGER NOT NULL DEFAULT 0,
    "transactionFeeCents" INTEGER NOT NULL DEFAULT 0,
    "payoutCents" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "providerReference" TEXT,
    "metadata" JSONB NOT NULL,
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MarketplaceTransaction_dealRoomId_fkey" FOREIGN KEY ("dealRoomId") REFERENCES "MarketplaceDealRoom" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketplaceTransaction_discoveryId_fkey" FOREIGN KEY ("discoveryId") REFERENCES "MarketplaceDiscovery" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketplaceTransaction_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "MarketplaceSponsor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketplaceAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "dealRoomId" TEXT,
    "actorUserId" TEXT,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "ipAddress" TEXT,
    "details" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketplaceAuditLog_dealRoomId_fkey" FOREIGN KEY ("dealRoomId") REFERENCES "MarketplaceDealRoom" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MarketplaceAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketplaceNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "recipientUserId" TEXT NOT NULL,
    "recipientRole" TEXT NOT NULL,
    "discoveryId" TEXT,
    "dealRoomId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "actionUrl" TEXT,
    "channels" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" DATETIME,
    CONSTRAINT "MarketplaceNotification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketplaceNotification_discoveryId_fkey" FOREIGN KEY ("discoveryId") REFERENCES "MarketplaceDiscovery" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MarketplaceNotification_dealRoomId_fkey" FOREIGN KEY ("dealRoomId") REFERENCES "MarketplaceDealRoom" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrustScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "overallScore" REAL NOT NULL DEFAULT 0.5,
    "evidenceScore" REAL NOT NULL DEFAULT 0.5,
    "reviewScore" REAL NOT NULL DEFAULT 0.5,
    "consistencyScore" REAL NOT NULL DEFAULT 0.5,
    "reputationScore" REAL NOT NULL DEFAULT 0.5,
    "engagementScore" REAL NOT NULL DEFAULT 0.5,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrustScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimelineEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "occurredAt" DATETIME NOT NULL,
    "provenanceType" TEXT,
    "provenanceDetail" TEXT,
    "reviewStatus" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimelineEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeedbackLoopSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "loopStrength" REAL NOT NULL DEFAULT 0,
    "discoveryScore" REAL NOT NULL DEFAULT 0,
    "evaluationScore" REAL NOT NULL DEFAULT 0,
    "procurementScore" REAL NOT NULL DEFAULT 0,
    "clinicalReviewScore" REAL NOT NULL DEFAULT 0,
    "interventionScore" REAL NOT NULL DEFAULT 0,
    "outcomeScore" REAL NOT NULL DEFAULT 0,
    "fundingScore" REAL NOT NULL DEFAULT 0,
    "snapshotAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedbackLoopSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BiologicalAgeSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "chronologicalAge" REAL NOT NULL,
    "biologicalAge" REAL NOT NULL,
    "hallmarkScores" TEXT NOT NULL DEFAULT '{}',
    "inputSummary" TEXT,
    "confidence" REAL NOT NULL DEFAULT 0.5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BiologicalAgeSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserXP" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "totalXP" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserXP_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserStreak" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "currentCount" INTEGER NOT NULL DEFAULT 0,
    "longestCount" INTEGER NOT NULL DEFAULT 0,
    "lastActionAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserStreak_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'trophy',
    "category" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL DEFAULT 1,
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WearableConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalUserId" TEXT,
    "scopes" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'active',
    "connectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WearableConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PendingGraphContribution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "contributorId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "reviewedAt" DATETIME,
    "reviewNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PendingGraphContribution_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "APIKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" TEXT NOT NULL DEFAULT 'discover,simulate,virtual-twin',
    "rateLimitPerMin" INTEGER NOT NULL DEFAULT 60,
    "sandbox" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" DATETIME,
    "revokedAt" DATETIME,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "APIKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "APIUsageRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "keyId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'POST',
    "statusCode" INTEGER NOT NULL,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "computeMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "APIUsageRecord_keyId_fkey" FOREIGN KEY ("keyId") REFERENCES "APIKey" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "referrerId" TEXT NOT NULL,
    "refereeId" TEXT,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rewardGranted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" DATETIME,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Referral_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AggregateOutcome" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "protocolId" TEXT,
    "compoundId" TEXT,
    "cohortBucket" TEXT NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "meanOutcomeScore" REAL NOT NULL,
    "stdDev" REAL NOT NULL DEFAULT 0,
    "pValue" REAL,
    "confidence" REAL NOT NULL DEFAULT 0.5,
    "period" TEXT NOT NULL,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AggregateOutcome_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "Protocol" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AggregateOutcome_compoundId_fkey" FOREIGN KEY ("compoundId") REFERENCES "Compound" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FederatedModel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "version" INTEGER NOT NULL,
    "architecture" TEXT NOT NULL,
    "taskType" TEXT NOT NULL DEFAULT 'bio-age-delta',
    "aggregatedFromN" INTEGER NOT NULL DEFAULT 0,
    "roundsCompleted" INTEGER NOT NULL DEFAULT 0,
    "epsilon" REAL,
    "accuracy" REAL,
    "loss" REAL,
    "metricsJson" TEXT NOT NULL DEFAULT '{}',
    "weightsUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'training',
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FLParticipation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "localSampleSize" INTEGER NOT NULL DEFAULT 0,
    "localLoss" REAL,
    "epsilonSpent" REAL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FLParticipation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FLParticipation_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "FederatedModel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "UserMfaSecret_userId_key" ON "UserMfaSecret"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ActiveSession_tokenHash_key" ON "ActiveSession"("tokenHash");

-- CreateIndex
CREATE INDEX "ActiveSession_userId_revokedAt_idx" ON "ActiveSession"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_status_isolationMode_idx" ON "Tenant"("status", "isolationMode");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_tenantId_status_idx" ON "Organization"("tenantId", "status");

-- CreateIndex
CREATE INDEX "OrganizationMembership_tenantId_userId_role_idx" ON "OrganizationMembership"("tenantId", "userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMembership_organizationId_userId_key" ON "OrganizationMembership"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserConsentGrant_userId_key" ON "UserConsentGrant"("userId");

-- CreateIndex
CREATE INDEX "UserConsentGrant_status_updatedAt_idx" ON "UserConsentGrant"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeCheckoutSessionId_key" ON "Subscription"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_regionTier_createdAt_idx" ON "Subscription"("regionTier", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingRecord_stripeCheckoutSessionId_key" ON "BillingRecord"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingRecord_stripePaymentIntentId_key" ON "BillingRecord"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingRecord_consultationRequestId_key" ON "BillingRecord"("consultationRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingRecord_labOrderId_key" ON "BillingRecord"("labOrderId");

-- CreateIndex
CREATE INDEX "BillingRecord_tenantId_category_status_idx" ON "BillingRecord"("tenantId", "category", "status");

-- CreateIndex
CREATE INDEX "BillingRecord_userId_createdAt_idx" ON "BillingRecord"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "BillingRecord_userId_aiCreditSource_status_createdAt_idx" ON "BillingRecord"("userId", "aiCreditSource", "status", "createdAt");

-- CreateIndex
CREATE INDEX "BillingRecord_regionTier_createdAt_idx" ON "BillingRecord"("regionTier", "createdAt");

-- CreateIndex
CREATE INDEX "Biomarker_userId_measuredAt_idx" ON "Biomarker"("userId", "measuredAt");

-- CreateIndex
CREATE INDEX "Biomarker_tenantId_userId_idx" ON "Biomarker"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "Protocol_userId_updatedAt_idx" ON "Protocol"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Protocol_tenantId_userId_idx" ON "Protocol"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_tenantId_status_expiresAt_idx" ON "IdempotencyRecord"("tenantId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_actorUserId_createdAt_idx" ON "IdempotencyRecord"("actorUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_tenantId_route_method_key_key" ON "IdempotencyRecord"("tenantId", "route", "method", "key");

-- CreateIndex
CREATE UNIQUE INDEX "DependencyCircuitBreaker_dependency_key" ON "DependencyCircuitBreaker"("dependency");

-- CreateIndex
CREATE INDEX "DependencyCircuitBreaker_state_nextAttemptAt_idx" ON "DependencyCircuitBreaker"("state", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "ReviewItem_status_severity_idx" ON "ReviewItem"("status", "severity");

-- CreateIndex
CREATE INDEX "ResearchCollection_userId_idx" ON "ResearchCollection"("userId");

-- CreateIndex
CREATE INDEX "ResearchEntry_collectionId_idx" ON "ResearchEntry"("collectionId");

-- CreateIndex
CREATE INDEX "ResearchEntry_source_externalId_idx" ON "ResearchEntry"("source", "externalId");

-- CreateIndex
CREATE INDEX "EvidenceRecord_diseaseArea_studyType_idx" ON "EvidenceRecord"("diseaseArea", "studyType");

-- CreateIndex
CREATE INDEX "EvidenceRecord_reviewed_evidenceScore_idx" ON "EvidenceRecord"("reviewed", "evidenceScore");

-- CreateIndex
CREATE INDEX "EvidenceRecord_reviewStatus_provenanceType_idx" ON "EvidenceRecord"("reviewStatus", "provenanceType");

-- CreateIndex
CREATE INDEX "EvidenceRecord_assignedReviewerId_reviewStatus_idx" ON "EvidenceRecord"("assignedReviewerId", "reviewStatus");

-- CreateIndex
CREATE INDEX "Hypothesis_ownerUserId_status_idx" ON "Hypothesis"("ownerUserId", "status");

-- CreateIndex
CREATE INDEX "EvidenceReviewEvent_evidenceRecordId_createdAt_idx" ON "EvidenceReviewEvent"("evidenceRecordId", "createdAt");

-- CreateIndex
CREATE INDEX "EvidenceReviewEvent_actorUserId_eventType_idx" ON "EvidenceReviewEvent"("actorUserId", "eventType");

-- CreateIndex
CREATE INDEX "HypothesisPriorityChange_hypothesisId_createdAt_idx" ON "HypothesisPriorityChange"("hypothesisId", "createdAt");

-- CreateIndex
CREATE INDEX "HypothesisPriorityChange_evidenceRecordId_createdAt_idx" ON "HypothesisPriorityChange"("evidenceRecordId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HypothesisEvidence_hypothesisId_evidenceRecordId_key" ON "HypothesisEvidence"("hypothesisId", "evidenceRecordId");

-- CreateIndex
CREATE INDEX "PatientCohort_ownerUserId_focusArea_idx" ON "PatientCohort"("ownerUserId", "focusArea");

-- CreateIndex
CREATE INDEX "AIResearchRun_userId_workflowType_idx" ON "AIResearchRun"("userId", "workflowType");

-- CreateIndex
CREATE INDEX "ClinicianTask_userId_status_idx" ON "ClinicianTask"("userId", "status");

-- CreateIndex
CREATE INDEX "PartnerDataRecord_userId_source_idx" ON "PartnerDataRecord"("userId", "source");

-- CreateIndex
CREATE UNIQUE INDEX "Compound_name_key" ON "Compound"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Compound_casNumber_key" ON "Compound"("casNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Pathway_name_key" ON "Pathway"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CompoundPathway_compoundId_pathwayId_key" ON "CompoundPathway"("compoundId", "pathwayId");

-- CreateIndex
CREATE UNIQUE INDEX "CompoundInteraction_compoundAId_compoundBId_key" ON "CompoundInteraction"("compoundAId", "compoundBId");

-- CreateIndex
CREATE INDEX "CompoundBiomarkerEffect_compoundId_idx" ON "CompoundBiomarkerEffect"("compoundId");

-- CreateIndex
CREATE INDEX "CompoundBiomarkerEffect_biomarkerName_idx" ON "CompoundBiomarkerEffect"("biomarkerName");

-- CreateIndex
CREATE UNIQUE INDEX "CompoundStudyLink_compoundId_source_externalId_key" ON "CompoundStudyLink"("compoundId", "source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "MechanisticModel_name_version_key" ON "MechanisticModel"("name", "version");

-- CreateIndex
CREATE INDEX "ModelConfidenceScore_entityType_entityId_idx" ON "ModelConfidenceScore"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ModelConfidenceScore_mechanisticModelId_version_idx" ON "ModelConfidenceScore"("mechanisticModelId", "version");

-- CreateIndex
CREATE INDEX "CommunityPost_category_createdAt_idx" ON "CommunityPost"("category", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityPost_authorId_idx" ON "CommunityPost"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "LearnArticle_slug_key" ON "LearnArticle"("slug");

-- CreateIndex
CREATE INDEX "LearnArticle_topic_publishedAt_idx" ON "LearnArticle"("topic", "publishedAt");

-- CreateIndex
CREATE INDEX "LearnArticle_slug_idx" ON "LearnArticle"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "LabTestPanel_name_key" ON "LabTestPanel"("name");

-- CreateIndex
CREATE INDEX "LabOrder_userId_status_idx" ON "LabOrder"("userId", "status");

-- CreateIndex
CREATE INDEX "LabResult_orderId_idx" ON "LabResult"("orderId");

-- CreateIndex
CREATE INDEX "LabResult_protocolId_idx" ON "LabResult"("protocolId");

-- CreateIndex
CREATE INDEX "ConsultationRequest_userId_status_idx" ON "ConsultationRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "ConsultationRequest_providerId_idx" ON "ConsultationRequest"("providerId");

-- CreateIndex
CREATE INDEX "AdverseEventReport_userId_createdAt_idx" ON "AdverseEventReport"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AdverseEventReport_protocolId_createdAt_idx" ON "AdverseEventReport"("protocolId", "createdAt");

-- CreateIndex
CREATE INDEX "AeonForgeCandidate_userId_status_idx" ON "AeonForgeCandidate"("userId", "status");

-- CreateIndex
CREATE INDEX "AeonForgeCandidate_createdAt_idx" ON "AeonForgeCandidate"("createdAt");

-- CreateIndex
CREATE INDEX "SimulationResult_aeonForgeCandidateId_type_idx" ON "SimulationResult"("aeonForgeCandidateId", "type");

-- CreateIndex
CREATE INDEX "VirtualTwinRun_aeonForgeCandidateId_idx" ON "VirtualTwinRun"("aeonForgeCandidateId");

-- CreateIndex
CREATE INDEX "CanonicalHealthEventRecord_tenantId_subjectId_occurredAt_idx" ON "CanonicalHealthEventRecord"("tenantId", "subjectId", "occurredAt");

-- CreateIndex
CREATE INDEX "CanonicalHealthEventRecord_tenantId_aggregateId_occurredAt_idx" ON "CanonicalHealthEventRecord"("tenantId", "aggregateId", "occurredAt");

-- CreateIndex
CREATE INDEX "CanonicalHealthEventRecord_tenantId_type_occurredAt_idx" ON "CanonicalHealthEventRecord"("tenantId", "type", "occurredAt");

-- CreateIndex
CREATE INDEX "CanonicalHealthEventRecord_tenantId_topic_occurredAt_idx" ON "CanonicalHealthEventRecord"("tenantId", "topic", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalHealthEventRecord_tenantId_eventId_key" ON "CanonicalHealthEventRecord"("tenantId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalHealthEventRecord_tenantId_idempotencyKey_key" ON "CanonicalHealthEventRecord"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalHealthEventOutboxRecord_eventRecordId_key" ON "CanonicalHealthEventOutboxRecord"("eventRecordId");

-- CreateIndex
CREATE INDEX "CanonicalHealthEventOutboxRecord_tenantId_status_availableAt_idx" ON "CanonicalHealthEventOutboxRecord"("tenantId", "status", "availableAt");

-- CreateIndex
CREATE INDEX "CanonicalHealthEventOutboxRecord_topic_status_availableAt_idx" ON "CanonicalHealthEventOutboxRecord"("topic", "status", "availableAt");

-- CreateIndex
CREATE INDEX "OrchestrationJob_tenantId_queue_status_availableAt_priority_idx" ON "OrchestrationJob"("tenantId", "queue", "status", "availableAt", "priority");

-- CreateIndex
CREATE INDEX "OrchestrationJob_tenantId_jobType_status_availableAt_idx" ON "OrchestrationJob"("tenantId", "jobType", "status", "availableAt");

-- CreateIndex
CREATE INDEX "OrchestrationJob_tenantId_retainedUntil_idx" ON "OrchestrationJob"("tenantId", "retainedUntil");

-- CreateIndex
CREATE INDEX "OrchestrationJob_parentJobId_idx" ON "OrchestrationJob"("parentJobId");

-- CreateIndex
CREATE UNIQUE INDEX "OrchestrationJob_tenantId_dedupeKey_key" ON "OrchestrationJob"("tenantId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "Product_name_key" ON "Product"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "MarketplaceOrder_userId_status_idx" ON "MarketplaceOrder"("userId", "status");

-- CreateIndex
CREATE INDEX "MarketplaceOrderItem_orderId_idx" ON "MarketplaceOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "InterventionOutcome_userId_biomarkerName_idx" ON "InterventionOutcome"("userId", "biomarkerName");

-- CreateIndex
CREATE INDEX "InterventionOutcome_protocolId_idx" ON "InterventionOutcome"("protocolId");

-- CreateIndex
CREATE INDEX "TrialMatch_userId_status_idx" ON "TrialMatch"("userId", "status");

-- CreateIndex
CREATE INDEX "TrialMatch_trialExternalId_idx" ON "TrialMatch"("trialExternalId");

-- CreateIndex
CREATE INDEX "TrialMatch_reviewerId_status_idx" ON "TrialMatch"("reviewerId", "status");

-- CreateIndex
CREATE INDEX "TrialMatchReviewEvent_trialMatchId_createdAt_idx" ON "TrialMatchReviewEvent"("trialMatchId", "createdAt");

-- CreateIndex
CREATE INDEX "TrialMatchReviewEvent_actorUserId_eventType_idx" ON "TrialMatchReviewEvent"("actorUserId", "eventType");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceScientist_userId_key" ON "MarketplaceScientist"("userId");

-- CreateIndex
CREATE INDEX "MarketplaceScientist_fundingStage_reputationScore_idx" ON "MarketplaceScientist"("fundingStage", "reputationScore");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceSponsor_userId_key" ON "MarketplaceSponsor"("userId");

-- CreateIndex
CREATE INDEX "MarketplaceSponsor_organizationId_idx" ON "MarketplaceSponsor"("organizationId");

-- CreateIndex
CREATE INDEX "MarketplaceSponsor_maxBudgetCents_minImpactScore_idx" ON "MarketplaceSponsor"("maxBudgetCents", "minImpactScore");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceDiscovery_slug_key" ON "MarketplaceDiscovery"("slug");

-- CreateIndex
CREATE INDEX "MarketplaceDiscovery_category_status_idx" ON "MarketplaceDiscovery"("category", "status");

-- CreateIndex
CREATE INDEX "MarketplaceDiscovery_scientistId_createdAt_idx" ON "MarketplaceDiscovery"("scientistId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceFundingRequest_discoveryId_key" ON "MarketplaceFundingRequest"("discoveryId");

-- CreateIndex
CREATE INDEX "MarketplaceFundingRequest_scientistId_status_idx" ON "MarketplaceFundingRequest"("scientistId", "status");

-- CreateIndex
CREATE INDEX "MarketplaceMatchScore_sponsorId_overallScore_idx" ON "MarketplaceMatchScore"("sponsorId", "overallScore");

-- CreateIndex
CREATE INDEX "MarketplaceMatchScore_scientistId_overallScore_idx" ON "MarketplaceMatchScore"("scientistId", "overallScore");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceMatchScore_discoveryId_sponsorId_key" ON "MarketplaceMatchScore"("discoveryId", "sponsorId");

-- CreateIndex
CREATE INDEX "MarketplaceDealRoom_scientistId_status_idx" ON "MarketplaceDealRoom"("scientistId", "status");

-- CreateIndex
CREATE INDEX "MarketplaceDealRoom_sponsorId_status_idx" ON "MarketplaceDealRoom"("sponsorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceDealRoom_discoveryId_sponsorId_key" ON "MarketplaceDealRoom"("discoveryId", "sponsorId");

-- CreateIndex
CREATE INDEX "MarketplaceMessageThread_dealRoomId_createdAt_idx" ON "MarketplaceMessageThread"("dealRoomId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceTransaction_dealRoomId_status_idx" ON "MarketplaceTransaction"("dealRoomId", "status");

-- CreateIndex
CREATE INDEX "MarketplaceTransaction_sponsorId_createdAt_idx" ON "MarketplaceTransaction"("sponsorId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceAuditLog_dealRoomId_createdAt_idx" ON "MarketplaceAuditLog"("dealRoomId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceAuditLog_entityType_entityId_idx" ON "MarketplaceAuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "MarketplaceNotification_recipientUserId_status_idx" ON "MarketplaceNotification"("recipientUserId", "status");

-- CreateIndex
CREATE INDEX "MarketplaceNotification_dealRoomId_createdAt_idx" ON "MarketplaceNotification"("dealRoomId", "createdAt");

-- CreateIndex
CREATE INDEX "TrustScore_userId_role_idx" ON "TrustScore"("userId", "role");

-- CreateIndex
CREATE INDEX "TrustScore_tenantId_role_overallScore_idx" ON "TrustScore"("tenantId", "role", "overallScore");

-- CreateIndex
CREATE INDEX "TimelineEntry_userId_domain_occurredAt_idx" ON "TimelineEntry"("userId", "domain", "occurredAt");

-- CreateIndex
CREATE INDEX "TimelineEntry_tenantId_userId_occurredAt_idx" ON "TimelineEntry"("tenantId", "userId", "occurredAt");

-- CreateIndex
CREATE INDEX "TimelineEntry_entityType_entityId_idx" ON "TimelineEntry"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "FeedbackLoopSnapshot_userId_snapshotAt_idx" ON "FeedbackLoopSnapshot"("userId", "snapshotAt");

-- CreateIndex
CREATE INDEX "FeedbackLoopSnapshot_tenantId_snapshotAt_idx" ON "FeedbackLoopSnapshot"("tenantId", "snapshotAt");

-- CreateIndex
CREATE INDEX "BiologicalAgeSnapshot_userId_createdAt_idx" ON "BiologicalAgeSnapshot"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "BiologicalAgeSnapshot_tenantId_userId_createdAt_idx" ON "BiologicalAgeSnapshot"("tenantId", "userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserXP_userId_key" ON "UserXP"("userId");

-- CreateIndex
CREATE INDEX "UserStreak_userId_type_idx" ON "UserStreak"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "UserStreak_userId_type_key" ON "UserStreak"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_code_key" ON "Achievement"("code");

-- CreateIndex
CREATE INDEX "UserAchievement_userId_unlockedAt_idx" ON "UserAchievement"("userId", "unlockedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_key" ON "UserAchievement"("userId", "achievementId");

-- CreateIndex
CREATE INDEX "WearableConnection_userId_status_idx" ON "WearableConnection"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WearableConnection_userId_provider_key" ON "WearableConnection"("userId", "provider");

-- CreateIndex
CREATE INDEX "PendingGraphContribution_status_createdAt_idx" ON "PendingGraphContribution"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PendingGraphContribution_contributorId_status_idx" ON "PendingGraphContribution"("contributorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "APIKey_keyHash_key" ON "APIKey"("keyHash");

-- CreateIndex
CREATE INDEX "APIKey_prefix_idx" ON "APIKey"("prefix");

-- CreateIndex
CREATE INDEX "APIKey_userId_revokedAt_idx" ON "APIKey"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "APIUsageRecord_keyId_createdAt_idx" ON "APIUsageRecord"("keyId", "createdAt");

-- CreateIndex
CREATE INDEX "APIUsageRecord_createdAt_idx" ON "APIUsageRecord"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_code_key" ON "Referral"("code");

-- CreateIndex
CREATE INDEX "Referral_referrerId_status_idx" ON "Referral"("referrerId", "status");

-- CreateIndex
CREATE INDEX "Referral_code_idx" ON "Referral"("code");

-- CreateIndex
CREATE INDEX "AggregateOutcome_protocolId_period_idx" ON "AggregateOutcome"("protocolId", "period");

-- CreateIndex
CREATE INDEX "AggregateOutcome_compoundId_period_idx" ON "AggregateOutcome"("compoundId", "period");

-- CreateIndex
CREATE INDEX "AggregateOutcome_cohortBucket_computedAt_idx" ON "AggregateOutcome"("cohortBucket", "computedAt");

-- CreateIndex
CREATE INDEX "FederatedModel_status_taskType_idx" ON "FederatedModel"("status", "taskType");

-- CreateIndex
CREATE INDEX "FederatedModel_taskType_version_idx" ON "FederatedModel"("taskType", "version");

-- CreateIndex
CREATE UNIQUE INDEX "FederatedModel_version_taskType_key" ON "FederatedModel"("version", "taskType");

-- CreateIndex
CREATE INDEX "FLParticipation_modelId_round_idx" ON "FLParticipation"("modelId", "round");

-- CreateIndex
CREATE INDEX "FLParticipation_userId_createdAt_idx" ON "FLParticipation"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FLParticipation_userId_modelId_round_key" ON "FLParticipation"("userId", "modelId", "round");

