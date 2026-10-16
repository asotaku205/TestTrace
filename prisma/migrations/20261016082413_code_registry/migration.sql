-- CreateTable
CREATE TABLE "CodeArtifact" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "language" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodeArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodeVersion" (
    "id" UUID NOT NULL,
    "artifactId" UUID NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "analysisId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodeUnit" (
    "id" UUID NOT NULL,
    "artifactId" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "qualifiedName" TEXT NOT NULL,
    "signatureHash" TEXT NOT NULL,
    "sourceRange" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodeUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementCodeUnit" (
    "id" UUID NOT NULL,
    "requirementId" UUID NOT NULL,
    "artifactId" UUID NOT NULL,
    "qualifiedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequirementCodeUnit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CodeArtifact_projectId_idx" ON "CodeArtifact"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "CodeArtifact_projectId_language_name_key" ON "CodeArtifact"("projectId", "language", "name");

-- CreateIndex
CREATE INDEX "CodeVersion_artifactId_idx" ON "CodeVersion"("artifactId");

-- CreateIndex
CREATE UNIQUE INDEX "CodeVersion_artifactId_sourceHash_key" ON "CodeVersion"("artifactId", "sourceHash");

-- CreateIndex
CREATE INDEX "CodeUnit_artifactId_qualifiedName_idx" ON "CodeUnit"("artifactId", "qualifiedName");

-- CreateIndex
CREATE UNIQUE INDEX "CodeUnit_versionId_qualifiedName_key" ON "CodeUnit"("versionId", "qualifiedName");

-- CreateIndex
CREATE INDEX "RequirementCodeUnit_artifactId_qualifiedName_idx" ON "RequirementCodeUnit"("artifactId", "qualifiedName");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementCodeUnit_requirementId_artifactId_qualifiedName_key" ON "RequirementCodeUnit"("requirementId", "artifactId", "qualifiedName");

-- AddForeignKey
ALTER TABLE "CodeArtifact" ADD CONSTRAINT "CodeArtifact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeVersion" ADD CONSTRAINT "CodeVersion_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "CodeArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeUnit" ADD CONSTRAINT "CodeUnit_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "CodeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementCodeUnit" ADD CONSTRAINT "RequirementCodeUnit_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
