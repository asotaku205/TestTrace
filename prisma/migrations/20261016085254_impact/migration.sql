-- CreateTable
CREATE TABLE "ImpactAnalysis" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "fromVersionId" UUID NOT NULL,
    "toVersionId" UUID NOT NULL,
    "result" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImpactAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImpactAnalysis_projectId_idx" ON "ImpactAnalysis"("projectId");

-- AddForeignKey
ALTER TABLE "ImpactAnalysis" ADD CONSTRAINT "ImpactAnalysis_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
