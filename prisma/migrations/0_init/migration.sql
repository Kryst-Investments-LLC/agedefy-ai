-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('MEMBER', 'ADMIN', 'CLINICIAN', 'RESEARCHER');

-- CreateEnum
CREATE TYPE "public"."OrganizationMembershipRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "public"."ReviewStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "public"."ReviewSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "public"."SubscriptionStatus" AS ENUM ('INACTIVE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "public"."BillingRecordCategory" AS ENUM ('AI_CREDIT_PACK', 'AI_CREDIT_USAGE', 'TELEMEDICINE_CONSULTATION', 'LAB_ORDER');

-- CreateEnum
CREATE TYPE "public"."BillingRecordStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'VOIDED');

-- CreateEnum
CREATE TYPE "public"."AICreditSource" AS ENUM ('SUBSCRIPTION_ALLOWANCE', 'PURCHASED_TOP_UP', 'ENTERPRISE_POOL');

-- CreateEnum
CREATE TYPE "public"."BiomarkerTrend" AS ENUM ('UP', 'DOWN', 'STABLE');

-- CreateEnum
CREATE TYPE "public"."IdempotencyExecutionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."DependencyCircuitBreakerState" AS ENUM ('CLOSED', 'OPEN', 'HALF_OPEN');

-- CreateEnum
CREATE TYPE "public"."OrchestrationJobQueue" AS ENUM ('AI', 'INGESTION', 'NOTIFICATION', 'GOVERNANCE', 'LOOP');

-- CreateEnum
CREATE TYPE "public"."OrchestrationJobStatus" AS ENUM ('QUEUED', 'LEASED', 'SUCCEEDED', 'FAILED', 'DEAD_LETTER', 'CANCELED');

-- CreateEnum
CREATE TYPE "public"."ResearchSource" AS ENUM ('PUBMED', 'MANUAL', 'IMPORT');

-- CreateEnum
CREATE TYPE "public"."EvidenceStudyType" AS ENUM ('IN_VITRO', 'ANIMAL', 'OBSERVATIONAL', 'CASE_SERIES', 'RCT', 'META_ANALYSIS', 'SYSTEMATIC_REVIEW', 'MECHANISTIC', 'EXPERT_OPINION');

-- CreateEnum
CREATE TYPE "public"."EvidenceDirection" AS ENUM ('SUPPORTIVE', 'MIXED', 'NEUTRAL', 'CONTRADICTORY');

