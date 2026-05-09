-- AlterTable
ALTER TABLE "CompanyClaim"
    ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
    ADD COLUMN "verificationTokenHash" TEXT,
    ADD COLUMN "verificationExpiresAt" TIMESTAMP(3),
    ADD COLUMN "lastVerificationSentAt" TIMESTAMP(3);

-- ReplaceEnum
ALTER TABLE "CompanyClaim" ALTER COLUMN "status" DROP DEFAULT;
ALTER TYPE "ClaimStatus" RENAME TO "ClaimStatus_old";
CREATE TYPE "ClaimStatus" AS ENUM ('email_pending', 'pending_review', 'approved', 'rejected');
ALTER TABLE "CompanyClaim" ALTER COLUMN "status" TYPE "ClaimStatus" USING (
    CASE "status"::text
        WHEN 'PENDING' THEN 'pending_review'
        WHEN 'APPROVED' THEN 'approved'
        WHEN 'REJECTED' THEN 'rejected'
        ELSE "status"::text
    END
)::"ClaimStatus";
ALTER TABLE "CompanyClaim" ALTER COLUMN "status" SET DEFAULT 'email_pending';
DROP TYPE "ClaimStatus_old";

-- CreateIndex
CREATE INDEX "CompanyClaim_verificationTokenHash_idx" ON "CompanyClaim"("verificationTokenHash");