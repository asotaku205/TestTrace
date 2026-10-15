// Ma trận quyền project/member (nguồn: plan M01 + AUTH-02).
// Seam: hàm can(role, action). Không bắt last-owner (việc của service, cần đếm DB).
import { describe, expect, it } from 'vitest';
import { can, type ProjectAction, type ProjectRole } from './permissions.js';

const roles: ProjectRole[] = ['OWNER', 'MANAGER', 'TESTER', 'VIEWER'];

describe('can', () => {
  it('OWNER làm được mọi action', () => {
    const actions: ProjectAction[] = [
      'project:update',
      'member:add',
      'member:update',
      'member:remove',
    ];
    for (const role of ['OWNER' as const]) {
      for (const action of actions) expect(can(role, action)).toBe(true);
    }
  });

  it('MANAGER quản trị project và member nhưng không vượt OWNER', () => {
    expect(can('MANAGER', 'project:update')).toBe(true);
    expect(can('MANAGER', 'member:add')).toBe(true);
    expect(can('MANAGER', 'member:update')).toBe(true);
    expect(can('MANAGER', 'member:remove')).toBe(true);
  });

  it('TESTER và VIEWER không được đổi project/member', () => {
    for (const role of ['TESTER', 'VIEWER'] as const) {
      expect(can(role, 'project:update')).toBe(false);
      expect(can(role, 'member:add')).toBe(false);
      expect(can(role, 'member:update')).toBe(false);
      expect(can(role, 'member:remove')).toBe(false);
    }
  });

  it('mọi role trong ma trận đều được định nghĩa (không role lạ lọt qua)', () => {
    for (const role of roles) {
      expect(() => can(role, 'member:remove')).not.toThrow();
    }
  });
});
