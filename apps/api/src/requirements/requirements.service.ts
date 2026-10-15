// Use case requirement + acceptance criteria (nguồn: M02 + REQ-01).
// REQ-01: sửa/lock khi APPROVED trả REQUIREMENT_READONLY; REQ-02 nới thành revision flow.
import { Inject, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createAuditEvent, riskScore } from '@testtrace/domain';
import { PRISMA } from '../prisma.module.js';
import { requireAction, requireMember } from '../projects/access.js';

function fail(code: string, message: string): never {
  throw Object.assign(new Error(message), { code });
}

@Injectable()
export class RequirementsService {
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
    const count = await this.db.requirement.count({ where: { projectId } });
    return `REQ-${String(count + 1).padStart(3, '0')}`;
  }

  async create(userId: string, projectId: string, title: string, description?: string) {
    const member = await requireMember(this.db, projectId, userId);
    requireAction(member.role, 'requirement:write');
    if (typeof title !== 'string' || title.trim().length === 0)
      fail('VALIDATION_ERROR', 'Tiêu đề requirement bắt buộc');
    const requirement = await this.db.requirement.create({
      data: { projectId, code: await this.nextCode(projectId), title: title.trim(), description },
    });
    await this.appendAudit({
      projectId,
      actorId: userId,
      entityType: 'requirement',
      entityId: requirement.id,
      action: 'requirement.created',
    });
    return requirement;
  }

  async list(
    userId: string,
    projectId: string,
    status?: string,
    minScore?: number,
    maxScore?: number,
  ) {
    await requireMember(this.db, projectId, userId);
    const items = await this.db.requirement.findMany({
      where: { projectId, ...(status ? { status: status as never } : {}) },
      include: { criteria: { orderBy: { position: 'asc' } }, risk: true },
      orderBy: { createdAt: 'asc' },
    });
    const withScore = items.map((item) => ({
      ...item,
      score: item.risk ? item.risk.impact * item.risk.likelihood : null,
    }));
    const filtered = withScore.filter(
      (item) =>
        (minScore === undefined || (item.score !== null && item.score >= minScore)) &&
        (maxScore === undefined || (item.score !== null && item.score <= maxScore)),
    );
    return Promise.all(
      filtered.map(async (item) => {
        const [testLinks, openReview] = await Promise.all([
          this.db.requirementTestCase.findMany({
            where: { requirementId: item.id },
            include: {
              testCase: { select: { id: true, code: true, title: true, status: true } },
            },
          }),
          this.db.reviewTask.findFirst({
            where: { requirementId: item.id, status: 'OPEN' },
          }),
        ]);
        return {
          ...item,
          linkedTests: testLinks.map((l) => l.testCase),
          needsReview: openReview !== null,
        };
      }),
    );
  }

  async get(userId: string, projectId: string, id: string) {
    await requireMember(this.db, projectId, userId);
    const requirement = await this.db.requirement.findFirst({
      where: { id, projectId },
      include: {
        criteria: { orderBy: { position: 'asc' } },
        testLinks: {
          include: { testCase: { select: { id: true, code: true, title: true, status: true } } },
        },
      },
    });
    if (!requirement) fail('REQUIREMENT_NOT_FOUND', 'Requirement không tồn tại');
    const openReview = await this.db.reviewTask.findFirst({
      where: { requirementId: id, status: 'OPEN' },
    });
    const { testLinks, ...rest } = requirement;
    return {
      ...rest,
      linkedTests: testLinks.map((l) => l.testCase),
      needsReview: openReview !== null,
    };
  }

  private async snapshotRevision(requirementId: string, userId: string): Promise<void> {
    const current = await this.db.requirement.findUniqueOrThrow({ where: { id: requirementId } });
    const count = await this.db.requirementRevision.count({ where: { requirementId } });
    await this.db.requirementRevision.create({
      data: {
        requirementId,
        version: count + 1,
        title: current.title,
        description: current.description,
        createdBy: userId,
      },
    });
  }

  private async openReviewTask(projectId: string, requirementId: string): Promise<void> {
    const existing = await this.db.reviewTask.findFirst({
      where: { requirementId, status: 'OPEN' },
    });
    if (!existing) {
      await this.db.reviewTask.create({
        data: { projectId, requirementId, reason: 'requirement.changed' },
      });
    }
  }

  async update(
    userId: string,
    projectId: string,
    id: string,
    title?: string,
    description?: string,
  ) {
    const member = await requireMember(this.db, projectId, userId);
    requireAction(member.role, 'requirement:write');
    const current = await this.db.requirement.findFirst({ where: { id, projectId } });
    if (!current) fail('REQUIREMENT_NOT_FOUND', 'Requirement không tồn tại');
    if (current.status !== 'DRAFT') {
      await this.snapshotRevision(id, userId);
      await this.openReviewTask(projectId, id);
    }
    const requirement = await this.db.requirement.update({
      where: { id },
      data: {
        ...(typeof title === 'string' ? { title: title.trim() } : {}),
        ...(description !== undefined ? { description } : {}),
      },
    });
    await this.appendAudit({
      projectId,
      actorId: userId,
      entityType: 'requirement',
      entityId: id,
      action: 'requirement.updated',
    });
    return requirement;
  }

  async approve(userId: string, projectId: string, id: string) {
    const member = await requireMember(this.db, projectId, userId);
    requireAction(member.role, 'requirement:write');
    const current = await this.db.requirement.findFirst({ where: { id, projectId } });
    if (!current) fail('REQUIREMENT_NOT_FOUND', 'Requirement không tồn tại');
    if (current.status !== 'DRAFT') fail('REQUIREMENT_STATE', 'Chỉ duyệt requirement ở DRAFT');
    const requirement = await this.db.requirement.update({
      where: { id },
      data: { status: 'APPROVED' },
    });
    await this.appendAudit({
      projectId,
      actorId: userId,
      entityType: 'requirement',
      entityId: id,
      action: 'requirement.approved',
    });
    return requirement;
  }

  async deprecate(userId: string, projectId: string, id: string) {
    const member = await requireMember(this.db, projectId, userId);
    requireAction(member.role, 'requirement:write');
    const current = await this.db.requirement.findFirst({ where: { id, projectId } });
    if (!current) fail('REQUIREMENT_NOT_FOUND', 'Requirement không tồn tại');
    if (current.status !== 'APPROVED')
      fail('REQUIREMENT_STATE', 'Chỉ deprecate requirement đã APPROVED');
    const requirement = await this.db.requirement.update({
      where: { id },
      data: { status: 'DEPRECATED' },
    });
    await this.appendAudit({
      projectId,
      actorId: userId,
      entityType: 'requirement',
      entityId: id,
      action: 'requirement.deprecated',
    });
    return requirement;
  }

  async addCriterion(userId: string, requirementId: string, text: string) {
    const requirement = await this.db.requirement.findUnique({ where: { id: requirementId } });
    if (!requirement) fail('REQUIREMENT_NOT_FOUND', 'Requirement không tồn tại');
    const member = await requireMember(this.db, requirement.projectId, userId);
    requireAction(member.role, 'requirement:write');
    if (requirement.status !== 'DRAFT') {
      await this.snapshotRevision(requirementId, userId);
      await this.openReviewTask(requirement.projectId, requirementId);
    }
    if (typeof text !== 'string' || text.trim().length === 0)
      fail('VALIDATION_ERROR', 'Nội dung criteria bắt buộc');
    const max = await this.db.acceptanceCriterion.findFirst({
      where: { requirementId },
      orderBy: { position: 'desc' },
    });
    const created = await this.db.acceptanceCriterion.create({
      data: { requirementId, text: text.trim(), position: (max?.position ?? 0) + 1 },
    });
    await this.appendAudit({
      projectId: requirement.projectId,
      actorId: userId,
      entityType: 'criterion',
      entityId: created.id,
      action: 'criterion.created',
    });
    return created;
  }

  async updateCriterion(userId: string, requirementId: string, criterionId: string, text: string) {
    const requirement = await this.db.requirement.findUnique({ where: { id: requirementId } });
    if (!requirement) fail('REQUIREMENT_NOT_FOUND', 'Requirement không tồn tại');
    const member = await requireMember(this.db, requirement.projectId, userId);
    requireAction(member.role, 'requirement:write');
    if (requirement.status !== 'DRAFT') {
      await this.snapshotRevision(requirementId, userId);
      await this.openReviewTask(requirement.projectId, requirementId);
    }
    const existing = await this.db.acceptanceCriterion.findFirst({
      where: { id: criterionId, requirementId },
    });
    if (!existing) fail('CRITERION_NOT_FOUND', 'Criteria không tồn tại');
    if (typeof text !== 'string' || text.trim().length === 0)
      fail('VALIDATION_ERROR', 'Nội dung criteria bắt buộc');
    return this.db.acceptanceCriterion.update({
      where: { id: criterionId },
      data: { text: text.trim() },
    });
  }

  async removeCriterion(userId: string, requirementId: string, criterionId: string) {
    const requirement = await this.db.requirement.findUnique({ where: { id: requirementId } });
    if (!requirement) fail('REQUIREMENT_NOT_FOUND', 'Requirement không tồn tại');
    const member = await requireMember(this.db, requirement.projectId, userId);
    requireAction(member.role, 'requirement:write');
    if (requirement.status !== 'DRAFT') {
      await this.snapshotRevision(requirementId, userId);
      await this.openReviewTask(requirement.projectId, requirementId);
    }
    const existing = await this.db.acceptanceCriterion.findFirst({
      where: { id: criterionId, requirementId },
    });
    if (!existing) fail('CRITERION_NOT_FOUND', 'Criteria không tồn tại');
    await this.db.acceptanceCriterion.delete({ where: { id: criterionId } });
    return { removed: true };
  }

  async setRisk(userId: string, projectId: string, id: string, impact: number, likelihood: number) {
    const member = await requireMember(this.db, projectId, userId);
    requireAction(member.role, 'requirement:write');
    const current = await this.db.requirement.findFirst({ where: { id, projectId } });
    if (!current) fail('REQUIREMENT_NOT_FOUND', 'Requirement không tồn tại');
    const score = riskScore(impact, likelihood);
    await this.db.risk.upsert({
      where: { requirementId: id },
      create: { requirementId: id, impact, likelihood },
      update: { impact, likelihood },
    });
    await this.appendAudit({
      projectId,
      actorId: userId,
      entityType: 'requirement',
      entityId: id,
      action: 'requirement.risk.updated',
    });
    return { impact, likelihood, score };
  }

  async listRevisions(userId: string, requirementId: string) {
    const requirement = await this.db.requirement.findUnique({ where: { id: requirementId } });
    if (!requirement) fail('REQUIREMENT_NOT_FOUND', 'Requirement không tồn tại');
    await requireMember(this.db, requirement.projectId, userId);
    return this.db.requirementRevision.findMany({
      where: { requirementId },
      orderBy: { version: 'asc' },
    });
  }

  async listReviewTasks(userId: string, projectId: string, status?: string) {
    await requireMember(this.db, projectId, userId);
    return this.db.reviewTask.findMany({
      where: { projectId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'asc' },
    });
  }

  async resolveReviewTask(userId: string, projectId: string, taskId: string) {
    const member = await requireMember(this.db, projectId, userId);
    requireAction(member.role, 'requirement:write');
    const task = await this.db.reviewTask.findFirst({ where: { id: taskId, projectId } });
    if (!task) fail('REVIEW_TASK_NOT_FOUND', 'Review task không tồn tại');
    return this.db.reviewTask.update({ where: { id: taskId }, data: { status: 'DONE' } });
  }
}
