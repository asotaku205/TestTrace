// Orchestrator phân tích: registry, idempotency, giới hạn, persist (nguồn: M10 + ANALYSIS-01).
// Chạy đồng bộ trong giới hạn 64KB (parse đo được dưới 1s); timeout worker thật để Slice 5+.
import { Inject, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import {
  basisPaths,
  complexity,
  decisionPoints,
  validateGraph,
  type LanguageAdapter,
} from '@testtrace/cfg-core';
import { stableHash } from '@testtrace/domain';
import { createJsTsAdapter } from '@testtrace/language-js-ts';
import { createPythonAdapter } from '@testtrace/language-python';
import { PRISMA } from '../prisma.module.js';
import { requireAction, requireMember } from '../projects/access.js';

function fail(code: string, message: string, extra: Record<string, unknown> = {}): never {
  throw Object.assign(new Error(message), { code, ...extra });
}

const MAX_SOURCE_BYTES = 64 * 1024;
const MAX_NODES = 2000;
const MAX_EDGES = 4000;
const MAX_PATHS = 200;
const ADAPTER_VERSION = '0.1.0';

function registry(): LanguageAdapter[] {
  return [createJsTsAdapter(), createPythonAdapter()];
}

function adapterFor(language: string): LanguageAdapter {
  const normalized = language.toLowerCase().replace(/[^a-z+#]+/g, '');
  const found = registry().find((a) => {
    if (a.id === 'javascript-typescript') {
      return ['javascript', 'typescript', 'js', 'ts'].includes(normalized);
    }
    if (a.id === 'python') {
      return ['python', 'py'].includes(normalized);
    }
    return false;
  });
  if (!found) {
    fail('ADAPTER_UNKNOWN', `Chưa có adapter cho ngôn ngữ: ${language}`, {
      adapters: registry().map((a) => a.id),
    });
  }
  return found;
}

@Injectable()
export class AnalysesService {
  constructor(@Inject(PRISMA) private readonly db: PrismaClient) {}

  async analyze(
    userId: string,
    projectId: string,
    input: { language: string; source: string; name?: string; maxPaths?: number },
  ) {
    const member = await requireMember(this.db, projectId, userId);
    requireAction(member.role, 'requirement:write');
    if (typeof input.source !== 'string' || input.source.length === 0)
      fail('VALIDATION_ERROR', 'Source bắt buộc');
    if (Buffer.byteLength(input.source, 'utf8') > MAX_SOURCE_BYTES)
      fail('ANALYSIS_TOO_LARGE', 'Source vượt quá 64KB');
    const adapter = adapterFor(input.language);
    const config = { maxPaths: input.maxPaths ?? MAX_PATHS };
    const sourceHash = createHash('sha256').update(input.source, 'utf8').digest('hex');
    const configHash = stableHash(config);
    const existing = await this.db.analysis.findUnique({
      where: {
        projectId_sourceHash_adapterVersion_configHash: {
          projectId,
          sourceHash,
          adapterVersion: ADAPTER_VERSION,
          configHash,
        },
      },
    });
    if (existing) return existing;

    const started = Date.now();
    try {
      const graph = adapter.buildControlFlow(input.source);
      const validation = validateGraph(graph);
      if (!validation.valid) {
        fail('ANALYSIS_INVALID', 'Graph không hợp lệ', { issues: validation.issues });
      }
      const diagnostics: Array<Record<string, unknown>> = [];
      let status: 'SUCCEEDED' | 'PARTIAL' = 'SUCCEEDED';
      if (graph.nodes.length > MAX_NODES || graph.edges.length > MAX_EDGES) {
        status = 'PARTIAL';
        diagnostics.push({
          kind: 'limit',
          message: `Vượt ngưỡng node/edge (N=${graph.nodes.length}, E=${graph.edges.length}); giữ nguyên graph kèm cảnh báo`,
        });
      }
      const paths = basisPaths(graph, config.maxPaths);
      if (paths.truncated) {
        status = 'PARTIAL';
        diagnostics.push({
          kind: 'limit',
          message: `Đường đi vượt ngưỡng ${config.maxPaths}, đã cắt bớt`,
        });
      }
      return await this.db.analysis.create({
        data: {
          projectId,
          name: input.name,
          language: input.language,
          sourceHash,
          source: input.source,
          adapterId: adapter.id,
          adapterVersion: ADAPTER_VERSION,
          configHash,
          status,
          diagnostics: diagnostics.length > 0 ? JSON.parse(JSON.stringify(diagnostics)) : undefined,
          graph: JSON.parse(JSON.stringify({ nodes: graph.nodes, edges: graph.edges })),
          metrics: JSON.parse(
            JSON.stringify({
              complexity: complexity(graph),
              decisions: decisionPoints(graph).length,
              paths: paths.paths,
              pathsTruncated: paths.truncated,
              unreachable: validation.unreachable,
            }),
          ),
          durationMs: Date.now() - started,
          createdBy: userId,
        },
      });
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code: unknown }).code)
          : 'ANALYSIS_FAILED';
      const diagnostics =
        typeof err === 'object' && err !== null && 'diagnostics' in err
          ? (err as { diagnostics: unknown }).diagnostics
          : [{ kind: 'error', message: (err as Error).message }];
      if (code === 'ADAPTER_UNKNOWN') throw err;
      return await this.db.analysis.create({
        data: {
          projectId,
          name: input.name,
          language: input.language,
          sourceHash,
          source: input.source,
          adapterId: adapter.id,
          adapterVersion: ADAPTER_VERSION,
          configHash,
          status: 'FAILED',
          diagnostics: diagnostics as never,
          durationMs: Date.now() - started,
          createdBy: userId,
        },
      });
    }
  }

  async list(userId: string, projectId: string) {
    await requireMember(this.db, projectId, userId);
    return this.db.analysis.findMany({
      where: { projectId },
      select: {
        id: true,
        name: true,
        language: true,
        status: true,
        adapterId: true,
        adapterVersion: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(userId: string, projectId: string, id: string) {
    await requireMember(this.db, projectId, userId);
    const analysis = await this.db.analysis.findFirst({ where: { id, projectId } });
    if (!analysis) fail('ANALYSIS_NOT_FOUND', 'Analysis không tồn tại');
    return analysis;
  }
}
