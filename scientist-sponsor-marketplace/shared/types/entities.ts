import type { MARKETPLACE_ENTITY_NAMES, MARKETPLACE_PERMISSIONS, MARKETPLACE_ROLES } from "@/scientist-sponsor-marketplace/shared/constants"

export type MarketplaceRole = (typeof MARKETPLACE_ROLES)[number]
export type MarketplacePermission = (typeof MARKETPLACE_PERMISSIONS)[number]
export type MarketplaceEntityName = (typeof MARKETPLACE_ENTITY_NAMES)[number]

export interface Scientist {
  id: string
  userId: string
  displayName: string
  institution: string | null
  specialty: string | null
  biography: string | null
  categories: string[]
  fundingStage: string
  reputationScore: number
  evidenceCount: number
  publishedDiscoveryCount: number
  createdAt: string
  updatedAt: string
}

export interface Sponsor {
  id: string
  userId: string
  organizationName: string
  organizationType: string
  thesis: string
  preferredCategories: string[]
  preferredStages: string[]
  maxBudgetCents: number
  minImpactScore: number
  capitalAvailableCents: number
  dueDiligenceLevel: string
  geographyFocus: string[]
  assayCapabilities: string[]
  labType: string | null
  createdAt: string
  updatedAt: string
}

export interface Discovery {
  id: string
  scientistId: string
  title: string
  slug: string
  category: string
  summary: string
  developmentStage: string
  status: "DRAFT" | "REVIEW" | "PUBLISHED" | "PRIVATE" | "ARCHIVED"
  scientificImpactScore: number
  commercialReadiness: number
  fundingGoalCents: number
  currency: string
  evidenceSummary: string | null
  evidenceLinks: Array<{ label: string; url: string; evidenceType?: string }>
  metadata: Record<string, unknown>
  candidateId: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface FundingRequest {
  id: string
  discoveryId: string
  scientistId: string
  requestedAmountCents: number
  currency: string
  useOfFunds: string
  timelineMonths: number
  status: "DRAFT" | "OPEN" | "DUE_DILIGENCE" | "COMMITTED" | "CLOSED"
  milestonePlan: Array<{ milestone: string; targetDate: string; deliverable: string }>
  evidenceUploads: Array<{ name: string; url: string; kind: string }>
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface MatchScoreBreakdown {
  categoryFit: number
  budgetFit: number
  impactFit: number
  stageFit: number
  evidenceFit: number
  metadataFit: number
  aiSignal: number
}

export interface MatchScore {
  id: string
  discoveryId: string
  scientistId: string
  sponsorId: string
  overallScore: number
  ruleBasedScore: number
  aiAugmentedScore: number | null
  weightedBreakdown: MatchScoreBreakdown
  sponsorPreferenceFit: number
  metadataFit: number
  rationale: string
  rank: number | null
  createdAt: string
  updatedAt: string
}

export interface DealRoom {
  id: string
  discoveryId: string
  scientistId: string
  sponsorId: string
  status: "OPEN" | "NEGOTIATING" | "AGREEMENT_PENDING" | "FUNDED" | "CLOSED"
  ndaRequired: boolean
  ndaAcceptedAt: string | null
  agreementStatus: "DRAFT" | "REVIEW" | "APPROVED" | "SIGNED"
  agreementTerms: Record<string, unknown>
  documentVault: Array<{ name: string; url: string; access: string }>
  lastActivityAt: string
  createdAt: string
  updatedAt: string
}

export interface MessageThread {
  id: string
  dealRoomId: string
  senderUserId: string | null
  senderRole: MarketplaceRole
  messageType: "MESSAGE" | "DOCUMENT" | "AGREEMENT" | "PAYMENT" | "SYSTEM"
  body: string
  attachments: Array<{ name: string; url: string; contentType?: string }>
  readAt: string | null
  createdAt: string
}

export interface Transaction {
  id: string
  dealRoomId: string
  discoveryId: string
  sponsorId: string
  amountCents: number
  currency: string
  platformFeeCents: number
  transactionFeeCents: number
  payoutCents: number
  status: "PENDING" | "AUTHORIZED" | "SETTLED" | "RELEASED" | "FAILED" | "REFUNDED"
  providerReference: string | null
  metadata: Record<string, unknown>
  paidAt: string | null
  createdAt: string
  updatedAt: string
}

export type MarketplacePayoutRejectionCategory = "evidence_gap" | "compliance" | "milestone_scope" | "documentation" | "other"
export type MarketplacePayoutBlockerSeverity = "low" | "medium" | "high" | "critical"

export interface MarketplacePayoutReviewRejection {
  category: MarketplacePayoutRejectionCategory
  blockerSeverity: MarketplacePayoutBlockerSeverity
  rejectionNote: string
  requiredFollowUpAction: string
  reviewedAt?: string | null
  reviewedBy?: string | null
}

export interface AuditLog {
  id: string
  dealRoomId: string | null
  actorUserId: string | null
  actorRole: MarketplaceRole
  action: string
  entityType: string
  entityId: string | null
  ipAddress: string | null
  details: Record<string, unknown>
  createdAt: string
}

export interface Notification {
  id: string
  recipientUserId: string
  recipientRole: MarketplaceRole
  discoveryId: string | null
  dealRoomId: string | null
  type: string
  title: string
  body: string
  actionUrl: string | null
  channels: string[]
  status: "QUEUED" | "DELIVERED" | "READ" | "DISMISSED"
  createdAt: string
  readAt: string | null
}

export interface MarketplaceSessionActor {
  userId: string
  email: string | null
  name: string | null
  globalRole: string
  actingAs: MarketplaceRole
}

export interface DiscoveryFilters {
  category?: string
  maxCostCents?: number
  minImpactScore?: number
  stage?: string
  search?: string
}

export interface RankedMatch {
  discovery: Discovery
  score: MatchScoreBreakdown
  overallScore: number
  ruleBasedScore: number
  aiAugmentedScore: number
  rationale: string
}

export interface BillingQuote {
  subscriptionTier: keyof typeof import("@/scientist-sponsor-marketplace/shared/constants").SUBSCRIPTION_TIERS
  grossAmountCents: number
  platformFeeCents: number
  transactionFeeCents: number
  payoutCents: number
}

export interface ComplianceAssessment {
  isCompliant: boolean
  exportControlRisk: "low" | "medium" | "high"
  ipProtectionActions: string[]
  blockers: string[]
}

export interface NdaPackage {
  title: string
  terms: Record<string, unknown>
  version: string
  generatedAt: string
}

export interface MarketplaceWorkspaceSnapshot {
  actor: MarketplaceSessionActor
  scientist: Scientist | null
  sponsor: Sponsor | null
  discoveries: Discovery[]
  fundingRequests: FundingRequest[]
  scientistMatchScores: MatchScore[]
  sponsorMatchScores: MatchScore[]
  dealRooms: DealRoom[]
  messages: MessageThread[]
  transactions: Transaction[]
  audits: AuditLog[]
  notifications: Notification[]
  permissions: Record<MarketplacePermission, boolean>
  metrics: {
    publishedDiscoveries: number
    openDealRooms: number
    fundedVolumeCents: number
    unreadNotifications: number
  }
}
