// Registry đọc + link requirement–unit (nguồn: M09 + REG-01).
// Trích unit lúc phân tích nằm ở hook syncRegistry trong AnalysesService.
import { Inject, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PRISMA } from '../prisma.module.js';
import { requireAction, requireMember } from '../projects/access.js';

function fail(code: string, message: string): never {
  throw Object.assign(new Error(message), { code });
}

@Injectable()
export class CodeUnitsService {
  constructor(@Inject(PRISMA) private readonly db: PrismaClient) {}

  async listArtifacts(userId: string, projectId: string) {
    await requireMember(this.db, projectId, userId);
    return this.db.codeArtifact.findMany({
      where: { projectId },
      include: { versions: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async listVersions(userId: string, projectId: string, artifactId: string) {
    await requireMember(this.db, projectId, userId);
    const artifact = await this.db.codeArtifact.findFirst({ where: { id: artifactId, projectId } });
    if (!artifact) fail('ARTIFACT_NOT_FOUND', 'Artifact không tồn tại');
    return this.db.codeVersion.findMany({
      where: { artifactId },
      include: { units: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async linkRequirement(
    userId: string,
    projectId: string,
    requirementId: string,
    artifactId: string,
    qualifiedName: string,
  ) {
    const member = await requireMember(this.db, projectId, userId);
    requireAction(member.role, 'requirement:write');
    const [requirement, artifact] = await Promise.all([
      this.db.requirement.findFirst({ where: { id: requirementId, projectId } }),
      this.db.codeArtifact.findFirst({ where: { id: artifactId, projectId } }),
    ]);
    if (!requirement) fail('REQUIREMENT_NOT_FOUND', 'Requirement không tồn tại');
    if (!artifact) fail('ARTIFACT_NOT_FOUND', 'Artifact không tồn tại');
    const unit = await this.db.codeUnit.findFirst({ where: { artifactId, qualifiedName } });
    if (!unit) fail('UNIT_NOT_FOUND', 'Code unit không tồn tại');
    const existing = await this.db.requirementCodeUnit.findUnique({
      where: {
        requirementId_artifactId_qualifiedName: { requirementId, artifactId, qualifiedName },
      },
    });
    if (existing) return existing;
    return this.db.requirementCodeUnit.create({
      data: { requirementId, artifactId, qualifiedName },
    });
  }
}
