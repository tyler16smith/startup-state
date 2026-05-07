CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'COMPANY_OWNER', 'PENDING_COMPANY_OWNER');
CREATE TYPE "FounderStage" AS ENUM ('IDEA', 'PRE_REVENUE', 'EARLY_REVENUE', 'GROWTH', 'SCALING');
CREATE TYPE "HiringStatus" AS ENUM ('NOT_HIRING', 'HIRING', 'ACTIVELY_HIRING', 'UNKNOWN');
CREATE TYPE "CompanyStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "ResourceStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';

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
    "stages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "sectors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "goals" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "regions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "businessTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "eligibilityTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
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

CREATE TABLE "ResourceEmbedding" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ResourceEmbedding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FounderProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "stage" TEXT,
    "city" TEXT,
    "county" TEXT,
    "region" TEXT,
    "sectors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "goals" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "businessTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "fundingNeeds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "hiringStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FounderProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SavedResource" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedResource_pkey" PRIMARY KEY ("id")
);

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

CREATE TABLE "CompanyPhoto" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "altText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompanyPhoto_pkey" PRIMARY KEY ("id")
);

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

CREATE TABLE "CompanyOwner" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompanyOwner_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Resource_slug_key" ON "Resource"("slug");
CREATE INDEX "Resource_status_idx" ON "Resource"("status");
CREATE INDEX "Resource_city_idx" ON "Resource"("city");
CREATE INDEX "Resource_county_idx" ON "Resource"("county");
CREATE UNIQUE INDEX "ResourceEmbedding_resourceId_key" ON "ResourceEmbedding"("resourceId");
CREATE INDEX "FounderProfile_userId_idx" ON "FounderProfile"("userId");
CREATE INDEX "FounderProfile_region_idx" ON "FounderProfile"("region");
CREATE UNIQUE INDEX "SavedResource_userId_resourceId_key" ON "SavedResource"("userId", "resourceId");
CREATE INDEX "SavedResource_resourceId_idx" ON "SavedResource"("resourceId");
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");
CREATE INDEX "Company_status_idx" ON "Company"("status");
CREATE INDEX "Company_city_idx" ON "Company"("city");
CREATE INDEX "Company_county_idx" ON "Company"("county");
CREATE INDEX "Company_sector_idx" ON "Company"("sector");
CREATE INDEX "Company_latitude_longitude_idx" ON "Company"("latitude", "longitude");
CREATE INDEX "CompanyPhoto_companyId_idx" ON "CompanyPhoto"("companyId");
CREATE INDEX "CompanyClaim_companyId_idx" ON "CompanyClaim"("companyId");
CREATE INDEX "CompanyClaim_userId_idx" ON "CompanyClaim"("userId");
CREATE INDEX "CompanyClaim_status_idx" ON "CompanyClaim"("status");
CREATE UNIQUE INDEX "CompanyOwner_companyId_userId_key" ON "CompanyOwner"("companyId", "userId");
CREATE INDEX "CompanyOwner_userId_idx" ON "CompanyOwner"("userId");

ALTER TABLE "ResourceEmbedding" ADD CONSTRAINT "ResourceEmbedding_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FounderProfile" ADD CONSTRAINT "FounderProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SavedResource" ADD CONSTRAINT "SavedResource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedResource" ADD CONSTRAINT "SavedResource_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyPhoto" ADD CONSTRAINT "CompanyPhoto_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyClaim" ADD CONSTRAINT "CompanyClaim_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyClaim" ADD CONSTRAINT "CompanyClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyOwner" ADD CONSTRAINT "CompanyOwner_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyOwner" ADD CONSTRAINT "CompanyOwner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;