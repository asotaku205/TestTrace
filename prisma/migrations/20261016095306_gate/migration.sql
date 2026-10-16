-- CreateEnum
CREATE TYPE "GateVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "QualityGate" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualityGate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GateVersion" (
    "id" UUID NOT NULL,
    "gateId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "rules" JSONB NOT NULL,
    "status" "GateVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QualityGate_projectId_idx" ON "QualityGate"("projectId");

-- CreateIndex
CREATE INDEX "GateVersion_gateId_idx" ON "GateVersion"("gateId");

-- CreateIndex
CREATE UNIQUE INDEX "GateVersion_gateId_version_key" ON "GateVersion"("gateId", "version");

-- AddForeignKey
ALTER TABLE "QualityGate" ADD CONSTRAINT "QualityGate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateVersion" ADD CONSTRAINT "GateVersion_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "QualityGate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
