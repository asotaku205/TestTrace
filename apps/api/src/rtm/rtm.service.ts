// Ma trận truy vết sống: derivation theo truth table + release/build scope (nguồn: M16 + RTM-01).
// STALE hash-based: version unit mới hơn lần run finalized gần nhất.
import { Inject, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { deriveRtmStatus } from '@testtrace/domain';
import { PRISMA } from '../prisma.module.js';
import { requireMember } from '../projects/access.js';

function fail(code: string, message: string): never {
  throw Object.assign(new Error(message), { code });
}

@Injectable()
export class RtmService {
  constructor(@Inject(PRISMA) private readonly db: PrismaClient) {}

  async matrix(userId: string, projectId: string, releaseId?: string, buildId?: string) {
    await requireMember(this.db, projectId, userId);
    const releaseFilter = releaseId ?? undefined;
    if (releaseId) {
      const release = await this.db.release.findFirst({ where: { id: releaseId, projectId } });
      if (!release) fail('RELEASE_NOT_FOUND', 'Release không tồn tại');
    }
    const requirements = await this.db.requirement.findMany({
      where: { projectId },
      include: {
        risk: true,
        testLinks: {
          include: {
            testCase: { select: { id: true, code: true, status: true, title: true } },
          },
        },
        codeLinks: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    const rows = [];
    for (const requirement of requirements) {
      const activeTests = requirement.testLinks
        .map((l) => l.testCase)
        .filter((t) => t.status === 'READY');
      const activeIds = activeTests.map((t) => t.id);
      const allItems =
        activeIds.length > 0
          ? await this.db.testRunItem.findMany({
              where: { testCaseId: { in: activeIds } },
              include: {
                run: true,
                results: { orderBy: { createdAt: 'desc' }, take: 1 },
              },
            })
          : [];
      const itemsInScope = allItems.filter(
        (item) =>
          item.run.projectId === projectId &&
          item.run.status === 'FINALIZED' &&
          (!releaseFilter || item.run.releaseId === releaseFilter) &&
          (!buildId || item.run.buildId === buildId),
      );
      const latestByItem = new Map<string, string>();
      for (const item of itemsInScope) {
        const status = item.results[0]?.status;
        if (status) latestByItem.set(item.id, status);
      }
      const hasFail = [...latestByItem.values()].some((s) => s === 'FAIL' || s === 'BLOCKED');
      const latestFinalizedAt = itemsInScope
        .map((i) => i.run.finalizedAt?.getTime() ?? 0)
        .reduce((max, t) => Math.max(max, t), 0);
      let codeChanged = false;
      if (requirement.codeLinks.length > 0 && latestFinalizedAt > 0) {
        for (const link of requirement.codeLinks) {
          const versions = await this.db.codeVersion.findMany({
            where: { artifactId: link.artifactId },
            orderBy: { createdAt: 'asc' },
            select: { createdAt: true },
          });
          if (versions.some((v) => v.createdAt.getTime() > latestFinalizedAt)) {
            codeChanged = true;
            break;
          }
        }
      }
      let hasSevereDefect = false;
      const testCaseIds = new Set(activeTests.map((t) => t.id));
      if (testCaseIds.size > 0) {
        const defects = await this.db.defect.findMany({
          where: {
            projectId,
            severity: { in: ['BLOCKER', 'CRITICAL'] },
            status: { notIn: ['CLOSED', 'REJECTED'] },
          },
          include: { sourceResult: { include: { item: true } } },
        });
        hasSevereDefect = defects.some(
          (d) => d.sourceResult && testCaseIds.has(d.sourceResult.item.testCaseId),
        );
      }
      const { status, reasonCodes } = deriveRtmStatus({
        hasActiveTest: activeTests.length > 0,
        codeChanged,
        hasFail,
        hasSevereDefect,
      });
      rows.push({
        requirementId: requirement.id,
        code: requirement.code,
        title: requirement.title,
        risk: requirement.risk
          ? {
              impact: requirement.risk.impact,
              likelihood: requirement.risk.likelihood,
              score: requirement.risk.impact * requirement.risk.likelihood,
            }
          : null,
        status,
        reasonCodes,
        evaluatedAt: new Date().toISOString(),
        testCases: activeTests.map((t) => ({ id: t.id, code: t.code, status: t.status })),
      });
    }
    return rows;
  }
}
