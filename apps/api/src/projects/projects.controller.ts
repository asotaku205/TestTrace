// Controller project/member: validate rồi gọi use case (nguồn: Q10 + AUTH-02).
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MemberRole } from '@prisma/client';
import { ProjectsService } from './projects.service.js';
import { AccessGuard, AuthenticatedRequest } from '../auth/auth.guard.js';

@Controller('projects')
@UseGuards(AccessGuard)
export class ProjectsController {
  constructor(@Inject(ProjectsService) private readonly projects: ProjectsService) {}

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() body: { name?: unknown }) {
    return this.projects.create(req.userId, body.name as string);
  }

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.projects.list(req.userId);
  }

  @Get(':id')
  get(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.projects.get(req.userId, id);
  }

  @Patch(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { name?: unknown },
  ) {
    return this.projects.update(req.userId, id, body.name as string);
  }

  @Get(':id/members')
  listMembers(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.projects.listMembers(req.userId, id);
  }

  @Post(':id/members')
  addMember(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { email?: unknown; role?: unknown },
  ) {
    return this.projects.addMember(req.userId, id, body.email as string, body.role as MemberRole);
  }

  @Patch(':id/members/:userId')
  updateMember(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() body: { role?: unknown },
  ) {
    return this.projects.updateMember(req.userId, id, userId, body.role as MemberRole);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.projects.removeMember(req.userId, id, userId);
  }
}
