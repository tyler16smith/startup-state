-- AlterTable
ALTER TABLE "FounderProfile" ADD COLUMN     "founderIdentities" TEXT[] DEFAULT ARRAY[]::TEXT[];
