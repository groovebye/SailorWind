-- IJsselmeer / Markermeer / Ketelmeer / IJmeer / Gooimeer harbours (coastSegment 'ijsselmeer').
-- Positions: harbour centres from OpenStreetMap (leisure=marina / seamark harbour), checked against
-- src/lib/navgrid-nl.data.ts so each snaps to open water of its own lake. coastlineNm 10000+ keeps the
-- lake clear of the Iberian coast ordering; lake stops/bail-outs are chosen by distance from the route.
-- Facilities are left unset (no verified data). Idempotent. Apply:
--   docker exec -i sailorwind-db psql -U sailor -d sailplanner -v ON_ERROR_STOP=1 < prisma/sql/2026-10-29-ijsselmeer-ports.sql
BEGIN;
INSERT INTO "Port" (id, name, slug, lat, lon, type, country, region, "coastSegment", "coastlineNm", "updatedAt") VALUES
 (gen_random_uuid()::text, 'Makkum', 'makkum', 53.0538, 5.3878, 'marina', 'NL', 'IJsselmeer', 'ijsselmeer', 10000, now()),
 (gen_random_uuid()::text, 'Workum (It Soal)', 'workum', 52.9657, 5.4198, 'marina', 'NL', 'IJsselmeer', 'ijsselmeer', 10010, now()),
 (gen_random_uuid()::text, 'Hindeloopen', 'hindeloopen', 52.9455, 5.4041, 'marina', 'NL', 'IJsselmeer', 'ijsselmeer', 10020, now()),
 (gen_random_uuid()::text, 'Stavoren', 'stavoren', 52.8746, 5.3636, 'marina', 'NL', 'IJsselmeer', 'ijsselmeer', 10030, now()),
 (gen_random_uuid()::text, 'Lemmer', 'lemmer', 52.842, 5.709, 'marina', 'NL', 'IJsselmeer', 'ijsselmeer', 10040, now()),
 (gen_random_uuid()::text, 'Urk', 'urk', 52.6602, 5.5962, 'port', 'NL', 'IJsselmeer', 'ijsselmeer', 10050, now()),
 (gen_random_uuid()::text, 'Schokkerhaven', 'schokkerhaven', 52.6118, 5.748, 'marina', 'NL', 'Ketelmeer', 'ijsselmeer', 10060, now()),
 (gen_random_uuid()::text, 'Ketelhaven', 'ketelhaven', 52.581, 5.7609, 'marina', 'NL', 'Ketelmeer', 'ijsselmeer', 10070, now()),
 (gen_random_uuid()::text, 'Lelystad (Houtribhaven)', 'lelystad-houtribhaven', 52.5316, 5.4393, 'marina', 'NL', 'IJsselmeer', 'ijsselmeer', 10080, now()),
 (gen_random_uuid()::text, 'Enkhuizen', 'enkhuizen', 52.7043, 5.3008, 'marina', 'NL', 'IJsselmeer', 'ijsselmeer', 10090, now()),
 (gen_random_uuid()::text, 'Andijk', 'andijk', 52.7465, 5.1825, 'marina', 'NL', 'IJsselmeer', 'ijsselmeer', 10100, now()),
 (gen_random_uuid()::text, 'Medemblik', 'medemblik', 52.7707, 5.1056, 'marina', 'NL', 'IJsselmeer', 'ijsselmeer', 10110, now()),
 (gen_random_uuid()::text, 'Den Oever', 'den-oever', 52.9239, 5.0457, 'marina', 'NL', 'IJsselmeer', 'ijsselmeer', 10120, now()),
 (gen_random_uuid()::text, 'Hoorn', 'hoorn', 52.6352, 5.0651, 'marina', 'NL', 'Markermeer', 'ijsselmeer', 10130, now()),
 (gen_random_uuid()::text, 'Edam', 'edam', 52.5177, 5.0732, 'marina', 'NL', 'Markermeer', 'ijsselmeer', 10140, now()),
 (gen_random_uuid()::text, 'Volendam', 'volendam', 52.4887, 5.0646, 'marina', 'NL', 'Markermeer', 'ijsselmeer', 10150, now()),
 (gen_random_uuid()::text, 'Monnickendam', 'monnickendam', 52.4622, 5.0386, 'marina', 'NL', 'Markermeer', 'ijsselmeer', 10160, now()),
 (gen_random_uuid()::text, 'Marken', 'marken', 52.458, 5.1002, 'port', 'NL', 'Markermeer', 'ijsselmeer', 10170, now()),
 (gen_random_uuid()::text, 'Uitdam', 'uitdam', 52.4277, 5.0755, 'marina', 'NL', 'Markermeer', 'ijsselmeer', 10180, now()),
 (gen_random_uuid()::text, 'Lelystad (Bataviahaven)', 'lelystad-bataviahaven', 52.5176, 5.4382, 'marina', 'NL', 'Markermeer', 'ijsselmeer', 10190, now()),
 (gen_random_uuid()::text, 'Durgerdam', 'durgerdam', 52.3779, 4.9934, 'marina', 'NL', 'IJmeer', 'ijsselmeer', 10200, now()),
 (gen_random_uuid()::text, 'Muiderzand', 'muiderzand', 52.3401, 5.1325, 'marina', 'NL', 'IJmeer', 'ijsselmeer', 10210, now()),
 (gen_random_uuid()::text, 'Muiden', 'muiden', 52.3352, 5.0688, 'marina', 'NL', 'IJmeer', 'ijsselmeer', 10220, now()),
 (gen_random_uuid()::text, 'Almere-Haven', 'almere-haven', 52.3321, 5.2186, 'marina', 'NL', 'Gooimeer', 'ijsselmeer', 10230, now()),
 (gen_random_uuid()::text, 'Huizen', 'huizen', 52.3075, 5.2434, 'marina', 'NL', 'Gooimeer', 'ijsselmeer', 10240, now())
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, lat = EXCLUDED.lat, lon = EXCLUDED.lon, type = EXCLUDED.type,
  region = EXCLUDED.region, "coastSegment" = EXCLUDED."coastSegment", "coastlineNm" = EXCLUDED."coastlineNm",
  "updatedAt" = now();
COMMIT;
