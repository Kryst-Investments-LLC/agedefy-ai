export const MARKETPLACE_ROLES = ["scientist", "sponsor", "reviewer", "admin"] as const

export const MARKETPLACE_ENTITY_NAMES = [
  "scientists",
  "sponsors",
  "discoveries",
  "fundingRequests",
  "matchScores",
  "dealRooms",
  "messageThreads",
  "transactions",
  "auditLogs",
  "notifications",
] as const

export const MARKETPLACE_PERMISSIONS = [
  "publishDiscovery",
  "fundProject",
  "viewDealRoom",
  "messageDealRoom",
  "approveAgreement",
  "manageScientistProfile",
  "manageSponsorProfile",
  "manageFundingRequest",
  "manageDiscovery",
  "manageMatchScore",
  "manageDealRoom",
  "manageTransaction",
  "readAuditLog",
  "manageNotification",
] as const

export const DISCOVERY_CATEGORIES = [
  "Longevity",
  "Diagnostics",
  "Computational Biology",
  "Regenerative Medicine",
  "Therapeutics",
  "Platform Tooling",
] as const

export const DISCOVERY_STAGES = ["concept", "preclinical", "translational", "clinical", "platform"] as const

export const SUBSCRIPTION_TIERS = {
  scout: {
    label: "Scout",
    monthlyCents: 19000,
    platformFeeBps: 900,
    transactionFeeBps: 250,
  },
  growth: {
    label: "Growth",
    monthlyCents: 79000,
    platformFeeBps: 700,
    transactionFeeBps: 175,
  },
  strategic: {
    label: "Strategic",
    monthlyCents: 199000,
    platformFeeBps: 500,
    transactionFeeBps: 125,
  },
} as const

export const DEFAULT_NDA_TERMS = {
  confidentialityWindowDays: 730,
  ipOwnership: "Scientist retains background IP; foreground IP governed by executed agreement.",
  disclosureScope: "Confidential materials may be used solely for deal evaluation and diligence.",
  exportControlClause: "Parties must comply with applicable export-control and sanctions rules.",
}
