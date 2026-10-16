import { Module } from '@nestjs/common';
import { DesignModelsController, DraftsController } from './drafts.controller.js';
import { DraftsService } from './drafts.service.js';

@Module({
  controllers: [DraftsController, DesignModelsController],
  providers: [DraftsService],
})
export class DraftsModule {}
