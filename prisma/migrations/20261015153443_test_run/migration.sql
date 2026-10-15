-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('OPEN', 'FINALIZED');

-- CreateTable
CREATE TABLE "TestRun" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "releaseId" UUID NOT NULL,
    "buildId" UUID NOT NULL,
    "environmentId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedAt" TIMESTAMP(3),

    CONSTRAINT "TestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestRunItem" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "testCaseId" UUID NOT NULL,
    "snapshot" JSONB NOT NULL,
    "assigneeId" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestRunItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestResult" (
    "id" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "actualResult" TEXT,
    "reason" TEXT,
    "stepResults" JSONB,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TestRun_projectId_idx" ON "TestRun"("projectId");

-- CreateIndex
CREATE INDEX "TestRun_buildId_idx" ON "TestRun"("buildId");

-- CreateIndex
CREATE INDEX "TestRunItem_runId_idx" ON "TestRunItem"("runId");

-- CreateIndex
CREATE INDEX "TestRunItem_testCaseId_idx" ON "TestRunItem"("testCaseId");

-- CreateIndex
CREATE INDEX "TestResult_itemId_idx" ON "TestResult"("itemId");

-- AddForeignKey
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "Build"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRunItem" ADD CONSTRAINT "TestRunItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "TestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "TestRunItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
