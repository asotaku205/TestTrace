import { Module } from '@nestjs/common';
import { SuitesController, TestCasesController } from './test-cases.controller.js';
import { TestCasesService } from './test-cases.service.js';

@Module({
  controllers: [SuitesController, TestCasesController],
  providers: [TestCasesService],
})
export class TestCasesModule {}
