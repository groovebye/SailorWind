-- CreateEnum
CREATE TYPE "PortType" AS ENUM ('marina', 'port', 'anchorage', 'cape');

-- CreateEnum
CREATE TYPE "PassageMode" AS ENUM ('daily', 'nonstop');

-- CreateTable
CREATE TABLE "Port" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "type" "PortType" NOT NULL,
    "country" TEXT NOT NULL,
    "region" TEXT,
    "fuel" BOOLEAN NOT NULL DEFAULT false,
    "water" BOOLEAN NOT NULL DEFAULT false,
    "electric" BOOLEAN NOT NULL DEFAULT false,
    "repairs" BOOLEAN NOT NULL DEFAULT false,
    "customs" BOOLEAN NOT NULL DEFAULT false,
    "shelter" TEXT,
    "maxDraft" DOUBLE PRECISION,
    "vhfCh" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "coastSegment" TEXT NOT NULL,
    "coastlineNm" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Port_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Passage" (
    "id" TEXT NOT NULL,
    "shortId" TEXT NOT NULL,
    "name" TEXT,
    "departure" TIMESTAMP(3) NOT NULL,
    "speed" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "mode" "PassageMode" NOT NULL DEFAULT 'daily',
    "model" TEXT NOT NULL DEFAULT 'ecmwf_ifs025',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Passage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassagePort" (
    "id" TEXT NOT NULL,
    "passageId" TEXT NOT NULL,
    "portId" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "PassagePort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassageWaypoint" (
    "id" TEXT NOT NULL,
    "passageId" TEXT NOT NULL,
    "portId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isStop" BOOLEAN NOT NULL DEFAULT false,
    "isCape" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PassageWaypoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Port_slug_key" ON "Port"("slug");

-- CreateIndex
CREATE INDEX "Port_coastSegment_coastlineNm_idx" ON "Port"("coastSegment", "coastlineNm");

-- CreateIndex
CREATE INDEX "Port_country_idx" ON "Port"("country");

-- CreateIndex
CREATE INDEX "Port_lat_lon_idx" ON "Port"("lat", "lon");

-- CreateIndex
CREATE UNIQUE INDEX "Passage_shortId_key" ON "Passage"("shortId");

-- CreateIndex
CREATE UNIQUE INDEX "PassagePort_passageId_role_key" ON "PassagePort"("passageId", "role");

-- CreateIndex
CREATE INDEX "PassageWaypoint_passageId_idx" ON "PassageWaypoint"("passageId");

-- CreateIndex
CREATE UNIQUE INDEX "PassageWaypoint_passageId_sortOrder_key" ON "PassageWaypoint"("passageId", "sortOrder");

-- AddForeignKey
ALTER TABLE "PassagePort" ADD CONSTRAINT "PassagePort_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "Passage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassagePort" ADD CONSTRAINT "PassagePort_portId_fkey" FOREIGN KEY ("portId") REFERENCES "Port"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassageWaypoint" ADD CONSTRAINT "PassageWaypoint_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "Passage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassageWaypoint" ADD CONSTRAINT "PassageWaypoint_portId_fkey" FOREIGN KEY ("portId") REFERENCES "Port"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
