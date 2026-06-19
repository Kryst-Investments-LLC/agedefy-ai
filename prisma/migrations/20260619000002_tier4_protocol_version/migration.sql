-- Tier 4: Protocol version system and cycle scheduling fields

-- Add cycle scheduling fields to Protocol
ALTER TABLE "Protocol"
  ADD COLUMN IF NOT EXISTS "protocolCycleLengthDays" INTEGER NOT NULL DEFAULT 28,
  ADD COLUMN IF NOT EXISTS "protocolCycleStartDate" TIMESTAMP(3);

-- Create ProtocolVersionStatus enum
DO $$ BEGIN
  CREATE TYPE "ProtocolVersionStatus" AS ENUM (
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'REJECTED',
    'APPLIED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create ProtocolVersion table
CREATE TABLE IF NOT EXISTS "ProtocolVersion" (
  "id"                        TEXT NOT NULL,
  "protocolId"                TEXT NOT NULL,
  "userId"                    TEXT NOT NULL,
  "tenantId"                  TEXT NOT NULL DEFAULT 'default',
  "version"                   INTEGER NOT NULL,
  "status"                    "ProtocolVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "changes"                   JSONB NOT NULL DEFAULT '[]',
  "generatedByAgentSessionId" TEXT,
  "approvedBy"                TEXT,
  "approvedAt"                TIMESTAMP(3),
  "appliedAt"                 TIMESTAMP(3),
  "createdAt"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProtocolVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProtocolVersion_protocolId_version_key" UNIQUE ("protocolId", "version"),
  CONSTRAINT "ProtocolVersion_protocolId_fkey"
    FOREIGN KEY ("protocolId") REFERENCES "Protocol"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProtocolVersion_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ProtocolVersion_protocolId_status_idx"
  ON "ProtocolVersion"("protocolId", "status");

CREATE INDEX IF NOT EXISTS "ProtocolVersion_userId_createdAt_idx"
  ON "ProtocolVersion"("userId", "createdAt");
