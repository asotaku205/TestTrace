// Health check công khai: app + database (nguồn: OPS-01).
import { Controller, Get, Inject } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PRISMA } from '../prisma.module.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(PRISMA) private readonly db: PrismaClient) {}

  @Get()
  async check(): Promise<{ status: string; db: boolean; time: string }> {
    try {
      await this.db.$queryRaw`SELECT 1`;
      return { status: 'ok', db: true, time: new Date().toISOString() };
    } catch {
      return { status: 'degraded', db: false, time: new Date().toISOString() };
    }
  }
}
