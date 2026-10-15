// Use case defect: CRUD, transition theo machine + vai trò, history (nguồn: M07 + BUG-01).
// Tạo từ kết quả Fail và retest link ở BUG-02.
import { Inject, Injectable } from '@nestjs/common';
import { DefectStatus, PrismaClient } from '@prisma/client';
import { canDefectTransition, createAuditEvent, rolesForDefectTransition } from '@testtrace/domain';
import { PRISMA } from '../prisma.module.js';
import { requireMember } from '../projects/access.js';

function fail(code: string, message: string): never {
  throw Object.assign(new Error(message), { code });
}

const severities = ['BLOCKER', 'CRITICAL', 'MAJOR', 'MINOR', 'TRIVIAL'];

@Injectable()
export class DefectsService {
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

  private async nextCode(projectId: string): Promise<string> {
    const count = await this.db.defect.count({ where: { projectId } });
    return `BUG-${String(count + 1).padStart(3, '0')}`;
  }

  async create(
    userId: string,
    projectId: string,
    input: {
      title: string;
      description?: string;
      stepsToReproduce?: string;
      severity?: string;
      priority?: string;
      assigneeId?: string;
    },
  ) {
    const member = await requireMember(this.db, projectId, userId);
    if (member.role === 'VIEWER') fail('PROJECT_FORBIDDEN', 'Vai trò không được phép');
    if (typeof input.title !== 'string' || input.title.trim().length === 0)
      fail('VALIDATION_ERROR', 'Tiêu đề defect bắt buộc');
    if (input.severity !== undefined && !severities.includes(input.severity)) {
      fail('VALIDATION_ERROR', `Severity phải trong ${severities.join('/')}`);
    }
    if (input.assigneeId) {
      const assignee = await this.db.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: input.assigneeId } },
      });
      if (!assignee) fail('MEMBER_NOT_FOUND', 'Assignee không phải member');
    }
    const defect = await this.db.defect.create({
      data: {
        projectId,
        code: await this.nextCode(projectId),
        title: input.title.trim(),
        description: input.description,
        stepsToReproduce: input.stepsToReproduce,
        severity: input.severity ?? 'MAJOR',
        priority: input.priority?.trim() || 'MEDIUM',
        reporterId: userId,
        assigneeId: input.assigneeId,
      },
    });
    await this.appendAudit({
      projectId,
      actorId: userId,
      entityType: 'defect',
      entityId: defect.id,
      action: 'defect.created',
    });
    return defect;
  }

  async list(
    userId: string,
    projectId: string,
    filters: { status?: string; severity?: string; assigneeId?: string },
  ) {
    await requireMember(this.db, projectId, userId);
    return this.db.defect.findMany({
      where: {
        projectId,
        ...(filters.status ? { status: filters.status as never } : {}),
        ...(filters.severity ? { severity: filters.severity } : {}),
        ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async get(userId: string, projectId: string, id: string) {
    await requireMember(this.db, projectId, userId);
    const defect = await this.db.defect.findFirst({
      where: { id, projectId },
      include: { history: { orderBy: { createdAt: 'asc' } } },
    });
    if (!defect) fail('DEFECT_NOT_FOUND', 'Defect không tồn tại');
    return defect;
  }

  async transition(
    userId: string,
    projectId: string,
    id: string,
    to: DefectStatus,
    fixedBuildId?: string,
  ) {
    const member = await requireMember(this.db, projectId, userId);
    const defect = await this.db.defect.findFirst({ where: { id, projectId } });
    if (!defect) fail('DEFECT_NOT_FOUND', 'Defect không tồn tại');
    if (!canDefectTransition(defect.status, to)) {
      throw Object.assign(new Error(`Không chuyển được từ ${defect.status} sang ${to}`), {
        code: 'DEFECT_STATE',
      });
    }
    if (!rolesForDefectTransition(defect.status, to).includes(member.role)) {
      fail('PROJECT_FORBIDDEN', 'Vai trò không được phép chuyển trạng thái này');
    }
    if (to === 'FIXED') {
      if (!fixedBuildId) fail('DEFECT_FIXED_BUILD', 'FIXED bắt buộc có fixed build');
      const build = await this.db.build.findFirst({ where: { id: fixedBuildId } });
      const release = build
        ? await this.db.release.findFirst({ where: { id: build.releaseId, projectId } })
        : null;
      if (!release) fail('DEFECT_FIXED_BUILD', 'Fixed build không thuộc project này');
    }
    const updated = await this.db.$transaction(async (tx) => {
      const next = await tx.defect.update({
        where: { id },
        data: { status: to, ...(to === 'FIXED' ? { fixedBuildId } : {}) },
      });
      await tx.defectHistory.create({
        data: { defectId: id, from: defect.status, to, actorId: userId },
      });
      return next;
    });
    await this.appendAudit({
      projectId,
      actorId: userId,
      entityType: 'defect',
      entityId: id,
      action: 'defect.transitioned',
    });
    return updated;
  }
}
