// Đọc audit event theo project: phân trang, lọc, sắp xếp mới trước (nguồn: M08 + AUDIT-01).
// Event cấp tài khoản (projectId null) chưa đọc ở Slice 1; export ở AUDIT mở rộng sau.
import { Inject, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PRISMA } from '../prisma.module.js';
import { requireMember } from '../projects/access.js';

function fail(code: string, message: string): never {
  throw Object.assign(new Error(message), { code });
}

@Injectable()
export class AuditService {
  constructor(@Inject(PRISMA) private readonly db: PrismaClient) {}

  async list(
    userId: string,
    projectId: string,
    filters: {
      entityType?: string;
      entityId?: string;
      action?: string;
      from?: string;
      to?: string;
    },
    page: number,
    pageSize: number,
  ) {
    await requireMember(this.db, projectId, userId);
    if (!Number.isInteger(page) || page < 1) fail('VALIDATION_ERROR', 'page phải >= 1');
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100)
      fail('VALIDATION_ERROR', 'pageSize trong 1–100');
    const where = {
      projectId,
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.entityId ? { entityId: filters.entityId } : {}),
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(filters.to) } : {}),
            },
          }
        : {}),
    };
    const [total, items] = await Promise.all([
      this.db.auditEvent.count({ where }),
      this.db.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items, total, page, pageSize };
  }
}
