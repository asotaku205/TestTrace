// Controller analysis (nguồn: Q10 + ANALYSIS-01).
import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AnalysesService } from './analyses.service.js';
import { AccessGuard, AuthenticatedRequest } from '../auth/auth.guard.js';

@Controller('projects/:projectId/analyses')
@UseGuards(AccessGuard)
export class AnalysesController {
  constructor(@Inject(AnalysesService) private readonly analyses: AnalysesService) {}

  @Post()
  analyze(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: { language?: unknown; source?: unknown; name?: unknown; maxPaths?: unknown },
  ) {
    return this.analyses.analyze(req.userId, projectId, {
      language: body.language as string,
      source: body.source as string,
      name: typeof body.name === 'string' ? body.name : undefined,
      maxPaths: typeof body.maxPaths === 'number' ? body.maxPaths : undefined,
    });
  }

  @Get()
  list(@Req() req: AuthenticatedRequest, @Param('projectId') projectId: string) {
    return this.analyses.list(req.userId, projectId);
  }

  @Get(':id')
  get(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.analyses.get(req.userId, projectId, id);
  }
}
