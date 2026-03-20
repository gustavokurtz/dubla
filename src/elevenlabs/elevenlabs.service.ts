import { Injectable } from '@nestjs/common';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { ConfigService } from '@nestjs/config';
@Injectable()
export class ElevenlabsService {
    private elevenLabs: ElevenLabsClient
    constructor(private config: ConfigService){
        this.elevenLabs = new ElevenLabsClient({apiKey: this.config.get<string>('ELEVENLABS_API_KEY')})
    }

    async textToSpeech(text: string): Promise<Buffer> {
        const audio = await this.elevenLabs.textToSpeech.convert(
            'JBFqnCBsd6RMkjVDRZzb', // George
            {
                text,
                modelId: 'eleven_multilingual_v2',
                outputFormat: 'mp3_44100_128',
            },
        );

        const chunks: Buffer[] = [];
        for await (const chunk of audio) {
            chunks.push(Buffer.from(chunk));
        }

        return Buffer.concat(chunks);
    }
}
