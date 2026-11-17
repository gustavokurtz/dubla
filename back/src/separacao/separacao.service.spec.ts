import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { basename, extname, join } from 'path';
import { SeparacaoService } from './separacao.service';

jest.mock('child_process', () => ({ execFile: jest.fn() }));
const execFileMock = execFile as unknown as jest.Mock;

type Callback = (erro: Error | null, stdout: string, stderr: string) => void;

// Imita o demucs: grava <saida>/htdemucs/<nome da entrada>/{vocals,no_vocals}.wav
function simularDemucs() {
  execFileMock.mockImplementation((_cmd: string, args: string[], _opts: object, cb: Callback) => {
    const entrada = args.at(-1) as string;
    const saida = args[args.indexOf('-o') + 1];
    const pasta = join(saida, 'htdemucs', basename(entrada, extname(entrada)));
    mkdirSync(pasta, { recursive: true });
    writeFileSync(join(pasta, 'vocals.wav'), 'so-voz');
    writeFileSync(join(pasta, 'no_vocals.wav'), 'so-fundo');
    cb(null, '', '');
  });
}

describe('SeparacaoService', () => {
  let service: SeparacaoService;

  beforeEach(async () => {
    execFileMock.mockReset();
    const modulo = await Test.createTestingModule({
      providers: [
        SeparacaoService,
        { provide: ConfigService, useValue: { get: () => '/py/bin/python' } },
      ],
    }).compile();
    service = modulo.get(SeparacaoService);
  });

  it('roda o demucs em dois canais (voz e resto) e devolve voz e fundo', async () => {
    let entradaGravada = '';
    simularDemucs();
    const original = execFileMock.getMockImplementation()!;
    execFileMock.mockImplementation((cmd: string, args: string[], opts: object, cb: Callback) => {
      entradaGravada = readFileSync(args.at(-1) as string, 'utf8');
      original(cmd, args, opts, cb);
    });

    const resultado = await service.separar(Buffer.from('audio-original'));

    const [cmd, args] = execFileMock.mock.calls[0] as [string, string[]];
    expect(cmd).toBe('/py/bin/python');
    expect(args.slice(0, 2)).toEqual(['-m', 'demucs']);
    expect(args).toEqual(expect.arrayContaining(['--two-stems=vocals', '-n', 'htdemucs']));
    expect(entradaGravada).toBe('audio-original');
    expect(resultado.voz.toString()).toBe('so-voz');
    expect(resultado.fundo.toString()).toBe('so-fundo');
  });

  it('erro do demucs vira erro explícito e limpa o temp dir', async () => {
    let dirTemp = '';
    execFileMock.mockImplementation((_cmd: string, args: string[], _opts: object, cb: Callback) => {
      dirTemp = args[args.indexOf('-o') + 1];
      cb(new Error('exit 1'), '', 'CUDA out of memory');
    });

    await expect(service.separar(Buffer.from('x'))).rejects.toThrow(
      'demucs falhou: CUDA out of memory',
    );
    expect(existsSync(dirTemp)).toBe(false);
  });
});
