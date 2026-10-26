-- Hand all ownerless passages and boats (Bossanova) to one account.
-- Creates the account if missing: verified, no password — the owner sets it via "Forgot password".
-- Idempotent. Usage:
--   docker exec -i sailorwind-db psql -U sailor -d sailplanner -v ON_ERROR_STOP=1 \
--     -v email=owner@example.com -v name='Alex' < prisma/sql/2026-10-27-claim-legacy.sql
BEGIN;

INSERT INTO "User" ("id", "email", "name", "emailVerifiedAt", "termsAcceptedAt", "updatedAt")
VALUES (gen_random_uuid()::text, lower(:'email'), :'name', now(), now(), now())
ON CONFLICT ("email") DO NOTHING;

UPDATE "Passage" SET "ownerId" = (SELECT "id" FROM "User" WHERE "email" = lower(:'email'))
WHERE "ownerId" IS NULL;

UPDATE "VesselProfile" SET "ownerId" = (SELECT "id" FROM "User" WHERE "email" = lower(:'email'))
WHERE "ownerId" IS NULL;

UPDATE "VesselProfile" SET "isDefault" = true, "model" = COALESCE("model", 'Hallberg-Rassy Monsun 31')
WHERE "slug" = 'bossanova';

SELECT u."email",
       (SELECT count(*) FROM "Passage" p WHERE p."ownerId" = u."id") AS passages,
       (SELECT count(*) FROM "VesselProfile" v WHERE v."ownerId" = u."id") AS boats
FROM "User" u WHERE u."email" = lower(:'email');

COMMIT;
