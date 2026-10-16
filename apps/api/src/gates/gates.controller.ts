// Controller gate (nguồn: Q10 + GATE-01).
import { Body, Controller, Get, Inject, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { GatesService } from './gates.service.js';
import { AccessGuard, AuthenticatedRequest } from '../auth/auth.guard.js';

@Controller('projects/:projectId/gates')
@UseGuards(AccessGuard)
export class GatesController {
  constructor(@Inject(GatesService) private readonly gates: GatesService) {}

  @Post('validate')
  validate(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: { yaml?: unknown },
  ) {
    return this.gates.validate(req.userId, projectId, body.yaml as string);
  }

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: { name?: unknown; yaml?: unknown },
  ) {
    return this.gates.create(req.userId, projectId, body.name as string, body.yaml as string);
  }

  @Get()
  list(@Req() req: AuthenticatedRequest, @Param('projectId') projectId: string) {
    return this.gates.list(req.userId, projectId);
  }

  @Put(':gateId/versions/:version/rules')
  updateRules(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('gateId') gateId: string,
    @Param('version') version: string,
    @Body() body: { yaml?: unknown },
  ) {
    return this.gates.updateRules(
      req.userId,
      projectId,
      gateId,
      Number(version),
      body.yaml as string,
    );
  }

  @Post(':gateId/publish')
  publish(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('gateId') gateId: string,
    @Body() body: { version?: unknown },
  ) {
    return this.gates.publish(req.userId, projectId, gateId, body.version as number);
  }

  @Post(':gateId/versions')
  fork(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('gateId') gateId: string,
  ) {
    return this.gates.forkVersion(req.userId, projectId, gateId);
  }

  @Post(':gateId/evaluate')
  evaluate(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('gateId') gateId: string,
    @Body() body: { buildId?: unknown },
  ) {
    return this.gates.evaluate(req.userId, projectId, gateId, body.buildId as string);
  }

  @Get(':gateId/evaluations')
  evaluations(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('gateId') gateId: string,
  ) {
    return this.gates.listEvaluations(req.userId, projectId, gateId);
  }
}
