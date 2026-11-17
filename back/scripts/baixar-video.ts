// T0: baixa um vídeo do YouTube para videos/ na raiz, com o mesmo serviço da pipeline.
// Uso (em back/): npx ts-node scripts/baixar-video.ts <link>
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { YoutubeService } from '../src/youtube/youtube.service';

async function main() {
  const url = process.argv[2];
  if (!url) throw new Error('Uso: npx ts-node scripts/baixar-video.ts <link do YouTube>');

  const { video, titulo } = await new YoutubeService(new ConfigService()).baixar(url);
  const pasta = join(process.cwd(), '..', 'videos');
  await mkdir(pasta, { recursive: true });
  const nome =
    titulo
      .replace(/[^\p{L}\p{N} _-]/gu, '')
      .trim()
      .replace(/\s+/g, '-') || 'video';
  const arquivo = join(pasta, `${nome}.mp4`);
  await writeFile(arquivo, video);
  console.log(arquivo);
}

main().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
