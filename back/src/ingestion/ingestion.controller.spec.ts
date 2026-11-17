import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import type { Response } from 'express';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';

describe('IngestionController', () => {
  let controller: IngestionController;
  const service = {
    dublar: jest.fn().mockResolvedValue(Buffer.from('do-arquivo')),
    dublarLink: jest.fn().mockResolvedValue(Buffer.from('do-link')),
  };
  const res = () => ({ set: jest.fn(), send: jest.fn() }) as unknown as Response;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IngestionController],
      providers: [{ provide: IngestionService, useValue: service }],
    }).compile();

    controller = module.get<IngestionController>(IngestionController);
  });

  it('com link, dubla pelo link e não pelo arquivo', async () => {
    const r = res();
    await controller.dublar(undefined, 'https://youtu.be/abc', r);

    expect(service.dublarLink).toHaveBeenCalledWith('https://youtu.be/abc');
    expect(service.dublar).not.toHaveBeenCalled();
    expect(r.send).toHaveBeenCalledWith(Buffer.from('do-link'));
  });

  it('com arquivo, dubla o arquivo com o nome sem extensão', async () => {
    const arquivo = { buffer: Buffer.from('v'), originalname: 'aula.mp4' } as Express.Multer.File;
    await controller.dublar(arquivo, undefined, res());

    expect(service.dublar).toHaveBeenCalledWith(arquivo.buffer, 'aula');
    expect(service.dublarLink).not.toHaveBeenCalled();
  });

  it('sem arquivo e sem link, recusa', async () => {
    await expect(controller.dublar(undefined, undefined, res())).rejects.toThrow(HttpException);
  });
});
