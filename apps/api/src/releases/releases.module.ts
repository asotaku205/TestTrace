import { Module } from '@nestjs/common';
import { EnvironmentsController, ReleasesController } from './releases.controller.js';
import { ReleasesService } from './releases.service.js';

@Module({
  controllers: [ReleasesController, EnvironmentsController],
  providers: [ReleasesService],
})
export class ReleasesModule {}
