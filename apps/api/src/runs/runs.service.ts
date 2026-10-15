// Use case test run: lập run từ suite/bộ lọc/danh sách, snapshot revision (nguồn: M06 + RUN-01).
// Item trỏ snapshot, không trỏ test live (invariant). Thực thi + finalize ở RUN-02.
import { Inject, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createAuditEvent, runProgress } from '@testtrace/domain';
import { PRISMA } from '../prisma.module.js';
import { requireAction, requireMember } from '../projects/access.js';

function fail(code: string, message: string): never {
  throw Object.assign(new Error(message), { code });
}

export interface RunSource {
  suiteId?: string;
  testCaseIds?: string[];
  status?: string;
  priority?: string;
  tag?: string;
}

@Injectable()
export class RunsService {
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

  async create(
    userId: string,
    projectId: string,
    input: {
      name: string;
      releaseId: string;
      buildId: string;
      environmentId: string;
      source: RunSource;
    },
  ) {
    const member = await requireMember(this.db, projectId, userId);
    requireAction(member.role, 'requirement:write');
    if (typeof input.name !== 'string' || input.name.trim().length === 0)
      fail('VALIDATION_ERROR', 'Tên run bắt buộc');
    const [release, build, environment] = await Promise.all([
      this.db.release.findFirst({ where: { id: input.releaseId, projectId } }),
      this.db.build.findFirst({ where: { id: input.buildId } }),
      this.db.environment.findFirst({ where: { id: input.environmentId, projectId } }),
    ]);
    if (!release) fail('RELEASE_NOT_FOUND', 'Release không tồn tại');
    if (!build || build.releaseId !== input.releaseId)
      fail('RUN_BUILD_MISMATCH', 'Build không thuộc release này');
    if (!environment) fail('ENV_NOT_FOUND', 'Environment không tồn tại');

    const where = {
      projectId,
      status: { not: 'RETIRED' as never },
      ...(input.source.suiteId ? { suiteId: input.source.suiteId } : {}),
      ...(input.source.testCaseIds ? { id: { in: input.source.testCaseIds } } : {}),
      ...(input.source.status ? { status: input.source.status as never } : {}),
      ...(input.source.priority ? { priority: input.source.priority } : {}),
      ...(input.source.tag ? { tags: { has: input.source.tag } } : {}),
    };
    const cases = await this.db.testCase.findMany({
      where,
      include: { steps: { orderBy: { position: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
    if (cases.length === 0) fail('RUN_EMPTY_SOURCE', 'Nguồn không có test case khả dụng');
    const run = await this.db.testRun.create({
      data: {
        projectId,
        releaseId: input.releaseId,
        buildId: input.buildId,
        environmentId: input.environmentId,
        name: input.name.trim(),
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
      include: { items: { orderBy: { position: 'asc' } } },
    });
    await this.appendAudit({
      projectId,
      actorId: userId,
      entityType: 'run',
      entityId: run.id,
      action: 'run.created',
    });
    return run;
  }

  async get(userId: string, projectId: string, runId: string) {
    await requireMember(this.db, projectId, userId);
    const run = await this.db.testRun.findFirst({
      where: { id: runId, projectId },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: { results: { orderBy: { createdAt: 'desc' }, take: 1 } },
        },
      },
    });
    if (!run) fail('RUN_NOT_FOUND', 'Test run không tồn tại');
    const progress = runProgress(run.items.map((item) => item.results.length > 0));
    return { ...run, progress };
  }

  async list(userId: string, projectId: string) {
    await requireMember(this.db, projectId, userId);
    return this.db.testRun.findMany({
      where: { projectId },
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async assign(
    userId: string,
    projectId: string,
    runId: string,
    assignments: Array<{ itemId: string; assigneeId: string | null }>,
  ) {
    const member = await requireMember(this.db, projectId, userId);
    requireAction(member.role, 'requirement:write');
    const run = await this.db.testRun.findFirst({ where: { id: runId, projectId } });
    if (!run) fail('RUN_NOT_FOUND', 'Test run không tồn tại');
    if (run.status !== 'OPEN') fail('RUN_FINALIZED', 'Run đã hoàn tất, không đổi assignment');
    await this.db.$transaction(
      assignments.map((a) =>
        this.db.testRunItem.updateMany({
          where: { id: a.itemId, runId },
          data: { assigneeId: a.assigneeId },
        }),
      ),
    );
    return this.get(userId, projectId, runId);
  }

  private static validResultStatus(
    status: unknown,
  ): status is 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIPPED' {
    return status === 'PASS' || status === 'FAIL' || status === 'BLOCKED' || status === 'SKIPPED';
  }

  async recordResult(
    userId: string,
    projectId: string,
    runId: string,
    itemId: string,
    input: { status: string; actualResult?: string; reason?: string; stepResults?: unknown },
  ) {
    const member = await requireMember(this.db, projectId, userId);
    requireAction(member.role, 'requirement:write');
    const run = await this.db.testRun.findFirst({ where: { id: runId, projectId } });
    if (!run) fail('RUN_NOT_FOUND', 'Test run không tồn tại');
    if (run.status !== 'OPEN') fail('RUN_FINALIZED', 'Run đã hoàn tất, không ghi kết quả');
    const item = await this.db.testRunItem.findFirst({ where: { id: itemId, runId } });
    if (!item) fail('RUN_ITEM_NOT_FOUND', 'Run item không tồn tại');
    if (!RunsService.validResultStatus(input.status))
      fail('RESULT_VALIDATION', 'Trạng thái phải là PASS/FAIL/BLOCKED/SKIPPED');
    if (
      input.status === 'FAIL' &&
      !(typeof input.actualResult === 'string' && input.actualResult.trim())
    ) {
      fail('RESULT_VALIDATION', 'FAIL bắt buộc có actual result');
    }
    if (input.status === 'BLOCKED' && !(typeof input.reason === 'string' && input.reason.trim())) {
      fail('RESULT_VALIDATION', 'BLOCKED bắt buộc có lý do');
    }
    const result = await this.db.testResult.create({
      data: {
        itemId,
        status: input.status,
        actualResult: input.actualResult,
        reason: input.reason,
        stepResults: (input.stepResults ?? undefined) as never,
        createdBy: userId,
      },
    });
    await this.appendAudit({
      projectId,
      actorId: userId,
      entityType: 'result',
      entityId: result.id,
      action: 'result.recorded',
    });
    return result;
  }

  async finalize(userId: string, projectId: string, runId: string, version: number) {
    const member = await requireMember(this.db, projectId, userId);
    requireAction(member.role, 'requirement:write');
    const run = await this.db.testRun.findFirst({ where: { id: runId, projectId } });
    if (!run) fail('RUN_NOT_FOUND', 'Test run không tồn tại');
    if (run.status !== 'OPEN') fail('RUN_FINALIZED', 'Run đã hoàn tất');
    if (version !== run.version) fail('RUN_VERSION_CONFLICT', 'Run đã đổi, tải lại rồi thử lại');
    const finalized = await this.db.$transaction(async (tx) => {
      const updated = await tx.testRun.update({
        where: { id: runId },
        data: { status: 'FINALIZED', finalizedAt: new Date(), version: { increment: 1 } },
      });
      const items = await tx.testRunItem.findMany({
        where: { runId },
        include: { results: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });
      const summary: Record<string, number> = {};
      for (const item of items) {
        const status = item.results[0]?.status ?? 'PENDING';
        summary[status] = (summary[status] ?? 0) + 1;
      }
      return { ...updated, summary };
    });
    await this.appendAudit({
      projectId,
      actorId: userId,
      entityType: 'run',
      entityId: runId,
      action: 'run.finalized',
    });
    return finalized;
  }
}
