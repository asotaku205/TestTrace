// Kiểm tra membership + quyền dùng chung cho các service theo project (nguồn: AUTH-02/REQ-01).
import { PrismaClient, MemberRole } from '@prisma/client';
import { can, type ProjectAction } from '@testtrace/domain';

function fail(code: string, message: string): never {
  throw Object.assign(new Error(message), { code });
}

export async function requireMember(db: PrismaClient, projectId: string, userId: string) {
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) fail('PROJECT_NOT_FOUND', 'Project không tồn tại');
  const member = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!member) fail('PROJECT_FORBIDDEN', 'Không có quyền trên project này');
  return member;
}

export function requireAction(role: MemberRole, action: ProjectAction): void {
  if (!can(role, action)) fail('PROJECT_FORBIDDEN', 'Vai trò không được phép');
}
