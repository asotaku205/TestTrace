// Controller evidence: upload multipart + tải + lưu trữ (nguồn: Q10 + EVID-01).
import {
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { EvidenceService } from './evidence.service.js';
import { AccessGuard, AuthenticatedRequest } from '../auth/auth.guard.js';

@Controller('projects/:projectId/evidence')
@UseGuards(AccessGuard)
export class EvidenceController {
  constructor(@Inject(EvidenceService) private readonly evidence: EvidenceService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  upload(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
    @UploadedFile() file: { originalname: string; buffer: Buffer; size: number },
  ) {
    if (!file) {
      throw Object.assign(new Error('Thiếu file đính kèm'), { code: 'EVIDENCE_MISSING' });
    }
    return this.evidence.upload(req.userId, projectId, entityType, entityId, file);
  }

  @Get(':evidenceId/download')
  async download(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('evidenceId') evidenceId: string,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, mime, filename } = await this.evidence.download(
      req.userId,
      projectId,
      evidenceId,
    );
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Delete(':evidenceId')
  archive(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('evidenceId') evidenceId: string,
  ) {
    return this.evidence.archive(req.userId, projectId, evidenceId);
  }

  @Get()
  list(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
  ) {
    return this.evidence.listFor(req.userId, projectId, entityType, entityId);
  }
}
