-- Server-authoritative MFA gate: records the instant of the most recent
-- successful second-factor challenge. The JWT callback compares this against
-- the session's login epoch to decide whether the MFA gate is satisfied, so
-- the client can never clear the gate by passing data to update().
ALTER TABLE "UserMfaSecret" ADD COLUMN "lastVerifiedAt" TIMESTAMP(3);
