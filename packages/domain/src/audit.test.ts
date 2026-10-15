// Test cho hợp đồng audit event (nguồn: plan M08 + PLAT-01).
// Seam: hàm công khai createAuditEvent. Bắt lỗi shape sai; không bắt append-only
// ở persistence (việc của DB-01 integration test).
import { describe, expect, it } from 'vitest';
import { createAuditEvent } from './audit.js';

const input = {
  projectId: '11111111-1111-4111-8111-111111111111',
  actorId: '22222222-2222-4222-8222-222222222222',
  entityType: 'requirement',
  entityId: '33333333-3333-4333-8333-333333333333',
  action: 'requirement.created',
} as const;

describe('createAuditEvent', () => {
  it('tạo event có id uuid và thời điểm UTC ISO, giữ nguyên các trường đầu vào', () => {
    const event = createAuditEvent({ ...input });
    expect(event.projectId).toBe(input.projectId);
    expect(event.actorId).toBe(input.actorId);
    expect(event.entityType).toBe(input.entityType);
    expect(event.entityId).toBe(input.entityId);
    expect(event.action).toBe(input.action);
    expect(event.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(new Date(event.at).toISOString()).toBe(event.at);
  });

  it('hai lần gọi tạo id khác nhau', () => {
    const a = createAuditEvent({ ...input });
    const b = createAuditEvent({ ...input });
    expect(a.id).not.toBe(b.id);
  });

  it('thiếu trường bắt buộc thì ném lỗi mã ổn định AUDIT_INVALID_INPUT', () => {
    const bad = { ...input, action: '' };
    try {
      createAuditEvent(bad);
      expect.unreachable('phải ném lỗi khi action rỗng');
    } catch (err) {
      expect(err).toMatchObject({ code: 'AUDIT_INVALID_INPUT' });
    }
  });
});
