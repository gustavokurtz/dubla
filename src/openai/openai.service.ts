import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import * as fs from 'fs';

@Injectable()
export class OpenaiService {
    private openai: OpenAI;

    constructor(private config: ConfigService){
         this.openai = new OpenAI({apiKey: this.config.get<string>('OPENAI_API_KEY')})
    }

    async transcreverVideo(caminhoAudio: string) {
        const transcricao = await this.openai.audio.transcriptions.create({
            file: fs.createReadStream(caminhoAudio),
            model: 'whisper-1',
            response_format: 'verbose_json', // retorna com timestamps
            timestamp_granularities: ['segment'],
        });

        return transcricao;
    }

    async traduzirTexto(textoOriginal: string) {
        const resposta = await this.openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: `Você é um tradutor profissional. Traduza o texto de inglês para português brasileiro.
                    Não traduza ao pé da letra — adapte expressões idiomáticas e mantenha o tom natural, 
                    como se a pessoa estivesse falando em português. Preserve o significado mas soe fluido.
                    Retorne APENAS o texto traduzido, sem explicações.`,
                },
                {
                    role: 'user',
                    content: textoOriginal,
                },
            ],
        });

        return resposta.choices[0].message.content;
}
    

}
