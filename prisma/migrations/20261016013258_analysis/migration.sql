-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('SUCCEEDED', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "Analysis" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" TEXT,
    "language" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "adapterId" TEXT NOT NULL,
    "adapterVersion" TEXT NOT NULL,
    "configHash" TEXT NOT NULL,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'SUCCEEDED',
    "diagnostics" JSONB,
    "graph" JSONB,
    "metrics" JSONB,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Analysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Analysis_projectId_idx" ON "Analysis"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Analysis_projectId_sourceHash_adapterVersion_configHash_key" ON "Analysis"("projectId", "sourceHash", "adapterVersion", "configHash");

-- AddForeignKey
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
