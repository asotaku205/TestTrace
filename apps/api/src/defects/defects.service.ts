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

  async fromResult(userId: string, projectId: string, resultId: string, severity?: string) {
    const member = await requireMember(this.db, projectId, userId);
    if (member.role === 'VIEWER') fail('PROJECT_FORBIDDEN', 'Vai trò không được phép');
    const result = await this.db.testResult.findUnique({
      where: { id: resultId },
      include: { item: { include: { run: true } } },
    });
    if (!result || result.item.run.projectId !== projectId)
      fail('DEFECT_SOURCE', 'Kết quả không thuộc project này');
    if (result.status !== 'FAIL') fail('DEFECT_SOURCE', 'Chỉ tạo defect từ kết quả FAIL');
    if (severity !== undefined && !severities.includes(severity)) {
      fail('VALIDATION_ERROR', `Severity phải trong ${severities.join('/')}`);
    }
    const snapshot = result.item.snapshot as { code?: string; title?: string };
    const defect = await this.db.defect.create({
      data: {
        projectId,
        code: await this.nextCode(projectId),
        title: `Lỗi từ ${snapshot.code ?? 'test'}: ${snapshot.title ?? ''}`.trim(),
        description: result.actualResult,
        severity: severity ?? 'MAJOR',
        reporterId: userId,
        sourceResultId: resultId,
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

  async retest(
    userId: string,
    projectId: string,
    id: string,
    input: { buildId: string; environmentId: string },
  ) {
    const member = await requireMember(this.db, projectId, userId);
    if (member.role === 'VIEWER') fail('PROJECT_FORBIDDEN', 'Vai trò không được phép');
    const defect = await this.db.defect.findFirst({
      where: { id, projectId },
      include: { sourceResult: { include: { item: true } } },
    });
    if (!defect) fail('DEFECT_NOT_FOUND', 'Defect không tồn tại');
    if (defect.status !== 'FIXED') fail('DEFECT_STATE', 'Chỉ retest defect đã FIXED');
    const build = await this.db.build.findFirst({ where: { id: input.buildId } });
    if (!build) fail('DEFECT_FIXED_BUILD', 'Build retest không tồn tại');
    const release = await this.db.release.findFirst({
      where: { id: build.releaseId, projectId },
    });
    if (!release) fail('DEFECT_FIXED_BUILD', 'Build retest không thuộc project này');
    const environment = await this.db.environment.findFirst({
      where: { id: input.environmentId, projectId },
    });
    if (!environment) fail('ENV_NOT_FOUND', 'Environment không tồn tại');
    const testCaseIds = defect.sourceResult ? [defect.sourceResult.item.testCaseId] : [];
    if (testCaseIds.length === 0) fail('DEFECT_SOURCE', 'Defect không gắn kết quả gốc');
    const cases = await this.db.testCase.findMany({
      where: { id: { in: testCaseIds }, projectId, status: { not: 'RETIRED' as never } },
      include: { steps: { orderBy: { position: 'asc' } } },
    });
    const run = await this.db.testRun.create({
      data: {
        projectId,
        releaseId: release.id,
        buildId: build.id,
        environmentId: environment.id,
        name: `Retest ${defect.code}`,
        createdBy: userId,
        items: {
          create: cases.map((c, index) => ({
            testCaseId: c.id,
            position: index + 1,
            snapshot: {
              code: c.code,
              title: c.title,
              priority: c.priority,
              type: c.type,
              expectedResult: c.expectedResult,
              steps: c.steps.map((s) => ({ action: s.action, expected: s.expected })),
            },
          })),
        },
      },
    });
    await this.db.defect.update({ where: { id }, data: { retestRunId: run.id } });
    await this.transition(userId, projectId, id, 'RETEST');
    await this.appendAudit({
      projectId,
      actorId: userId,
      entityType: 'run',
      entityId: run.id,
      action: 'run.created',
    });
    return this.db.defect.findUniqueOrThrow({ where: { id } });
  }

  async retestResolve(userId: string, projectId: string, id: string, resultId: string) {
    await requireMember(this.db, projectId, userId);
    const defect = await this.db.defect.findFirst({ where: { id, projectId } });
    if (!defect) fail('DEFECT_NOT_FOUND', 'Defect không tồn tại');
    if (defect.status !== 'RETEST') fail('DEFECT_STATE', 'Chỉ chốt defect đang RETEST');
    if (!defect.retestRunId) fail('DEFECT_SOURCE', 'Defect chưa có retest run');
    const result = await this.db.testResult.findUnique({
      where: { id: resultId },
      include: { item: true },
    });
    if (!result || result.item.runId !== defect.retestRunId)
      fail('DEFECT_SOURCE', 'Kết quả không thuộc retest run này');
    if (result.status === 'PASS') {
      return this.transition(userId, projectId, id, 'CLOSED');
    }
    if (result.status === 'FAIL') {
      return this.transition(userId, projectId, id, 'REOPENED');
    }
    fail('DEFECT_SOURCE', 'Chỉ chốt bằng kết quả PASS hoặc FAIL');
  }
}
