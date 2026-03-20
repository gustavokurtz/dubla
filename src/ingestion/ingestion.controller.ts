import {
  Controller,
  HttpException,
  HttpStatus,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { IngestionService } from './ingestion.service';

@Controller('ingestion')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post('dublar')
  @UseInterceptors(
    FileInterceptor('video', {
      limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('video/')) {
          cb(new HttpException('Apenas arquivos de vídeo são aceitos', HttpStatus.BAD_REQUEST), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async dublar(@UploadedFile() file: Express.Multer.File, @Res() res: Response) {
    if (!file) {
      throw new HttpException('Nenhum vídeo enviado', HttpStatus.BAD_REQUEST);
    }

    try {
      const videoFinal = await this.ingestionService.orchestratePipelineVideo(file.buffer);

      res.set({
        'Content-Type': 'video/mp4',
        'Content-Disposition': 'attachment; filename="video-dublado.mp4"',
        'Content-Length': videoFinal.length,
      });

      res.send(videoFinal);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new HttpException(
        `Erro no pipeline de dublagem: ${message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
