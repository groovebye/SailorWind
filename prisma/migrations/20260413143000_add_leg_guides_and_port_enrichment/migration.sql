-- AlterTable
ALTER TABLE "Port"
ADD COLUMN "extras" JSONB,
ADD COLUMN "marinaFacilities" JSONB,
ADD COLUMN "sourceVerification" JSONB;

-- AlterTable
ALTER TABLE "Passage"
ADD COLUMN "forecastCache" JSONB;

-- CreateTable
CREATE TABLE "LegGuide" (
    "id" TEXT NOT NULL,
    "fromSlug" TEXT NOT NULL,
    "toSlug" TEXT NOT NULL,
    "difficulty" TEXT,
    "description" TEXT,
    "pilotageText" TEXT,
    "milestones" JSONB,
    "hazards" JSONB,
    "fallbackPorts" JSONB,
    "tidalNotes" TEXT,
    "tidalGate" TEXT,
    "currentNotes" TEXT,
    "bestWindow" TEXT,
    "nightNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegGuide_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LegGuide_fromSlug_toSlug_key" ON "LegGuide"("fromSlug", "toSlug");
