// Controller reports CSV (nguồn: Q10 + REPORT-01).
import { Controller, Get, Inject, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService, type CsvFile } from './reports.service.js';
import { AccessGuard, AuthenticatedRequest } from '../auth/auth.guard.js';

@Controller('projects/:projectId/reports')
@UseGuards(AccessGuard)
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reports: ReportsService) {}

  private send(res: Response, file: CsvFile): void {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.content);
  }

  @Get('rtm.csv')
  async rtm(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Query('releaseId') releaseId: string | undefined,
    @Query('buildId') buildId: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    this.send(res, await this.reports.rtmCsv(req.userId, projectId, releaseId, buildId));
  }

  @Get('execution.csv')
  async execution(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Query('releaseId') releaseId: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    this.send(res, await this.reports.executionCsv(req.userId, projectId, releaseId));
  }

  @Get('defects.csv')
  async defects(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Res() res: Response,
  ): Promise<void> {
    this.send(res, await this.reports.defectsCsv(req.userId, projectId));
  }
}
