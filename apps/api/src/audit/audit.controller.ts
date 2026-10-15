// Controller audit: validate rồi gọi use case (nguồn: Q10 + AUDIT-01).
import { Controller, Get, Inject, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service.js';
import { AccessGuard, AuthenticatedRequest } from '../auth/auth.guard.js';

@Controller('projects/:projectId/audit')
@UseGuards(AccessGuard)
export class AuditController {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  @Get()
  list(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.audit.list(
      req.userId,
      projectId,
      { entityType, entityId, action, from, to },
      page === undefined ? 1 : Number(page),
      pageSize === undefined ? 20 : Number(pageSize),
    );
  }
}
