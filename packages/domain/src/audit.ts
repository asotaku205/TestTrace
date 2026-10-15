// Hợp đồng audit event cho Slice 1 (nguồn: plan M08 + PLAT-01).
// Chỉ dựng event hợp lệ; append-only do tầng persistence (DB-01) đảm bảo.
export interface AuditEventInput {
  projectId: string;
  actorId: string;
  entityType: string;
  entityId: string;
  action: string;
}

export interface AuditEvent extends AuditEventInput {
  id: string;
  at: string;
}

export function createAuditEvent(input: AuditEventInput): AuditEvent {
  for (const key of ['projectId', 'actorId', 'entityType', 'entityId', 'action'] as const) {
    if (typeof input[key] !== 'string' || input[key].length === 0) {
      throw Object.assign(new Error(`Thiếu trường audit bắt buộc: ${key}`), {
        code: 'AUDIT_INVALID_INPUT',
      });
    }
  }
  return {
    ...input,
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
  };
}
