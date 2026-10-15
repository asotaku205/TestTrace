import { Module } from '@nestjs/common';
import { CriteriaController, RequirementsController } from './requirements.controller.js';
import { RequirementsService } from './requirements.service.js';

@Module({
  controllers: [RequirementsController, CriteriaController],
  providers: [RequirementsService],
})
export class RequirementsModule {}
