// Ma trận quyền (nguồn: plan M01: Viewer chỉ đọc; Tester không đổi cấu hình/member).
export type ProjectRole = 'OWNER' | 'MANAGER' | 'TESTER' | 'VIEWER';
export type ProjectAction =
  'project:update' | 'member:add' | 'member:update' | 'member:remove' | 'requirement:write';

const allowed: Record<ProjectRole, ProjectAction[]> = {
  OWNER: ['project:update', 'member:add', 'member:update', 'member:remove', 'requirement:write'],
  MANAGER: ['project:update', 'member:add', 'member:update', 'member:remove', 'requirement:write'],
  TESTER: ['requirement:write'],
  VIEWER: [],
};

export function can(role: ProjectRole, action: ProjectAction): boolean {
  return allowed[role].includes(action);
}
