CREATE TYPE "NavigatorPlanKind" AS ENUM ('FOUNDER', 'INVESTOR');

CREATE TABLE "NavigatorPlan" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" "NavigatorPlanKind" NOT NULL,
  "title" TEXT,
  "input" JSONB NOT NULL,
  "result" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NavigatorPlan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NavigatorPlan_userId_idx" ON "NavigatorPlan"("userId");
CREATE INDEX "NavigatorPlan_userId_updatedAt_idx" ON "NavigatorPlan"("userId", "updatedAt");
CREATE INDEX "NavigatorPlan_kind_idx" ON "NavigatorPlan"("kind");

ALTER TABLE "NavigatorPlan"
ADD CONSTRAINT "NavigatorPlan_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;