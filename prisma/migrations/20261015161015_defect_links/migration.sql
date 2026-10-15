-- AlterTable
ALTER TABLE "Defect" ADD COLUMN     "retestRunId" UUID,
ADD COLUMN     "sourceResultId" UUID;

-- AddForeignKey
ALTER TABLE "Defect" ADD CONSTRAINT "Defect_sourceResultId_fkey" FOREIGN KEY ("sourceResultId") REFERENCES "TestResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Defect" ADD CONSTRAINT "Defect_retestRunId_fkey" FOREIGN KEY ("retestRunId") REFERENCES "TestRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
