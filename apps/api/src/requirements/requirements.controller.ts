// Controller requirement + criteria (nguồn: Q10 + REQ-01).
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RequirementsService } from './requirements.service.js';
import { AccessGuard, AuthenticatedRequest } from '../auth/auth.guard.js';

@Controller('projects/:projectId/requirements')
@UseGuards(AccessGuard)
export class RequirementsController {
  constructor(@Inject(RequirementsService) private readonly requirements: RequirementsService) {}

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: { title?: unknown; description?: unknown },
  ) {
    return this.requirements.create(
      req.userId,
      projectId,
      body.title as string,
      typeof body.description === 'string' ? body.description : undefined,
    );
  }

  @Get()
  list(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Query('status') status?: string,
  ) {
    return this.requirements.list(req.userId, projectId, status);
  }

  @Get(':id')
  get(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.requirements.get(req.userId, projectId, id);
  }

  @Patch(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() body: { title?: unknown; description?: unknown },
  ) {
    return this.requirements.update(
      req.userId,
      projectId,
      id,
      typeof body.title === 'string' ? body.title : undefined,
      body.description as string | undefined,
    );
  }

  @Post(':id/approve')
  approve(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.requirements.approve(req.userId, projectId, id);
  }

  @Post(':id/deprecate')
  deprecate(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.requirements.deprecate(req.userId, projectId, id);
  }
}

@Controller('requirements/:requirementId/criteria')
@UseGuards(AccessGuard)
export class CriteriaController {
  constructor(@Inject(RequirementsService) private readonly requirements: RequirementsService) {}

  @Post()
  add(
    @Req() req: AuthenticatedRequest,
    @Param('requirementId') requirementId: string,
    @Body() body: { text?: unknown },
  ) {
    return this.requirements.addCriterion(req.userId, requirementId, body.text as string);
  }

  @Patch(':criterionId')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('requirementId') requirementId: string,
    @Param('criterionId') criterionId: string,
    @Body() body: { text?: unknown },
  ) {
    return this.requirements.updateCriterion(
      req.userId,
      requirementId,
      criterionId,
      body.text as string,
    );
  }

  @Delete(':criterionId')
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('requirementId') requirementId: string,
    @Param('criterionId') criterionId: string,
  ) {
    return this.requirements.removeCriterion(req.userId, requirementId, criterionId);
  }
}