-- CreateEnum
CREATE TYPE "public"."EvidenceReviewStatus" AS ENUM ('AUTO_QUEUED', 'IN_REVIEW', 'VERIFIED', 'REJECTED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "public"."EvidenceProvenanceType" AS ENUM ('MANUAL', 'PUBMED_IMPORT', 'CLINICAL_TRIAL_IMPORT', 'USER_CURATED', 'AI_EXTRACTED');

-- CreateEnum
CREATE TYPE "public"."EvidenceReviewEventType" AS ENUM ('ASSIGNED', 'STATUS_UPDATED', 'NOTES_UPDATED');

-- CreateEnum
CREATE TYPE "public"."HypothesisStatus" AS ENUM ('DRAFT', 'PRIORITIZED', 'IN_REVIEW', 'VALIDATED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."TrialMatchStatus" AS ENUM ('CANDIDATE', 'REVIEWED', 'CONTACTED', 'ENROLLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."AIWorkflowType" AS ENUM ('LITERATURE_REVIEW', 'HYPOTHESIS_GENERATION', 'SAFETY_REVIEW', 'COHORT_ANALYSIS', 'TRIAL_MATCHING');

-- CreateEnum
CREATE TYPE "public"."ClinicianTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "public"."PartnerDataSource" AS ENUM ('LAB', 'WEARABLE', 'GENOMICS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "public"."CohortRiskBand" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'COMPLEX');

-- CreateEnum
CREATE TYPE "public"."InteractionSeverity" AS ENUM ('BENEFICIAL', 'NEUTRAL', 'CAUTION', 'DANGEROUS', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "public"."PostCategory" AS ENUM ('COMPOUNDS', 'BIOMARKERS', 'PROTOCOLS', 'RESEARCH', 'GENERAL');

-- CreateEnum
CREATE TYPE "public"."ArticleTopic" AS ENUM ('PATHWAYS', 'COMPOUNDS', 'BIOMARKERS', 'PROTOCOLS', 'NUTRITION', 'EXERCISE', 'SLEEP', 'OVERVIEW');

-- CreateEnum
CREATE TYPE "public"."LabTestStatus" AS ENUM ('AVAILABLE', 'DISCONTINUED');

-- CreateEnum
CREATE TYPE "public"."LabOrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COLLECTED', 'PROCESSING', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "public"."ConsultationStatus" AS ENUM ('REQUESTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "public"."ConsultationType" AS ENUM ('INITIAL', 'FOLLOW_UP', 'LAB_REVIEW', 'PROTOCOL_REVIEW');

-- CreateEnum
CREATE TYPE "public"."ProductCategory" AS ENUM ('SUPPLEMENT', 'PEPTIDE', 'TEST_KIT', 'DEVICE', 'BUNDLE');

-- CreateEnum
CREATE TYPE "public"."MarketplaceOrderStatus" AS ENUM ('PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "public"."MarketplaceDiscoveryStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'PRIVATE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."MarketplaceFundingRequestStatus" AS ENUM ('DRAFT', 'OPEN', 'DUE_DILIGENCE', 'COMMITTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."MarketplaceDealRoomStatus" AS ENUM ('OPEN', 'NEGOTIATING', 'AGREEMENT_PENDING', 'FUNDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."MarketplaceAgreementStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'SIGNED');

-- CreateEnum
CREATE TYPE "public"."MarketplaceMessageType" AS ENUM ('MESSAGE', 'DOCUMENT', 'AGREEMENT', 'PAYMENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "public"."MarketplaceTransactionStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'SETTLED', 'RELEASED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "public"."MarketplaceNotificationStatus" AS ENUM ('QUEUED', 'DELIVERED', 'READ', 'DISMISSED');

-- CreateEnum
CREATE TYPE "public"."TrustRole" AS ENUM ('SCIENTIST', 'SPONSOR', 'REVIEWER', 'CLINICIAN');

-- CreateEnum
CREATE TYPE "public"."AgentSessionStatusEnum" AS ENUM ('PLANNING', 'RUNNING', 'PAUSED', 'AWAITING_REVIEW', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."AgentClassEnum" AS ENUM ('PERCEPTION', 'DISCOVERY', 'PROTOCOL', 'SAFETY', 'EXPLAINABILITY');

-- CreateEnum
CREATE TYPE "public"."DriftSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "public"."RiskCategory" AS ENUM ('GREEN', 'YELLOW', 'RED');

-- CreateEnum
CREATE TYPE "public"."OmicsAssayKind" AS ENUM ('METHYLATION_EPIC', 'PROTEOMICS_SOMASCAN', 'PROTEOMICS_OLINK', 'METABOLOMICS_NIGHTINGALE', 'METABOLOMICS_METABOLON', 'TRANSCRIPTOMICS_BULK', 'TRANSCRIPTOMICS_SINGLECELL', 'IMMUNE_REPERTOIRE_TCR', 'IMMUNE_REPERTOIRE_BCR', 'MICROBIOME_16S', 'MICROBIOME_SHOTGUN', 'CTDNA_LIQUID_BIOPSY', 'GENOME_WGS', 'GENOME_WES', 'PHARMACOGENOMICS_PANEL');

-- CreateEnum
CREATE TYPE "public"."OmicsUnitVocab" AS ENUM ('NG_PER_ML', 'PG_PER_ML', 'UG_PER_ML', 'MMOL_PER_L', 'UMOL_PER_L', 'NMOL_PER_L', 'COUNT_PER_UL', 'PCT', 'RATIO', 'Z_SCORE', 'BETA_VALUE', 'M_VALUE', 'TPM', 'CPM', 'RPM', 'COPIES_PER_ML', 'MAF', 'MTB_PER_MB', 'ARBITRARY');

-- CreateEnum
CREATE TYPE "public"."NofOneDesign" AS ENUM ('AB_CROSSOVER', 'ABA_CROSSOVER', 'ABAB_CROSSOVER', 'N_OF_1_RCT_BLINDED', 'WASHOUT_RECHALLENGE');

-- CreateEnum
CREATE TYPE "public"."NofOneStatus" AS ENUM ('DESIGN', 'ACTIVE', 'PAUSED', 'STOPPED_FOR_BENEFIT', 'STOPPED_FOR_FUTILITY', 'STOPPED_FOR_HARM', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."PgxMetabolizerPhenotype" AS ENUM ('POOR', 'INTERMEDIATE', 'NORMAL', 'RAPID', 'ULTRARAPID', 'INDETERMINATE');

-- CreateEnum
CREATE TYPE "public"."KgEdgeType" AS ENUM ('INHIBITS', 'ACTIVATES', 'UPREGULATES', 'DOWNREGULATES', 'BINDS', 'SYNTHETIC_LETHAL_WITH', 'CAUSES_RESISTANCE_TO', 'CO_EXPRESSED_WITH', 'GENE_DISEASE_ASSOCIATION', 'DRUG_TARGET', 'DRUG_INDICATION', 'DRUG_CONTRAINDICATION', 'PATHWAY_MEMBER', 'POPULATION_ASSOCIATION');

-- CreateEnum
CREATE TYPE "public"."KgEvidenceGrade" AS ENUM ('A_HIGH', 'B_MODERATE', 'C_LOW', 'D_VERY_LOW');

-- CreateEnum
CREATE TYPE "public"."AgentClaimEvidenceKind" AS ENUM ('MECHANISTIC_SIMULATION', 'KG_EDGE', 'COHORT_STATISTIC', 'N_OF_1_RESULT', 'REGULATORY_LABEL');

-- CreateEnum
CREATE TYPE "public"."LabResultRecStatus" AS ENUM ('RECEIVED', 'PARSED', 'RECONCILED', 'FLAGGED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."ExperimentCandidateStatus" AS ENUM ('PROPOSED', 'SCREENED', 'SENT_TO_LAB', 'RESULT_LOGGED', 'FED_BACK');

-- CreateEnum
CREATE TYPE "public"."ExperimentCandidateKind" AS ENUM ('CHEMBL', 'AI');

-- CreateEnum
CREATE TYPE "public"."LabSubmissionStatus" AS ENUM ('PENDING', 'PARTIAL', 'COMPLETE', 'VOID');

-- CreateEnum
CREATE TYPE "public"."CroWorkOrderStatus" AS ENUM ('DRAFT', 'QUOTED', 'FUNDED', 'IN_PROGRESS', 'DELIVERED', 'RECONCILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."LoopCycleStatus" AS ENUM ('OBSERVE', 'PLAN', 'ACT', 'REFLECT', 'COMPLETE', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."LoopTriggerReason" AS ENUM ('BIOMARKER_INGEST', 'LAB_RESULT', 'WEARABLE_SYNC', 'PROTOCOL_CHANGE', 'SCHEDULED', 'MANUAL');

-- CreateEnum
CREATE TYPE "public"."ProtocolVersionStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'APPLIED');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "passwordHash" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "role" "public"."UserRole" NOT NULL DEFAULT 'MEMBER',
    "discoveryTier" TEXT DEFAULT 'explorer',
    "defaultTenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserMfaSecret" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "backupCodes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserMfaSecret_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ActiveSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ActiveSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isolationMode" TEXT NOT NULL DEFAULT 'shared',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Organization" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'enterprise',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrganizationMembership" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "public"."OrganizationMembershipRole" NOT NULL DEFAULT 'MEMBER',
    "status" TEXT NOT NULL DEFAULT 'active',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "biologicalSex" TEXT,
    "longevityGoal" TEXT,
    "riskTolerance" TEXT,
    "dietaryPattern" TEXT,
    "activityLevel" TEXT,
    "sleepQuality" INTEGER,
    "stressLevel" INTEGER,
    "healthConditions" JSONB NOT NULL DEFAULT '[]',
    "supplementStack" JSONB NOT NULL DEFAULT '[]',
    "healthGoals" JSONB NOT NULL DEFAULT '[]',
    "primaryMotivation" TEXT,
    "onboardingCompletedAt" TIMESTAMP(3),
    "timezone" TEXT,
    "quietHoursStart" INTEGER,
    "quietHoursEnd" INTEGER,
    "driftNotificationsOn" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserConsentGrant" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "legalBasis" TEXT,
    "scopes" JSONB NOT NULL,
    "gdprConsents" JSONB,
    "consentVersion" INTEGER NOT NULL DEFAULT 1,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revocationReason" TEXT,
    "policyVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserConsentGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Subscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "status" "public"."SubscriptionStatus" NOT NULL DEFAULT 'INACTIVE',
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "billingCycle" TEXT NOT NULL,
    "regionTier" TEXT,
    "seatQuantity" INTEGER NOT NULL DEFAULT 1,
    "monthlyAICreditAllowance" INTEGER,
    "stripeCheckoutSessionId" TEXT,
    "stripeSubscriptionId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BillingRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "category" "public"."BillingRecordCategory" NOT NULL,
    "status" "public"."BillingRecordStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "regionTier" TEXT,
    "pricingModel" TEXT,
    "aiCreditPackKey" TEXT,
    "aiCreditSource" "public"."AICreditSource",
    "aiCreditsDelta" INTEGER NOT NULL DEFAULT 0,
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "consultationRequestId" TEXT,
    "labOrderId" TEXT,
    "paidAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Biomarker" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "target" DOUBLE PRECISION,
    "trend" "public"."BiomarkerTrend" NOT NULL DEFAULT 'STABLE',
    "source" TEXT,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "protocolId" TEXT,

    CONSTRAINT "Biomarker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Protocol" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "description" TEXT,
    "protocolCycleLengthDays" INTEGER NOT NULL DEFAULT 28,
    "protocolCycleStartDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "contraindicationScore" DOUBLE PRECISION,
    "forkCount" INTEGER NOT NULL DEFAULT 0,
    "forkedFromId" TEXT,

    CONSTRAINT "Protocol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Account" (
    "id" TEXT NOT NULL,
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

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorEmail" TEXT,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "details" JSONB,
    "prevHash" TEXT,
    "entryHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "actorUserId" TEXT,
    "requestFingerprint" TEXT NOT NULL,
    "status" "public"."IdempotencyExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "responseStatus" INTEGER,
    "responseBody" JSONB,
    "errorMessage" TEXT,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DependencyCircuitBreaker" (
    "id" TEXT NOT NULL,
    "dependency" TEXT NOT NULL,
    "state" "public"."DependencyCircuitBreakerState" NOT NULL DEFAULT 'CLOSED',
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "lastFailureAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DependencyCircuitBreaker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReviewItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" "public"."ReviewStatus" NOT NULL DEFAULT 'OPEN',
    "severity" "public"."ReviewSeverity" NOT NULL DEFAULT 'MEDIUM',
    "details" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ResearchCollection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ResearchEntry" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "source" "public"."ResearchSource" NOT NULL DEFAULT 'MANUAL',
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "authors" TEXT,
    "abstract" TEXT,
    "url" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EvidenceRecord" (
    "id" TEXT NOT NULL,
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
    "studyType" "public"."EvidenceStudyType" NOT NULL,
    "evidenceDirection" "public"."EvidenceDirection" NOT NULL DEFAULT 'SUPPORTIVE',
    "reviewStatus" "public"."EvidenceReviewStatus" NOT NULL DEFAULT 'AUTO_QUEUED',
    "provenanceType" "public"."EvidenceProvenanceType" NOT NULL DEFAULT 'MANUAL',
    "provenanceDetail" TEXT,
    "automationSource" TEXT,
    "evidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "uncertaintyScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "reviewConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "sourceCapturedAt" TIMESTAMP(3),
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "verificationNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvidenceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Hypothesis" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "targetCondition" TEXT,
    "rationale" TEXT NOT NULL,
    "proposedMechanism" TEXT,
    "suggestedTests" TEXT,
    "suggestedInterventions" TEXT,
    "cohortDefinition" TEXT,
    "priorityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "averageEvidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "evidenceCoverageScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "contraindicationScore" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "uncertaintyScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "status" "public"."HypothesisStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hypothesis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EvidenceReviewEvent" (
    "id" TEXT NOT NULL,
    "evidenceRecordId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "eventType" "public"."EvidenceReviewEventType" NOT NULL,
    "previousStatus" "public"."EvidenceReviewStatus",
    "nextStatus" "public"."EvidenceReviewStatus",
    "previousAssignedReviewerId" TEXT,
    "nextAssignedReviewerId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceReviewEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HypothesisPriorityChange" (
    "id" TEXT NOT NULL,
    "hypothesisId" TEXT NOT NULL,
    "evidenceReviewEventId" TEXT NOT NULL,
    "evidenceRecordId" TEXT NOT NULL,
    "previousPriorityScore" DOUBLE PRECISION NOT NULL,
    "newPriorityScore" DOUBLE PRECISION NOT NULL,
    "previousConfidenceScore" DOUBLE PRECISION NOT NULL,
    "newConfidenceScore" DOUBLE PRECISION NOT NULL,
    "previousStatus" "public"."HypothesisStatus" NOT NULL,
    "newStatus" "public"."HypothesisStatus" NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HypothesisPriorityChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HypothesisEvidence" (
    "id" TEXT NOT NULL,
    "hypothesisId" TEXT NOT NULL,
    "evidenceRecordId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "rationale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HypothesisEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PatientCohort" (
    "id" TEXT NOT NULL,
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
    "estimatedEligibleShare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "readinessScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "riskBand" "public"."CohortRiskBand" NOT NULL DEFAULT 'MODERATE',
    "outcomeSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientCohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AIResearchRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "workflowType" "public"."AIWorkflowType" NOT NULL,
    "inputSummary" TEXT NOT NULL,
    "outputSummary" TEXT NOT NULL,
    "citations" TEXT,
    "uncertaintyScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIResearchRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClinicianTask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "public"."ClinicianTaskStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicianTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Medication" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dosage" TEXT,
    "frequency" TEXT,
    "prescribedFor" TEXT,
    "category" TEXT NOT NULL DEFAULT 'supplement',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "discontinuedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Medication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PartnerDataRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "source" "public"."PartnerDataSource" NOT NULL,
    "partnerId" TEXT,
    "label" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerDataRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Compound" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT,
    "category" TEXT NOT NULL,
    "riskCategory" "public"."RiskCategory" NOT NULL DEFAULT 'GREEN',
    "description" TEXT,
    "casNumber" TEXT,
    "pubChemCid" TEXT,
    "mechanism" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Compound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Pathway" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pathway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompoundPathway" (
    "id" TEXT NOT NULL,
    "compoundId" TEXT NOT NULL,
    "pathwayId" TEXT NOT NULL,
    "effect" TEXT NOT NULL,
    "strength" TEXT,
    "evidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompoundPathway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompoundInteraction" (
    "id" TEXT NOT NULL,
    "compoundAId" TEXT NOT NULL,
    "compoundBId" TEXT NOT NULL,
    "severity" "public"."InteractionSeverity" NOT NULL DEFAULT 'UNKNOWN',
    "description" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompoundInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompoundBiomarkerEffect" (
    "id" TEXT NOT NULL,
    "compoundId" TEXT NOT NULL,
    "biomarkerName" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "magnitude" TEXT,
    "evidence" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompoundBiomarkerEffect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompoundStudyLink" (
    "id" TEXT NOT NULL,
    "compoundId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompoundStudyLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MechanisticModel" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL,
    "source" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MechanisticModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ModelConfidenceScore" (
    "id" TEXT NOT NULL,
    "mechanisticModelId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT,
    "version" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelConfidenceScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CommunityPost" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "authorId" TEXT NOT NULL,
    "category" "public"."PostCategory" NOT NULL DEFAULT 'GENERAL',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LearnArticle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "authorId" TEXT NOT NULL,
    "topic" "public"."ArticleTopic" NOT NULL DEFAULT 'OVERVIEW',
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewedBy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearnArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LabTestPanel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "biomarkers" JSONB NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "turnaroundDays" INTEGER NOT NULL DEFAULT 5,
    "status" "public"."LabTestStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabTestPanel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LabOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "panelId" TEXT NOT NULL,
    "status" "public"."LabOrderStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "orderedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LabResult" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "biomarkerName" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "refLow" DOUBLE PRECISION,
    "refHigh" DOUBLE PRECISION,
    "flag" TEXT,
    "protocolId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TelehealthProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "bio" TEXT,
    "licenseStates" JSONB,
    "acceptingNew" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelehealthProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConsultationRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "providerId" TEXT,
    "type" "public"."ConsultationType" NOT NULL DEFAULT 'INITIAL',
    "status" "public"."ConsultationStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AdverseEventReport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "protocolId" TEXT,
    "severity" TEXT NOT NULL,
    "seriousness" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "suspectedCause" TEXT,
    "symptoms" JSONB NOT NULL,
    "detectedBy" TEXT NOT NULL,
    "onsetAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "outcome" TEXT,
    "escalationRequired" BOOLEAN NOT NULL DEFAULT false,
    "regulatorReportable" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdverseEventReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AeonForgeCandidate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "rawResponse" JSONB NOT NULL,
    "candidates" JSONB NOT NULL,
    "simulationScore" DOUBLE PRECISION,
    "healthspanDelta" INTEGER,
    "safetyScore" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AeonForgeCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SimulationResult" (
    "id" TEXT NOT NULL,
    "aeonForgeCandidateId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VirtualTwinRun" (
    "id" TEXT NOT NULL,
    "aeonForgeCandidateId" TEXT NOT NULL,
    "twinProfile" JSONB NOT NULL,
    "predictedOutcomes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VirtualTwinRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CanonicalHealthEventRecord" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "emittedAt" TIMESTAMP(3) NOT NULL,
    "storedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "partitionKey" TEXT NOT NULL,
    "sequence" INTEGER,
    "idempotencyKey" TEXT,
    "envelope" JSONB NOT NULL,
    "event" JSONB NOT NULL,

    CONSTRAINT "CanonicalHealthEventRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CanonicalHealthEventOutboxRecord" (
    "id" TEXT NOT NULL,
    "eventRecordId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "partitionKey" TEXT NOT NULL,
    "message" JSONB NOT NULL,
    "headers" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanonicalHealthEventOutboxRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrchestrationJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT,
    "queue" "public"."OrchestrationJobQueue" NOT NULL,
    "jobType" TEXT NOT NULL,
    "dedupeKey" TEXT,
    "status" "public"."OrchestrationJobStatus" NOT NULL DEFAULT 'QUEUED',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "lastError" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leasedAt" TIMESTAMP(3),
    "leaseExpiresAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "retainedUntil" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "parentJobId" TEXT,
    "correlationId" TEXT,
    "requestId" TEXT,
    "traceContext" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrchestrationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Product" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "public"."ProductCategory" NOT NULL DEFAULT 'SUPPLEMENT',
    "description" TEXT,
    "ingredients" TEXT,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "imageUrl" TEXT,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "thirdPartyTested" BOOLEAN NOT NULL DEFAULT false,
    "coaUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MarketplaceOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "status" "public"."MarketplaceOrderStatus" NOT NULL DEFAULT 'PENDING',
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "shippingAddress" TEXT,
    "trackingNumber" TEXT,
    "orderedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MarketplaceOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "priceCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InterventionOutcome" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "protocolId" TEXT,
    "biomarkerName" TEXT NOT NULL,
    "baselineValue" DOUBLE PRECISION NOT NULL,
    "latestValue" DOUBLE PRECISION NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterventionOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TrialMatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "cohortId" TEXT,
    "trialExternalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "condition" TEXT,
    "matchScore" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT NOT NULL,
    "status" "public"."TrialMatchStatus" NOT NULL DEFAULT 'CANDIDATE',
    "reviewerId" TEXT,
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrialMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TrialMatchReviewEvent" (
    "id" TEXT NOT NULL,
    "trialMatchId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "previousStatus" "public"."TrialMatchStatus",
    "nextStatus" "public"."TrialMatchStatus",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrialMatchReviewEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MarketplaceScientist" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "institution" TEXT,
    "specialty" TEXT,
    "biography" TEXT,
    "categories" JSONB NOT NULL,
    "fundingStage" TEXT NOT NULL DEFAULT 'pre-seed',
    "reputationScore" DOUBLE PRECISION NOT NULL DEFAULT 0.45,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "publishedDiscoveryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceScientist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MarketplaceSponsor" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "organizationName" TEXT NOT NULL,
    "organizationType" TEXT NOT NULL DEFAULT 'venture',
    "thesis" TEXT NOT NULL,
    "preferredCategories" JSONB NOT NULL,
    "preferredStages" JSONB NOT NULL,
    "maxBudgetCents" INTEGER NOT NULL DEFAULT 250000,
    "minImpactScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "capitalAvailableCents" INTEGER NOT NULL DEFAULT 1000000,
    "dueDiligenceLevel" TEXT NOT NULL DEFAULT 'standard',
    "geographyFocus" JSONB NOT NULL,
    "assayCapabilities" JSONB NOT NULL DEFAULT '[]',
    "labType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceSponsor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MarketplaceDiscovery" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "scientistId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "developmentStage" TEXT NOT NULL,
    "status" "public"."MarketplaceDiscoveryStatus" NOT NULL DEFAULT 'DRAFT',
    "scientificImpactScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "commercialReadiness" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "fundingGoalCents" INTEGER NOT NULL DEFAULT 50000,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "evidenceSummary" TEXT,
    "evidenceLinks" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "candidateId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceDiscovery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MarketplaceFundingRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "discoveryId" TEXT NOT NULL,
    "scientistId" TEXT NOT NULL,
    "requestedAmountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "useOfFunds" TEXT NOT NULL,
    "timelineMonths" INTEGER NOT NULL DEFAULT 12,
    "status" "public"."MarketplaceFundingRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "milestonePlan" JSONB NOT NULL,
    "evidenceUploads" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceFundingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MarketplaceMatchScore" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "discoveryId" TEXT NOT NULL,
    "scientistId" TEXT NOT NULL,
    "sponsorId" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "ruleBasedScore" DOUBLE PRECISION NOT NULL,
    "aiAugmentedScore" DOUBLE PRECISION,
    "weightedBreakdown" JSONB NOT NULL,
    "sponsorPreferenceFit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metadataFit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rationale" TEXT NOT NULL,
    "rank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceMatchScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MarketplaceDealRoom" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "discoveryId" TEXT NOT NULL,
    "scientistId" TEXT NOT NULL,
    "sponsorId" TEXT NOT NULL,
    "status" "public"."MarketplaceDealRoomStatus" NOT NULL DEFAULT 'OPEN',
    "ndaRequired" BOOLEAN NOT NULL DEFAULT true,
    "ndaAcceptedAt" TIMESTAMP(3),
    "agreementStatus" "public"."MarketplaceAgreementStatus" NOT NULL DEFAULT 'DRAFT',
    "agreementTerms" JSONB NOT NULL,
    "documentVault" JSONB NOT NULL,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceDealRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MarketplaceMessageThread" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "dealRoomId" TEXT NOT NULL,
    "senderUserId" TEXT,
    "senderRole" TEXT NOT NULL,
    "messageType" "public"."MarketplaceMessageType" NOT NULL DEFAULT 'MESSAGE',
    "body" TEXT NOT NULL,
    "attachments" JSONB NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceMessageThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MarketplaceTransaction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "dealRoomId" TEXT NOT NULL,
    "discoveryId" TEXT NOT NULL,
    "sponsorId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "platformFeeCents" INTEGER NOT NULL DEFAULT 0,
    "transactionFeeCents" INTEGER NOT NULL DEFAULT 0,
    "payoutCents" INTEGER NOT NULL DEFAULT 0,
    "status" "public"."MarketplaceTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "providerReference" TEXT,
    "metadata" JSONB NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MarketplaceAuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "dealRoomId" TEXT,
    "actorUserId" TEXT,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "ipAddress" TEXT,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MarketplaceNotification" (
    "id" TEXT NOT NULL,
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
    "status" "public"."MarketplaceNotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "MarketplaceNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TrustScore" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "role" "public"."TrustRole" NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "evidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "reviewScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "consistencyScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "reputationScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "engagementScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TimelineEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "provenanceType" TEXT,
    "provenanceDetail" TEXT,
    "reviewStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimelineEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FeedbackLoopSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "loopStrength" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discoveryScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evaluationScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "procurementScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "clinicalReviewScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "interventionScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outcomeScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fundingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackLoopSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BiologicalAgeSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "chronologicalAge" DOUBLE PRECISION NOT NULL,
    "biologicalAge" DOUBLE PRECISION NOT NULL,
    "hallmarkScores" JSONB NOT NULL DEFAULT '{}',
    "inputSummary" JSONB,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BiologicalAgeSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserXP" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "totalXP" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserXP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserStreak" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "currentCount" INTEGER NOT NULL DEFAULT 0,
    "longestCount" INTEGER NOT NULL DEFAULT 0,
    "lastActionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserStreak_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Achievement" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'trophy',
    "category" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL DEFAULT 1,
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserAchievement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WearableConnection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalUserId" TEXT,
    "scopes" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'active',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WearableConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PendingGraphContribution" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "contributorId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingGraphContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."APIKey" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" TEXT NOT NULL DEFAULT 'discover,simulate,virtual-twin',
    "rateLimitPerMin" INTEGER NOT NULL DEFAULT 60,
    "sandbox" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "APIKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."APIUsageRecord" (
    "id" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'POST',
    "statusCode" INTEGER NOT NULL,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "computeMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "APIUsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Referral" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "referrerId" TEXT NOT NULL,
    "refereeId" TEXT,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rewardGranted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AggregateOutcome" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "protocolId" TEXT,
    "compoundId" TEXT,
    "cohortBucket" TEXT NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "meanOutcomeScore" DOUBLE PRECISION NOT NULL,
    "stdDev" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pValue" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "period" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AggregateOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FederatedModel" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "version" INTEGER NOT NULL,
    "architecture" TEXT NOT NULL,
    "taskType" TEXT NOT NULL DEFAULT 'bio-age-delta',
    "aggregatedFromN" INTEGER NOT NULL DEFAULT 0,
    "roundsCompleted" INTEGER NOT NULL DEFAULT 0,
    "epsilon" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "loss" DOUBLE PRECISION,
    "metricsJson" JSONB NOT NULL DEFAULT '{}',
    "weightsUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'training',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FederatedModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FLParticipation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "localSampleSize" INTEGER NOT NULL DEFAULT 0,
    "localLoss" DOUBLE PRECISION,
    "epsilonSpent" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FLParticipation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AgentSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "status" "public"."AgentSessionStatusEnum" NOT NULL DEFAULT 'PLANNING',
    "plan" TEXT,
    "scratchpad" TEXT,
    "result" TEXT,
    "reviewItemIds" TEXT,
    "resumedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AgentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AgentStepLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "agentClass" "public"."AgentClassEnum" NOT NULL,
    "input" TEXT,
    "output" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "durationMs" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentStepLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DriftSweep" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "biomarkersScanned" INTEGER NOT NULL DEFAULT 0,
    "driftsDetected" INTEGER NOT NULL DEFAULT 0,
    "findings" JSONB NOT NULL DEFAULT '[]',
    "triggerType" TEXT NOT NULL DEFAULT 'scheduled',
    "proactiveSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriftSweep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DriftNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "sweepId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "severity" "public"."DriftSeverity" NOT NULL DEFAULT 'MEDIUM',
    "biomarkerNames" JSONB NOT NULL DEFAULT '[]',
    "sessionId" TEXT,
    "readAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriftNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GovernancePolicy" (
    "id" TEXT NOT NULL,
    "category" "public"."RiskCategory" NOT NULL,
    "autoApprove" BOOLEAN NOT NULL DEFAULT false,
    "minAdherenceRate" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "requireLabReview" BOOLEAN NOT NULL DEFAULT false,
    "maxAutoApprovePerSession" INTEGER NOT NULL DEFAULT 3,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernancePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GovernanceAuditLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "compoundName" TEXT NOT NULL,
    "riskCategory" "public"."RiskCategory" NOT NULL,
    "decision" TEXT NOT NULL,
    "policySnapshot" JSONB NOT NULL,
    "adherenceRate" DOUBLE PRECISION,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GovernanceAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClinicalSignature" (
    "id" TEXT NOT NULL,
    "reviewItemId" TEXT NOT NULL,
    "sessionId" TEXT,
    "clinicianId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "rationale" TEXT NOT NULL,
    "compoundName" TEXT,
    "riskCategory" TEXT,
    "signatureHash" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clinicianName" TEXT NOT NULL,
    "clinicianEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicalSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AdminImpersonationSession" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "stoppedAt" TIMESTAMP(3),

    CONSTRAINT "AdminImpersonationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OmicsAssayBatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "kind" "public"."OmicsAssayKind" NOT NULL,
    "vendor" TEXT NOT NULL,
    "assayVersion" TEXT NOT NULL,
    "pipelineVersion" TEXT NOT NULL,
    "reagentLot" TEXT,
    "runDate" TIMESTAMP(3) NOT NULL,
    "qcPassed" BOOLEAN NOT NULL DEFAULT false,
    "qcReportUri" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OmicsAssayBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OmicsSample" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "sampleType" TEXT NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3),
    "externalId" TEXT,
    "qcPassed" BOOLEAN NOT NULL DEFAULT false,
    "qcMetrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OmicsSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OmicsMeasurement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "sampleId" TEXT NOT NULL,
    "analyteCode" TEXT,
    "geneSymbol" TEXT,
    "cpgSite" TEXT,
    "taxonId" INTEGER,
    "mutationHgvs" TEXT,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" "public"."OmicsUnitVocab" NOT NULL,
    "unitFreeText" TEXT,
    "limitOfDetection" DOUBLE PRECISION,
    "limitOfQuant" DOUBLE PRECISION,
    "isBelowLOD" BOOLEAN NOT NULL DEFAULT false,
    "qcFlag" TEXT,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OmicsMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PolygenicScore" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "trait" TEXT NOT NULL,
    "pgsCatalogId" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "percentile" DOUBLE PRECISION,
    "ancestry" TEXT,
    "modelVersion" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolygenicScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MendelianRandomizationFinding" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT,
    "exposure" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "betaIvw" DOUBLE PRECISION NOT NULL,
    "seIvw" DOUBLE PRECISION NOT NULL,
    "pIvw" DOUBLE PRECISION NOT NULL,
    "nSnps" INTEGER NOT NULL,
    "egger" DOUBLE PRECISION,
    "source" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MendelianRandomizationFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PhysiologicalTwin" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION,
    "heightCm" DOUBLE PRECISION,
    "sexAtBirth" TEXT,
    "age" INTEGER,
    "ancestry" TEXT,
    "egfrMlMin" DOUBLE PRECISION,
    "childPughClass" TEXT,
    "parameterJson" JSONB NOT NULL,
    "hallmarkJson" JSONB NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhysiologicalTwin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TwinSimulationRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "twinId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "intervention" TEXT NOT NULL,
    "compoundId" TEXT,
    "doseMg" DOUBLE PRECISION,
    "scheduleCron" TEXT,
    "horizonDays" INTEGER NOT NULL,
    "endpoint" TEXT NOT NULL,
    "predictedMean" DOUBLE PRECISION NOT NULL,
    "predictedSdLo" DOUBLE PRECISION NOT NULL,
    "predictedSdHi" DOUBLE PRECISION NOT NULL,
    "uncertaintyKind" TEXT NOT NULL,
    "inputsHash" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "predictionWindowDays" INTEGER NOT NULL DEFAULT 0,
    "predictionExpiresAt" TIMESTAMP(3),
    "pkParamsUsedJson" JSONB,
    "outcomeTrajectoryJson" JSONB,
    "twinAccuracyScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TwinSimulationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NofOneTrial" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "hypothesis" TEXT NOT NULL,
    "design" "public"."NofOneDesign" NOT NULL,
    "primaryEndpoint" TEXT NOT NULL,
    "secondaryEndpoints" JSONB NOT NULL,
    "preregisteredHash" TEXT NOT NULL,
    "preregisteredJson" JSONB NOT NULL,
    "status" "public"."NofOneStatus" NOT NULL DEFAULT 'DESIGN',
    "bayesianStopJson" JSONB NOT NULL,
    "irbApprovalRef" TEXT,
    "startedAt" TIMESTAMP(3),
    "stoppedAt" TIMESTAMP(3),
    "stopReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NofOneTrial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NofOneArm" (
    "id" TEXT NOT NULL,
    "trialId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "compoundId" TEXT,
    "doseMg" DOUBLE PRECISION,
    "scheduleCron" TEXT,

    CONSTRAINT "NofOneArm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NofOnePeriod" (
    "id" TEXT NOT NULL,
    "trialId" TEXT NOT NULL,
    "armLabel" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "observations" JSONB NOT NULL,

    CONSTRAINT "NofOnePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PharmacogenomicProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "variantsJson" JSONB NOT NULL,
    "panelVendor" TEXT,
    "panelVersion" TEXT,
    "reportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PharmacogenomicProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DrugDrugInteraction" (
    "id" TEXT NOT NULL,
    "drugA" TEXT NOT NULL,
    "drugB" TEXT NOT NULL,
    "mechanism" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "evidenceGrade" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrugDrugInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."KgNode" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "kind" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "synonyms" JSONB,
    "attributes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KgNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."KgEdge" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "fromNodeId" TEXT NOT NULL,
    "toNodeId" TEXT NOT NULL,
    "edgeType" "public"."KgEdgeType" NOT NULL,
    "evidenceGrade" "public"."KgEvidenceGrade" NOT NULL,
    "source" TEXT NOT NULL,
    "pubmedIds" JSONB,
    "effectSize" DOUBLE PRECISION,
    "effectSizeUnit" TEXT,
    "confidence" DOUBLE PRECISION,
    "attributes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KgEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TumorProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "primarySite" TEXT NOT NULL,
    "histology" TEXT,
    "stageAjcc" TEXT,
    "diagnosedAt" TIMESTAMP(3) NOT NULL,
    "tmbPerMb" DOUBLE PRECISION,
    "msiStatus" TEXT,
    "hrdScore" DOUBLE PRECISION,
    "pdL1Cps" DOUBLE PRECISION,
    "driverMutations" JSONB NOT NULL,
    "neoantigensJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TumorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CtdnaTimepoint" (
    "id" TEXT NOT NULL,
    "tumorProfileId" TEXT NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "vafMax" DOUBLE PRECISION,
    "copiesPerMl" DOUBLE PRECISION,
    "mrdStatus" TEXT NOT NULL,
    "panelVendor" TEXT,
    "panelVersion" TEXT,

    CONSTRAINT "CtdnaTimepoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RecistAssessment" (
    "id" TEXT NOT NULL,
    "tumorProfileId" TEXT NOT NULL,
    "assessedAt" TIMESTAMP(3) NOT NULL,
    "scheme" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "sumLongestDiameterMm" DOUBLE PRECISION,
    "notes" TEXT,

    CONSTRAINT "RecistAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TranscriptomicSignature" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "sourceAssay" TEXT NOT NULL,
    "upGenes" JSONB NOT NULL,
    "downGenes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TranscriptomicSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DrugRepurposingScore" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "signatureId" TEXT NOT NULL,
    "compoundId" TEXT NOT NULL,
    "cmapScore" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrugRepurposingScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AgentClaim" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "sessionId" TEXT NOT NULL,
    "agentClass" TEXT NOT NULL,
    "claimText" TEXT NOT NULL,
    "evidenceKind" "public"."AgentClaimEvidenceKind" NOT NULL,
    "evidenceRef" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CdiscOdmExport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "trialId" TEXT,
    "studyOid" TEXT NOT NULL,
    "documentXml" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CdiscOdmExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LabResultReconciliation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "externalOrderId" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawPayload" TEXT NOT NULL,
    "parsedJson" JSONB,
    "status" "public"."LabResultRecStatus" NOT NULL DEFAULT 'RECEIVED',
    "matchedSampleId" TEXT,
    "notes" TEXT,

    CONSTRAINT "LabResultReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AgentPromptVersion" (
    "id" TEXT NOT NULL,
    "agentClass" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "promptText" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "signature" TEXT,
    "signedBy" TEXT,
    "signedAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentPromptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AgentSessionReplayManifest" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "scratchpadHash" TEXT NOT NULL,
    "modelIds" JSONB NOT NULL,
    "promptHashes" JSONB NOT NULL,
    "inputsHash" TEXT NOT NULL,
    "determinismOk" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentSessionReplayManifest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JurisdictionGateDecision" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "sessionId" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "ruleSetVersion" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JurisdictionGateDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EvalBenchRun" (
    "id" TEXT NOT NULL,
    "benchName" TEXT NOT NULL,
    "benchVersion" TEXT NOT NULL,
    "datasetHash" TEXT NOT NULL,
    "metricsJson" JSONB NOT NULL,
    "agentClass" TEXT,
    "modelVersion" TEXT,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvalBenchRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExperimentCandidate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "kind" "public"."ExperimentCandidateKind" NOT NULL,
    "status" "public"."ExperimentCandidateStatus" NOT NULL DEFAULT 'PROPOSED',
    "displayName" TEXT NOT NULL,
    "smiles" TEXT,
    "chemblId" TEXT,
    "chemblScore" DOUBLE PRECISION,
    "chemblJson" JSONB,
    "aeonForgeCandidateId" TEXT,
    "aiMolJson" JSONB,
    "screenJson" JSONB,
    "dockJson" JSONB,
    "targetName" TEXT,
    "targetChemblId" TEXT,
    "hypothesisNote" TEXT,
    "notes" TEXT,
    "feedbackScore" DOUBLE PRECISION,
    "uncertaintyScore" DOUBLE PRECISION,
    "acquisitionScore" DOUBLE PRECISION,
    "fepGateScore" DOUBLE PRECISION,
    "fepGateReason" TEXT,
    "fepJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExperimentCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExperimentCandidateEvent" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "fromStatus" "public"."ExperimentCandidateStatus",
    "toStatus" "public"."ExperimentCandidateStatus" NOT NULL,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExperimentCandidateEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CandidateLabResult" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "submissionId" TEXT,
    "assayName" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "operator" TEXT NOT NULL DEFAULT '=',
    "flag" TEXT,
    "assayType" TEXT,
    "lab" TEXT,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "rawDataUri" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateLabResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LabSubmission" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "labName" TEXT NOT NULL,
    "labContact" TEXT,
    "tokenHash" TEXT NOT NULL,
    "status" "public"."LabSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "packageJson" JSONB NOT NULL,
    "requestedAssays" JSONB NOT NULL,
    "deadlineAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabSubmission_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "public"."CandidateFeedbackRun" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feedbackScore" DOUBLE PRECISION NOT NULL,
    "uncertaintyScore" DOUBLE PRECISION NOT NULL,
    "activityScore" DOUBLE PRECISION NOT NULL,
    "selectivityScore" DOUBLE PRECISION NOT NULL,
    "toxicityScore" DOUBLE PRECISION NOT NULL,
    "nResults" INTEGER NOT NULL,
    "rationale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateFeedbackRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PilotMetricsSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "windowDays" INTEGER NOT NULL DEFAULT 90,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alHitRate" DOUBLE PRECISION NOT NULL,
    "baselineHitRate" DOUBLE PRECISION NOT NULL,
    "hitRateUplift" DOUBLE PRECISION NOT NULL,
    "alN" INTEGER NOT NULL,
    "baselineN" INTEGER NOT NULL,
    "totalSpendCents" INTEGER NOT NULL,
    "validatedHits" INTEGER NOT NULL,
    "costPerHitCents" INTEGER,
    "medianCycleTimeSec" DOUBLE PRECISION,
    "p75CycleTimeSec" DOUBLE PRECISION,
    "stageTimes" JSONB NOT NULL,
    "screenPositives" INTEGER NOT NULL,
    "screenNegatives" INTEGER NOT NULL,
    "falsePositiveRate" DOUBLE PRECISION,
    "falseNegativeRate" DOUBLE PRECISION,

    CONSTRAINT "PilotMetricsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExternalScreeningAdapter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "endpointUrl" TEXT NOT NULL,
    "authHeader" TEXT NOT NULL DEFAULT 'Authorization',
    "authScheme" TEXT NOT NULL DEFAULT 'Bearer',
    "secret" TEXT NOT NULL,
    "timeoutMs" INTEGER NOT NULL DEFAULT 15000,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalScreeningAdapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExternalScreeningRun" (
    "id" TEXT NOT NULL,
    "adapterId" TEXT NOT NULL,
    "candidateId" TEXT,
    "smiles" TEXT NOT NULL,
    "durationMs" INTEGER,
    "statusCode" INTEGER,
    "success" BOOLEAN NOT NULL,
    "rawResponse" JSONB,
    "normalized" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalScreeningRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LoopCycle" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "status" "public"."LoopCycleStatus" NOT NULL DEFAULT 'OBSERVE',
    "triggeredBy" "public"."LoopTriggerReason" NOT NULL,
    "snapshotId" TEXT,
    "agentSessionId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "failedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoopCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PhysiologicalSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "materializedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "biomarkersJson" JSONB NOT NULL DEFAULT '{}',
    "riskScoresJson" JSONB NOT NULL DEFAULT '{}',
    "activeProtocolId" TEXT,
    "protocolAdherence" DOUBLE PRECISION,
    "protocolWeeksActive" DOUBLE PRECISION,
    "dysregulatedPathways" JSONB NOT NULL DEFAULT '[]',
    "twinLastSimAt" TIMESTAMP(3),
    "twinPredictionAccuracy" DOUBLE PRECISION,
    "pendingReflections" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhysiologicalSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProtocolOutcome" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "loopCycleId" TEXT NOT NULL,
    "protocolId" TEXT,
    "cycleStartDate" TIMESTAMP(3) NOT NULL,
    "cycleEndDate" TIMESTAMP(3),
    "targetBiomarkers" JSONB NOT NULL DEFAULT '[]',
    "observedBiomarkers" JSONB NOT NULL DEFAULT '[]',
    "twinSimulationId" TEXT,
    "twinPredictionAccuracy" DOUBLE PRECISION,
    "agentAccuracyScores" JSONB NOT NULL DEFAULT '[]',
    "overallEfficacy" DOUBLE PRECISION,
    "reflectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtocolOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReflectionReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "loopCycleId" TEXT NOT NULL,
    "protocolOutcomeId" TEXT,
    "insights" JSONB NOT NULL DEFAULT '[]',
    "agentScoreDeltas" JSONB NOT NULL DEFAULT '{}',
    "twinAccuracyDelta" DOUBLE PRECISION,
    "priorAdjustments" JSONB NOT NULL DEFAULT '[]',
    "disclaimer" TEXT NOT NULL DEFAULT 'Retrospective research analysis — not medical advice.',
    "signedVc" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReflectionReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserTwinPrior" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "compoundId" TEXT NOT NULL,
    "outcomeKey" TEXT NOT NULL,
    "prior" DOUBLE PRECISION NOT NULL,
    "populationDefault" DOUBLE PRECISION NOT NULL,
    "n" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTwinPrior_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProtocolVersion" (
    "id" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "version" INTEGER NOT NULL,
    "status" "public"."ProtocolVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "changes" JSONB NOT NULL DEFAULT '[]',
    "generatedByAgentSessionId" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtocolVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserPkProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "compoundId" TEXT NOT NULL,
    "vd" DOUBLE PRECISION NOT NULL,
    "cl" DOUBLE PRECISION NOT NULL,
    "ka" DOUBLE PRECISION NOT NULL,
    "f" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "n" INTEGER NOT NULL,
    "rmse" DOUBLE PRECISION NOT NULL,
    "fittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fittedFromOutcomeIds" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPkProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FederatedNode" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "endpoint" TEXT,
    "publicKey" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FederatedNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FederationConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "scope" JSONB NOT NULL DEFAULT '[]',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "FederationConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserPrivacyBudget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "epsilonUsed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "epsilonMax" DOUBLE PRECISION NOT NULL DEFAULT 4.0,
    "queryCount" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPrivacyBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProtocolFork" (
    "id" TEXT NOT NULL,
    "sourceProtocolId" TEXT NOT NULL,
    "forkedByUserId" TEXT NOT NULL,
    "forkNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProtocolFork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IrbApproval" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "token" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IrbApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClinicianCoSign" (
    "id" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "signature" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "jurisdiction" TEXT,
    "licenseNumber" TEXT NOT NULL,
    "licenseVerifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicianCoSign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "public"."User"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "UserMfaSecret_userId_key" ON "public"."UserMfaSecret"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ActiveSession_tokenHash_key" ON "public"."ActiveSession"("tokenHash");

-- CreateIndex
CREATE INDEX "ActiveSession_userId_revokedAt_idx" ON "public"."ActiveSession"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "public"."Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_status_isolationMode_idx" ON "public"."Tenant"("status", "isolationMode");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "public"."Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_tenantId_status_idx" ON "public"."Organization"("tenantId", "status");

-- CreateIndex
CREATE INDEX "OrganizationMembership_tenantId_userId_role_idx" ON "public"."OrganizationMembership"("tenantId", "userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMembership_organizationId_userId_key" ON "public"."OrganizationMembership"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "public"."UserProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserConsentGrant_userId_key" ON "public"."UserConsentGrant"("userId");

-- CreateIndex
CREATE INDEX "UserConsentGrant_status_updatedAt_idx" ON "public"."UserConsentGrant"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeCheckoutSessionId_key" ON "public"."Subscription"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "public"."Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_regionTier_createdAt_idx" ON "public"."Subscription"("regionTier", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingRecord_stripeCheckoutSessionId_key" ON "public"."BillingRecord"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingRecord_stripePaymentIntentId_key" ON "public"."BillingRecord"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingRecord_consultationRequestId_key" ON "public"."BillingRecord"("consultationRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingRecord_labOrderId_key" ON "public"."BillingRecord"("labOrderId");

-- CreateIndex
CREATE INDEX "BillingRecord_tenantId_category_status_idx" ON "public"."BillingRecord"("tenantId", "category", "status");

-- CreateIndex
CREATE INDEX "BillingRecord_userId_createdAt_idx" ON "public"."BillingRecord"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "BillingRecord_userId_aiCreditSource_status_createdAt_idx" ON "public"."BillingRecord"("userId", "aiCreditSource", "status", "createdAt");

-- CreateIndex
CREATE INDEX "BillingRecord_regionTier_createdAt_idx" ON "public"."BillingRecord"("regionTier", "createdAt");

-- CreateIndex
CREATE INDEX "Biomarker_userId_measuredAt_idx" ON "public"."Biomarker"("userId", "measuredAt");

-- CreateIndex
CREATE INDEX "Biomarker_tenantId_userId_idx" ON "public"."Biomarker"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "Protocol_userId_updatedAt_idx" ON "public"."Protocol"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Protocol_tenantId_userId_idx" ON "public"."Protocol"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "Protocol_forkCount_idx" ON "public"."Protocol"("forkCount");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "public"."Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "public"."Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "public"."VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "public"."VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "public"."AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "public"."AuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "public"."AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_tenantId_status_expiresAt_idx" ON "public"."IdempotencyRecord"("tenantId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_actorUserId_createdAt_idx" ON "public"."IdempotencyRecord"("actorUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_tenantId_route_method_key_key" ON "public"."IdempotencyRecord"("tenantId", "route", "method", "key");

-- CreateIndex
CREATE UNIQUE INDEX "DependencyCircuitBreaker_dependency_key" ON "public"."DependencyCircuitBreaker"("dependency");

-- CreateIndex
CREATE INDEX "DependencyCircuitBreaker_state_nextAttemptAt_idx" ON "public"."DependencyCircuitBreaker"("state", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "ReviewItem_status_severity_idx" ON "public"."ReviewItem"("status", "severity");

-- CreateIndex
CREATE INDEX "ResearchCollection_userId_idx" ON "public"."ResearchCollection"("userId");

-- CreateIndex
CREATE INDEX "ResearchEntry_collectionId_idx" ON "public"."ResearchEntry"("collectionId");

-- CreateIndex
CREATE INDEX "ResearchEntry_source_externalId_idx" ON "public"."ResearchEntry"("source", "externalId");

-- CreateIndex
CREATE INDEX "EvidenceRecord_diseaseArea_studyType_idx" ON "public"."EvidenceRecord"("diseaseArea", "studyType");

-- CreateIndex
CREATE INDEX "EvidenceRecord_reviewed_evidenceScore_idx" ON "public"."EvidenceRecord"("reviewed", "evidenceScore");

-- CreateIndex
CREATE INDEX "EvidenceRecord_reviewStatus_provenanceType_idx" ON "public"."EvidenceRecord"("reviewStatus", "provenanceType");

-- CreateIndex
CREATE INDEX "EvidenceRecord_assignedReviewerId_reviewStatus_idx" ON "public"."EvidenceRecord"("assignedReviewerId", "reviewStatus");

-- CreateIndex
CREATE INDEX "Hypothesis_ownerUserId_status_idx" ON "public"."Hypothesis"("ownerUserId", "status");

-- CreateIndex
CREATE INDEX "EvidenceReviewEvent_evidenceRecordId_createdAt_idx" ON "public"."EvidenceReviewEvent"("evidenceRecordId", "createdAt");

-- CreateIndex
CREATE INDEX "EvidenceReviewEvent_actorUserId_eventType_idx" ON "public"."EvidenceReviewEvent"("actorUserId", "eventType");

-- CreateIndex
CREATE INDEX "HypothesisPriorityChange_hypothesisId_createdAt_idx" ON "public"."HypothesisPriorityChange"("hypothesisId", "createdAt");

-- CreateIndex
CREATE INDEX "HypothesisPriorityChange_evidenceRecordId_createdAt_idx" ON "public"."HypothesisPriorityChange"("evidenceRecordId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HypothesisEvidence_hypothesisId_evidenceRecordId_key" ON "public"."HypothesisEvidence"("hypothesisId", "evidenceRecordId");

-- CreateIndex
CREATE INDEX "PatientCohort_ownerUserId_focusArea_idx" ON "public"."PatientCohort"("ownerUserId", "focusArea");

-- CreateIndex
CREATE INDEX "AIResearchRun_userId_workflowType_idx" ON "public"."AIResearchRun"("userId", "workflowType");

-- CreateIndex
CREATE INDEX "ClinicianTask_userId_status_idx" ON "public"."ClinicianTask"("userId", "status");

-- CreateIndex
CREATE INDEX "Medication_userId_active_idx" ON "public"."Medication"("userId", "active");

-- CreateIndex
CREATE INDEX "Medication_tenantId_userId_idx" ON "public"."Medication"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "PartnerDataRecord_userId_source_idx" ON "public"."PartnerDataRecord"("userId", "source");

-- CreateIndex
CREATE UNIQUE INDEX "Compound_name_key" ON "public"."Compound"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Compound_casNumber_key" ON "public"."Compound"("casNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Pathway_name_key" ON "public"."Pathway"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CompoundPathway_compoundId_pathwayId_key" ON "public"."CompoundPathway"("compoundId", "pathwayId");

-- CreateIndex
CREATE UNIQUE INDEX "CompoundInteraction_compoundAId_compoundBId_key" ON "public"."CompoundInteraction"("compoundAId", "compoundBId");

-- CreateIndex
CREATE INDEX "CompoundBiomarkerEffect_compoundId_idx" ON "public"."CompoundBiomarkerEffect"("compoundId");

-- CreateIndex
CREATE INDEX "CompoundBiomarkerEffect_biomarkerName_idx" ON "public"."CompoundBiomarkerEffect"("biomarkerName");

-- CreateIndex
CREATE UNIQUE INDEX "CompoundStudyLink_compoundId_source_externalId_key" ON "public"."CompoundStudyLink"("compoundId", "source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "MechanisticModel_name_version_key" ON "public"."MechanisticModel"("name", "version");

-- CreateIndex
CREATE INDEX "ModelConfidenceScore_entityType_entityId_idx" ON "public"."ModelConfidenceScore"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ModelConfidenceScore_mechanisticModelId_version_idx" ON "public"."ModelConfidenceScore"("mechanisticModelId", "version");

-- CreateIndex
CREATE INDEX "CommunityPost_category_createdAt_idx" ON "public"."CommunityPost"("category", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityPost_authorId_idx" ON "public"."CommunityPost"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "LearnArticle_slug_key" ON "public"."LearnArticle"("slug");

-- CreateIndex
CREATE INDEX "LearnArticle_topic_publishedAt_idx" ON "public"."LearnArticle"("topic", "publishedAt");

-- CreateIndex
CREATE INDEX "LearnArticle_slug_idx" ON "public"."LearnArticle"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "LabTestPanel_name_key" ON "public"."LabTestPanel"("name");

-- CreateIndex
CREATE INDEX "LabOrder_userId_status_idx" ON "public"."LabOrder"("userId", "status");

-- CreateIndex
CREATE INDEX "LabResult_orderId_idx" ON "public"."LabResult"("orderId");

-- CreateIndex
CREATE INDEX "LabResult_protocolId_idx" ON "public"."LabResult"("protocolId");

-- CreateIndex
CREATE INDEX "ConsultationRequest_userId_status_idx" ON "public"."ConsultationRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "ConsultationRequest_providerId_idx" ON "public"."ConsultationRequest"("providerId");

-- CreateIndex
CREATE INDEX "AdverseEventReport_userId_createdAt_idx" ON "public"."AdverseEventReport"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AdverseEventReport_protocolId_createdAt_idx" ON "public"."AdverseEventReport"("protocolId", "createdAt");

-- CreateIndex
CREATE INDEX "AeonForgeCandidate_userId_status_idx" ON "public"."AeonForgeCandidate"("userId", "status");

-- CreateIndex
CREATE INDEX "AeonForgeCandidate_createdAt_idx" ON "public"."AeonForgeCandidate"("createdAt");

-- CreateIndex
CREATE INDEX "SimulationResult_aeonForgeCandidateId_type_idx" ON "public"."SimulationResult"("aeonForgeCandidateId", "type");

-- CreateIndex
CREATE INDEX "VirtualTwinRun_aeonForgeCandidateId_idx" ON "public"."VirtualTwinRun"("aeonForgeCandidateId");

-- CreateIndex
CREATE INDEX "CanonicalHealthEventRecord_tenantId_subjectId_occurredAt_idx" ON "public"."CanonicalHealthEventRecord"("tenantId", "subjectId", "occurredAt");

-- CreateIndex
CREATE INDEX "CanonicalHealthEventRecord_tenantId_aggregateId_occurredAt_idx" ON "public"."CanonicalHealthEventRecord"("tenantId", "aggregateId", "occurredAt");

-- CreateIndex
CREATE INDEX "CanonicalHealthEventRecord_tenantId_type_occurredAt_idx" ON "public"."CanonicalHealthEventRecord"("tenantId", "type", "occurredAt");

-- CreateIndex
CREATE INDEX "CanonicalHealthEventRecord_tenantId_topic_occurredAt_idx" ON "public"."CanonicalHealthEventRecord"("tenantId", "topic", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalHealthEventRecord_tenantId_eventId_key" ON "public"."CanonicalHealthEventRecord"("tenantId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalHealthEventRecord_tenantId_idempotencyKey_key" ON "public"."CanonicalHealthEventRecord"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalHealthEventOutboxRecord_eventRecordId_key" ON "public"."CanonicalHealthEventOutboxRecord"("eventRecordId");

-- CreateIndex
CREATE INDEX "CanonicalHealthEventOutboxRecord_tenantId_status_availableA_idx" ON "public"."CanonicalHealthEventOutboxRecord"("tenantId", "status", "availableAt");

-- CreateIndex
CREATE INDEX "CanonicalHealthEventOutboxRecord_topic_status_availableAt_idx" ON "public"."CanonicalHealthEventOutboxRecord"("topic", "status", "availableAt");

-- CreateIndex
CREATE INDEX "OrchestrationJob_tenantId_queue_status_availableAt_priority_idx" ON "public"."OrchestrationJob"("tenantId", "queue", "status", "availableAt", "priority");

-- CreateIndex
CREATE INDEX "OrchestrationJob_tenantId_jobType_status_availableAt_idx" ON "public"."OrchestrationJob"("tenantId", "jobType", "status", "availableAt");

-- CreateIndex
CREATE INDEX "OrchestrationJob_tenantId_retainedUntil_idx" ON "public"."OrchestrationJob"("tenantId", "retainedUntil");

-- CreateIndex
CREATE INDEX "OrchestrationJob_parentJobId_idx" ON "public"."OrchestrationJob"("parentJobId");

-- CreateIndex
CREATE UNIQUE INDEX "OrchestrationJob_tenantId_dedupeKey_key" ON "public"."OrchestrationJob"("tenantId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "Product_name_key" ON "public"."Product"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "public"."Product"("slug");

-- CreateIndex
CREATE INDEX "MarketplaceOrder_userId_status_idx" ON "public"."MarketplaceOrder"("userId", "status");

-- CreateIndex
CREATE INDEX "MarketplaceOrderItem_orderId_idx" ON "public"."MarketplaceOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "InterventionOutcome_userId_biomarkerName_idx" ON "public"."InterventionOutcome"("userId", "biomarkerName");

-- CreateIndex
CREATE INDEX "InterventionOutcome_protocolId_idx" ON "public"."InterventionOutcome"("protocolId");

-- CreateIndex
CREATE INDEX "TrialMatch_userId_status_idx" ON "public"."TrialMatch"("userId", "status");

-- CreateIndex
CREATE INDEX "TrialMatch_trialExternalId_idx" ON "public"."TrialMatch"("trialExternalId");

-- CreateIndex
CREATE INDEX "TrialMatch_reviewerId_status_idx" ON "public"."TrialMatch"("reviewerId", "status");

-- CreateIndex
CREATE INDEX "TrialMatchReviewEvent_trialMatchId_createdAt_idx" ON "public"."TrialMatchReviewEvent"("trialMatchId", "createdAt");

-- CreateIndex
CREATE INDEX "TrialMatchReviewEvent_actorUserId_eventType_idx" ON "public"."TrialMatchReviewEvent"("actorUserId", "eventType");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceScientist_userId_key" ON "public"."MarketplaceScientist"("userId");

-- CreateIndex
CREATE INDEX "MarketplaceScientist_fundingStage_reputationScore_idx" ON "public"."MarketplaceScientist"("fundingStage", "reputationScore");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceSponsor_userId_key" ON "public"."MarketplaceSponsor"("userId");

-- CreateIndex
CREATE INDEX "MarketplaceSponsor_organizationId_idx" ON "public"."MarketplaceSponsor"("organizationId");

-- CreateIndex
CREATE INDEX "MarketplaceSponsor_maxBudgetCents_minImpactScore_idx" ON "public"."MarketplaceSponsor"("maxBudgetCents", "minImpactScore");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceDiscovery_slug_key" ON "public"."MarketplaceDiscovery"("slug");

-- CreateIndex
CREATE INDEX "MarketplaceDiscovery_category_status_idx" ON "public"."MarketplaceDiscovery"("category", "status");

-- CreateIndex
CREATE INDEX "MarketplaceDiscovery_scientistId_createdAt_idx" ON "public"."MarketplaceDiscovery"("scientistId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceDiscovery_candidateId_idx" ON "public"."MarketplaceDiscovery"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceFundingRequest_discoveryId_key" ON "public"."MarketplaceFundingRequest"("discoveryId");

-- CreateIndex
CREATE INDEX "MarketplaceFundingRequest_scientistId_status_idx" ON "public"."MarketplaceFundingRequest"("scientistId", "status");

-- CreateIndex
CREATE INDEX "MarketplaceMatchScore_sponsorId_overallScore_idx" ON "public"."MarketplaceMatchScore"("sponsorId", "overallScore");

-- CreateIndex
CREATE INDEX "MarketplaceMatchScore_scientistId_overallScore_idx" ON "public"."MarketplaceMatchScore"("scientistId", "overallScore");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceMatchScore_discoveryId_sponsorId_key" ON "public"."MarketplaceMatchScore"("discoveryId", "sponsorId");

-- CreateIndex
CREATE INDEX "MarketplaceDealRoom_scientistId_status_idx" ON "public"."MarketplaceDealRoom"("scientistId", "status");

-- CreateIndex
CREATE INDEX "MarketplaceDealRoom_sponsorId_status_idx" ON "public"."MarketplaceDealRoom"("sponsorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceDealRoom_discoveryId_sponsorId_key" ON "public"."MarketplaceDealRoom"("discoveryId", "sponsorId");

-- CreateIndex
CREATE INDEX "MarketplaceMessageThread_dealRoomId_createdAt_idx" ON "public"."MarketplaceMessageThread"("dealRoomId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceTransaction_dealRoomId_status_idx" ON "public"."MarketplaceTransaction"("dealRoomId", "status");

-- CreateIndex
CREATE INDEX "MarketplaceTransaction_sponsorId_createdAt_idx" ON "public"."MarketplaceTransaction"("sponsorId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceAuditLog_dealRoomId_createdAt_idx" ON "public"."MarketplaceAuditLog"("dealRoomId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceAuditLog_entityType_entityId_idx" ON "public"."MarketplaceAuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "MarketplaceNotification_recipientUserId_status_idx" ON "public"."MarketplaceNotification"("recipientUserId", "status");

-- CreateIndex
CREATE INDEX "MarketplaceNotification_dealRoomId_createdAt_idx" ON "public"."MarketplaceNotification"("dealRoomId", "createdAt");

-- CreateIndex
CREATE INDEX "TrustScore_userId_role_idx" ON "public"."TrustScore"("userId", "role");

-- CreateIndex
CREATE INDEX "TrustScore_tenantId_role_overallScore_idx" ON "public"."TrustScore"("tenantId", "role", "overallScore");

-- CreateIndex
CREATE INDEX "TimelineEntry_userId_domain_occurredAt_idx" ON "public"."TimelineEntry"("userId", "domain", "occurredAt");

-- CreateIndex
CREATE INDEX "TimelineEntry_tenantId_userId_occurredAt_idx" ON "public"."TimelineEntry"("tenantId", "userId", "occurredAt");

-- CreateIndex
CREATE INDEX "TimelineEntry_entityType_entityId_idx" ON "public"."TimelineEntry"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "FeedbackLoopSnapshot_userId_snapshotAt_idx" ON "public"."FeedbackLoopSnapshot"("userId", "snapshotAt");

-- CreateIndex
CREATE INDEX "FeedbackLoopSnapshot_tenantId_snapshotAt_idx" ON "public"."FeedbackLoopSnapshot"("tenantId", "snapshotAt");

-- CreateIndex
CREATE INDEX "BiologicalAgeSnapshot_userId_createdAt_idx" ON "public"."BiologicalAgeSnapshot"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "BiologicalAgeSnapshot_tenantId_userId_createdAt_idx" ON "public"."BiologicalAgeSnapshot"("tenantId", "userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserXP_userId_key" ON "public"."UserXP"("userId");

-- CreateIndex
CREATE INDEX "UserStreak_userId_type_idx" ON "public"."UserStreak"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "UserStreak_userId_type_key" ON "public"."UserStreak"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_code_key" ON "public"."Achievement"("code");

-- CreateIndex
CREATE INDEX "UserAchievement_userId_unlockedAt_idx" ON "public"."UserAchievement"("userId", "unlockedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_key" ON "public"."UserAchievement"("userId", "achievementId");

-- CreateIndex
CREATE INDEX "WearableConnection_userId_status_idx" ON "public"."WearableConnection"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WearableConnection_userId_provider_key" ON "public"."WearableConnection"("userId", "provider");

-- CreateIndex
CREATE INDEX "PendingGraphContribution_status_createdAt_idx" ON "public"."PendingGraphContribution"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PendingGraphContribution_contributorId_status_idx" ON "public"."PendingGraphContribution"("contributorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "APIKey_keyHash_key" ON "public"."APIKey"("keyHash");

-- CreateIndex
CREATE INDEX "APIKey_prefix_idx" ON "public"."APIKey"("prefix");

-- CreateIndex
CREATE INDEX "APIKey_userId_revokedAt_idx" ON "public"."APIKey"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "APIUsageRecord_keyId_createdAt_idx" ON "public"."APIUsageRecord"("keyId", "createdAt");

-- CreateIndex
CREATE INDEX "APIUsageRecord_createdAt_idx" ON "public"."APIUsageRecord"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_code_key" ON "public"."Referral"("code");

-- CreateIndex
CREATE INDEX "Referral_referrerId_status_idx" ON "public"."Referral"("referrerId", "status");

-- CreateIndex
CREATE INDEX "Referral_code_idx" ON "public"."Referral"("code");

-- CreateIndex
CREATE INDEX "AggregateOutcome_protocolId_period_idx" ON "public"."AggregateOutcome"("protocolId", "period");

-- CreateIndex
CREATE INDEX "AggregateOutcome_compoundId_period_idx" ON "public"."AggregateOutcome"("compoundId", "period");

-- CreateIndex
CREATE INDEX "AggregateOutcome_cohortBucket_computedAt_idx" ON "public"."AggregateOutcome"("cohortBucket", "computedAt");

-- CreateIndex
CREATE INDEX "FederatedModel_status_taskType_idx" ON "public"."FederatedModel"("status", "taskType");

-- CreateIndex
CREATE INDEX "FederatedModel_taskType_version_idx" ON "public"."FederatedModel"("taskType", "version");

-- CreateIndex
CREATE UNIQUE INDEX "FederatedModel_version_taskType_key" ON "public"."FederatedModel"("version", "taskType");

-- CreateIndex
CREATE INDEX "FLParticipation_modelId_round_idx" ON "public"."FLParticipation"("modelId", "round");

-- CreateIndex
CREATE INDEX "FLParticipation_userId_createdAt_idx" ON "public"."FLParticipation"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FLParticipation_userId_modelId_round_key" ON "public"."FLParticipation"("userId", "modelId", "round");

-- CreateIndex
CREATE INDEX "AgentSession_userId_idx" ON "public"."AgentSession"("userId");

-- CreateIndex
CREATE INDEX "AgentSession_tenantId_idx" ON "public"."AgentSession"("tenantId");

-- CreateIndex
CREATE INDEX "AgentSession_status_idx" ON "public"."AgentSession"("status");

-- CreateIndex
CREATE INDEX "AgentStepLog_sessionId_idx" ON "public"."AgentStepLog"("sessionId");

-- CreateIndex
CREATE INDEX "DriftSweep_userId_ranAt_idx" ON "public"."DriftSweep"("userId", "ranAt");

-- CreateIndex
CREATE INDEX "DriftSweep_tenantId_ranAt_idx" ON "public"."DriftSweep"("tenantId", "ranAt");

-- CreateIndex
CREATE INDEX "DriftNotification_userId_readAt_idx" ON "public"."DriftNotification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "DriftNotification_userId_createdAt_idx" ON "public"."DriftNotification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GovernancePolicy_category_key" ON "public"."GovernancePolicy"("category");

-- CreateIndex
CREATE INDEX "GovernanceAuditLog_sessionId_idx" ON "public"."GovernanceAuditLog"("sessionId");

-- CreateIndex
CREATE INDEX "GovernanceAuditLog_userId_createdAt_idx" ON "public"."GovernanceAuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "GovernanceAuditLog_decision_createdAt_idx" ON "public"."GovernanceAuditLog"("decision", "createdAt");

-- CreateIndex
CREATE INDEX "ClinicalSignature_sessionId_idx" ON "public"."ClinicalSignature"("sessionId");

-- CreateIndex
CREATE INDEX "ClinicalSignature_clinicianId_signedAt_idx" ON "public"."ClinicalSignature"("clinicianId", "signedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalSignature_reviewItemId_clinicianId_key" ON "public"."ClinicalSignature"("reviewItemId", "clinicianId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminImpersonationSession_adminUserId_key" ON "public"."AdminImpersonationSession"("adminUserId");

-- CreateIndex
CREATE INDEX "AdminImpersonationSession_targetUserId_idx" ON "public"."AdminImpersonationSession"("targetUserId");

-- CreateIndex
CREATE INDEX "AdminImpersonationSession_expiresAt_idx" ON "public"."AdminImpersonationSession"("expiresAt");

-- CreateIndex
CREATE INDEX "OmicsAssayBatch_tenantId_kind_runDate_idx" ON "public"."OmicsAssayBatch"("tenantId", "kind", "runDate");

-- CreateIndex
CREATE INDEX "OmicsSample_userId_collectedAt_idx" ON "public"."OmicsSample"("userId", "collectedAt");

-- CreateIndex
CREATE INDEX "OmicsSample_tenantId_sampleType_idx" ON "public"."OmicsSample"("tenantId", "sampleType");

-- CreateIndex
CREATE INDEX "OmicsMeasurement_sampleId_idx" ON "public"."OmicsMeasurement"("sampleId");

-- CreateIndex
CREATE INDEX "OmicsMeasurement_tenantId_analyteCode_idx" ON "public"."OmicsMeasurement"("tenantId", "analyteCode");

-- CreateIndex
CREATE INDEX "OmicsMeasurement_tenantId_geneSymbol_idx" ON "public"."OmicsMeasurement"("tenantId", "geneSymbol");

-- CreateIndex
CREATE INDEX "OmicsMeasurement_tenantId_cpgSite_idx" ON "public"."OmicsMeasurement"("tenantId", "cpgSite");

-- CreateIndex
CREATE INDEX "PolygenicScore_userId_trait_idx" ON "public"."PolygenicScore"("userId", "trait");

-- CreateIndex
CREATE INDEX "MendelianRandomizationFinding_exposure_outcome_idx" ON "public"."MendelianRandomizationFinding"("exposure", "outcome");

-- CreateIndex
CREATE INDEX "MendelianRandomizationFinding_userId_idx" ON "public"."MendelianRandomizationFinding"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PhysiologicalTwin_userId_key" ON "public"."PhysiologicalTwin"("userId");

-- CreateIndex
CREATE INDEX "PhysiologicalTwin_tenantId_idx" ON "public"."PhysiologicalTwin"("tenantId");

-- CreateIndex
CREATE INDEX "TwinSimulationRun_userId_endpoint_createdAt_idx" ON "public"."TwinSimulationRun"("userId", "endpoint", "createdAt");

-- CreateIndex
CREATE INDEX "TwinSimulationRun_inputsHash_idx" ON "public"."TwinSimulationRun"("inputsHash");

-- CreateIndex
CREATE INDEX "TwinSimulationRun_predictionExpiresAt_twinAccuracyScore_idx" ON "public"."TwinSimulationRun"("predictionExpiresAt", "twinAccuracyScore");

-- CreateIndex
CREATE INDEX "NofOneTrial_userId_status_idx" ON "public"."NofOneTrial"("userId", "status");

-- CreateIndex
CREATE INDEX "NofOneTrial_tenantId_status_idx" ON "public"."NofOneTrial"("tenantId", "status");

-- CreateIndex
CREATE INDEX "NofOneArm_trialId_idx" ON "public"."NofOneArm"("trialId");

-- CreateIndex
CREATE INDEX "NofOnePeriod_trialId_orderIndex_idx" ON "public"."NofOnePeriod"("trialId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "PharmacogenomicProfile_userId_key" ON "public"."PharmacogenomicProfile"("userId");

-- CreateIndex
CREATE INDEX "PharmacogenomicProfile_tenantId_idx" ON "public"."PharmacogenomicProfile"("tenantId");

-- CreateIndex
CREATE INDEX "DrugDrugInteraction_drugA_idx" ON "public"."DrugDrugInteraction"("drugA");

-- CreateIndex
CREATE INDEX "DrugDrugInteraction_drugB_idx" ON "public"."DrugDrugInteraction"("drugB");

-- CreateIndex
CREATE UNIQUE INDEX "DrugDrugInteraction_drugA_drugB_mechanism_key" ON "public"."DrugDrugInteraction"("drugA", "drugB", "mechanism");

-- CreateIndex
CREATE INDEX "KgNode_tenantId_kind_idx" ON "public"."KgNode"("tenantId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "KgNode_tenantId_kind_externalId_key" ON "public"."KgNode"("tenantId", "kind", "externalId");

-- CreateIndex
CREATE INDEX "KgEdge_fromNodeId_edgeType_idx" ON "public"."KgEdge"("fromNodeId", "edgeType");

-- CreateIndex
CREATE INDEX "KgEdge_toNodeId_edgeType_idx" ON "public"."KgEdge"("toNodeId", "edgeType");

-- CreateIndex
CREATE INDEX "KgEdge_tenantId_edgeType_evidenceGrade_idx" ON "public"."KgEdge"("tenantId", "edgeType", "evidenceGrade");

-- CreateIndex
CREATE INDEX "TumorProfile_userId_diagnosedAt_idx" ON "public"."TumorProfile"("userId", "diagnosedAt");

-- CreateIndex
CREATE INDEX "CtdnaTimepoint_tumorProfileId_measuredAt_idx" ON "public"."CtdnaTimepoint"("tumorProfileId", "measuredAt");

-- CreateIndex
CREATE INDEX "RecistAssessment_tumorProfileId_assessedAt_idx" ON "public"."RecistAssessment"("tumorProfileId", "assessedAt");

-- CreateIndex
CREATE INDEX "TranscriptomicSignature_userId_idx" ON "public"."TranscriptomicSignature"("userId");

-- CreateIndex
CREATE INDEX "DrugRepurposingScore_signatureId_cmapScore_idx" ON "public"."DrugRepurposingScore"("signatureId", "cmapScore");

-- CreateIndex
CREATE INDEX "DrugRepurposingScore_compoundId_idx" ON "public"."DrugRepurposingScore"("compoundId");

-- CreateIndex
CREATE INDEX "AgentClaim_sessionId_idx" ON "public"."AgentClaim"("sessionId");

-- CreateIndex
CREATE INDEX "AgentClaim_tenantId_agentClass_createdAt_idx" ON "public"."AgentClaim"("tenantId", "agentClass", "createdAt");

-- CreateIndex
CREATE INDEX "CdiscOdmExport_tenantId_studyOid_idx" ON "public"."CdiscOdmExport"("tenantId", "studyOid");

-- CreateIndex
CREATE INDEX "LabResultReconciliation_tenantId_status_idx" ON "public"."LabResultReconciliation"("tenantId", "status");

-- CreateIndex
CREATE INDEX "LabResultReconciliation_externalOrderId_idx" ON "public"."LabResultReconciliation"("externalOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentPromptVersion_contentHash_key" ON "public"."AgentPromptVersion"("contentHash");

-- CreateIndex
CREATE INDEX "AgentPromptVersion_agentClass_active_idx" ON "public"."AgentPromptVersion"("agentClass", "active");

-- CreateIndex
CREATE UNIQUE INDEX "AgentSessionReplayManifest_sessionId_key" ON "public"."AgentSessionReplayManifest"("sessionId");

-- CreateIndex
CREATE INDEX "AgentSessionReplayManifest_scratchpadHash_idx" ON "public"."AgentSessionReplayManifest"("scratchpadHash");

-- CreateIndex
CREATE INDEX "JurisdictionGateDecision_sessionId_idx" ON "public"."JurisdictionGateDecision"("sessionId");

-- CreateIndex
CREATE INDEX "JurisdictionGateDecision_tenantId_jurisdiction_decision_idx" ON "public"."JurisdictionGateDecision"("tenantId", "jurisdiction", "decision");

-- CreateIndex
CREATE INDEX "EvalBenchRun_benchName_ranAt_idx" ON "public"."EvalBenchRun"("benchName", "ranAt");

-- CreateIndex
CREATE INDEX "ExperimentCandidate_userId_status_idx" ON "public"."ExperimentCandidate"("userId", "status");

-- CreateIndex
CREATE INDEX "ExperimentCandidate_userId_createdAt_idx" ON "public"."ExperimentCandidate"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ExperimentCandidate_chemblId_idx" ON "public"."ExperimentCandidate"("chemblId");

-- CreateIndex
CREATE INDEX "ExperimentCandidate_tenantId_status_idx" ON "public"."ExperimentCandidate"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ExperimentCandidateEvent_candidateId_createdAt_idx" ON "public"."ExperimentCandidateEvent"("candidateId", "createdAt");

-- CreateIndex
CREATE INDEX "ExperimentCandidateEvent_actorUserId_idx" ON "public"."ExperimentCandidateEvent"("actorUserId");

-- CreateIndex
CREATE INDEX "CandidateLabResult_candidateId_assayName_idx" ON "public"."CandidateLabResult"("candidateId", "assayName");

-- CreateIndex
CREATE INDEX "CandidateLabResult_candidateId_measuredAt_idx" ON "public"."CandidateLabResult"("candidateId", "measuredAt");

-- CreateIndex
CREATE INDEX "CandidateLabResult_submissionId_idx" ON "public"."CandidateLabResult"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "LabSubmission_tokenHash_key" ON "public"."LabSubmission"("tokenHash");

-- CreateIndex
CREATE INDEX "LabSubmission_candidateId_idx" ON "public"."LabSubmission"("candidateId");

-- CreateIndex
CREATE INDEX "LabSubmission_userId_status_idx" ON "public"."LabSubmission"("userId", "status");

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

-- CreateIndex
CREATE INDEX "CandidateFeedbackRun_candidateId_idx" ON "public"."CandidateFeedbackRun"("candidateId");

-- CreateIndex
CREATE INDEX "CandidateFeedbackRun_userId_idx" ON "public"."CandidateFeedbackRun"("userId");

-- CreateIndex
CREATE INDEX "PilotMetricsSnapshot_userId_computedAt_idx" ON "public"."PilotMetricsSnapshot"("userId", "computedAt");

-- CreateIndex
CREATE INDEX "ExternalScreeningAdapter_userId_idx" ON "public"."ExternalScreeningAdapter"("userId");

-- CreateIndex
CREATE INDEX "ExternalScreeningAdapter_tenantId_idx" ON "public"."ExternalScreeningAdapter"("tenantId");

-- CreateIndex
CREATE INDEX "ExternalScreeningRun_adapterId_createdAt_idx" ON "public"."ExternalScreeningRun"("adapterId", "createdAt");

-- CreateIndex
CREATE INDEX "ExternalScreeningRun_candidateId_idx" ON "public"."ExternalScreeningRun"("candidateId");

-- CreateIndex
CREATE INDEX "LoopCycle_userId_status_createdAt_idx" ON "public"."LoopCycle"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "LoopCycle_tenantId_status_createdAt_idx" ON "public"."LoopCycle"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PhysiologicalSnapshot_userId_materializedAt_idx" ON "public"."PhysiologicalSnapshot"("userId", "materializedAt");

-- CreateIndex
CREATE INDEX "PhysiologicalSnapshot_tenantId_materializedAt_idx" ON "public"."PhysiologicalSnapshot"("tenantId", "materializedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProtocolOutcome_loopCycleId_key" ON "public"."ProtocolOutcome"("loopCycleId");

-- CreateIndex
CREATE INDEX "ProtocolOutcome_userId_createdAt_idx" ON "public"."ProtocolOutcome"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ProtocolOutcome_loopCycleId_idx" ON "public"."ProtocolOutcome"("loopCycleId");

-- CreateIndex
CREATE UNIQUE INDEX "ReflectionReport_loopCycleId_key" ON "public"."ReflectionReport"("loopCycleId");

-- CreateIndex
CREATE INDEX "ReflectionReport_userId_createdAt_idx" ON "public"."ReflectionReport"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserTwinPrior_userId_idx" ON "public"."UserTwinPrior"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserTwinPrior_userId_compoundId_outcomeKey_key" ON "public"."UserTwinPrior"("userId", "compoundId", "outcomeKey");

-- CreateIndex
CREATE INDEX "ProtocolVersion_protocolId_status_idx" ON "public"."ProtocolVersion"("protocolId", "status");

-- CreateIndex
CREATE INDEX "ProtocolVersion_userId_createdAt_idx" ON "public"."ProtocolVersion"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProtocolVersion_protocolId_version_key" ON "public"."ProtocolVersion"("protocolId", "version");

-- CreateIndex
CREATE INDEX "UserPkProfile_userId_idx" ON "public"."UserPkProfile"("userId");

-- CreateIndex
CREATE INDEX "UserPkProfile_compoundId_idx" ON "public"."UserPkProfile"("compoundId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPkProfile_userId_compoundId_key" ON "public"."UserPkProfile"("userId", "compoundId");

-- CreateIndex
CREATE INDEX "FederatedNode_tenantId_active_idx" ON "public"."FederatedNode"("tenantId", "active");

-- CreateIndex
CREATE INDEX "FederatedNode_jurisdiction_idx" ON "public"."FederatedNode"("jurisdiction");

-- CreateIndex
CREATE INDEX "FederationConsent_userId_idx" ON "public"."FederationConsent"("userId");

-- CreateIndex
CREATE INDEX "FederationConsent_nodeId_revokedAt_idx" ON "public"."FederationConsent"("nodeId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FederationConsent_userId_nodeId_key" ON "public"."FederationConsent"("userId", "nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPrivacyBudget_userId_key" ON "public"."UserPrivacyBudget"("userId");

-- CreateIndex
CREATE INDEX "UserPrivacyBudget_periodEnd_idx" ON "public"."UserPrivacyBudget"("periodEnd");

-- CreateIndex
CREATE INDEX "ProtocolFork_sourceProtocolId_idx" ON "public"."ProtocolFork"("sourceProtocolId");

-- CreateIndex
CREATE INDEX "ProtocolFork_forkedByUserId_idx" ON "public"."ProtocolFork"("forkedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "IrbApproval_token_key" ON "public"."IrbApproval"("token");

-- CreateIndex
CREATE INDEX "IrbApproval_userId_expiresAt_idx" ON "public"."IrbApproval"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "IrbApproval_token_idx" ON "public"."IrbApproval"("token");

-- CreateIndex
CREATE INDEX "ClinicianCoSign_resourceType_resourceId_idx" ON "public"."ClinicianCoSign"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "ClinicianCoSign_clinicianId_idx" ON "public"."ClinicianCoSign"("clinicianId");

-- CreateIndex
CREATE INDEX "ClinicianCoSign_signedAt_idx" ON "public"."ClinicianCoSign"("signedAt");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_defaultTenantId_fkey" FOREIGN KEY ("defaultTenantId") REFERENCES "public"."Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserMfaSecret" ADD CONSTRAINT "UserMfaSecret_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ActiveSession" ADD CONSTRAINT "ActiveSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Organization" ADD CONSTRAINT "Organization_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserConsentGrant" ADD CONSTRAINT "UserConsentGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BillingRecord" ADD CONSTRAINT "BillingRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BillingRecord" ADD CONSTRAINT "BillingRecord_consultationRequestId_fkey" FOREIGN KEY ("consultationRequestId") REFERENCES "public"."ConsultationRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BillingRecord" ADD CONSTRAINT "BillingRecord_labOrderId_fkey" FOREIGN KEY ("labOrderId") REFERENCES "public"."LabOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Biomarker" ADD CONSTRAINT "Biomarker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Biomarker" ADD CONSTRAINT "Biomarker_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "public"."Protocol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Protocol" ADD CONSTRAINT "Protocol_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Protocol" ADD CONSTRAINT "Protocol_forkedFromId_fkey" FOREIGN KEY ("forkedFromId") REFERENCES "public"."Protocol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReviewItem" ADD CONSTRAINT "ReviewItem_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchCollection" ADD CONSTRAINT "ResearchCollection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResearchEntry" ADD CONSTRAINT "ResearchEntry_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "public"."ResearchCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EvidenceRecord" ADD CONSTRAINT "EvidenceRecord_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EvidenceRecord" ADD CONSTRAINT "EvidenceRecord_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EvidenceRecord" ADD CONSTRAINT "EvidenceRecord_assignedReviewerId_fkey" FOREIGN KEY ("assignedReviewerId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EvidenceRecord" ADD CONSTRAINT "EvidenceRecord_researchEntryId_fkey" FOREIGN KEY ("researchEntryId") REFERENCES "public"."ResearchEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Hypothesis" ADD CONSTRAINT "Hypothesis_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EvidenceReviewEvent" ADD CONSTRAINT "EvidenceReviewEvent_evidenceRecordId_fkey" FOREIGN KEY ("evidenceRecordId") REFERENCES "public"."EvidenceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EvidenceReviewEvent" ADD CONSTRAINT "EvidenceReviewEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HypothesisPriorityChange" ADD CONSTRAINT "HypothesisPriorityChange_hypothesisId_fkey" FOREIGN KEY ("hypothesisId") REFERENCES "public"."Hypothesis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HypothesisPriorityChange" ADD CONSTRAINT "HypothesisPriorityChange_evidenceReviewEventId_fkey" FOREIGN KEY ("evidenceReviewEventId") REFERENCES "public"."EvidenceReviewEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HypothesisPriorityChange" ADD CONSTRAINT "HypothesisPriorityChange_evidenceRecordId_fkey" FOREIGN KEY ("evidenceRecordId") REFERENCES "public"."EvidenceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HypothesisEvidence" ADD CONSTRAINT "HypothesisEvidence_hypothesisId_fkey" FOREIGN KEY ("hypothesisId") REFERENCES "public"."Hypothesis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HypothesisEvidence" ADD CONSTRAINT "HypothesisEvidence_evidenceRecordId_fkey" FOREIGN KEY ("evidenceRecordId") REFERENCES "public"."EvidenceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PatientCohort" ADD CONSTRAINT "PatientCohort_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AIResearchRun" ADD CONSTRAINT "AIResearchRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClinicianTask" ADD CONSTRAINT "ClinicianTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Medication" ADD CONSTRAINT "Medication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PartnerDataRecord" ADD CONSTRAINT "PartnerDataRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompoundPathway" ADD CONSTRAINT "CompoundPathway_compoundId_fkey" FOREIGN KEY ("compoundId") REFERENCES "public"."Compound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompoundPathway" ADD CONSTRAINT "CompoundPathway_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "public"."Pathway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompoundInteraction" ADD CONSTRAINT "CompoundInteraction_compoundAId_fkey" FOREIGN KEY ("compoundAId") REFERENCES "public"."Compound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompoundInteraction" ADD CONSTRAINT "CompoundInteraction_compoundBId_fkey" FOREIGN KEY ("compoundBId") REFERENCES "public"."Compound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompoundBiomarkerEffect" ADD CONSTRAINT "CompoundBiomarkerEffect_compoundId_fkey" FOREIGN KEY ("compoundId") REFERENCES "public"."Compound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompoundStudyLink" ADD CONSTRAINT "CompoundStudyLink_compoundId_fkey" FOREIGN KEY ("compoundId") REFERENCES "public"."Compound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MechanisticModel" ADD CONSTRAINT "MechanisticModel_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ModelConfidenceScore" ADD CONSTRAINT "ModelConfidenceScore_mechanisticModelId_fkey" FOREIGN KEY ("mechanisticModelId") REFERENCES "public"."MechanisticModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CommunityPost" ADD CONSTRAINT "CommunityPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LearnArticle" ADD CONSTRAINT "LearnArticle_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LabOrder" ADD CONSTRAINT "LabOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LabOrder" ADD CONSTRAINT "LabOrder_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "public"."LabTestPanel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LabResult" ADD CONSTRAINT "LabResult_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."LabOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LabResult" ADD CONSTRAINT "LabResult_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "public"."Protocol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConsultationRequest" ADD CONSTRAINT "ConsultationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConsultationRequest" ADD CONSTRAINT "ConsultationRequest_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "public"."TelehealthProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdverseEventReport" ADD CONSTRAINT "AdverseEventReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdverseEventReport" ADD CONSTRAINT "AdverseEventReport_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "public"."Protocol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AeonForgeCandidate" ADD CONSTRAINT "AeonForgeCandidate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SimulationResult" ADD CONSTRAINT "SimulationResult_aeonForgeCandidateId_fkey" FOREIGN KEY ("aeonForgeCandidateId") REFERENCES "public"."AeonForgeCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VirtualTwinRun" ADD CONSTRAINT "VirtualTwinRun_aeonForgeCandidateId_fkey" FOREIGN KEY ("aeonForgeCandidateId") REFERENCES "public"."AeonForgeCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrchestrationJob" ADD CONSTRAINT "OrchestrationJob_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrchestrationJob" ADD CONSTRAINT "OrchestrationJob_parentJobId_fkey" FOREIGN KEY ("parentJobId") REFERENCES "public"."OrchestrationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceOrderItem" ADD CONSTRAINT "MarketplaceOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."MarketplaceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceOrderItem" ADD CONSTRAINT "MarketplaceOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InterventionOutcome" ADD CONSTRAINT "InterventionOutcome_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InterventionOutcome" ADD CONSTRAINT "InterventionOutcome_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "public"."Protocol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrialMatch" ADD CONSTRAINT "TrialMatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrialMatch" ADD CONSTRAINT "TrialMatch_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "public"."PatientCohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrialMatch" ADD CONSTRAINT "TrialMatch_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrialMatchReviewEvent" ADD CONSTRAINT "TrialMatchReviewEvent_trialMatchId_fkey" FOREIGN KEY ("trialMatchId") REFERENCES "public"."TrialMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrialMatchReviewEvent" ADD CONSTRAINT "TrialMatchReviewEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceScientist" ADD CONSTRAINT "MarketplaceScientist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceSponsor" ADD CONSTRAINT "MarketplaceSponsor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceSponsor" ADD CONSTRAINT "MarketplaceSponsor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceDiscovery" ADD CONSTRAINT "MarketplaceDiscovery_scientistId_fkey" FOREIGN KEY ("scientistId") REFERENCES "public"."MarketplaceScientist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceFundingRequest" ADD CONSTRAINT "MarketplaceFundingRequest_discoveryId_fkey" FOREIGN KEY ("discoveryId") REFERENCES "public"."MarketplaceDiscovery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceFundingRequest" ADD CONSTRAINT "MarketplaceFundingRequest_scientistId_fkey" FOREIGN KEY ("scientistId") REFERENCES "public"."MarketplaceScientist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceMatchScore" ADD CONSTRAINT "MarketplaceMatchScore_discoveryId_fkey" FOREIGN KEY ("discoveryId") REFERENCES "public"."MarketplaceDiscovery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceMatchScore" ADD CONSTRAINT "MarketplaceMatchScore_scientistId_fkey" FOREIGN KEY ("scientistId") REFERENCES "public"."MarketplaceScientist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceMatchScore" ADD CONSTRAINT "MarketplaceMatchScore_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "public"."MarketplaceSponsor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceDealRoom" ADD CONSTRAINT "MarketplaceDealRoom_discoveryId_fkey" FOREIGN KEY ("discoveryId") REFERENCES "public"."MarketplaceDiscovery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceDealRoom" ADD CONSTRAINT "MarketplaceDealRoom_scientistId_fkey" FOREIGN KEY ("scientistId") REFERENCES "public"."MarketplaceScientist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceDealRoom" ADD CONSTRAINT "MarketplaceDealRoom_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "public"."MarketplaceSponsor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceMessageThread" ADD CONSTRAINT "MarketplaceMessageThread_dealRoomId_fkey" FOREIGN KEY ("dealRoomId") REFERENCES "public"."MarketplaceDealRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceMessageThread" ADD CONSTRAINT "MarketplaceMessageThread_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceTransaction" ADD CONSTRAINT "MarketplaceTransaction_dealRoomId_fkey" FOREIGN KEY ("dealRoomId") REFERENCES "public"."MarketplaceDealRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceTransaction" ADD CONSTRAINT "MarketplaceTransaction_discoveryId_fkey" FOREIGN KEY ("discoveryId") REFERENCES "public"."MarketplaceDiscovery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceTransaction" ADD CONSTRAINT "MarketplaceTransaction_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "public"."MarketplaceSponsor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceAuditLog" ADD CONSTRAINT "MarketplaceAuditLog_dealRoomId_fkey" FOREIGN KEY ("dealRoomId") REFERENCES "public"."MarketplaceDealRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceAuditLog" ADD CONSTRAINT "MarketplaceAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceNotification" ADD CONSTRAINT "MarketplaceNotification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceNotification" ADD CONSTRAINT "MarketplaceNotification_discoveryId_fkey" FOREIGN KEY ("discoveryId") REFERENCES "public"."MarketplaceDiscovery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceNotification" ADD CONSTRAINT "MarketplaceNotification_dealRoomId_fkey" FOREIGN KEY ("dealRoomId") REFERENCES "public"."MarketplaceDealRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrustScore" ADD CONSTRAINT "TrustScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TimelineEntry" ADD CONSTRAINT "TimelineEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FeedbackLoopSnapshot" ADD CONSTRAINT "FeedbackLoopSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BiologicalAgeSnapshot" ADD CONSTRAINT "BiologicalAgeSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserXP" ADD CONSTRAINT "UserXP_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserStreak" ADD CONSTRAINT "UserStreak_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserAchievement" ADD CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "public"."Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WearableConnection" ADD CONSTRAINT "WearableConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PendingGraphContribution" ADD CONSTRAINT "PendingGraphContribution_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."APIKey" ADD CONSTRAINT "APIKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."APIUsageRecord" ADD CONSTRAINT "APIUsageRecord_keyId_fkey" FOREIGN KEY ("keyId") REFERENCES "public"."APIKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Referral" ADD CONSTRAINT "Referral_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AggregateOutcome" ADD CONSTRAINT "AggregateOutcome_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "public"."Protocol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AggregateOutcome" ADD CONSTRAINT "AggregateOutcome_compoundId_fkey" FOREIGN KEY ("compoundId") REFERENCES "public"."Compound"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FLParticipation" ADD CONSTRAINT "FLParticipation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FLParticipation" ADD CONSTRAINT "FLParticipation_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "public"."FederatedModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AgentSession" ADD CONSTRAINT "AgentSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AgentSession" ADD CONSTRAINT "AgentSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AgentStepLog" ADD CONSTRAINT "AgentStepLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."AgentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DriftSweep" ADD CONSTRAINT "DriftSweep_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DriftNotification" ADD CONSTRAINT "DriftNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OmicsSample" ADD CONSTRAINT "OmicsSample_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OmicsSample" ADD CONSTRAINT "OmicsSample_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "public"."OmicsAssayBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OmicsMeasurement" ADD CONSTRAINT "OmicsMeasurement_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "public"."OmicsSample"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PolygenicScore" ADD CONSTRAINT "PolygenicScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MendelianRandomizationFinding" ADD CONSTRAINT "MendelianRandomizationFinding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PhysiologicalTwin" ADD CONSTRAINT "PhysiologicalTwin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TwinSimulationRun" ADD CONSTRAINT "TwinSimulationRun_twinId_fkey" FOREIGN KEY ("twinId") REFERENCES "public"."PhysiologicalTwin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NofOneTrial" ADD CONSTRAINT "NofOneTrial_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NofOneArm" ADD CONSTRAINT "NofOneArm_trialId_fkey" FOREIGN KEY ("trialId") REFERENCES "public"."NofOneTrial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NofOnePeriod" ADD CONSTRAINT "NofOnePeriod_trialId_fkey" FOREIGN KEY ("trialId") REFERENCES "public"."NofOneTrial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PharmacogenomicProfile" ADD CONSTRAINT "PharmacogenomicProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KgEdge" ADD CONSTRAINT "KgEdge_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "public"."KgNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KgEdge" ADD CONSTRAINT "KgEdge_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "public"."KgNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TumorProfile" ADD CONSTRAINT "TumorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CtdnaTimepoint" ADD CONSTRAINT "CtdnaTimepoint_tumorProfileId_fkey" FOREIGN KEY ("tumorProfileId") REFERENCES "public"."TumorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RecistAssessment" ADD CONSTRAINT "RecistAssessment_tumorProfileId_fkey" FOREIGN KEY ("tumorProfileId") REFERENCES "public"."TumorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TranscriptomicSignature" ADD CONSTRAINT "TranscriptomicSignature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DrugRepurposingScore" ADD CONSTRAINT "DrugRepurposingScore_signatureId_fkey" FOREIGN KEY ("signatureId") REFERENCES "public"."TranscriptomicSignature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExperimentCandidate" ADD CONSTRAINT "ExperimentCandidate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExperimentCandidate" ADD CONSTRAINT "ExperimentCandidate_aeonForgeCandidateId_fkey" FOREIGN KEY ("aeonForgeCandidateId") REFERENCES "public"."AeonForgeCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExperimentCandidateEvent" ADD CONSTRAINT "ExperimentCandidateEvent_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "public"."ExperimentCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExperimentCandidateEvent" ADD CONSTRAINT "ExperimentCandidateEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CandidateLabResult" ADD CONSTRAINT "CandidateLabResult_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "public"."ExperimentCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CandidateLabResult" ADD CONSTRAINT "CandidateLabResult_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "public"."LabSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LabSubmission" ADD CONSTRAINT "LabSubmission_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "public"."ExperimentCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LabSubmission" ADD CONSTRAINT "LabSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CroWorkOrder" ADD CONSTRAINT "CroWorkOrder_croPartnerId_fkey" FOREIGN KEY ("croPartnerId") REFERENCES "public"."CroPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CroWorkOrderEvent" ADD CONSTRAINT "CroWorkOrderEvent_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "public"."CroWorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CandidateFeedbackRun" ADD CONSTRAINT "CandidateFeedbackRun_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "public"."ExperimentCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CandidateFeedbackRun" ADD CONSTRAINT "CandidateFeedbackRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PilotMetricsSnapshot" ADD CONSTRAINT "PilotMetricsSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExternalScreeningAdapter" ADD CONSTRAINT "ExternalScreeningAdapter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExternalScreeningRun" ADD CONSTRAINT "ExternalScreeningRun_adapterId_fkey" FOREIGN KEY ("adapterId") REFERENCES "public"."ExternalScreeningAdapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LoopCycle" ADD CONSTRAINT "LoopCycle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LoopCycle" ADD CONSTRAINT "LoopCycle_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "public"."PhysiologicalSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PhysiologicalSnapshot" ADD CONSTRAINT "PhysiologicalSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProtocolOutcome" ADD CONSTRAINT "ProtocolOutcome_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProtocolOutcome" ADD CONSTRAINT "ProtocolOutcome_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "public"."Protocol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProtocolOutcome" ADD CONSTRAINT "ProtocolOutcome_loopCycleId_fkey" FOREIGN KEY ("loopCycleId") REFERENCES "public"."LoopCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReflectionReport" ADD CONSTRAINT "ReflectionReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReflectionReport" ADD CONSTRAINT "ReflectionReport_loopCycleId_fkey" FOREIGN KEY ("loopCycleId") REFERENCES "public"."LoopCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserTwinPrior" ADD CONSTRAINT "UserTwinPrior_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProtocolVersion" ADD CONSTRAINT "ProtocolVersion_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "public"."Protocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProtocolVersion" ADD CONSTRAINT "ProtocolVersion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserPkProfile" ADD CONSTRAINT "UserPkProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FederationConsent" ADD CONSTRAINT "FederationConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FederationConsent" ADD CONSTRAINT "FederationConsent_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "public"."FederatedNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserPrivacyBudget" ADD CONSTRAINT "UserPrivacyBudget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProtocolFork" ADD CONSTRAINT "ProtocolFork_sourceProtocolId_fkey" FOREIGN KEY ("sourceProtocolId") REFERENCES "public"."Protocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProtocolFork" ADD CONSTRAINT "ProtocolFork_forkedByUserId_fkey" FOREIGN KEY ("forkedByUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IrbApproval" ADD CONSTRAINT "IrbApproval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClinicianCoSign" ADD CONSTRAINT "ClinicianCoSign_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

