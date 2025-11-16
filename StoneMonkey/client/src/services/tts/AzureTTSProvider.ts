/**
 * AzureTTSProvider
 *
 * Implementation of TTSProvider using Azure Cognitive Services Text-to-Speech.
 * This provides high-quality, natural-sounding voices but requires Azure credentials.
 *
 * Pros:
 * - High-quality, natural voices
 * - Wide range of voices and languages
 * - Consistent quality across platforms
 * - Advanced features (SSML, custom voices)
 *
 * Cons:
 * - Requires Azure subscription and API key
 * - Requires internet connection
 * - Costs money (based on usage)
 *
 * Configuration:
 * Requires VITE_WS_URL environment variable pointing to a backend with Azure TTS
 */

import type { TTSProvider, TTSStateCallback } from './TTSProvider.interface';

export class AzureTTSProvider implements TTSProvider {
  private wsUrl: string;
  private wsPath = '/ws/tts';
  private socket: WebSocket | null = null;
  private audioQueue: Blob[] = [];
  private playing = false;
  private currentAudio: HTMLAudioElement | null = null;
  private stateCallbacks: TTSStateCallback[] = [];

  constructor() {
    // Get WebSocket URL from environment or use default
    this.wsUrl =
      ((import.meta as any).env?.VITE_WS_URL as string | undefined)?.replace(
        /\/$/,
        '',
      ) || window.location.origin.replace(/^http/, 'ws');
  }

  /**
   * Check if Azure TTS is available (requires backend support)
   */
  public isAvailable(): boolean {
    // We can't truly check without attempting connection,
    // but we can check if WebSocket is supported
    return 'WebSocket' in window;
  }

  /**
   * Get the provider name
   */
  public getName(): string {
    return 'Azure Cognitive Services';
  }

  /**
   * Initialize the WebSocket connection to Azure TTS backend
   */
  public async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.notifyStateChange('initializing');

        this.socket = new WebSocket(this.wsUrl + this.wsPath);
        this.socket.binaryType = 'arraybuffer';

        this.socket.onopen = () => {
          console.log('🔊 [AzureTTSProvider] WebSocket connected');
          this.notifyStateChange('connected');
          resolve();
        };

        this.socket.onmessage = (event) => this.handleAudioResponse(event);

        this.socket.onerror = (event) => {
          console.error('[AzureTTSProvider] WebSocket error:', event);
          const error = new Error('WebSocket connection error');
          this.notifyStateChange('error', { error });
          reject(error);
        };

        this.socket.onclose = () => {
          console.warn(
            '[AzureTTSProvider] WebSocket closed. Reconnecting in 3s...',
          );
          this.notifyStateChange('disconnected', { reconnecting: true });
          setTimeout(() => this.reconnect(), 3000);
        };
      } catch (error) {
        console.error(
          '[AzureTTSProvider] WebSocket initialization failed:',
          error,
        );
        const errorObj =
          error instanceof Error
            ? error
            : new Error('Failed to initialize WebSocket');
        this.notifyStateChange('error', { error: errorObj });
        reject(errorObj);
      }
    });
  }

  /**
   * Attempt to reconnect the WebSocket
   */
  private async reconnect(): Promise<void> {
    try {
      await this.initialize();
    } catch (error) {
      console.error('[AzureTTSProvider] Reconnection failed:', error);
    }
  }

  /**
   * Send text to Azure TTS for speech synthesis
   */
  public speak(text: string): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn(
        '[AzureTTSProvider] WebSocket not ready, cannot send speech request.',
      );
      this.notifyStateChange('error', {
        error: new Error('WebSocket not ready'),
      });
      return;
    }

    this.notifyStateChange('preparing', { text });
    this.socket.send(JSON.stringify({ text }));
  }

  /**
   * Stop any ongoing speech
   */
  public stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
    }
    this.audioQueue = [];
    this.playing = false;
    this.notifyStateChange('stopped');
  }

  /**
   * Check if audio is currently playing
   */
  public isPlaying(): boolean {
    return this.playing;
  }

  /**
   * Add a state change observer
   */
  public addStateObserver(callback: TTSStateCallback): () => void {
    this.stateCallbacks.push(callback);
    return () => {
      this.stateCallbacks = this.stateCallbacks.filter((cb) => cb !== callback);
    };
  }

  /**
   * Handle audio response from Azure TTS backend
   */
  private handleAudioResponse(event: MessageEvent): void {
    const blob = new Blob([event.data], { type: 'audio/mpeg' });
    this.audioQueue.push(blob);

    this.notifyStateChange('ready', { queueLength: this.audioQueue.length });

    if (!this.playing) {
      this.playNextAudio();
    }
  }

  /**
   * Play the next audio blob from the queue
   */
  private playNextAudio(): void {
    if (this.audioQueue.length === 0) {
      this.playing = false;
      this.notifyStateChange('ended');
      return;
    }

    const blob = this.audioQueue.shift();
    if (!blob) return;

    this.currentAudio = new Audio(URL.createObjectURL(blob));
    this.playing = true;

    this.notifyStateChange('speaking', {
      remainingAudio: this.audioQueue.length,
    });

    this.currentAudio.onended = () => {
      this.playNextAudio();
    };

    this.currentAudio.onerror = (err) => {
      console.error('[AzureTTSProvider] Audio playback error:', err);
      const error = new Error('Audio playback failed');
      this.notifyStateChange('error', { error });
      this.playNextAudio(); // Try to continue with next audio
    };

    this.currentAudio.play();
  }

  /**
   * Notify all observers of a state change
   */
  private notifyStateChange(state: string, data?: any): void {
    this.stateCallbacks.forEach((callback) => {
      try {
        callback(state, data);
      } catch (error) {
        console.error('[AzureTTSProvider] Error in state callback:', error);
      }
    });
  }
}
