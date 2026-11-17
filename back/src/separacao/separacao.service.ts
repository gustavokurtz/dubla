import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { executar, pythonDasFerramentas } from '../shared/ferramentas-python';

@Injectable()
export class SeparacaoService {
  private readonly logger = new Logger(SeparacaoService.name);

  constructor(private readonly config: ConfigService) {}

  // Separa a voz do resto do áudio (música, ambiente) com o Demucs local.
  async separar(audio: Buffer): Promise<{ voz: Buffer; fundo: Buffer }> {
    const dir = await mkdtemp(join(tmpdir(), 'dubla-sep-'));
    const entrada = join(dir, 'entrada.mp3');
    await writeFile(entrada, audio);

    try {
      this.logger.log(`Separando voz e fundo: ${audio.length} bytes`);
      const inicio = Date.now();
      await executar('demucs', pythonDasFerramentas(this.config), [
        '-m',
        'demucs',
        '--two-stems=vocals',
        '-n',
        'htdemucs',
        '-o',
        dir,
        entrada,
      ]);
      const saida = join(dir, 'htdemucs', 'entrada');
      const [voz, fundo] = await Promise.all([
        readFile(join(saida, 'vocals.wav')),
        readFile(join(saida, 'no_vocals.wav')),
      ]);
      this.logger.log(`Separação concluída em ${((Date.now() - inicio) / 1000).toFixed(1)} s`);
      return { voz, fundo };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}
