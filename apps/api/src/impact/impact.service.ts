// So 2 version mã, xếp hạng regression có lý do (nguồn: M15 + IMPACT-01).
// PATH_CHANGED dành cho khi có coverage; ticket này phát DIRECT_LINK/SAME_REQUIREMENT.
import { Inject, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { diffGraphs, matchUnits, type LanguageAdapter } from '@testtrace/cfg-core';
import { createAuditEvent, reasonCodesFor } from '@testtrace/domain';
import { createJsTsAdapter } from '@testtrace/language-js-ts';
import { createPythonAdapter } from '@testtrace/language-python';
import { PRISMA } from '../prisma.module.js';
import { requireAction, requireMember } from '../projects/access.js';

function fail(code: string, message: string): never {
  throw Object.assign(new Error(message), { code });
}

function adapterFor(language: string): LanguageAdapter {
  const normalized = language.toLowerCase();
  if (normalized.startsWith('py')) return createPythonAdapter();
  if (['javascript', 'typescript', 'js', 'ts'].includes(normalized)) return createJsTsAdapter();
  fail('ADAPTER_UNKNOWN', `Chưa có adapter cho ngôn ngữ: ${language}`);
}

@Injectable()
export class ImpactService {
  constructor(@Inject(PRISMA) private readonly db: PrismaClient) {}

  async compare(userId: string, projectId: string, fromVersionId: string, toVersionId: string) {
    const member = await requireMember(this.db, projectId, userId);
    requireAction(member.role, 'requirement:write');
    const [from, to] = await Promise.all([
      this.db.codeVersion.findFirst({
        where: { id: fromVersionId },
        include: { artifact: true, units: true },
      }),
      this.db.codeVersion.findFirst({
        where: { id: toVersionId },
        include: { artifact: true, units: true },
      }),
    ]);
    if (
      !from ||
      from.artifact.projectId !== projectId ||
      !to ||
      to.artifact.projectId !== projectId
    ) {
      fail('IMPACT_VERSIONS', 'Version không thuộc project này');
    }
    if (from.artifactId !== to.artifactId) {
      fail('IMPACT_VERSIONS', 'Hai version phải cùng artifact');
    }
    const adapter = adapterFor(from.artifact.language);
    const matches = matchUnits(
      from.units.map((u) => ({ qualifiedName: u.qualifiedName, paramsHash: u.signatureHash })),
      to.units.map((u) => ({ qualifiedName: u.qualifiedName, paramsHash: u.signatureHash })),
    );
    const oldGraph = adapter.buildControlFlow(from.source);
    const newGraph = adapter.buildControlFlow(to.source);
    const graphDiff = diffGraphs(
      { graph: oldGraph, source: from.source },
      { graph: newGraph, source: to.source },
    );
    const structurallyChanged =
      graphDiff.addedNodes.length > 0 ||
      graphDiff.removedNodes.length > 0 ||
      graphDiff.modifiedNodes.length > 0;
    const changedUnits = structurallyChanged
      ? matches
          .filter((m) => m.status === 'same' && m.newName !== null)
          .map((m) => ({ artifactId: from.artifactId, qualifiedName: m.newName as string }))
      : [];
    const links = await this.db.requirementCodeUnit.findMany({
      where: { artifactId: from.artifactId },
      include: {
        requirement: {
          include: {
            testLinks: {
              include: { testCase: { select: { id: true, code: true, title: true } } },
            },
          },
        },
      },
    });
    const impactedTests: Array<{
      testCaseId: string;
      code: string;
      title: string;
      requirementId: string;
      reasonCodes: string[];
    }> = [];
    const seen = new Set<string>();
    for (const link of links) {
      const refs = [{ artifactId: link.artifactId, qualifiedName: link.qualifiedName }];
      for (const testLink of link.requirement.testLinks) {
        const codes = reasonCodesFor(refs, changedUnits);
        if (codes.length > 0 && !seen.has(testLink.testCase.id)) {
          seen.add(testLink.testCase.id);
          impactedTests.push({
            testCaseId: testLink.testCase.id,
            code: testLink.testCase.code,
            title: testLink.testCase.title,
            requirementId: link.requirementId,
            reasonCodes: codes,
          });
        }
      }
    }
    const result = {
      matches,
      graphDiff,
      complexityDelta: graphDiff.complexityDelta,
      changedUnits,
      impactedTests,
    };
    const saved = await this.db.impactAnalysis.create({
      data: {
        projectId,
        fromVersionId,
        toVersionId,
        result: JSON.parse(JSON.stringify(result)),
        createdBy: userId,
      },
    });
    const event = createAuditEvent({
      projectId,
      actorId: userId,
      entityType: 'impact',
      entityId: saved.id,
      action: 'impact.compared',
    });
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
    return { id: saved.id, ...result };
  }
}
