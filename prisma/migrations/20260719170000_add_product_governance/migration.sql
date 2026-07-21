CREATE TYPE "ProductReviewStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED');

ALTER TABLE "Product"
  ADD COLUMN "reviewStatus" "ProductReviewStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "reviewedBy" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "evidenceTier" TEXT,
  ADD COLUMN "sourceProvenance" JSONB,
  ADD COLUMN "affiliate" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sponsored" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "lastVerifiedAt" TIMESTAMP(3);

CREATE INDEX "Product_reviewStatus_inStock_idx" ON "Product"("reviewStatus", "inStock");
