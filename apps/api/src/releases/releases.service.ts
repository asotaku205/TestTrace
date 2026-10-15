// Use case release/build/environment: CRUD, transition, freeze (nguồn: M03 + REL-01).
// Builds bất biến sau khi tạo (không update/delete); guard xóa environment khi có run
// thuộc RUN-01 (chưa có model TestRun ở ticket này).
import { Inject, Injectable } from '@nestjs/common';
import { PrismaClient, ReleaseStatus } from '@prisma/client';
import { canReleaseTransition, createAuditEvent } from '@testtrace/domain';
import { PRISMA } from '../prisma.module.js';
import { requireAction, requireMember } from '../projects/access.js';

function fail(code: string, message: string): never {
  throw Object.assign(new Error(message), { code });
}

@Injectable()
export class ReleasesService {
  constructor(@Inject(PRISMA) private readonly db: PrismaClient) {}

  private async appendAudit(input: {
    projectId: string;
    actorId: string;
    entityType: string;
    entityId: string;
    action: string;
  }): Promise<void> {
    const event = createAuditEvent(input);
    await this.db.auditEvent.create({
      data: {
        projectId: event.projectId,
        actorId: event.actorId,
        entityType: event.entityType,
        entityId: event.entityId,
        action: event.action,
        createdAt: new Date(event.at),
      },
    });
  }

  private async managed(userId: string, projectId: string) {
    const member = await requireMember(this.db, projectId, userId);
    requireAction(member.role, 'release:manage');
  }

  async createRelease(userId: string, projectId: string, name: string) {
    await this.managed(userId, projectId);
    if (typeof name !== 'string' || name.trim().length === 0)
      fail('VALIDATION_ERROR', 'Tên release bắt buộc');
    const release = await this.db.release.create({ data: { projectId, name: name.trim() } });
    await this.appendAudit({
      projectId,
      actorId: userId,
      entityType: 'release',
      entityId: release.id,
      action: 'release.created',
    });
    return release;
  }

  async listReleases(userId: string, projectId: string) {
    await requireMember(this.db, projectId, userId);
    return this.db.release.findMany({
      where: { projectId },
      include: { builds: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getRelease(userId: string, projectId: string, releaseId: string) {
    await requireMember(this.db, projectId, userId);
    const release = await this.db.release.findFirst({
      where: { id: releaseId, projectId },
      include: { builds: { orderBy: { createdAt: 'asc' } } },
    });
    if (!release) fail('RELEASE_NOT_FOUND', 'Release không tồn tại');
    return release;
  }

  async transition(userId: string, projectId: string, releaseId: string, to: ReleaseStatus) {
    await this.managed(userId, projectId);
    const current = await this.db.release.findFirst({ where: { id: releaseId, projectId } });
    if (!current) fail('RELEASE_NOT_FOUND', 'Release không tồn tại');
    if (!canReleaseTransition(current.status, to)) {
      throw Object.assign(new Error(`Không chuyển được từ ${current.status} sang ${to}`), {
        code: 'RELEASE_STATE',
      });
    }
    const release = await this.db.release.update({
      where: { id: releaseId },
      data: { status: to, ...(to === 'RELEASED' ? { frozen: true } : {}) },
    });
    await this.appendAudit({
      projectId,
      actorId: userId,
      entityType: 'release',
      entityId: releaseId,
      action: 'release.transitioned',
    });
    return release;
  }

  async freeze(userId: string, projectId: string, releaseId: string) {
    await this.managed(userId, projectId);
    const current = await this.db.release.findFirst({ where: { id: releaseId, projectId } });
    if (!current) fail('RELEASE_NOT_FOUND', 'Release không tồn tại');
    const release = await this.db.release.update({
      where: { id: releaseId },
      data: { frozen: true },
    });
    await this.appendAudit({
      projectId,
      actorId: userId,
      entityType: 'release',
      entityId: releaseId,
      action: 'release.frozen',
    });
    return release;
  }

  async createBuild(userId: string, projectId: string, releaseId: string, number: string) {
    await this.managed(userId, projectId);
    const release = await this.db.release.findFirst({ where: { id: releaseId, projectId } });
    if (!release) fail('RELEASE_NOT_FOUND', 'Release không tồn tại');
    if (release.frozen) fail('RELEASE_FROZEN', 'Release đã freeze, không thêm build');
    if (typeof number !== 'string' || number.trim().length === 0)
      fail('VALIDATION_ERROR', 'Build number bắt buộc');
    try {
      const build = await this.db.build.create({
        data: { releaseId, number: number.trim() },
      });
      await this.appendAudit({
        projectId,
        actorId: userId,
        entityType: 'build',
        entityId: build.id,
        action: 'build.created',
      });
      return build;
    } catch (err) {
      if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
        fail('BUILD_EXISTS', 'Build number đã tồn tại trong release');
      }
      throw err;
    }
  }

  async createEnvironment(userId: string, projectId: string, name: string) {
    await this.managed(userId, projectId);
    if (typeof name !== 'string' || name.trim().length === 0)
      fail('VALIDATION_ERROR', 'Tên environment bắt buộc');
    try {
      return await this.db.environment.create({ data: { projectId, name: name.trim() } });
    } catch (err) {
      if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
        fail('ENV_EXISTS', 'Environment đã tồn tại trong project');
      }
      throw err;
    }
  }

  async listEnvironments(userId: string, projectId: string) {
    await requireMember(this.db, projectId, userId);
    return this.db.environment.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } });
  }

  async deleteEnvironment(userId: string, projectId: string, envId: string) {
    await this.managed(userId, projectId);
    const env = await this.db.environment.findFirst({ where: { id: envId, projectId } });
    if (!env) fail('ENV_NOT_FOUND', 'Environment không tồn tại');
    await this.db.environment.delete({ where: { id: envId } });
    return { removed: true };
  }
}
