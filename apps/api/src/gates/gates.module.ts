import { Module } from '@nestjs/common';
import { GatesController } from './gates.controller.js';
import { GatesService } from './gates.service.js';
import { ReleasesModule } from '../releases/releases.module.js';
import { RtmModule } from '../rtm/rtm.module.js';

@Module({
  imports: [ReleasesModule, RtmModule],
  controllers: [GatesController],
  providers: [GatesService],
  exports: [GatesService],
})
export class GatesModule {}
