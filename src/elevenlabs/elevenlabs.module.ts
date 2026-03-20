import { Module } from '@nestjs/common';
import { ElevenlabsService } from './elevenlabs.service';
import { ElevenlabsController } from './elevenlabs.controller';

@Module({
  controllers: [ElevenlabsController],
  providers: [ElevenlabsService],
})
export class ElevenlabsModule {}
