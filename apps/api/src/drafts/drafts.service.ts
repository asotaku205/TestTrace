// Use case draft: tạo (dedupe + gộp nguồn), duyệt thành test case, sửa giữ diff, từ chối (nguồn: M14 + DRAFT-01).
import { Inject, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createAuditEvent } from '@testtrace/domain';
import { bvaPoints, draftFingerprint, predicatesForPath } from '@testtrace/test-generation';
import type { NeutralCfg } from '@testtrace/cfg-core';
import { PRISMA } from '../prisma.module.js';
import { requireAction, requireMember } from '../projects/access.js';

function fail(code: string, message: string): never {
  throw Object.assign(new Error(message), { code });
}

const techniques = ['path', 'branch', 'boundary', 'partition', 'decision-table'];

@Injectable()
export class DraftsService {
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
      technique: string;
      sourceRef: unknown;
      inputs: unknown;
      expectedResult?: string;
      oracleStatus?: string;
      confidence?: number;
      assumptions?: unknown;
      modelId?: string;
    },
  ) {
    const member = await requireMember(this.db, projectId, userId);
    requireAction(member.role, 'requirement:write');
    if (!techniques.includes(input.technique)) fail('VALIDATION_ERROR', 'Technique không hỗ trợ');
    if (typeof input.inputs !== 'object' || input.inputs === null)
      fail('VALIDATION_ERROR', 'Inputs phải là object');
    if (
      input.oracleStatus !== undefined &&
      !['DEFINED', 'NEEDS_REVIEW'].includes(input.oracleStatus)
    ) {
      fail('VALIDATION_ERROR', 'oracleStatus phải là DEFINED hoặc NEEDS_REVIEW');
    }
    if (input.confidence !== undefined && !(input.confidence >= 0 && input.confidence <= 100)) {
      fail('VALIDATION_ERROR', 'confidence trong 0–100');
    }
    if (input.modelId) {
      const model = await this.db.designModel.findFirst({
        where: { id: input.modelId, projectId },
      });
      if (!model) fail('DESIGN_MODEL_NOT_FOUND', 'Design model không tồn tại');
    }
    const fingerprint = draftFingerprint({
      technique: input.technique,
      inputs: input.inputs,
      expectedResult: input.expectedResult,
    });
    const existing = await this.db.testDraft.findUnique({
      where: { projectId_fingerprint: { projectId, fingerprint } },
    });
    if (existing) {
      const sources = [...((existing.sources as unknown[]) ?? [])];
      const ref = JSON.stringify(input.sourceRef);
      if (!sources.some((s) => JSON.stringify(s) === ref)) sources.push(input.sourceRef);
      const merged = await this.db.testDraft.update({
        where: { id: existing.id },
        data: { sources: sources as never },
      });
      return { ...merged, deduped: true };
    }
    const draft = await this.db.testDraft.create({
      data: {
        projectId,
        modelId: input.modelId,
        technique: input.technique,
        sourceRef: (input.sourceRef ?? {}) as never,
        sources: [input.sourceRef ?? {}] as never,
        inputs: (input.inputs ?? {}) as never,
        expectedResult: input.expectedResult,
        oracleStatus: input.oracleStatus ?? 'DEFINED',
        confidence: input.confidence ?? 50,
        assumptions: (input.assumptions ?? undefined) as never,
        fingerprint,
      },
    });
    await this.appendAudit({
      projectId,
      actorId: userId,
      entityType: 'draft',
      entityId: draft.id,
      action: 'draft.created',
    });
    return { ...draft, deduped: false };
  }

  async list(userId: string, projectId: string, status?: string, technique?: string) {
    await requireMember(this.db, projectId, userId);
    return this.db.testDraft.findMany({
      where: {
        projectId,
        ...(status ? { status: status as never } : {}),
        ...(technique ? { technique } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async approve(
    userId: string,
    projectId: string,
    draftId: string,
    input: { title: string; suiteId?: string; requirementId?: string },
  ) {
    const member = await requireMember(this.db, projectId, userId);
    requireAction(member.role, 'requirement:write');
    const draft = await this.db.testDraft.findFirst({ where: { id: draftId, projectId } });
    if (!draft) fail('DRAFT_NOT_FOUND', 'Draft không tồn tại');
    if (draft.status !== 'PENDING') fail('DRAFT_STATE', 'Chỉ duyệt draft PENDING');
    if (typeof input.title !== 'string' || input.title.trim().length === 0)
      fail('VALIDATION_ERROR', 'Tiêu đề test case bắt buộc');
    if (input.suiteId) {
      const suite = await this.db.testSuite.findFirst({ where: { id: input.suiteId, projectId } });
      if (!suite) fail('SUITE_NOT_FOUND', 'Suite không tồn tại');
    }
    const count = await this.db.testCase.count({ where: { projectId } });
    const testCase = await this.db.testCase.create({
      data: {
        projectId,
        code: `TC-${String(count + 1).padStart(3, '0')}`,
        title: input.title.trim(),
        suiteId: input.suiteId,
        expectedResult: draft.expectedResult,
      },
    });
    if (input.requirementId) {
      const requirement = await this.db.requirement.findFirst({
        where: { id: input.requirementId, projectId },
      });
      if (!requirement) fail('REQUIREMENT_NOT_FOUND', 'Requirement không tồn tại');
      await this.db.requirementTestCase.create({
        data: { requirementId: input.requirementId, testCaseId: testCase.id },
      });
    }
    const updated = await this.db.testDraft.update({
      where: { id: draftId },
      data: { status: 'APPROVED', testCaseId: testCase.id },
    });
    await this.db.draftReview.create({
      data: { draftId, decision: 'APPROVED', actorId: userId },
    });
    await this.appendAudit({
      projectId,
      actorId: userId,
      entityType: 'draft',
      entityId: draftId,
      action: 'draft.approved',
    });
    return updated;
  }

  async edit(
    userId: string,
    projectId: string,
    draftId: string,
    input: { inputs?: unknown; expectedResult?: string; confidence?: number },
  ) {
    const member = await requireMember(this.db, projectId, userId);
    requireAction(member.role, 'requirement:write');
    const draft = await this.db.testDraft.findFirst({ where: { id: draftId, projectId } });
    if (!draft) fail('DRAFT_NOT_FOUND', 'Draft không tồn tại');
    if (draft.status !== 'PENDING') fail('DRAFT_STATE', 'Chỉ sửa draft PENDING');
    const nextInputs = (input.inputs ?? draft.inputs) as Record<string, unknown>;
    const nextExpected =
      input.expectedResult !== undefined ? input.expectedResult : draft.expectedResult;
    const diff = {
      inputs: { from: draft.inputs, to: nextInputs },
      expectedResult: { from: draft.expectedResult, to: nextExpected },
    };
    const fingerprint = draftFingerprint({
      technique: draft.technique,
      inputs: nextInputs,
      expectedResult: nextExpected,
    });
    const updated = await this.db.testDraft.update({
      where: { id: draftId },
      data: {
        inputs: nextInputs as never,
        expectedResult: nextExpected,
        confidence: input.confidence ?? draft.confidence,
        fingerprint,
      },
    });
    await this.db.draftReview.create({
      data: { draftId, decision: 'EDITED', diff: diff as never, actorId: userId },
    });
    return updated;
  }

  async reject(userId: string, projectId: string, draftId: string, reason?: string) {
    const member = await requireMember(this.db, projectId, userId);
    requireAction(member.role, 'requirement:write');
    const draft = await this.db.testDraft.findFirst({ where: { id: draftId, projectId } });
    if (!draft) fail('DRAFT_NOT_FOUND', 'Draft không tồn tại');
    if (draft.status !== 'PENDING') fail('DRAFT_STATE', 'Chỉ từ chối draft PENDING');
    const updated = await this.db.testDraft.update({
      where: { id: draftId },
      data: { status: 'REJECTED' },
    });
    await this.db.draftReview.create({
      data: { draftId, decision: 'REJECTED', reason, actorId: userId },
    });
    return updated;
  }

  async createModel(userId: string, projectId: string, kind: string, name?: string) {
    const member = await requireMember(this.db, projectId, userId);
    requireAction(member.role, 'requirement:write');
    if (typeof kind !== 'string' || kind.trim().length === 0)
      fail('VALIDATION_ERROR', 'Kind model bắt buộc');
    return this.db.designModel.create({
      data: { projectId, kind: kind.trim(), name, createdBy: userId },
    });
  }

  async addInput(userId: string, projectId: string, modelId: string, payload: unknown) {
    const member = await requireMember(this.db, projectId, userId);
    requireAction(member.role, 'requirement:write');
    const model = await this.db.designModel.findFirst({ where: { id: modelId, projectId } });
    if (!model) fail('DESIGN_MODEL_NOT_FOUND', 'Design model không tồn tại');
    if (typeof payload !== 'object' || payload === null)
      fail('VALIDATION_ERROR', 'Payload phải là object');
    return this.db.designInput.create({ data: { modelId, payload: payload as never } });
  }

  private async loadGraph(
    projectId: string,
    analysisId: string,
  ): Promise<{
    graph: NeutralCfg;
    source: string;
  }> {
    const analysis = await this.db.analysis.findFirst({ where: { id: analysisId, projectId } });
    if (!analysis || analysis.status !== 'SUCCEEDED' || !analysis.graph) {
      fail('DRAFT_SOURCE', 'Analysis không khả dụng để sinh draft');
    }
    const graph = (analysis.graph as unknown as NeutralCfg) ?? { nodes: [], edges: [] };
    return { graph, source: analysis.source };
  }

  async fromPath(userId: string, projectId: string, analysisId: string, path: string[]) {
    const member = await requireMember(this.db, projectId, userId);
    requireAction(member.role, 'requirement:write');
    if (!Array.isArray(path) || path.length === 0) fail('VALIDATION_ERROR', 'Path bắt buộc');
    const { graph, source } = await this.loadGraph(projectId, analysisId);
    const known = new Set(graph.nodes.map((n) => n.id));
    if (!path.every((id) => known.has(id))) fail('DRAFT_SOURCE', 'Path chứa node ngoài graph');
    const predicates = predicatesForPath(graph, source, path);
    // Confidence là heuristic quy ước (path cụ thể hơn nhưng oracle vẫn cần người):
    // path 40, branch 60. Không bao giờ tự approve (nguồn: Q5 Slice 4).
    return this.create(userId, projectId, {
      technique: 'path',
      sourceRef: { analysisId, path },
      inputs: { predicates },
      oracleStatus: 'NEEDS_REVIEW',
      confidence: 40,
      assumptions: ['cần người điền giá trị thỏa predicates', 'expected result cần người xác nhận'],
    });
  }

  async fromBva(
    userId: string,
    projectId: string,
    input: { variable?: unknown; min?: unknown; max?: unknown; analysisId?: unknown },
  ) {
    const member = await requireMember(this.db, projectId, userId);
    requireAction(member.role, 'requirement:write');
    const variable = typeof input.variable === 'string' ? input.variable.trim() : '';
    const min = Number(input.min);
    const max = Number(input.max);
    if (!variable) fail('VALIDATION_ERROR', 'Tên biến bắt buộc');
    if (!Number.isFinite(min) || !Number.isFinite(max)) fail('VALIDATION_ERROR', 'min/max phải là số');
    let points;
    try {
      points = bvaPoints({ type: 'integer', min, max, minInclusive: true, maxInclusive: true });
    } catch (e) {
      fail('VALIDATION_ERROR', (e as Error).message);
    }
    const created = [];
    for (const p of points as Array<{ value: number; kind: string; valid: boolean }>) {
      created.push(
        await this.create(userId, projectId, {
          technique: 'boundary',
          sourceRef: { variable, min, max, analysisId: input.analysisId ?? null },
          inputs: { variable, value: p.value, kind: p.kind, expectedValid: p.valid },
          oracleStatus: 'NEEDS_REVIEW',
          confidence: 70,
          assumptions: ['giá trị biên cần người xác nhận expected', 'miền số nguyên'],
        }),
      );
    }
    return { count: created.length, drafts: created };
  }

  async fromDecision(userId: string, projectId: string, analysisId: string, nodeId: string) {
    const member = await requireMember(this.db, projectId, userId);
    requireAction(member.role, 'requirement:write');
    const { graph, source } = await this.loadGraph(projectId, analysisId);
    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node || (node.type !== 'DECISION' && node.type !== 'LOOP')) {
      fail('DRAFT_SOURCE', 'Node không phải decision');
    }
    const outgoing = graph.edges.filter((e) => e.from === nodeId).map((e) => e.to);
    const predicates = predicatesForPath(graph, source, [
      nodeId,
      ...(outgoing[0] ? [outgoing[0]] : []),
    ]);
    return this.create(userId, projectId, {
      technique: 'branch',
      sourceRef: { analysisId, nodeId },
      inputs: { predicates },
      oracleStatus: 'NEEDS_REVIEW',
      confidence: 60,
      assumptions: ['cần người điền giá trị thỏa predicates', 'expected result cần người xác nhận'],
    });
  }
}
