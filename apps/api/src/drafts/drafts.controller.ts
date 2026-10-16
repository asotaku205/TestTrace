// Controller draft + design model (nguồn: Q10 + DRAFT-01).
import { Body, Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { DraftsService } from './drafts.service.js';
import { AccessGuard, AuthenticatedRequest } from '../auth/auth.guard.js';

@Controller('projects/:projectId/drafts')
@UseGuards(AccessGuard)
export class DraftsController {
  constructor(@Inject(DraftsService) private readonly drafts: DraftsService) {}

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.drafts.create(req.userId, projectId, {
      technique: body.technique as string,
      sourceRef: body.sourceRef,
      inputs: body.inputs,
      expectedResult: typeof body.expectedResult === 'string' ? body.expectedResult : undefined,
      oracleStatus: typeof body.oracleStatus === 'string' ? body.oracleStatus : undefined,
      confidence: typeof body.confidence === 'number' ? body.confidence : undefined,
      assumptions: body.assumptions,
      modelId: typeof body.modelId === 'string' ? body.modelId : undefined,
    });
  }

  @Get()
  list(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Query('status') status?: string,
    @Query('technique') technique?: string,
  ) {
    return this.drafts.list(req.userId, projectId, status, technique);
  }

  @Post(':draftId/approve')
  approve(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('draftId') draftId: string,
    @Body() body: { title?: unknown; suiteId?: unknown; requirementId?: unknown },
  ) {
    return this.drafts.approve(req.userId, projectId, draftId, {
      title: body.title as string,
      suiteId: typeof body.suiteId === 'string' ? body.suiteId : undefined,
      requirementId: typeof body.requirementId === 'string' ? body.requirementId : undefined,
    });
  }

  @Post(':draftId/edit')
  edit(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('draftId') draftId: string,
    @Body() body: { inputs?: unknown; expectedResult?: unknown; confidence?: unknown },
  ) {
    return this.drafts.edit(req.userId, projectId, draftId, {
      inputs: body.inputs,
      expectedResult: typeof body.expectedResult === 'string' ? body.expectedResult : undefined,
      confidence: typeof body.confidence === 'number' ? body.confidence : undefined,
    });
  }

  @Post(':draftId/reject')
  reject(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('draftId') draftId: string,
    @Body() body: { reason?: unknown },
  ) {
    return this.drafts.reject(
      req.userId,
      projectId,
      draftId,
      typeof body.reason === 'string' ? body.reason : undefined,
    );
  }
}

@Controller('projects/:projectId/design-models')
@UseGuards(AccessGuard)
export class DesignModelsController {
  constructor(@Inject(DraftsService) private readonly drafts: DraftsService) {}

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: { kind?: unknown; name?: unknown },
  ) {
    return this.drafts.createModel(
      req.userId,
      projectId,
      body.kind as string,
      typeof body.name === 'string' ? body.name : undefined,
    );
  }

  @Post(':modelId/inputs')
  addInput(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('modelId') modelId: string,
    @Body() body: { payload?: unknown },
  ) {
    return this.drafts.addInput(req.userId, projectId, modelId, body.payload);
  }
}
