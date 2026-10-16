// Đính kèm evidence: upload ngoài DB + checksum + sanitize (nguồn: M08 + EVID-01).
import { Inject, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileTypeFromBuffer } from 'file-type';
import { createAuditEvent, sanitizeFilename } from '@testtrace/domain';
import { PRISMA } from '../prisma.module.js';
import { requireMember } from '../projects/access.js';

function fail(code: string, message: string): never {
  throw Object.assign(new Error(message), { code });
}

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'text/plain',
  'application/pdf',
  'application/json',
  'application/xml',
]);
const TEXT_EXTS = new Set(['.txt', '.log', '.md', '.csv', '.json', '.xml']);

@Injectable()
export class EvidenceService {
  constructor(@Inject(PRISMA) private readonly db: PrismaClient) {}

  private async checkTarget(
    projectId: string,
    entityType: string,
    entityId: string,
  ): Promise<void> {
    if (entityType === 'defect') {
      const defect = await this.db.defect.findFirst({ where: { id: entityId, projectId } });
      if (!defect) fail('EVIDENCE_TARGET', 'Defect không thuộc project này');
      return;
    }
    if (entityType === 'result') {
      const result = await this.db.testResult.findUnique({
        where: { id: entityId },
        include: { item: { include: { run: true } } },
      });
      if (!result || result.item.run.projectId !== projectId)
        fail('EVIDENCE_TARGET', 'Kết quả không thuộc project này');
      return;
    }
    fail('VALIDATION_ERROR', 'entityType phải là defect hoặc result');
  }

  async upload(
    userId: string,
    projectId: string,
    entityType: string,
    entityId: string,
    file: { originalname: string; buffer: Buffer; size: number },
  ) {
    const member = await requireMember(this.db, projectId, userId);
    if (member.role === 'VIEWER') fail('PROJECT_FORBIDDEN', 'Vai trò không được phép');
    await this.checkTarget(projectId, entityType, entityId);
    if (file.size > MAX_BYTES) fail('EVIDENCE_TOO_LARGE', 'File vượt quá 10MB');
    const sniffed = await fileTypeFromBuffer(file.buffer);
    let mime: string;
    if (sniffed) {
      if (!ALLOWED_MIME.has(sniffed.mime))
        fail('EVIDENCE_TYPE', `Loại file không hỗ trợ: ${sniffed.mime}`);
      mime = sniffed.mime;
    } else {
      const dot = file.originalname.lastIndexOf('.');
      const ext = dot >= 0 ? file.originalname.slice(dot).toLowerCase() : '';
      if (!TEXT_EXTS.has(ext)) fail('EVIDENCE_TYPE', 'Không nhận diện được loại file');
      mime = 'text/plain';
    }
    const filename = `${randomUUID()}-${sanitizeFilename(file.originalname)}`;
    const storagePath = join('storage', projectId, filename);
    await mkdir(dirname(storagePath), { recursive: true });
    await writeFile(storagePath, file.buffer);
    const checksum = createHash('sha256').update(file.buffer).digest('hex');
    const evidence = await this.db.evidence.create({
      data: {
        projectId,
        filename,
        originalName: file.originalname,
        mime,
        size: file.size,
        checksum,
        storagePath,
        createdBy: userId,
        links: { create: { entityType, entityId } },
      },
    });
    const event = createAuditEvent({
      projectId,
      actorId: userId,
      entityType: 'evidence',
      entityId: evidence.id,
      action: 'evidence.uploaded',
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
    return { ...evidence, checksum };
  }

  async download(userId: string, projectId: string, evidenceId: string) {
    await requireMember(this.db, projectId, userId);
    const evidence = await this.db.evidence.findFirst({ where: { id: evidenceId, projectId } });
    if (!evidence || evidence.archivedAt) fail('EVIDENCE_NOT_FOUND', 'Evidence không tồn tại');
    const buffer = await readFile(evidence.storagePath);
    const checksum = createHash('sha256').update(buffer).digest('hex');
    if (checksum !== evidence.checksum) fail('EVIDENCE_CORRUPT', 'File đã bị thay đổi');
    return { buffer, mime: evidence.mime, filename: evidence.originalName };
  }

  async archive(userId: string, projectId: string, evidenceId: string) {
    const member = await requireMember(this.db, projectId, userId);
    if (member.role === 'VIEWER') fail('PROJECT_FORBIDDEN', 'Vai trò không được phép');
    const evidence = await this.db.evidence.findFirst({ where: { id: evidenceId, projectId } });
    if (!evidence) fail('EVIDENCE_NOT_FOUND', 'Evidence không tồn tại');
    return this.db.evidence.update({ where: { id: evidenceId }, data: { archivedAt: new Date() } });
  }

  async listFor(userId: string, projectId: string, entityType: string, entityId: string) {
    await requireMember(this.db, projectId, userId);
    await this.checkTarget(projectId, entityType, entityId);
    const links = await this.db.evidenceLink.findMany({
      where: { entityType, entityId },
      include: { evidence: true },
      orderBy: { createdAt: 'asc' },
    });
    return links.map((l) => l.evidence).filter((e) => !e.archivedAt);
  }
}
