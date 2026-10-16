// Export CSV dùng chung query với UI (nguồn: M18 + REPORT-01).
// Invariant: số CSV ≡ số UI.
import { Inject, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PRISMA } from '../prisma.module.js';
import { requireMember } from '../projects/access.js';
import { RtmService } from '../rtm/rtm.service.js';
import { toCsv } from './csv.js';

export interface CsvFile {
  filename: string;
  content: string;
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

@Injectable()
export class ReportsService {
  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    @Inject(RtmService) private readonly rtm: RtmService,
  ) {}

  async rtmCsv(
    userId: string,
    projectId: string,
    releaseId?: string,
    buildId?: string,
  ): Promise<CsvFile> {
    const rows = await this.rtm.matrix(userId, projectId, releaseId, buildId);
    return {
      filename: `rtm-${stamp()}.csv`,
      content: toCsv(
        ['requirement_code', 'title', 'status', 'reasons', 'risk_score', 'tests', 'evaluated_at'],
        rows.map((r) => ({
          requirement_code: r.code,
          title: r.title,
          status: r.status,
          reasons: r.reasonCodes.join('|'),
          risk_score: r.risk?.score ?? '',
          tests: r.testCases.map((t) => t.code).join('|'),
          evaluated_at: r.evaluatedAt,
        })),
      ),
    };
  }

  async executionCsv(userId: string, projectId: string, releaseId?: string): Promise<CsvFile> {
    await requireMember(this.db, projectId, userId);
    const runs = await this.db.testRun.findMany({
      where: { projectId, ...(releaseId ? { releaseId } : {}) },
      include: {
        release: { select: { name: true } },
        build: { select: { number: true } },
        items: { include: { results: { orderBy: { createdAt: 'desc' }, take: 1 } } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return {
      filename: `execution-${stamp()}.csv`,
      content: toCsv(
        [
          'run_name',
          'status',
          'release',
          'build',
          'total',
          'done',
          'pass',
          'fail',
          'blocked',
          'skipped',
        ],
        runs.map((run) => {
          const latest = run.items.map((i) => i.results[0]?.status).filter(Boolean) as string[];
          const count = (s: string): number => latest.filter((x) => x === s).length;
          return {
            run_name: run.name,
            status: run.status,
            release: run.release.name,
            build: run.build.number,
            total: run.items.length,
            done: latest.length,
            pass: count('PASS'),
            fail: count('FAIL'),
            blocked: count('BLOCKED'),
            skipped: count('SKIPPED'),
          };
        }),
      ),
    };
  }

  async defectsCsv(userId: string, projectId: string): Promise<CsvFile> {
    await requireMember(this.db, projectId, userId);
    const defects = await this.db.defect.findMany({
      where: { projectId },
      include: { _count: { select: { history: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return {
      filename: `defects-${stamp()}.csv`,
      content: toCsv(
        ['code', 'title', 'status', 'severity', 'priority', 'history_count', 'created_at'],
        defects.map((d) => ({
          code: d.code,
          title: d.title,
          status: d.status,
          severity: d.severity,
          priority: d.priority,
          history_count: d._count.history,
          created_at: d.createdAt.toISOString(),
        })),
      ),
    };
  }
}
