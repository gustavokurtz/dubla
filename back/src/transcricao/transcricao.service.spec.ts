import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TranscricaoService } from './transcricao.service';
import { TERMOS_RECONHECIMENTO } from '../traducao/guia-bjj';
import { custoTranscricao } from '../custos/custo';
import { rodarNoTrace, Trace } from '../trace/trace';

const transcribeMock = jest.fn();
jest.mock('assemblyai', () => ({
  AssemblyAI: jest.fn().mockImplementation(() => ({
    transcripts: { transcribe: transcribeMock },
  })),
}));

// Resposta no formato da AssemblyAI: professor (A) e aluno (B).
const respostaGravada = {
  status: 'completed',
  error: null,
  audio_duration: 290,
  words: [
    { text: 'Can', start: 500, end: 700, confidence: 0.9, speaker: 'B' },
    { text: 'I', start: 720, end: 800, confidence: 0.9, speaker: 'B' },
    { text: 'go', start: 820, end: 950, confidence: 0.9, speaker: 'B' },
    { text: 'for', start: 970, end: 1050, confidence: 0.9, speaker: 'B' },
    { text: 'the', start: 1060, end: 1120, confidence: 0.9, speaker: 'B' },
    { text: 'kimura?', start: 1130, end: 1600, confidence: 0.9, speaker: 'B' },
    { text: 'Yes,', start: 1900, end: 2200, confidence: 0.9, speaker: 'A' },
    { text: 'but', start: 2250, end: 2400, confidence: 0.9, speaker: 'A' },
    { text: 'control', start: 2420, end: 2800, confidence: 0.9, speaker: 'A' },
    { text: 'the', start: 2820, end: 2900, confidence: 0.9, speaker: 'A' },
    { text: 'wrist', start: 2920, end: 3200, confidence: 0.9, speaker: 'A' },
    { text: 'first.', start: 3220, end: 3600, confidence: 0.9, speaker: 'A' },
  ],
};

describe('TranscricaoService', () => {
  let service: TranscricaoService;

  beforeEach(async () => {
    transcribeMock.mockReset();
    const modulo = await Test.createTestingModule({
      providers: [
        TranscricaoService,
        { provide: ConfigService, useValue: { getOrThrow: () => 'chave-teste' } },
      ],
    }).compile();
    service = modulo.get(TranscricaoService);
  });

  it('pede quem fala, inglês e os termos de jiu-jitsu, e devolve as falas', async () => {
    transcribeMock.mockResolvedValue(respostaGravada);
    const audio = Buffer.from('audio');

    const falas = await service.transcrever(audio);

    expect(transcribeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        audio,
        speaker_labels: true,
        language_code: 'en',
        keyterms_prompt: TERMOS_RECONHECIMENTO,
      }),
    );
    expect(falas).toEqual([
      { id: 1, pessoa: 'B', inicio: 0.5, fim: 1.6, textoEn: 'Can I go for the kimura?' },
      { id: 2, pessoa: 'A', inicio: 1.9, fim: 3.6, textoEn: 'Yes, but control the wrist first.' },
    ]);
  });

  it('transcrição com erro na AssemblyAI vira erro explícito', async () => {
    transcribeMock.mockResolvedValue({
      status: 'error',
      error: 'Audio file is empty',
      words: null,
    });
    await expect(service.transcrever(Buffer.from('x'))).rejects.toThrow('Audio file is empty');
  });

  it('registra no trace a duração do áudio transcrito e o custo', async () => {
    transcribeMock.mockResolvedValue(respostaGravada);
    const trace = new Trace();

    await rodarNoTrace(trace, () => service.transcrever(Buffer.from('audio')));

    expect(trace.chamadas).toEqual([
      expect.objectContaining({
        servico: 'assemblyai-transcricao',
        segundos: 290,
        custo: custoTranscricao(290),
      }),
    ]);
  });
});
