import { Module } from '@nestjs/common';
import { DefectsController } from './defects.controller.js';
import { DefectsService } from './defects.service.js';

@Module({
  controllers: [DefectsController],
  providers: [DefectsService],
  exports: [DefectsService],
})
export class DefectsModule {}
