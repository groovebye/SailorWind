-- Passage crew (sharing a passage with other accounts). Idempotent. Apply:
--   docker exec -i sailorwind-db psql -U sailor -d sailplanner -v ON_ERROR_STOP=1 < prisma/sql/2026-10-29-passage-crew.sql
BEGIN;
CREATE TABLE IF NOT EXISTS "PassageMember" (
    "id" TEXT NOT NULL,
    "passageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PassageMember_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PassageMember_userId_idx" ON "PassageMember"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "PassageMember_passageId_userId_key" ON "PassageMember"("passageId", "userId");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PassageMember_passageId_fkey') THEN
    ALTER TABLE "PassageMember" ADD CONSTRAINT "PassageMember_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "Passage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PassageMember_userId_fkey') THEN
    ALTER TABLE "PassageMember" ADD CONSTRAINT "PassageMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
COMMIT;
