import { WebSocket } from 'ws';
import winston from 'winston';

export class TTSWebSocketHandler {
  static handleConnection(logger: winston.Logger, ws: WebSocket): void {
    logger.info('TTS WebSocket connection opened.');

    try {
      // Handle incoming messages
      ws.on('message', (data: Buffer) => {
        void (async () => {
          try {
            const message = data.toString();
            logger.info(`TTS received: ${message}`);

            let text: string;
            try {
              const payload = JSON.parse(message) as { text?: unknown };
              text = typeof payload.text === 'string' ? payload.text : '';
              if (typeof text !== 'string') {
                text = String(text);
              }
            } catch {
              text = message;
            }

            // Check for Azure TTS configuration
            const azureSpeechKey = process.env.AZURE_SPEECH_KEY;
            const azureSpeechRegion = process.env.AZURE_SPEECH_REGION;

            if (!azureSpeechKey || !azureSpeechRegion) {
              logger.warn('Azure TTS not configured - sending mock response');
              // Send mock audio response for development
              const mockResponse = Buffer.from(
                'Mock TTS audio data - configure AZURE_SPEECH_KEY and AZURE_SPEECH_REGION'
              );
              ws.send(mockResponse);
              return;
            }

            // Azure TTS request
            const azureTtsEndpoint = `https://${azureSpeechRegion}.tts.speech.microsoft.com/cognitiveservices/v1`;

            const headers = {
              'Ocp-Apim-Subscription-Key': azureSpeechKey,
              'Content-Type': 'application/ssml+xml',
              'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
            };

            // Escape HTML entities in text
            const escapedText = text
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;');

            const ssmlBody = `
            <speak version='1.0' xml:lang='en-US'>
                <voice xml:lang='en-US' xml:gender='Female' name='en-US-AvaMultilingualNeural'>
                    ${escapedText}
                </voice>
            </speak>
          `;

            try {
              const response = await fetch(azureTtsEndpoint, {
                method: 'POST',
                headers,
                body: ssmlBody,
              });

              if (!response.ok) {
                throw new Error(`Azure TTS API error: ${response.status} ${response.statusText}`);
              }

              const audioBuffer = await response.arrayBuffer();
              ws.send(Buffer.from(audioBuffer));

              logger.info(`TTS: Generated audio for text length: ${text.length}`);
            } catch (error) {
              logger.error('Azure TTS API error:', error);
              ws.send(
                JSON.stringify({
                  error: 'TTS service temporarily unavailable',
                  message: 'Please try again later',
                })
              );
            }
          } catch (error) {
            logger.error('Error processing TTS message:', error);
            ws.send(
              JSON.stringify({
                error: 'Invalid TTS request',
                message: 'Please check your request format',
              })
            );
          }
        })();
      });

      ws.on('close', () => {
        logger.info('TTS WebSocket connection closed.');
      });

      ws.on('error', (error: Error) => {
        logger.error('TTS WebSocket error:', error);
      });
    } catch (error) {
      logger.error('Failed to initialize TTS WebSocket:', error);
      ws.close();
    }
  }
}
