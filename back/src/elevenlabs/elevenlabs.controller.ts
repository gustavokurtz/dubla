import { Controller } from '@nestjs/common';
import { ElevenlabsService } from './elevenlabs.service';

@Controller('elevenlabs')
export class ElevenlabsController {
  constructor(private readonly elevenlabsService: ElevenlabsService) {}
}
