// Use case suite/test case/steps: CRUD, READY, revision, clone, search (nguồn: M04 + TEST-01).
// Sửa test READY sinh revision và về DRAFT để duyệt lại; RETIRED chỉ đọc.
import { Inject, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createAuditEvent, readinessGaps } from '@testtrace/domain';
import { PRISMA } from '../prisma.module.js';
import { requireAction, requireMember } from '../projects/access.js';

function fail(code: string, message: string): never {
  throw Object.assign(new Error(message), { code });
}

@Injectable()
export class TestCasesService {
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
    const count = await this.db.testCase.count({ where: { projectId } });
    return `TC-${String(count + 1).padStart(3, '0')}`;
  }

  private async snapshotRevision(testCaseId: string, userId: string): Promise<void> {
    const current = await this.db.testCase.findUniqueOrThrow({
      where: { id: testCaseId },
      include: { steps: { orderBy: { position: 'asc' } } },
    });
    const count = await this.db.testCaseRevision.count({ where: { testCaseId } });
    await this.db.testCaseRevision.create({
      data: {
        testCaseId,
        version: count + 1,
        title: current.title,
        priority: current.priority,
        type: current.type,
        expectedResult: current.expectedResult,
        steps: current.steps.map((s) => ({ action: s.action, expected: s.expected })),
        createdBy: userId,
      },
    });
  }

  async createSuite(userId: string, projectId: string, name: string, parentId?: string) {
    const member = await requireMember(this.db, projectId, userId);
    requireAction(member.role, 'requirement:write');
    if (typeof name !== 'string' || name.trim().length === 0)
      fail('VALIDATION_ERROR', 'Tên suite bắt buộc');
    if (parentId) {
      const parent = await this.db.testSuite.findFirst({ where: { id: parentId, projectId } });
      if (!parent) fail('SUITE_NOT_FOUND', 'Suite cha không tồn tại');
    }
    return this.db.testSuite.create({ data: { projectId, name: name.trim(), parentId } });
  }

  async listSuites(userId: string, projectId: string) {
    await requireMember(this.db, projectId, userId);
    return this.db.testSuite.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async deleteSuite(userId: string, projectId: string, suiteId: string) {
    const member = await requireMember(this.db, projectId, userId);
    requireAction(member.role, 'requirement:write');
    const suite = await this.db.testSuite.findFirst({ where: { id: suiteId, projectId } });
    if (!suite) fail('SUITE_NOT_FOUND', 'Suite không tồn tại');
    const [children, cases] = await Promise.all([
      this.db.testSuite.count({ where: { parentId: suiteId } }),
      this.db.testCase.count({ where: { suiteId } }),
    ]);
    if (children > 0 || cases > 0) fail('SUITE_NOT_EMPTY', 'Suite còn suite con hoặc test case');
    await this.db.testSuite.delete({ where: { id: suiteId } });
    return { removed: true };
  }

  async create(
    userId: string,
    projectId: string,
    input: {
      title: string;
      suiteId?: string;
      priority?: string;
      type?: string;
      expectedResult?: string;
      independentReason?: string;
      tags?: string[];
    },
  ) {
    const member = await requireMember(this.db, projectId, userId);
    requireAction(member.role, 'requirement:write');
    if (typeof input.title !== 'string' || input.title.trim().length === 0)
      fail('VALIDATION_ERROR', 'Tiêu đề test case bắt buộc');
    if (input.suiteId) {
      const suite = await this.db.testSuite.findFirst({
        where: { id: input.suiteId, projectId },
      });
      if (!suite) fail('SUITE_NOT_FOUND', 'Suite không tồn tại');
    }
    const testCase = await this.db.testCase.create({
      data: {
        projectId,
        code: await this.nextCode(projectId),
        title: input.title.trim(),
        suiteId: input.suiteId,
        priority: input.priority?.trim() || 'MEDIUM',
        type: input.type?.trim() || 'FUNCTIONAL',
        expectedResult: input.expectedResult,
        independentReason: input.independentReason,
        tags: input.tags ?? [],
      },
    });
    await this.appendAudit({
      projectId,
      actorId: userId,
      entityType: 'testcase',
      entityId: testCase.id,
      action: 'test.created',
    });
    return testCase;
  }

  async list(
    userId: string,
    projectId: string,
    filters: {
      q?: string;
      status?: string;
      priority?: string;
      tag?: string;
      requirementId?: string;
    },
  ) {
    await requireMember(this.db, projectId, userId);
    const items = await this.db.testCase.findMany({
      where: {
        projectId,
        ...(filters.status ? { status: filters.status as never } : {}),
        ...(filters.priority ? { priority: filters.priority } : {}),
        ...(filters.tag ? { tags: { has: filters.tag } } : {}),
        ...(filters.requirementId
          ? { links: { some: { requirementId: filters.requirementId } } }
          : {}),
        ...(filters.q
          ? { OR: [{ code: { contains: filters.q } }, { title: { contains: filters.q } }] }
          : {}),
      },
      include: { links: true },
      orderBy: { createdAt: 'asc' },
    });
    return items;
  }

  async get(userId: string, projectId: string, id: string) {
    await requireMember(this.db, projectId, userId);
    const testCase = await this.db.testCase.findFirst({
      where: { id, projectId },
      include: {
        steps: { orderBy: { position: 'asc' } },
        links: {
          include: {
            requirement: { select: { id: true, code: true, title: true, status: true } },
          },
        },
      },
    });
    if (!testCase) fail('TESTCASE_NOT_FOUND', 'Test case không tồn tại');
    const { links, ...rest } = testCase;
    return { ...rest, linkedRequirements: links.map((l) => l.requirement) };
  }

  async update(
    userId: string,
    projectId: string,
    id: string,
    input: {
      title?: string;
      priority?: string;
      type?: string;
      expectedResult?: string;
      independentReason?: string;
      tags?: string[];
      suiteId?: string | null;
    },
  ) {
    const member = await requireMember(this.db, projectId, userId);
    requireAction(member.role, 'requirement:write');
    const current = await this.db.testCase.findFirst({ where: { id, projectId } });
    if (!current) fail('TESTCASE_NOT_FOUND', 'Test case không tồn tại');
    if (current.status === 'RETIRED') fail('TESTCASE_RETIRED', 'Test RETIRED chỉ đọc');
    if (current.status === 'READY') {
      await this.snapshotRevision(id, userId);
    }
    if (input.suiteId !== undefined && input.suiteId !== null) {
      const suite = await this.db.testSuite.findFirst({ where: { id: input.suiteId, projectId } });
      if (!suite) fail('SUITE_NOT_FOUND', 'Suite không tồn tại');
    }
    const testCase = await this.db.testCase.update({
      where: { id },
      data: {
        ...(typeof input.title === 'string' ? { title: input.title.trim() } : {}),
        ...(typeof input.priority === 'string' ? { priority: input.priority } : {}),
        ...(typeof input.type === 'string' ? { type: input.type } : {}),
        ...(input.expectedResult !== undefined ? { expectedResult: input.expectedResult } : {}),
        ...(input.independentReason !== undefined
          ? { independentReason: input.independentReason }
          : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
        ...(input.suiteId !== undefined ? { suiteId: input.suiteId } : {}),
        ...(current.status === 'READY' ? { status: 'DRAFT' } : {}),
      },
    });
    await this.appendAudit({
      projectId,
      actorId: userId,
      entityType: 'testcase',
      entityId: id,
      action: 'test.updated',
    });
    return testCase;
  }

  async addStep(
    userId: string,
    projectId: string,
    testCaseId: string,
    action: string,
    expected?: string,
  ) {
    const member = await requireMember(this.db, projectId, userId);
    requireAction(member.role, 'requirement:write');
    const testCase = await this.db.testCase.findFirst({ where: { id: testCaseId, projectId } });
    if (!testCase) fail('TESTCASE_NOT_FOUND', 'Test case không tồn tại');
    if (testCase.status === 'RETIRED') fail('TESTCASE_RETIRED', 'Test RETIRED chỉ đọc');
    if (typeof action !== 'string' || action.trim().length === 0)
      fail('VALIDATION_ERROR', 'Thao tác step bắt buộc');
    const max = await this.db.testStep.findFirst({
      where: { testCaseId },
      orderBy: { position: 'desc' },
    });
    return this.db.testStep.create({
      data: { testCaseId, action: action.trim(), expected, position: (max?.position ?? 0) + 1 },
    });
  }

  async reorderSteps(userId: string, projectId: string, testCaseId: string, order: string[]) {
    const member = await requireMember(this.db, projectId, userId);
    requireAction(member.role, 'requirement:write');
    const testCase = await this.db.testCase.findFirst({
      where: { id: testCaseId, projectId },
      include: { steps: true },
    });
    if (!testCase) fail('TESTCASE_NOT_FOUND', 'Test case không tồn tại');
    if (testCase.status === 'RETIRED') fail('TESTCASE_RETIRED', 'Test RETIRED chỉ đọc');
    const ids = new Set(testCase.steps.map((s) => s.id));
    if (order.length !== ids.size || !order.every((id) => ids.has(id))) {
      fail('VALIDATION_ERROR', 'Thứ tự phải chứa đúng mọi step hiện có');
    }
    await this.db.$transaction(
      order.map((id, index) =>
        this.db.testStep.update({ where: { id }, data: { position: index + 1 } }),
      ),
    );
    return this.db.testStep.findMany({ where: { testCaseId }, orderBy: { position: 'asc' } });
  }

  async ready(userId: string, projectId: string, id: string) {
    const member = await requireMember(this.db, projectId, userId);
    requireAction(member.role, 'requirement:write');
    const testCase = await this.db.testCase.findFirst({
      where: { id, projectId },
      include: { links: true },
    });
    if (!testCase) fail('TESTCASE_NOT_FOUND', 'Test case không tồn tại');
    if (testCase.status === 'RETIRED') fail('TESTCASE_RETIRED', 'Test RETIRED chỉ đọc');
    const gaps = readinessGaps({
      expectedResult: testCase.expectedResult,
      linkCount: testCase.links.length,
      independentReason: testCase.independentReason,
    });
    if (gaps.length > 0) {
      throw Object.assign(new Error(`Thiếu điều kiện READY: ${gaps.join(', ')}`), {
        code: 'TESTCASE_NOT_READY',
        gaps,
      });
    }
    const updated = await this.db.testCase.update({ where: { id }, data: { status: 'READY' } });
    await this.appendAudit({
      projectId,
      actorId: userId,
      entityType: 'testcase',
      entityId: id,
      action: 'test.ready',
    });
    return updated;
  }

  async retire(userId: string, projectId: string, id: string) {
    const member = await requireMember(this.db, projectId, userId);
    requireAction(member.role, 'requirement:write');
    const testCase = await this.db.testCase.findFirst({ where: { id, projectId } });
    if (!testCase) fail('TESTCASE_NOT_FOUND', 'Test case không tồn tại');
    const updated = await this.db.testCase.update({ where: { id }, data: { status: 'RETIRED' } });
    await this.appendAudit({
      projectId,
      actorId: userId,
      entityType: 'testcase',
      entityId: id,
      action: 'test.retired',
    });
    return updated;
  }

  async clone(userId: string, projectId: string, id: string) {
    const member = await requireMember(this.db, projectId, userId);
    requireAction(member.role, 'requirement:write');
    const source = await this.db.testCase.findFirst({
      where: { id, projectId },
      include: { steps: { orderBy: { position: 'asc' } }, links: true },
    });
    if (!source) fail('TESTCASE_NOT_FOUND', 'Test case không tồn tại');
    const copy = await this.db.testCase.create({
      data: {
        projectId,
        code: await this.nextCode(projectId),
        title: `${source.title} (bản sao)`,
        suiteId: source.suiteId,
        priority: source.priority,
        type: source.type,
        expectedResult: source.expectedResult,
        independentReason: source.independentReason,
        tags: source.tags,
        steps: {
          create: source.steps.map((s) => ({
            action: s.action,
            expected: s.expected,
            position: s.position,
          })),
        },
        links: { create: source.links.map((l) => ({ requirementId: l.requirementId })) },
      },
      include: { steps: true, links: true },
    });
    await this.appendAudit({
      projectId,
      actorId: userId,
      entityType: 'testcase',
      entityId: copy.id,
      action: 'test.cloned',
    });
    return copy;
  }

  async attachRequirement(
    userId: string,
    projectId: string,
    testCaseId: string,
    requirementId: string,
  ) {
    const member = await requireMember(this.db, projectId, userId);
    requireAction(member.role, 'requirement:write');
    const [testCase, requirement] = await Promise.all([
      this.db.testCase.findFirst({ where: { id: testCaseId, projectId } }),
      this.db.requirement.findFirst({ where: { id: requirementId, projectId } }),
    ]);
    if (!testCase) fail('TESTCASE_NOT_FOUND', 'Test case không tồn tại');
    if (!requirement) fail('REQUIREMENT_NOT_FOUND', 'Requirement không tồn tại hoặc khác project');
    const existing = await this.db.requirementTestCase.findUnique({
      where: { requirementId_testCaseId: { requirementId, testCaseId } },
    });
    if (existing) return existing;
    return this.db.requirementTestCase.create({ data: { requirementId, testCaseId } });
  }

  async detachRequirement(
    userId: string,
    projectId: string,
    testCaseId: string,
    requirementId: string,
  ) {
    const member = await requireMember(this.db, projectId, userId);
    requireAction(member.role, 'requirement:write');
    const testCase = await this.db.testCase.findFirst({ where: { id: testCaseId, projectId } });
    if (!testCase) fail('TESTCASE_NOT_FOUND', 'Test case không tồn tại');
    await this.db.requirementTestCase.deleteMany({ where: { requirementId, testCaseId } });
    return { removed: true };
  }

  async listRevisions(userId: string, projectId: string, testCaseId: string) {
    const testCase = await this.db.testCase.findFirst({ where: { id: testCaseId, projectId } });
    if (!testCase) fail('TESTCASE_NOT_FOUND', 'Test case không tồn tại');
    await requireMember(this.db, projectId, userId);
    return this.db.testCaseRevision.findMany({
      where: { testCaseId },
      orderBy: { version: 'asc' },
    });
  }
}
