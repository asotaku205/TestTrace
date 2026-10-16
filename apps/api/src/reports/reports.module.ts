import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';
import { RtmModule } from '../rtm/rtm.module.js';

@Module({
  imports: [RtmModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
