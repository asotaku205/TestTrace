// Controller test run (nguồn: Q10 + RUN-01).
import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import { RunsService, type RunSource } from './runs.service.js';
import { AccessGuard, AuthenticatedRequest } from '../auth/auth.guard.js';

@Controller('projects/:projectId/runs')
@UseGuards(AccessGuard)
export class RunsController {
  constructor(@Inject(RunsService) private readonly runs: RunsService) {}

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body()
    body: {
      name?: unknown;
      releaseId?: unknown;
      buildId?: unknown;
      environmentId?: unknown;
      suiteId?: unknown;
      testCaseIds?: unknown;
      status?: unknown;
      priority?: unknown;
      tag?: unknown;
    },
  ) {
    const source: RunSource = {
      suiteId: typeof body.suiteId === 'string' ? body.suiteId : undefined,
      testCaseIds: Array.isArray(body.testCaseIds) ? (body.testCaseIds as string[]) : undefined,
      status: typeof body.status === 'string' ? body.status : undefined,
      priority: typeof body.priority === 'string' ? body.priority : undefined,
      tag: typeof body.tag === 'string' ? body.tag : undefined,
    };
    return this.runs.create(req.userId, projectId, {
      name: body.name as string,
      releaseId: body.releaseId as string,
      buildId: body.buildId as string,
      environmentId: body.environmentId as string,
      source,
    });
  }

  @Get()
  list(@Req() req: AuthenticatedRequest, @Param('projectId') projectId: string) {
    return this.runs.list(req.userId, projectId);
  }

  @Get(':runId')
  get(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
  ) {
    return this.runs.get(req.userId, projectId, runId);
  }

  @Post(':runId/assign')
  assign(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
    @Body() body: { assignments?: unknown },
  ) {
    return this.runs.assign(
      req.userId,
      projectId,
      runId,
      (body.assignments ?? []) as Array<{ itemId: string; assigneeId: string | null }>,
    );
  }
}
