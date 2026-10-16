import { Module } from '@nestjs/common';
import { CodeUnitsController, RequirementCodeUnitsController } from './codeunits.controller.js';
import { CodeUnitsService } from './codeunits.service.js';

@Module({
  controllers: [CodeUnitsController, RequirementCodeUnitsController],
  providers: [CodeUnitsService],
})
export class CodeUnitsModule {}
