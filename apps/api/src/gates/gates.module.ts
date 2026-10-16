import { Module } from '@nestjs/common';
import { GatesController } from './gates.controller.js';
import { GatesService } from './gates.service.js';

@Module({
  controllers: [GatesController],
  providers: [GatesService],
  exports: [GatesService],
})
export class GatesModule {}
