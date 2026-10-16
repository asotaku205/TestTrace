// Quản trị gate: schema YAML + publish khóa version (nguồn: M17 + GATE-01).
// Đánh giá thuộc GATE-02/GATE-03.
import { Inject, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { parse as parseYaml } from 'yaml';
import {
  canReleaseTransition,
  createAuditEvent,
  evaluateGate,
  validateGateRules,
} from '@testtrace/domain';
import { PRISMA } from '../prisma.module.js';
import { requireMember } from '../projects/access.js';
import { ReleasesService } from '../releases/releases.service.js';
import { RtmService } from '../rtm/rtm.service.js';

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
  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    @Inject(ReleasesService) private readonly releases: ReleasesService,
    @Inject(RtmService) private readonly rtm: RtmService,
  ) {}

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

  async evaluate(userId: string, projectId: string, gateId: string, buildId: string) {
    if (typeof buildId !== 'string' || buildId.trim().length === 0) {
      fail('VALIDATION_ERROR', 'buildId bắt buộc');
    }
    const member = await requireMember(this.db, projectId, userId);
    if (member.role !== 'OWNER' && member.role !== 'MANAGER') {
      fail('PROJECT_FORBIDDEN', 'Chỉ Owner/Manager evaluate gate');
    }
    const gate = await this.db.qualityGate.findFirst({
      where: { id: gateId, projectId },
      include: {
        versions: { where: { status: 'PUBLISHED' }, orderBy: { version: 'desc' }, take: 1 },
      },
    });
    if (!gate || gate.versions.length === 0) fail('GATE_NOT_PUBLISHED', 'Gate chưa publish');
    const version = gate.versions[0];
    const build = await this.db.build.findFirst({
      where: { id: buildId },
      include: { release: true },
    });
    if (!build || build.release.projectId !== projectId) {
      fail('BUILD_NOT_FOUND', 'Build không thuộc project này');
    }
    const rules = version.rules as Record<string, never>;
    const [uncovered, defects, rtmRows, runs, analyses] = await Promise.all([
      this.db.requirement.findMany({
        where: { projectId },
        include: {
          risk: true,
          testLinks: { include: { testCase: { select: { id: true, status: true } } } },
        },
      }),
      this.db.defect.findMany({
        where: {
          projectId,
          severity: { in: ['BLOCKER', 'CRITICAL'] },
          status: { notIn: ['CLOSED', 'REJECTED'] },
        },
        select: { id: true },
      }),
      this.rtm.matrix(userId, projectId, build.releaseId, buildId),
      this.db.testRun.findMany({
        where: { buildId, status: 'FINALIZED' },
        include: { items: { include: { results: { orderBy: { createdAt: 'desc' }, take: 1 } } } },
      }),
      this.db.analysis.findMany({
        where: { projectId, status: 'SUCCEEDED' },
        select: { metrics: true },
      }),
    ]);
    const uncoveredIds = uncovered
      .filter(
        (r) =>
          r.risk &&
          r.risk.impact * r.risk.likelihood >= 15 &&
          !r.testLinks.some((l) => l.testCase.status === 'READY'),
      )
      .map((r) => r.id);
    let decided = 0;
    let passed = 0;
    const failedCaseIds: string[] = [];
    for (const run of runs) {
      for (const item of run.items) {
        const status = item.results[0]?.status;
        if (!status) continue;
        decided += 1;
        if (status === 'PASS') passed += 1;
        else if (status === 'FAIL') failedCaseIds.push(item.testCaseId);
      }
    }
    const complexities = analyses
      .map((a) => (a.metrics as { complexity?: number } | null)?.complexity)
      .filter((c): c is number => typeof c === 'number');
    const snapshot = {
      uncoveredHighRisk: uncoveredIds.length,
      openBlockerCritical: defects.length,
      staleCount: rtmRows.filter((r) => r.status === 'STALE').length,
      passRate: decided === 0 ? null : Math.round((passed / decided) * 100),
      maxComplexity: complexities.length > 0 ? Math.max(...complexities) : null,
    };
    const evaluation = evaluateGate(rules as never, snapshot);
    const withDrilldown = evaluation.results.map((r) => ({
      ...r,
      drilldown:
        r.rule === 'uncovered_high_risk_requirements'
          ? { type: 'requirement', ids: uncoveredIds }
          : r.rule === 'open_critical_defects'
            ? { type: 'defect', ids: defects.map((d) => d.id) }
            : r.rule === 'stale_tests_for_changed_code'
              ? {
                  type: 'requirement',
                  ids: rtmRows
                    .filter((row) => row.status === 'STALE')
                    .map((row) => row.requirementId),
                }
              : r.rule === 'pass_rate_min'
                ? { type: 'testcase', ids: failedCaseIds }
                : undefined,
    }));
    const saved = await this.db.gateEvaluation.create({
      data: {
        projectId,
        gateId,
        gateVersionId: version.id,
        version: version.version,
        buildId,
        verdict: evaluation.verdict,
        input: JSON.parse(JSON.stringify(snapshot)),
        rules: JSON.parse(JSON.stringify(rules)),
        results: JSON.parse(JSON.stringify(withDrilldown)),
        createdBy: userId,
      },
    });
    if (evaluation.verdict === 'PASS') {
      const release = await this.db.release.findUniqueOrThrow({ where: { id: build.releaseId } });
      if (release.status === 'IN_TEST' && canReleaseTransition('IN_TEST', 'PASSED')) {
        await this.releases.transition(userId, projectId, release.id, 'PASSED');
      }
    }
    await this.appendAudit({
      projectId,
      actorId: userId,
      entityType: 'gate',
      entityId: saved.id,
      action: 'gate.evaluated',
    });
    return saved;
  }

  async listEvaluations(userId: string, projectId: string, gateId: string) {
    await requireMember(this.db, projectId, userId);
    return this.db.gateEvaluation.findMany({
      where: { projectId, gateId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
