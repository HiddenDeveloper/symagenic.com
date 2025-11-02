/**
 * BrowserTTSProvider
 *
 * Implementation of TTSProvider using the browser's built-in Web Speech API.
 * This is a free, offline-capable alternative to cloud TTS services.
 *
 * Pros:
 * - No API keys or configuration needed
 * - Works offline
 * - Free to use
 * - Available in most modern browsers
 *
 * Cons:
 * - Voice quality varies by browser/OS
 * - Limited voice customization
 * - Different voices available on different platforms
 *
 * Browser Support:
 * - Chrome/Edge: Excellent support
 * - Safari: Good support
 * - Firefox: Limited support
 */

import type { TTSProvider, TTSStateCallback } from './TTSProvider.interface';

export class BrowserTTSProvider implements TTSProvider {
  private synthesis: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private stateCallbacks: TTSStateCallback[] = [];
  private playing = false;

  /**
   * Check if the Web Speech API is available
   */
  public isAvailable(): boolean {
    return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  }

  /**
   * Get the provider name
   */
  public getName(): string {
    return 'Browser Speech API';
  }

  /**
   * Initialize the speech synthesis
   */
  public async initialize(): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Web Speech API is not available in this browser');
    }

    this.synthesis = window.speechSynthesis;

    // Wait for voices to load (some browsers load them asynchronously)
    if (this.synthesis.getVoices().length === 0) {
      await new Promise<void>((resolve) => {
        if (!this.synthesis) return resolve();

        const synthesis = this.synthesis; // Capture reference for closure

        const checkVoices = () => {
          if (synthesis.getVoices().length > 0) {
            resolve();
          }
        };

        // Some browsers fire this event when voices are loaded
        if ('onvoiceschanged' in synthesis) {
          synthesis.onvoiceschanged = () => {
            checkVoices();
            synthesis.onvoiceschanged = null;
          };
        }

        // Fallback: check every 100ms for up to 2 seconds
        let attempts = 0;
        const interval = setInterval(() => {
          checkVoices();
          attempts++;
          if (attempts >= 20) {
            clearInterval(interval);
            resolve(); // Resolve anyway after timeout
          }
        }, 100);
      });
    }

    console.log(
      `[BrowserTTSProvider] Initialized with ${this.synthesis.getVoices().length} voices`,
    );
    this.notifyStateChange('connected');
  }

  /**
   * Speak the given text
   */
  public speak(text: string): void {
    if (!this.synthesis) {
      console.error('[BrowserTTSProvider] Not initialized');
      return;
    }

    // Cancel any ongoing speech
    this.stop();

    // Create a new utterance
    this.currentUtterance = new SpeechSynthesisUtterance(text);

    // Configure the utterance
    this.configureUtterance(this.currentUtterance);

    // Set up event handlers
    this.currentUtterance.onstart = () => {
      this.playing = true;
      console.log('[BrowserTTSProvider] Speech started');
      this.notifyStateChange('speaking');
    };

    this.currentUtterance.onend = () => {
      this.playing = false;
      console.log('[BrowserTTSProvider] Speech ended');
      this.notifyStateChange('ended');
      this.currentUtterance = null;
    };

    this.currentUtterance.onerror = (event) => {
      this.playing = false;
      console.error('[BrowserTTSProvider] Speech error:', event);
      this.notifyStateChange('error', { error: event });
      this.currentUtterance = null;
    };

    // Start speaking
    this.synthesis.speak(this.currentUtterance);
  }

  /**
   * Stop any ongoing speech
   */
  public stop(): void {
    if (this.synthesis) {
      this.synthesis.cancel();
      this.playing = false;
      this.currentUtterance = null;
      this.notifyStateChange('stopped');
    }
  }

  /**
   * Check if speech is currently playing
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
   * Configure the utterance with preferred settings
   * This can be extended to support user preferences
   */
  private configureUtterance(utterance: SpeechSynthesisUtterance): void {
    // Set speech rate (0.1 to 10, default 1)
    utterance.rate = 1.0;

    // Set pitch (0 to 2, default 1)
    utterance.pitch = 1.0;

    // Set volume (0 to 1, default 1)
    utterance.volume = 1.0;

    // Try to select a good default voice
    const voices = this.synthesis!.getVoices();

    // Prefer English voices
    const englishVoices = voices.filter((voice) =>
      voice.lang.startsWith('en'),
    );

    if (englishVoices.length > 0) {
      // Prefer female voices (often more natural sounding)
      const femaleVoice = englishVoices.find(
        (voice) =>
          voice.name.toLowerCase().includes('female') ||
          voice.name.toLowerCase().includes('woman') ||
          voice.name.toLowerCase().includes('samantha') ||
          voice.name.toLowerCase().includes('zira'),
      );

      utterance.voice = femaleVoice ?? englishVoices[0] ?? null;
    } else if (voices.length > 0) {
      // Fallback to first available voice
      utterance.voice = voices[0] ?? null;
    }

    console.log(
      `[BrowserTTSProvider] Using voice: ${utterance.voice?.name || 'default'}`,
    );
  }

  /**
   * Notify all observers of a state change
   */
  private notifyStateChange(state: string, data?: any): void {
    this.stateCallbacks.forEach((callback) => {
      try {
        callback(state, data);
      } catch (error) {
        console.error('[BrowserTTSProvider] Error in state callback:', error);
      }
    });
  }
}
