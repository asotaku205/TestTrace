// Controller RTM (nguồn: Q10 + RTM-01).
import { Controller, Get, Inject, Param, Query, Req, UseGuards } from '@nestjs/common';
import { RtmService } from './rtm.service.js';
import { AccessGuard, AuthenticatedRequest } from '../auth/auth.guard.js';

@Controller('projects/:projectId/rtm')
@UseGuards(AccessGuard)
export class RtmController {
  constructor(@Inject(RtmService) private readonly rtm: RtmService) {}

  @Get()
  matrix(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Query('releaseId') releaseId?: string,
    @Query('buildId') buildId?: string,
  ) {
    return this.rtm.matrix(req.userId, projectId, releaseId, buildId);
  }
}
