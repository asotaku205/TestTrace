import { Module } from '@nestjs/common';
import {
  CriteriaController,
  RequirementsController,
  ReviewTasksController,
} from './requirements.controller.js';
import { RequirementsService } from './requirements.service.js';

@Module({
  controllers: [RequirementsController, CriteriaController, ReviewTasksController],
  providers: [RequirementsService],
})
export class RequirementsModule {}
