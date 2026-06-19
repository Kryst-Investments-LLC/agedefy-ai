-- Moat M1: Federated biomarker graph infrastructure

CREATE TABLE "FederatedNode" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "tenantId"    TEXT NOT NULL DEFAULT 'default',
    "name"        TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "endpoint"    TEXT,
    "publicKey"   TEXT,
    "active"      BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   DATETIME NOT NULL
);
CREATE INDEX "FederatedNode_tenantId_active_idx" ON "FederatedNode" ("tenantId", "active");
CREATE INDEX "FederatedNode_jurisdiction_idx" ON "FederatedNode" ("jurisdiction");

CREATE TABLE "FederationConsent" (
    "id"         TEXT NOT NULL PRIMARY KEY,
    "userId"     TEXT NOT NULL,
    "nodeId"     TEXT NOT NULL,
    "tenantId"   TEXT NOT NULL DEFAULT 'default',
    "scope"      TEXT NOT NULL DEFAULT '[]',
    "grantedAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt"  DATETIME,
    CONSTRAINT "FederationConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
    CONSTRAINT "FederationConsent_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "FederatedNode" ("id")
);
CREATE UNIQUE INDEX "FederationConsent_userId_nodeId_key" ON "FederationConsent" ("userId", "nodeId");
CREATE INDEX "FederationConsent_userId_idx"          ON "FederationConsent" ("userId");
CREATE INDEX "FederationConsent_nodeId_revokedAt_idx" ON "FederationConsent" ("nodeId", "revokedAt");

CREATE TABLE "UserPrivacyBudget" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "userId"      TEXT NOT NULL UNIQUE,
    "tenantId"    TEXT NOT NULL DEFAULT 'default',
    "epsilonUsed" REAL NOT NULL DEFAULT 0,
    "epsilonMax"  REAL NOT NULL DEFAULT 4.0,
    "queryCount"  INTEGER NOT NULL DEFAULT 0,
    "periodStart" DATETIME NOT NULL,
    "periodEnd"   DATETIME NOT NULL,
    "updatedAt"   DATETIME NOT NULL,
    "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserPrivacyBudget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);
CREATE INDEX "UserPrivacyBudget_periodEnd_idx" ON "UserPrivacyBudget" ("periodEnd");

-- Moat M2: Protocol fork fields + fork records table

ALTER TABLE "Protocol" ADD COLUMN "forkCount"    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Protocol" ADD COLUMN "forkedFromId" TEXT;
CREATE INDEX "Protocol_forkCount_idx" ON "Protocol" ("forkCount");

CREATE TABLE "ProtocolFork" (
    "id"               TEXT NOT NULL PRIMARY KEY,
    "sourceProtocolId" TEXT NOT NULL,
    "forkedByUserId"   TEXT NOT NULL,
    "forkNote"         TEXT,
    "createdAt"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProtocolFork_sourceProtocolId_fkey" FOREIGN KEY ("sourceProtocolId") REFERENCES "Protocol" ("id") ON DELETE CASCADE,
    CONSTRAINT "ProtocolFork_forkedByUserId_fkey"   FOREIGN KEY ("forkedByUserId")   REFERENCES "User"     ("id") ON DELETE CASCADE
);
CREATE INDEX "ProtocolFork_sourceProtocolId_idx" ON "ProtocolFork" ("sourceProtocolId");
CREATE INDEX "ProtocolFork_forkedByUserId_idx"   ON "ProtocolFork" ("forkedByUserId");

-- Moat M3: IRB approval tokens

CREATE TABLE "IrbApproval" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "userId"      TEXT NOT NULL,
    "tenantId"    TEXT NOT NULL DEFAULT 'default',
    "token"       TEXT NOT NULL UNIQUE,
    "institution" TEXT NOT NULL,
    "studyId"     TEXT NOT NULL,
    "approvedAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt"   DATETIME NOT NULL,
    "revokedAt"   DATETIME,
    "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IrbApproval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);
CREATE INDEX "IrbApproval_userId_expiresAt_idx" ON "IrbApproval" ("userId", "expiresAt");
CREATE INDEX "IrbApproval_token_idx"             ON "IrbApproval" ("token");

-- Moat M7: Clinician co-sign audit records

CREATE TABLE "ClinicianCoSign" (
    "id"                TEXT NOT NULL PRIMARY KEY,
    "resourceType"      TEXT NOT NULL,
    "resourceId"        TEXT NOT NULL,
    "clinicianId"       TEXT NOT NULL,
    "tenantId"          TEXT NOT NULL DEFAULT 'default',
    "signature"         TEXT NOT NULL,
    "signedAt"          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt"         DATETIME,
    "jurisdiction"      TEXT,
    "licenseNumber"     TEXT NOT NULL,
    "licenseVerifiedAt" DATETIME,
    "notes"             TEXT,
    "createdAt"         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClinicianCoSign_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "User" ("id") ON DELETE CASCADE
);
CREATE INDEX "ClinicianCoSign_resourceType_resourceId_idx" ON "ClinicianCoSign" ("resourceType", "resourceId");
CREATE INDEX "ClinicianCoSign_clinicianId_idx"             ON "ClinicianCoSign" ("clinicianId");
CREATE INDEX "ClinicianCoSign_signedAt_idx"                ON "ClinicianCoSign" ("signedAt");
