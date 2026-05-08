-- DropForeignKey
ALTER TABLE "ReferralRedemption" DROP CONSTRAINT IF EXISTS "ReferralRedemption_referrerUserId_fkey";
ALTER TABLE "ReferralRedemption" DROP CONSTRAINT IF EXISTS "ReferralRedemption_referredUserId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_referredByUserId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "User_referredByUserId_idx";

-- DropTable
DROP TABLE IF EXISTS "ReferralRedemption";

-- AlterTable
ALTER TABLE "User"
  DROP COLUMN IF EXISTS "trialStartedAt",
  DROP COLUMN IF EXISTS "trialEndsAt",
  DROP COLUMN IF EXISTS "subscriptionStatus",
  DROP COLUMN IF EXISTS "subscriptionPlan",
  DROP COLUMN IF EXISTS "syncAccessStatus",
  DROP COLUMN IF EXISTS "subscriptionCurrentPeriodStart",
  DROP COLUMN IF EXISTS "subscriptionCurrentPeriodEnd",
  DROP COLUMN IF EXISTS "subscriptionCancelAtPeriodEnd",
  DROP COLUMN IF EXISTS "subscriptionCanceledAt",
  DROP COLUMN IF EXISTS "subscriptionProviderCustomerId",
  DROP COLUMN IF EXISTS "subscriptionProviderSubscriptionId",
  DROP COLUMN IF EXISTS "subscriptionProviderPriceId",
  DROP COLUMN IF EXISTS "subscriptionLastWebhookEventId",
  DROP COLUMN IF EXISTS "subscriptionInterval",
  DROP COLUMN IF EXISTS "referralCode",
  DROP COLUMN IF EXISTS "referredByUserId",
  DROP COLUMN IF EXISTS "referralBonusDaysGranted",
  DROP COLUMN IF EXISTS "successfulReferralCount";
