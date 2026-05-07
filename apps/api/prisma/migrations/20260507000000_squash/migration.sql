-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "HouseholdInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'COMPANY_OWNER', 'PENDING_COMPANY_OWNER');

-- CreateEnum
CREATE TYPE "FounderStage" AS ENUM ('IDEA', 'PRE_REVENUE', 'EARLY_REVENUE', 'GROWTH', 'SCALING');

-- CreateEnum
CREATE TYPE "HiringStatus" AS ENUM ('NOT_HIRING', 'HIRING', 'ACTIVELY_HIRING', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ResourceStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "HouseholdMembershipStatus" AS ENUM ('ACTIVE', 'REMOVED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('NONE', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('NONE', 'MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "SyncAccessStatus" AS ENUM ('ACTIVE', 'PAUSED_TRIAL_EXPIRED');

-- CreateEnum
CREATE TYPE "AgentMessageRole" AS ENUM ('user', 'assistant', 'system', 'tool');

-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled', 'waiting_for_user');

-- CreateEnum
CREATE TYPE "AgentRunKind" AS ENUM ('chat', 'widget_action');

-- CreateEnum
CREATE TYPE "AgentRunStepType" AS ENUM ('model_response', 'tool_execution', 'user_input_required');

-- CreateEnum
CREATE TYPE "AgentRunStepStatus" AS ENUM ('running', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "AgentToolCallStatus" AS ENUM ('running', 'completed', 'failed', 'skipped', 'cancelled');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "refresh_token_expires_in" INTEGER,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "username" TEXT,
    "password" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "trialStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trialEndsAt" TIMESTAMP(3) NOT NULL DEFAULT (now() + interval '30 days'),
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'NONE',
    "subscriptionPlan" "SubscriptionPlan" NOT NULL DEFAULT 'NONE',
    "syncAccessStatus" "SyncAccessStatus" NOT NULL DEFAULT 'ACTIVE',
    "subscriptionCurrentPeriodStart" TIMESTAMP(3),
    "subscriptionCurrentPeriodEnd" TIMESTAMP(3),
    "subscriptionCancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "subscriptionCanceledAt" TIMESTAMP(3),
    "subscriptionProviderCustomerId" TEXT,
    "subscriptionProviderSubscriptionId" TEXT,
    "subscriptionProviderPriceId" TEXT,
    "subscriptionLastWebhookEventId" TEXT,
    "subscriptionInterval" TEXT,
    "referralCode" TEXT,
    "referredByUserId" TEXT,
    "referralBonusDaysGranted" INTEGER NOT NULL DEFAULT 0,
    "successfulReferralCount" INTEGER NOT NULL DEFAULT 0,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "twoFactorBackupCodes" TEXT,
    "twoFactorVerified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "shortDescription" TEXT,
    "websiteUrl" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "category" TEXT,
    "subcategory" TEXT,
    "status" "ResourceStatus" NOT NULL DEFAULT 'PUBLISHED',
    "stages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sectors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "goals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "regions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "businessTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "eligibilityTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "city" TEXT,
    "county" TEXT,
    "state" TEXT DEFAULT 'UT',
    "source" TEXT,
    "sourceId" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceEmbedding" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FounderProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "stage" TEXT,
    "city" TEXT,
    "county" TEXT,
    "region" TEXT,
    "sectors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "goals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "businessTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fundingNeeds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hiringStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FounderProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedResource" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "linkedinUrl" TEXT,
    "description" TEXT,
    "sector" TEXT,
    "stage" TEXT,
    "employees" INTEGER,
    "employeeRange" TEXT,
    "yearFounded" INTEGER,
    "address" TEXT,
    "city" TEXT,
    "county" TEXT,
    "state" TEXT DEFAULT 'UT',
    "postalCode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "hiringStatus" "HiringStatus" NOT NULL DEFAULT 'UNKNOWN',
    "jobPostingsUrl" TEXT,
    "status" "CompanyStatus" NOT NULL DEFAULT 'PUBLISHED',
    "source" TEXT,
    "sourceId" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyPhoto" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "altText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyClaim" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workEmail" TEXT NOT NULL,
    "explanation" TEXT,
    "domainMatches" BOOLEAN NOT NULL DEFAULT false,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyOwner" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyOwner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "TwoFactorToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwoFactorToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "deviceInfo" TEXT,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "deviceInfo" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hasCompletedInitialOnboarding" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemoOverlaySession" (
    "id" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "userId" TEXT,
    "demoUserId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "uiStateJson" JSONB,

    CONSTRAINT "DemoOverlaySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseholdInvite" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "inviteeName" TEXT NOT NULL,
    "inviteeEmail" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "HouseholdInviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseholdInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseholdMembership" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "memberUserId" TEXT NOT NULL,
    "status" "HouseholdMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "HouseholdMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralRedemption" (
    "id" TEXT NOT NULL,
    "referrerUserId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "qualifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bonusDaysToReferrer" INTEGER NOT NULL DEFAULT 7,
    "bonusDaysToReferred" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "McpPersonalAccessToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "clientName" TEXT,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "McpPersonalAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "McpOAuthClient" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecretHash" TEXT,
    "name" TEXT NOT NULL,
    "clientProfile" TEXT NOT NULL,
    "redirectUris" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "grants" TEXT[] DEFAULT ARRAY['authorization_code', 'refresh_token']::TEXT[],
    "requestsPerMinute" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "McpOAuthClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "McpOAuthAuthorizationCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "oauthClientId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "codeChallengeMethod" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "McpOAuthAuthorizationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "McpOAuthAccessToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "oauthClientId" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "refreshTokenHash" TEXT,
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "McpOAuthAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "McpToolCall" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "householdId" TEXT,
    "personalAccessTokenId" TEXT,
    "oauthAccessTokenId" TEXT,
    "oauthClientId" TEXT,
    "clientName" TEXT,
    "clientProfile" TEXT,
    "toolName" TEXT NOT NULL,
    "requiredScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "grantedScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "inputHash" TEXT,
    "inputSummary" JSONB,
    "outputSummary" JSONB,
    "status" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "errorCode" TEXT,
    "rateLimited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "McpToolCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "householdId" TEXT,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "AgentMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "householdId" TEXT,
    "clientRequestId" TEXT,
    "status" "AgentRunStatus" NOT NULL,
    "kind" "AgentRunKind" NOT NULL DEFAULT 'chat',
    "model" TEXT,
    "provider" TEXT,
    "providerResponseId" TEXT,
    "promptVersion" TEXT,
    "agentVersion" TEXT,
    "toolRegistryVersion" TEXT,
    "streamProtocolVersion" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRunStep" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "type" "AgentRunStepType" NOT NULL,
    "status" "AgentRunStepStatus" NOT NULL,
    "providerResponseId" TEXT,
    "input" JSONB,
    "output" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AgentRunStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentToolCall" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stepId" TEXT,
    "toolCallId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "input" JSONB,
    "output" JSONB,
    "status" "AgentToolCallStatus" NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AgentToolCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentTimelineBlock" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "runId" TEXT,
    "stepId" TEXT,
    "role" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentTimelineBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentWidgetAction" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "widgetId" TEXT NOT NULL,
    "runId" TEXT,
    "stepId" TEXT,
    "userId" TEXT NOT NULL,
    "householdId" TEXT,
    "actionType" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "status" TEXT NOT NULL,
    "clientRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AgentWidgetAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_subscriptionProviderCustomerId_key" ON "User"("subscriptionProviderCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_subscriptionProviderSubscriptionId_key" ON "User"("subscriptionProviderSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- CreateIndex
CREATE INDEX "User_referredByUserId_idx" ON "User"("referredByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Resource_slug_key" ON "Resource"("slug");

-- CreateIndex
CREATE INDEX "Resource_status_idx" ON "Resource"("status");

-- CreateIndex
CREATE INDEX "Resource_city_idx" ON "Resource"("city");

-- CreateIndex
CREATE INDEX "Resource_county_idx" ON "Resource"("county");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceEmbedding_resourceId_key" ON "ResourceEmbedding"("resourceId");

-- CreateIndex
CREATE INDEX "FounderProfile_userId_idx" ON "FounderProfile"("userId");

-- CreateIndex
CREATE INDEX "FounderProfile_region_idx" ON "FounderProfile"("region");

-- CreateIndex
CREATE INDEX "SavedResource_resourceId_idx" ON "SavedResource"("resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedResource_userId_resourceId_key" ON "SavedResource"("userId", "resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE INDEX "Company_status_idx" ON "Company"("status");

-- CreateIndex
CREATE INDEX "Company_city_idx" ON "Company"("city");

-- CreateIndex
CREATE INDEX "Company_county_idx" ON "Company"("county");

-- CreateIndex
CREATE INDEX "Company_sector_idx" ON "Company"("sector");

-- CreateIndex
CREATE INDEX "Company_latitude_longitude_idx" ON "Company"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "CompanyPhoto_companyId_idx" ON "CompanyPhoto"("companyId");

-- CreateIndex
CREATE INDEX "CompanyClaim_companyId_idx" ON "CompanyClaim"("companyId");

-- CreateIndex
CREATE INDEX "CompanyClaim_userId_idx" ON "CompanyClaim"("userId");

-- CreateIndex
CREATE INDEX "CompanyClaim_status_idx" ON "CompanyClaim"("status");

-- CreateIndex
CREATE INDEX "CompanyOwner_userId_idx" ON "CompanyOwner"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyOwner_companyId_userId_key" ON "CompanyOwner"("companyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "TwoFactorToken_token_key" ON "TwoFactorToken"("token");

-- CreateIndex
CREATE INDEX "TwoFactorToken_userId_idx" ON "TwoFactorToken"("userId");

-- CreateIndex
CREATE INDEX "TwoFactorToken_expires_idx" ON "TwoFactorToken"("expires");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_revokedAt_idx" ON "RefreshToken"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "RefreshToken_sessionId_idx" ON "RefreshToken"("sessionId");

-- CreateIndex
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE INDEX "AuthSession_userId_revokedAt_idx" ON "AuthSession"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE INDEX "AuthSession_lastActiveAt_idx" ON "AuthSession"("lastActiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DemoOverlaySession_sessionKey_key" ON "DemoOverlaySession"("sessionKey");

-- CreateIndex
CREATE INDEX "DemoOverlaySession_userId_idx" ON "DemoOverlaySession"("userId");

-- CreateIndex
CREATE INDEX "DemoOverlaySession_expiresAt_idx" ON "DemoOverlaySession"("expiresAt");

-- CreateIndex
CREATE INDEX "HouseholdInvite_ownerUserId_status_expiresAt_idx" ON "HouseholdInvite"("ownerUserId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "HouseholdInvite_inviteeEmail_idx" ON "HouseholdInvite"("inviteeEmail");

-- CreateIndex
CREATE UNIQUE INDEX "HouseholdInvite_tokenHash_key" ON "HouseholdInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "HouseholdMembership_ownerUserId_idx" ON "HouseholdMembership"("ownerUserId");

-- CreateIndex
CREATE INDEX "HouseholdMembership_memberUserId_idx" ON "HouseholdMembership"("memberUserId");

-- CreateIndex
CREATE UNIQUE INDEX "HouseholdMembership_ownerUserId_memberUserId_key" ON "HouseholdMembership"("ownerUserId", "memberUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralRedemption_referredUserId_key" ON "ReferralRedemption"("referredUserId");

-- CreateIndex
CREATE INDEX "ReferralRedemption_referrerUserId_idx" ON "ReferralRedemption"("referrerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "McpPersonalAccessToken_tokenHash_key" ON "McpPersonalAccessToken"("tokenHash");

-- CreateIndex
CREATE INDEX "McpPersonalAccessToken_userId_idx" ON "McpPersonalAccessToken"("userId");

-- CreateIndex
CREATE INDEX "McpPersonalAccessToken_userId_revokedAt_idx" ON "McpPersonalAccessToken"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "McpPersonalAccessToken_expiresAt_idx" ON "McpPersonalAccessToken"("expiresAt");

-- CreateIndex
CREATE INDEX "McpPersonalAccessToken_tokenHash_idx" ON "McpPersonalAccessToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "McpOAuthClient_clientId_key" ON "McpOAuthClient"("clientId");

-- CreateIndex
CREATE INDEX "McpOAuthClient_clientProfile_idx" ON "McpOAuthClient"("clientProfile");

-- CreateIndex
CREATE INDEX "McpOAuthClient_revokedAt_idx" ON "McpOAuthClient"("revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "McpOAuthAuthorizationCode_codeHash_key" ON "McpOAuthAuthorizationCode"("codeHash");

-- CreateIndex
CREATE INDEX "McpOAuthAuthorizationCode_userId_idx" ON "McpOAuthAuthorizationCode"("userId");

-- CreateIndex
CREATE INDEX "McpOAuthAuthorizationCode_oauthClientId_idx" ON "McpOAuthAuthorizationCode"("oauthClientId");

-- CreateIndex
CREATE INDEX "McpOAuthAuthorizationCode_expiresAt_idx" ON "McpOAuthAuthorizationCode"("expiresAt");

-- CreateIndex
CREATE INDEX "McpOAuthAuthorizationCode_consumedAt_idx" ON "McpOAuthAuthorizationCode"("consumedAt");

-- CreateIndex
CREATE UNIQUE INDEX "McpOAuthAccessToken_tokenHash_key" ON "McpOAuthAccessToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "McpOAuthAccessToken_refreshTokenHash_key" ON "McpOAuthAccessToken"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "McpOAuthAccessToken_userId_idx" ON "McpOAuthAccessToken"("userId");

-- CreateIndex
CREATE INDEX "McpOAuthAccessToken_oauthClientId_idx" ON "McpOAuthAccessToken"("oauthClientId");

-- CreateIndex
CREATE INDEX "McpOAuthAccessToken_userId_revokedAt_idx" ON "McpOAuthAccessToken"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "McpOAuthAccessToken_expiresAt_idx" ON "McpOAuthAccessToken"("expiresAt");

-- CreateIndex
CREATE INDEX "McpOAuthAccessToken_refreshTokenExpiresAt_idx" ON "McpOAuthAccessToken"("refreshTokenExpiresAt");

-- CreateIndex
CREATE INDEX "McpOAuthAccessToken_tokenHash_idx" ON "McpOAuthAccessToken"("tokenHash");

-- CreateIndex
CREATE INDEX "McpToolCall_userId_createdAt_idx" ON "McpToolCall"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "McpToolCall_personalAccessTokenId_createdAt_idx" ON "McpToolCall"("personalAccessTokenId", "createdAt");

-- CreateIndex
CREATE INDEX "McpToolCall_oauthAccessTokenId_createdAt_idx" ON "McpToolCall"("oauthAccessTokenId", "createdAt");

-- CreateIndex
CREATE INDEX "McpToolCall_oauthClientId_createdAt_idx" ON "McpToolCall"("oauthClientId", "createdAt");

-- CreateIndex
CREATE INDEX "McpToolCall_toolName_createdAt_idx" ON "McpToolCall"("toolName", "createdAt");

-- CreateIndex
CREATE INDEX "McpToolCall_status_createdAt_idx" ON "McpToolCall"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AgentConversation_userId_idx" ON "AgentConversation"("userId");

-- CreateIndex
CREATE INDEX "AgentConversation_householdId_idx" ON "AgentConversation"("householdId");

-- CreateIndex
CREATE INDEX "AgentMessage_conversationId_idx" ON "AgentMessage"("conversationId");

-- CreateIndex
CREATE INDEX "AgentRun_conversationId_idx" ON "AgentRun"("conversationId");

-- CreateIndex
CREATE INDEX "AgentRun_userId_idx" ON "AgentRun"("userId");

-- CreateIndex
CREATE INDEX "AgentRun_householdId_idx" ON "AgentRun"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentRun_userId_clientRequestId_key" ON "AgentRun"("userId", "clientRequestId");

-- CreateIndex
CREATE INDEX "AgentRunStep_runId_idx" ON "AgentRunStep"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentRunStep_runId_stepIndex_key" ON "AgentRunStep"("runId", "stepIndex");

-- CreateIndex
CREATE INDEX "AgentToolCall_runId_idx" ON "AgentToolCall"("runId");

-- CreateIndex
CREATE INDEX "AgentToolCall_stepId_idx" ON "AgentToolCall"("stepId");

-- CreateIndex
CREATE INDEX "AgentToolCall_toolName_idx" ON "AgentToolCall"("toolName");

-- CreateIndex
CREATE UNIQUE INDEX "AgentToolCall_runId_toolCallId_key" ON "AgentToolCall"("runId", "toolCallId");

-- CreateIndex
CREATE INDEX "AgentTimelineBlock_conversationId_idx" ON "AgentTimelineBlock"("conversationId");

-- CreateIndex
CREATE INDEX "AgentTimelineBlock_runId_idx" ON "AgentTimelineBlock"("runId");

-- CreateIndex
CREATE INDEX "AgentTimelineBlock_stepId_idx" ON "AgentTimelineBlock"("stepId");

-- CreateIndex
CREATE INDEX "AgentWidgetAction_conversationId_idx" ON "AgentWidgetAction"("conversationId");

-- CreateIndex
CREATE INDEX "AgentWidgetAction_widgetId_idx" ON "AgentWidgetAction"("widgetId");

-- CreateIndex
CREATE INDEX "AgentWidgetAction_userId_idx" ON "AgentWidgetAction"("userId");

-- CreateIndex
CREATE INDEX "AgentWidgetAction_householdId_idx" ON "AgentWidgetAction"("householdId");

-- CreateIndex
CREATE INDEX "AgentWidgetAction_runId_idx" ON "AgentWidgetAction"("runId");

-- CreateIndex
CREATE INDEX "AgentWidgetAction_stepId_idx" ON "AgentWidgetAction"("stepId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentWidgetAction_widgetId_actionType_clientRequestId_key" ON "AgentWidgetAction"("widgetId", "actionType", "clientRequestId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_referredByUserId_fkey" FOREIGN KEY ("referredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceEmbedding" ADD CONSTRAINT "ResourceEmbedding_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FounderProfile" ADD CONSTRAINT "FounderProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedResource" ADD CONSTRAINT "SavedResource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedResource" ADD CONSTRAINT "SavedResource_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPhoto" ADD CONSTRAINT "CompanyPhoto_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyClaim" ADD CONSTRAINT "CompanyClaim_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyClaim" ADD CONSTRAINT "CompanyClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyOwner" ADD CONSTRAINT "CompanyOwner_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyOwner" ADD CONSTRAINT "CompanyOwner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwoFactorToken" ADD CONSTRAINT "TwoFactorToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AuthSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemoOverlaySession" ADD CONSTRAINT "DemoOverlaySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdInvite" ADD CONSTRAINT "HouseholdInvite_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdMembership" ADD CONSTRAINT "HouseholdMembership_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdMembership" ADD CONSTRAINT "HouseholdMembership_memberUserId_fkey" FOREIGN KEY ("memberUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralRedemption" ADD CONSTRAINT "ReferralRedemption_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralRedemption" ADD CONSTRAINT "ReferralRedemption_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpPersonalAccessToken" ADD CONSTRAINT "McpPersonalAccessToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpOAuthAuthorizationCode" ADD CONSTRAINT "McpOAuthAuthorizationCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpOAuthAuthorizationCode" ADD CONSTRAINT "McpOAuthAuthorizationCode_oauthClientId_fkey" FOREIGN KEY ("oauthClientId") REFERENCES "McpOAuthClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpOAuthAccessToken" ADD CONSTRAINT "McpOAuthAccessToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpOAuthAccessToken" ADD CONSTRAINT "McpOAuthAccessToken_oauthClientId_fkey" FOREIGN KEY ("oauthClientId") REFERENCES "McpOAuthClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpToolCall" ADD CONSTRAINT "McpToolCall_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpToolCall" ADD CONSTRAINT "McpToolCall_personalAccessTokenId_fkey" FOREIGN KEY ("personalAccessTokenId") REFERENCES "McpPersonalAccessToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpToolCall" ADD CONSTRAINT "McpToolCall_oauthAccessTokenId_fkey" FOREIGN KEY ("oauthAccessTokenId") REFERENCES "McpOAuthAccessToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpToolCall" ADD CONSTRAINT "McpToolCall_oauthClientId_fkey" FOREIGN KEY ("oauthClientId") REFERENCES "McpOAuthClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentConversation" ADD CONSTRAINT "AgentConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMessage" ADD CONSTRAINT "AgentMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AgentConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AgentConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRunStep" ADD CONSTRAINT "AgentRunStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentToolCall" ADD CONSTRAINT "AgentToolCall_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentToolCall" ADD CONSTRAINT "AgentToolCall_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "AgentRunStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTimelineBlock" ADD CONSTRAINT "AgentTimelineBlock_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AgentConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTimelineBlock" ADD CONSTRAINT "AgentTimelineBlock_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTimelineBlock" ADD CONSTRAINT "AgentTimelineBlock_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "AgentRunStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentWidgetAction" ADD CONSTRAINT "AgentWidgetAction_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AgentConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentWidgetAction" ADD CONSTRAINT "AgentWidgetAction_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentWidgetAction" ADD CONSTRAINT "AgentWidgetAction_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "AgentRunStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

