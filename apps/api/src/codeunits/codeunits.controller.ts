// Controller registry + links (nguồn: Q10 + REG-01).
import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import { CodeUnitsService } from './codeunits.service.js';
import { AccessGuard, AuthenticatedRequest } from '../auth/auth.guard.js';

@Controller('projects/:projectId/code')
@UseGuards(AccessGuard)
export class CodeUnitsController {
  constructor(@Inject(CodeUnitsService) private readonly code: CodeUnitsService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest, @Param('projectId') projectId: string) {
    return this.code.listArtifacts(req.userId, projectId);
  }

  @Get(':artifactId/versions')
  versions(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('artifactId') artifactId: string,
  ) {
    return this.code.listVersions(req.userId, projectId, artifactId);
  }
}

@Controller('projects/:projectId/requirements/:id/code-units')
@UseGuards(AccessGuard)
export class RequirementCodeUnitsController {
  constructor(@Inject(CodeUnitsService) private readonly code: CodeUnitsService) {}

  @Post()
  link(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() body: { artifactId?: unknown; qualifiedName?: unknown },
  ) {
    return this.code.linkRequirement(
      req.userId,
      projectId,
      id,
      body.artifactId as string,
      body.qualifiedName as string,
    );
  }
}
