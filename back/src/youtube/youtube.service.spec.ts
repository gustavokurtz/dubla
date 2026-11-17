import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { existsSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { YoutubeService } from './youtube.service';

jest.mock('child_process', () => ({ execFile: jest.fn() }));
const execFileMock = execFile as unknown as jest.Mock;

type Callback = (erro: Error | null, stdout: string, stderr: string) => void;

function simularYtDlp(titulo: string) {
  execFileMock.mockImplementation((_cmd: string, args: string[], _opts: object, cb: Callback) => {
    const destino = args[args.indexOf('-o') + 1].replace('%(ext)s', 'mp4');
    writeFileSync(destino, 'video-falso');
    cb(null, `${titulo}\n`, '');
  });
}

describe('YoutubeService', () => {
  let service: YoutubeService;

  beforeEach(async () => {
    execFileMock.mockReset();
    const modulo = await Test.createTestingModule({
      providers: [
        YoutubeService,
        { provide: ConfigService, useValue: { get: () => '/py/bin/python' } },
      ],
    }).compile();
    service = modulo.get(YoutubeService);
  });

  it('baixa com o yt-dlp do venv e devolve o vídeo e o título', async () => {
    simularYtDlp('Passagem de guarda');

    const resultado = await service.baixar('https://www.youtube.com/watch?v=abc123');

    const [cmd, args] = execFileMock.mock.calls[0] as [string, string[]];
    expect(cmd).toBe('/py/bin/python');
    expect(args.slice(0, 2)).toEqual(['-m', 'yt_dlp']);
    expect(args).toContain('--no-playlist');
    expect(args.at(-1)).toBe('https://www.youtube.com/watch?v=abc123');
    expect(resultado.titulo).toBe('Passagem de guarda');
    expect(resultado.video.toString()).toBe('video-falso');
  });

  it('aceita link curto youtu.be', async () => {
    simularYtDlp('x');
    await expect(service.baixar('https://youtu.be/abc123')).resolves.toBeDefined();
  });

  it('recusa link que não é do YouTube sem chamar o yt-dlp', async () => {
    await expect(service.baixar('https://vimeo.com/123')).rejects.toThrow(
      'Link do YouTube inválido',
    );
    await expect(service.baixar('não é link')).rejects.toThrow('Link do YouTube inválido');
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it('erro do yt-dlp vira erro explícito com a mensagem dele e limpa o temp dir', async () => {
    let dirTemp = '';
    execFileMock.mockImplementation((_cmd: string, args: string[], _opts: object, cb: Callback) => {
      dirTemp = dirname(args[args.indexOf('-o') + 1]);
      cb(new Error('exit 1'), '', 'ERROR: Video unavailable');
    });

    await expect(service.baixar('https://www.youtube.com/watch?v=sumiu')).rejects.toThrow(
      'ERROR: Video unavailable',
    );
    expect(existsSync(dirTemp)).toBe(false);
  });
});
