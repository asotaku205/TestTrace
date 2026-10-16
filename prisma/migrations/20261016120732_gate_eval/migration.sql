-- CreateTable
CREATE TABLE "GateEvaluation" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "gateId" UUID NOT NULL,
    "gateVersionId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "buildId" UUID NOT NULL,
    "verdict" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "rules" JSONB NOT NULL,
    "results" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GateEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GateEvaluation_projectId_idx" ON "GateEvaluation"("projectId");

-- CreateIndex
CREATE INDEX "GateEvaluation_gateId_version_idx" ON "GateEvaluation"("gateId", "version");

-- CreateIndex
CREATE INDEX "GateEvaluation_buildId_idx" ON "GateEvaluation"("buildId");

-- AddForeignKey
ALTER TABLE "GateEvaluation" ADD CONSTRAINT "GateEvaluation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
