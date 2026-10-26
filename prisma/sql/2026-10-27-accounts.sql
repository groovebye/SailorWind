-- Accounts: User / Session / AuthToken + owner on Passage and VesselProfile.
-- Idempotent — safe to re-run. Apply on prod with:
--   docker exec -i sailorwind-db psql -U sailor -d sailplanner -v ON_ERROR_STOP=1 < prisma/sql/2026-10-27-accounts.sql
BEGIN;

CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "termsAcceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AuthToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Passage" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;
ALTER TABLE "VesselProfile" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;
ALTER TABLE "VesselProfile" ADD COLUMN IF NOT EXISTS "model" TEXT;
ALTER TABLE "VesselProfile" ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "AuthToken_userId_type_idx" ON "AuthToken"("userId", "type");
CREATE INDEX IF NOT EXISTS "Passage_ownerId_updatedAt_idx" ON "Passage"("ownerId", "updatedAt");
CREATE INDEX IF NOT EXISTS "VesselProfile_ownerId_idx" ON "VesselProfile"("ownerId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Passage_ownerId_fkey') THEN
    ALTER TABLE "Passage" ADD CONSTRAINT "Passage_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VesselProfile_ownerId_fkey') THEN
    ALTER TABLE "VesselProfile" ADD CONSTRAINT "VesselProfile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Session_userId_fkey') THEN
    ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuthToken_userId_fkey') THEN
    ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
