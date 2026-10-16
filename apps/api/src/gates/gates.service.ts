// Quản trị gate: schema YAML + publish khóa version (nguồn: M17 + GATE-01).
// Đánh giá thuộc GATE-02/GATE-03.
import { Inject, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { parse as parseYaml } from 'yaml';
import { createAuditEvent, validateGateRules } from '@testtrace/domain';
import { PRISMA } from '../prisma.module.js';
import { requireMember } from '../projects/access.js';

function fail(code: string, message: string): never {
  throw Object.assign(new Error(message), { code });
}

function parseRules(yaml: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = parseYaml(yaml);
  } catch (err) {
    fail('GATE_YAML', `YAML không hợp lệ: ${(err as Error).message}`);
  }
  const { ok, errors } = validateGateRules(parsed);
  if (!ok) fail('GATE_RULES', errors.join('; '));
  return parsed as Record<string, unknown>;
}

@Injectable()
export class GatesService {
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
    if (member.role !== 'OWNER' && member.role !== 'MANAGER') {
      fail('PROJECT_FORBIDDEN', 'Chỉ Owner/Manager quản trị gate');
    }
  }

  async validate(userId: string, projectId: string, yaml: string) {
    await requireMember(this.db, projectId, userId);
    if (typeof yaml !== 'string' || yaml.trim().length === 0) {
      return { ok: false, errors: ['YAML bắt buộc'] };
    }
    try {
      const rules = parseRules(yaml);
      return { ok: true, errors: [], rules };
    } catch (err) {
      const thrown = err as { code?: string; message?: string };
      if (thrown.code === 'GATE_YAML' || thrown.code === 'GATE_RULES') {
        return { ok: false, errors: [thrown.message ?? 'Lỗi'] };
      }
      throw err;
    }
  }

  async create(userId: string, projectId: string, name: string, yaml: string) {
    await this.managed(userId, projectId);
    if (typeof name !== 'string' || name.trim().length === 0)
      fail('VALIDATION_ERROR', 'Tên gate bắt buộc');
    const rules = parseRules(yaml);
    const gate = await this.db.qualityGate.create({
      data: {
        projectId,
        name: name.trim(),
        createdBy: userId,
        versions: { create: { version: 1, rules: rules as never } },
      },
      include: { versions: true },
    });
    await this.appendAudit({
      projectId,
      actorId: userId,
      entityType: 'gate',
      entityId: gate.id,
      action: 'gate.created',
    });
    return gate;
  }

  async updateRules(
    userId: string,
    projectId: string,
    gateId: string,
    version: number,
    yaml: string,
  ) {
    await this.managed(userId, projectId);
    const current = await this.db.gateVersion.findUnique({
      where: { gateId_version: { gateId, version } },
      include: { gate: true },
    });
    if (!current || current.gate.projectId !== projectId)
      fail('GATE_NOT_FOUND', 'Gate version không tồn tại');
    if (current.status !== 'DRAFT')
      fail('GATE_LOCKED', 'Version đã publish, tạo version mới để sửa');
    const rules = parseRules(yaml);
    return this.db.gateVersion.update({
      where: { id: current.id },
      data: { rules: rules as never },
    });
  }

  async publish(userId: string, projectId: string, gateId: string, version: number) {
    await this.managed(userId, projectId);
    const current = await this.db.gateVersion.findUnique({
      where: { gateId_version: { gateId, version } },
      include: { gate: true },
    });
    if (!current || current.gate.projectId !== projectId)
      fail('GATE_NOT_FOUND', 'Gate version không tồn tại');
    if (current.status !== 'DRAFT') fail('GATE_LOCKED', 'Version đã publish');
    const published = await this.db.gateVersion.update({
      where: { id: current.id },
      data: { status: 'PUBLISHED' },
    });
    await this.appendAudit({
      projectId,
      actorId: userId,
      entityType: 'gate',
      entityId: gateId,
      action: 'gate.published',
    });
    return published;
  }

  async forkVersion(userId: string, projectId: string, gateId: string) {
    await this.managed(userId, projectId);
    const gate = await this.db.qualityGate.findFirst({
      where: { id: gateId, projectId },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!gate) fail('GATE_NOT_FOUND', 'Gate không tồn tại');
    const latest = gate.versions[0];
    return this.db.gateVersion.create({
      data: {
        gateId,
        version: (latest?.version ?? 0) + 1,
        rules: (latest?.rules ?? {}) as never,
      },
    });
  }

  async list(userId: string, projectId: string) {
    await requireMember(this.db, projectId, userId);
    return this.db.qualityGate.findMany({
      where: { projectId },
      include: { versions: { orderBy: { version: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
  }
}
