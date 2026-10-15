// Controller release/build/environment (nguồn: Q10 + REL-01).
import { Body, Controller, Delete, Get, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ReleaseStatus } from '@prisma/client';
import { ReleasesService } from './releases.service.js';
import { AccessGuard, AuthenticatedRequest } from '../auth/auth.guard.js';

@Controller('projects/:projectId/releases')
@UseGuards(AccessGuard)
export class ReleasesController {
  constructor(@Inject(ReleasesService) private readonly releases: ReleasesService) {}

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: { name?: unknown },
  ) {
    return this.releases.createRelease(req.userId, projectId, body.name as string);
  }

  @Get()
  list(@Req() req: AuthenticatedRequest, @Param('projectId') projectId: string) {
    return this.releases.listReleases(req.userId, projectId);
  }

  @Get(':releaseId')
  get(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('releaseId') releaseId: string,
  ) {
    return this.releases.getRelease(req.userId, projectId, releaseId);
  }

  @Post(':releaseId/transition')
  transition(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('releaseId') releaseId: string,
    @Body() body: { to?: unknown },
  ) {
    return this.releases.transition(req.userId, projectId, releaseId, body.to as ReleaseStatus);
  }

  @Post(':releaseId/freeze')
  freeze(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('releaseId') releaseId: string,
  ) {
    return this.releases.freeze(req.userId, projectId, releaseId);
  }

  @Post(':releaseId/builds')
  createBuild(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('releaseId') releaseId: string,
    @Body() body: { number?: unknown },
  ) {
    return this.releases.createBuild(req.userId, projectId, releaseId, body.number as string);
  }
}

@Controller('projects/:projectId/environments')
@UseGuards(AccessGuard)
export class EnvironmentsController {
  constructor(@Inject(ReleasesService) private readonly releases: ReleasesService) {}

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: { name?: unknown },
  ) {
    return this.releases.createEnvironment(req.userId, projectId, body.name as string);
  }

  @Get()
  list(@Req() req: AuthenticatedRequest, @Param('projectId') projectId: string) {
    return this.releases.listEnvironments(req.userId, projectId);
  }

  @Delete(':envId')
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('envId') envId: string,
  ) {
    return this.releases.deleteEnvironment(req.userId, projectId, envId);
  }
}
