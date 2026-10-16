import { Module } from '@nestjs/common';
import { RtmController } from './rtm.controller.js';
import { RtmService } from './rtm.service.js';

@Module({
  controllers: [RtmController],
  providers: [RtmService],
})
export class RtmModule {}
