-- AlterTable: add FEP triage gate fields to ExperimentCandidate
-- fepGateScore / fepGateReason: set by POST /api/experiment/candidates/[id]/fep-triage
-- fepJson: stores FepResult snapshot after a real FEP run (Phase 3)

ALTER TABLE "public"."ExperimentCandidate" ADD COLUMN "fepGateScore" DOUBLE PRECISION;
ALTER TABLE "public"."ExperimentCandidate" ADD COLUMN "fepGateReason" TEXT;
ALTER TABLE "public"."ExperimentCandidate" ADD COLUMN "fepJson" JSONB;
