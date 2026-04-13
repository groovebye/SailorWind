-- CreateTable
CREATE TABLE "VesselProfile" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "loaMeters" DOUBLE PRECISION NOT NULL,
    "draftMeters" DOUBLE PRECISION NOT NULL,
    "engineCruiseKt" DOUBLE PRECISION NOT NULL,
    "engineMaxKt" DOUBLE PRECISION,
    "notes" TEXT,
    "performanceModel" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VesselProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegComputation" (
    "id" TEXT NOT NULL,
    "passageId" TEXT NOT NULL,
    "legIndex" INTEGER NOT NULL,
    "vesselProfileId" TEXT NOT NULL,
    "forecastSignature" TEXT NOT NULL,
    "routeSignature" TEXT NOT NULL,
    "vesselSignature" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "timeline" JSONB NOT NULL,
    "warnings" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegComputation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VesselProfile_slug_key" ON "VesselProfile"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "LegComputation_passageId_legIndex_forecastSignature_routeSign_key"
ON "LegComputation"("passageId", "legIndex", "forecastSignature", "routeSignature", "vesselSignature");

-- CreateIndex
CREATE INDEX "LegComputation_passageId_legIndex_updatedAt_idx"
ON "LegComputation"("passageId", "legIndex", "updatedAt");

-- AddForeignKey
ALTER TABLE "LegComputation"
ADD CONSTRAINT "LegComputation_passageId_fkey"
FOREIGN KEY ("passageId") REFERENCES "Passage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegComputation"
ADD CONSTRAINT "LegComputation_vesselProfileId_fkey"
FOREIGN KEY ("vesselProfileId") REFERENCES "VesselProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
