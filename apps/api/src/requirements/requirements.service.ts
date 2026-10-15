// Use case requirement + acceptance criteria (nguồn: M02 + REQ-01).
// REQ-01: sửa/lock khi APPROVED trả REQUIREMENT_READONLY; REQ-02 nới thành revision flow.
import { Inject, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createAuditEvent } from '@testtrace/domain';
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

  async list(userId: string, projectId: string, status?: string) {
    await requireMember(this.db, projectId, userId);
    return this.db.requirement.findMany({
      where: { projectId, ...(status ? { status: status as never } : {}) },
      include: { criteria: { orderBy: { position: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async get(userId: string, projectId: string, id: string) {
    await requireMember(this.db, projectId, userId);
    const requirement = await this.db.requirement.findFirst({
      where: { id, projectId },
      include: { criteria: { orderBy: { position: 'asc' } } },
    });
    if (!requirement) fail('REQUIREMENT_NOT_FOUND', 'Requirement không tồn tại');
    return requirement;
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
    if (current.status !== 'DRAFT')
      fail('REQUIREMENT_READONLY', 'Đã duyệt thì không sửa trực tiếp (chờ REQ-02 revision flow)');
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
    if (requirement.status !== 'DRAFT')
      fail('REQUIREMENT_READONLY', 'Đã duyệt thì không sửa criteria trực tiếp');
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
    if (requirement.status !== 'DRAFT')
      fail('REQUIREMENT_READONLY', 'Đã duyệt thì không sửa criteria trực tiếp');
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
    if (requirement.status !== 'DRAFT')
      fail('REQUIREMENT_READONLY', 'Đã duyệt thì không xóa criteria trực tiếp');
    const existing = await this.db.acceptanceCriterion.findFirst({
      where: { id: criterionId, requirementId },
    });
    if (!existing) fail('CRITERION_NOT_FOUND', 'Criteria không tồn tại');
    await this.db.acceptanceCriterion.delete({ where: { id: criterionId } });
    return { removed: true };
  }
}
