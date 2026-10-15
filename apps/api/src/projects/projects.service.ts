// Use case project/member: CRUD project, quản trị member, bảo vệ Owner cuối (nguồn: M01 + AUTH-02).
import { Inject, Injectable } from '@nestjs/common';
import { PrismaClient, MemberRole } from '@prisma/client';
import { can, createAuditEvent, type ProjectAction } from '@testtrace/domain';
import { PRISMA } from '../prisma.module.js';

function fail(code: string, message: string): never {
  throw Object.assign(new Error(message), { code });
}

const validRoles: MemberRole[] = ['OWNER', 'MANAGER', 'TESTER', 'VIEWER'];

@Injectable()
export class ProjectsService {
  constructor(@Inject(PRISMA) private readonly db: PrismaClient) {}

  private async appendAudit(input: {
    projectId: string | null;
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

  private async membership(projectId: string, userId: string) {
    const project = await this.db.project.findUnique({ where: { id: projectId } });
    if (!project) fail('PROJECT_NOT_FOUND', 'Project không tồn tại');
    const member = await this.db.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!member) fail('PROJECT_FORBIDDEN', 'Không có quyền trên project này');
    return member;
  }

  private require(memberRole: MemberRole, action: ProjectAction): void {
    if (!can(memberRole, action)) fail('PROJECT_FORBIDDEN', 'Vai trò không được phép');
  }

  private async ensureNotLastOwner(projectId: string, targetUserId: string): Promise<void> {
    const owners = await this.db.projectMember.findMany({
      where: { projectId, role: 'OWNER' },
      select: { userId: true },
    });
    if (owners.length === 1 && owners[0].userId === targetUserId) {
      fail('MEMBER_LAST_OWNER', 'Không được hạ quyền/xóa Owner cuối cùng');
    }
  }

  async create(userId: string, name: string) {
    if (typeof name !== 'string' || name.trim().length === 0)
      fail('VALIDATION_ERROR', 'Tên project bắt buộc');
    const project = await this.db.project.create({ data: { name: name.trim() } });
    await this.db.projectMember.create({
      data: { projectId: project.id, userId, role: 'OWNER' },
    });
    await this.appendAudit({
      projectId: project.id,
      actorId: userId,
      entityType: 'project',
      entityId: project.id,
      action: 'project.created',
    });
    return project;
  }

  async list(userId: string) {
    const members = await this.db.projectMember.findMany({
      where: { userId },
      include: { project: true },
      orderBy: { createdAt: 'asc' },
    });
    return members.map((m) => ({ ...m.project, role: m.role }));
  }

  async get(userId: string, projectId: string) {
    await this.membership(projectId, userId);
    return this.db.project.findUniqueOrThrow({ where: { id: projectId } });
  }

  async update(userId: string, projectId: string, name: string) {
    const member = await this.membership(projectId, userId);
    this.require(member.role, 'project:update');
    if (typeof name !== 'string' || name.trim().length === 0)
      fail('VALIDATION_ERROR', 'Tên project bắt buộc');
    const project = await this.db.project.update({
      where: { id: projectId },
      data: { name: name.trim() },
    });
    await this.appendAudit({
      projectId,
      actorId: userId,
      entityType: 'project',
      entityId: projectId,
      action: 'project.updated',
    });
    return project;
  }

  async listMembers(userId: string, projectId: string) {
    await this.membership(projectId, userId);
    return this.db.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addMember(actorId: string, projectId: string, email: string, role: MemberRole) {
    const member = await this.membership(projectId, actorId);
    this.require(member.role, 'member:add');
    if (!validRoles.includes(role)) fail('VALIDATION_ERROR', 'Vai trò không hợp lệ');
    const user = await this.db.user.findUnique({ where: { email } });
    if (!user) fail('USER_NOT_FOUND', 'User chưa có tài khoản');
    const exists = await this.db.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    });
    if (exists) fail('MEMBER_EXISTS', 'User đã là member');
    const created = await this.db.projectMember.create({
      data: { projectId, userId: user.id, role },
    });
    await this.appendAudit({
      projectId,
      actorId,
      entityType: 'member',
      entityId: user.id,
      action: 'member.added',
    });
    return created;
  }

  async updateMember(actorId: string, projectId: string, targetUserId: string, role: MemberRole) {
    const member = await this.membership(projectId, actorId);
    this.require(member.role, 'member:update');
    if (!validRoles.includes(role)) fail('VALIDATION_ERROR', 'Vai trò không hợp lệ');
    const target = await this.db.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: targetUserId } },
    });
    if (!target) fail('MEMBER_NOT_FOUND', 'Member không tồn tại');
    if (target.role === 'OWNER' && role !== 'OWNER') {
      await this.ensureNotLastOwner(projectId, targetUserId);
    }
    const updated = await this.db.projectMember.update({
      where: { id: target.id },
      data: { role },
    });
    await this.appendAudit({
      projectId,
      actorId,
      entityType: 'member',
      entityId: targetUserId,
      action: 'member.updated',
    });
    return updated;
  }

  async removeMember(actorId: string, projectId: string, targetUserId: string) {
    const member = await this.membership(projectId, actorId);
    this.require(member.role, 'member:remove');
    const target = await this.db.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: targetUserId } },
    });
    if (!target) fail('MEMBER_NOT_FOUND', 'Member không tồn tại');
    if (target.role === 'OWNER') {
      await this.ensureNotLastOwner(projectId, targetUserId);
    }
    await this.db.projectMember.delete({ where: { id: target.id } });
    await this.appendAudit({
      projectId,
      actorId,
      entityType: 'member',
      entityId: targetUserId,
      action: 'member.removed',
    });
    return { removed: true };
  }
}
