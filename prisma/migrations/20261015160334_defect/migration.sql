-- CreateEnum
CREATE TYPE "DefectStatus" AS ENUM ('NEW', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'FIXED', 'RETEST', 'CLOSED', 'REOPENED', 'REJECTED');

-- CreateTable
CREATE TABLE "Defect" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "stepsToReproduce" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'MAJOR',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" "DefectStatus" NOT NULL DEFAULT 'NEW',
    "reporterId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "fixedBuildId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Defect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DefectHistory" (
    "id" UUID NOT NULL,
    "defectId" UUID NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DefectHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Defect_projectId_status_idx" ON "Defect"("projectId", "status");

-- CreateIndex
CREATE INDEX "Defect_assigneeId_idx" ON "Defect"("assigneeId");

-- CreateIndex
CREATE UNIQUE INDEX "Defect_projectId_code_key" ON "Defect"("projectId", "code");

-- CreateIndex
CREATE INDEX "DefectHistory_defectId_idx" ON "DefectHistory"("defectId");

-- AddForeignKey
ALTER TABLE "Defect" ADD CONSTRAINT "Defect_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DefectHistory" ADD CONSTRAINT "DefectHistory_defectId_fkey" FOREIGN KEY ("defectId") REFERENCES "Defect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
