import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Logger,
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
  private readonly logger = new Logger(IngestionController.name);

  constructor(private readonly ingestionService: IngestionService) {}

  @Post('dublar')
  @UseInterceptors(
    FileInterceptor('video', {
      limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('video/')) {
          cb(
            new HttpException('Apenas arquivos de vídeo são aceitos', HttpStatus.BAD_REQUEST),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  async dublar(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('url') url: string | undefined,
    @Res() res: Response,
  ) {
    // Link do YouTube tem preferência; sem link, o arquivo enviado (R12).
    let dublagem: () => Promise<Buffer>;
    if (url) {
      dublagem = () => this.ingestionService.dublarLink(url);
    } else if (file) {
      const nome = file.originalname.replace(/\.[^.]+$/, '');
      dublagem = () => this.ingestionService.dublar(file.buffer, nome);
    } else {
      throw new HttpException('Envie um vídeo ou um link do YouTube', HttpStatus.BAD_REQUEST);
    }

    try {
      const videoFinal = await dublagem();

      res.set({
        'Content-Type': 'video/mp4',
        'Content-Disposition': 'attachment; filename="video-dublado.mp4"',
        'Content-Length': videoFinal.length,
      });

      res.send(videoFinal);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(`Pipeline falhou: ${message}`, stack);
      throw new HttpException(
        `Erro no pipeline de dublagem: ${message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
