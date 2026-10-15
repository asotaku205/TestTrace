-- CreateEnum
CREATE TYPE "RequirementStatus" AS ENUM ('DRAFT', 'APPROVED', 'DEPRECATED');

-- CreateTable
CREATE TABLE "Requirement" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "RequirementStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Requirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcceptanceCriterion" (
    "id" UUID NOT NULL,
    "requirementId" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcceptanceCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Requirement_projectId_status_idx" ON "Requirement"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Requirement_projectId_code_key" ON "Requirement"("projectId", "code");

-- CreateIndex
CREATE INDEX "AcceptanceCriterion_requirementId_idx" ON "AcceptanceCriterion"("requirementId");

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcceptanceCriterion" ADD CONSTRAINT "AcceptanceCriterion_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
