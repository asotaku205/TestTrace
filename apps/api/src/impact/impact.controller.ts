// Controller impact (nguồn: Q10 + IMPACT-01).
import { Body, Controller, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ImpactService } from './impact.service.js';
import { AccessGuard, AuthenticatedRequest } from '../auth/auth.guard.js';

@Controller('projects/:projectId/impact')
@UseGuards(AccessGuard)
export class ImpactController {
  constructor(@Inject(ImpactService) private readonly impact: ImpactService) {}

  @Post()
  compare(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: { fromVersionId?: unknown; toVersionId?: unknown },
  ) {
    return this.impact.compare(
      req.userId,
      projectId,
      body.fromVersionId as string,
      body.toVersionId as string,
    );
  }
}
