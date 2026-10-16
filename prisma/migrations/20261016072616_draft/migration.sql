-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "DesignModel" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignInput" (
    "id" UUID NOT NULL,
    "modelId" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignInput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestDraft" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "modelId" UUID,
    "technique" TEXT NOT NULL,
    "sourceRef" JSONB NOT NULL,
    "sources" JSONB NOT NULL,
    "inputs" JSONB NOT NULL,
    "expectedResult" TEXT,
    "oracleStatus" TEXT NOT NULL DEFAULT 'DEFINED',
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "assumptions" JSONB,
    "status" "DraftStatus" NOT NULL DEFAULT 'PENDING',
    "fingerprint" TEXT NOT NULL,
    "testCaseId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftReview" (
    "id" UUID NOT NULL,
    "draftId" UUID NOT NULL,
    "decision" TEXT NOT NULL,
    "diff" JSONB,
    "reason" TEXT,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DraftReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DesignModel_projectId_idx" ON "DesignModel"("projectId");

-- CreateIndex
CREATE INDEX "DesignInput_modelId_idx" ON "DesignInput"("modelId");

-- CreateIndex
CREATE INDEX "TestDraft_projectId_status_idx" ON "TestDraft"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TestDraft_projectId_fingerprint_key" ON "TestDraft"("projectId", "fingerprint");

-- CreateIndex
CREATE INDEX "DraftReview_draftId_idx" ON "DraftReview"("draftId");

-- AddForeignKey
ALTER TABLE "DesignModel" ADD CONSTRAINT "DesignModel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignInput" ADD CONSTRAINT "DesignInput_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "DesignModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestDraft" ADD CONSTRAINT "TestDraft_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestDraft" ADD CONSTRAINT "TestDraft_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "DesignModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftReview" ADD CONSTRAINT "DraftReview_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "TestDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
