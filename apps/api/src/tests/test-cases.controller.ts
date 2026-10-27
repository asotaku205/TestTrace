// Controller suite/test case/steps (nguồn: Q10 + TEST-01).
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { TestCasesService } from './test-cases.service.js';
import { AccessGuard, AuthenticatedRequest } from '../auth/auth.guard.js';

@Controller('projects/:projectId/suites')
@UseGuards(AccessGuard)
export class SuitesController {
  constructor(@Inject(TestCasesService) private readonly tests: TestCasesService) {}

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: { name?: unknown; parentId?: unknown },
  ) {
    return this.tests.createSuite(
      req.userId,
      projectId,
      body.name as string,
      typeof body.parentId === 'string' ? body.parentId : undefined,
    );
  }

  @Get()
  list(@Req() req: AuthenticatedRequest, @Param('projectId') projectId: string) {
    return this.tests.listSuites(req.userId, projectId);
  }

  @Delete(':suiteId')
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('suiteId') suiteId: string,
  ) {
    return this.tests.deleteSuite(req.userId, projectId, suiteId);
  }
}

@Controller('projects/:projectId/test-cases')
@UseGuards(AccessGuard)
export class TestCasesController {
  constructor(@Inject(TestCasesService) private readonly tests: TestCasesService) {}

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body()
    body: {
      title?: unknown;
      suiteId?: unknown;
      priority?: unknown;
      type?: unknown;
      expectedResult?: unknown;
      independentReason?: unknown;
      tags?: unknown;
    },
  ) {
    return this.tests.create(req.userId, projectId, {
      title: body.title as string,
      suiteId: typeof body.suiteId === 'string' ? body.suiteId : undefined,
      priority: typeof body.priority === 'string' ? body.priority : undefined,
      type: typeof body.type === 'string' ? body.type : undefined,
      expectedResult: typeof body.expectedResult === 'string' ? body.expectedResult : undefined,
      independentReason:
        typeof body.independentReason === 'string' ? body.independentReason : undefined,
      tags: Array.isArray(body.tags) ? (body.tags as string[]) : undefined,
    });
  }

  @Get()
  list(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('tag') tag?: string,
    @Query('requirementId') requirementId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    // Không có page/pageSize -> trả mảng như cũ; có tham số -> envelope như audit.
    const paging =
      page === undefined && pageSize === undefined
        ? {}
        : {
            page: page === undefined ? 1 : Number(page),
            pageSize: pageSize === undefined ? 20 : Number(pageSize),
          };
    return this.tests.list(req.userId, projectId, {
      q,
      status,
      priority,
      tag,
      requirementId,
      ...paging,
    });
  }

  @Get(':id')
  get(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.tests.get(req.userId, projectId, id);
  }

  @Patch(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.tests.update(req.userId, projectId, id, {
      title: typeof body.title === 'string' ? body.title : undefined,
      priority: typeof body.priority === 'string' ? body.priority : undefined,
      type: typeof body.type === 'string' ? body.type : undefined,
      expectedResult: typeof body.expectedResult === 'string' ? body.expectedResult : undefined,
      independentReason:
        typeof body.independentReason === 'string' ? body.independentReason : undefined,
      tags: Array.isArray(body.tags) ? (body.tags as string[]) : undefined,
      suiteId:
        body.suiteId === null || typeof body.suiteId === 'string'
          ? (body.suiteId as string | null)
          : undefined,
    });
  }

  @Post(':id/ready')
  ready(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.tests.ready(req.userId, projectId, id);
  }

  @Post(':id/retire')
  retire(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.tests.retire(req.userId, projectId, id);
  }

  @Post(':id/clone')
  clone(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.tests.clone(req.userId, projectId, id);
  }

  @Get(':id/revisions')
  revisions(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.tests.listRevisions(req.userId, projectId, id);
  }

  @Post(':id/steps')
  addStep(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() body: { action?: unknown; expected?: unknown },
  ) {
    return this.tests.addStep(
      req.userId,
      projectId,
      id,
      body.action as string,
      typeof body.expected === 'string' ? body.expected : undefined,
    );
  }

  @Put(':id/steps/order')
  reorder(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() body: { order?: unknown },
  ) {
    return this.tests.reorderSteps(req.userId, projectId, id, body.order as string[]);
  }

  @Post(':id/links')
  attach(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() body: { requirementId?: unknown },
  ) {
    return this.tests.attachRequirement(req.userId, projectId, id, body.requirementId as string);
  }

  @Delete(':id/links/:requirementId')
  detach(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Param('requirementId') requirementId: string,
  ) {
    return this.tests.detachRequirement(req.userId, projectId, id, requirementId);
  }
}
