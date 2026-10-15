// Controller defect (nguồn: Q10 + BUG-01).
import { Body, Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { DefectStatus } from '@prisma/client';
import { DefectsService } from './defects.service.js';
import { AccessGuard, AuthenticatedRequest } from '../auth/auth.guard.js';

@Controller('projects/:projectId/defects')
@UseGuards(AccessGuard)
export class DefectsController {
  constructor(@Inject(DefectsService) private readonly defects: DefectsService) {}

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.defects.create(req.userId, projectId, {
      title: body.title as string,
      description: typeof body.description === 'string' ? body.description : undefined,
      stepsToReproduce:
        typeof body.stepsToReproduce === 'string' ? body.stepsToReproduce : undefined,
      severity: typeof body.severity === 'string' ? body.severity : undefined,
      priority: typeof body.priority === 'string' ? body.priority : undefined,
      assigneeId: typeof body.assigneeId === 'string' ? body.assigneeId : undefined,
    });
  }

  @Get()
  list(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('assigneeId') assigneeId?: string,
  ) {
    return this.defects.list(req.userId, projectId, { status, severity, assigneeId });
  }

  @Get(':id')
  get(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.defects.get(req.userId, projectId, id);
  }

  @Post(':id/transition')
  transition(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() body: { to?: unknown; fixedBuildId?: unknown },
  ) {
    return this.defects.transition(
      req.userId,
      projectId,
      id,
      body.to as DefectStatus,
      typeof body.fixedBuildId === 'string' ? body.fixedBuildId : undefined,
    );
  }

  @Post('from-result')
  fromResult(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: { resultId?: unknown; severity?: unknown },
  ) {
    return this.defects.fromResult(
      req.userId,
      projectId,
      body.resultId as string,
      typeof body.severity === 'string' ? body.severity : undefined,
    );
  }

  @Post(':id/retest')
  retest(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() body: { buildId?: unknown; environmentId?: unknown },
  ) {
    return this.defects.retest(req.userId, projectId, id, {
      buildId: body.buildId as string,
      environmentId: body.environmentId as string,
    });
  }

  @Post(':id/retest-resolve')
  retestResolve(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() body: { resultId?: unknown },
  ) {
    return this.defects.retestResolve(req.userId, projectId, id, body.resultId as string);
  }
}
