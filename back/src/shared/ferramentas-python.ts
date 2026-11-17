import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { join } from 'path';

// Python do venv das ferramentas (yt-dlp, demucs): FERRAMENTAS_PYTHON ou back/.venv-py.
export function pythonDasFerramentas(config: ConfigService): string {
  return (
    config.get<string>('FERRAMENTAS_PYTHON') ?? join(process.cwd(), '.venv-py', 'bin', 'python')
  );
}

// Roda um comando e devolve o stdout; falha com o stderr da ferramenta.
export function executar(rotulo: string, cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 10 * 1024 * 1024 }, (erro, stdout, stderr) => {
      if (erro) reject(new Error(`${rotulo} falhou: ${stderr || erro.message}`));
      else resolve(stdout);
    });
  });
}
