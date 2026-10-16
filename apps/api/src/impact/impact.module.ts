import { Module } from '@nestjs/common';
import { ImpactController } from './impact.controller.js';
import { ImpactService } from './impact.service.js';

@Module({
  controllers: [ImpactController],
  providers: [ImpactService],
})
export class ImpactModule {}
