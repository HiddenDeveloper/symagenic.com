import { createActor } from "xstate";

import { TextToSpeechStateMachine } from '../statemachines/TextToSpeechStateMachine';
import type { TTSProvider } from './tts/TTSProvider.interface';
import { BrowserTTSProvider } from './tts/BrowserTTSProvider';
import { AzureTTSProvider } from './tts/AzureTTSProvider';

// Type definition for state observers
type TTSStateObserver = (state: string, data?: any) => void;

class TTSService {
  private actor = createActor(TextToSpeechStateMachine).start();
  private provider: TTSProvider;

  // Observer pattern implementation
  private stateObservers: TTSStateObserver[] = [];

  constructor() {
    // Select and initialize the appropriate TTS provider
    this.provider = this.selectProvider();
    this.startActor();
    this.initProvider();
  }

  private startActor() {
    // (Re)create the actor and subscribe to state updates
    try {
      if (!this.actor || this.actor.getSnapshot().status !== "active") {
        this.actor = createActor(TextToSpeechStateMachine).start();
      }
    } catch {
      // If actor not initialized yet
      this.actor = createActor(TextToSpeechStateMachine).start();
    }
    this.subscribeToState();
  }

  private ensureActorActive() {
    const snap = this.actor?.getSnapshot?.();
    if (!snap || snap.status !== "active") {
      this.startActor();
    }
  }

  private subscribeToState() {
    this.actor.subscribe((snapshot) => {
      const { value, context } = snapshot;

      // Notify observers
      this.notifyStateObservers(String(value), { state: value, context });
    });
  }

  // Method to add a state observer
  public addStateObserver(observer: TTSStateObserver): () => void {
    this.stateObservers.push(observer);
    console.log(
      `[TTSService] Added state observer, count: ${this.stateObservers.length}`,
    );

    // Return a function to remove this observer
    return () => {
      this.stateObservers = this.stateObservers.filter(
        (obs) => obs !== observer,
      );
      console.log(
        `[TTSService] Removed state observer, count: ${this.stateObservers.length}`,
      );
    };
  }

  // Method to notify observers of state changes
  private notifyStateObservers(state: string, data?: any): void {
    this.stateObservers.forEach((observer) => {
      try {
        observer(state, data);
      } catch (error) {
        console.error("[TTSService] Error in state observer:", error);
      }
    });
  }

  /**
   * Select the appropriate TTS provider based on configuration
   *
   * Strategy:
   * 1. Check if Azure is explicitly enabled and configured
   * 2. Fall back to Browser TTS if Azure is not available
   * 3. Browser TTS is the default for zero-config setup
   */
  private selectProvider(): TTSProvider {
    const useAzure = (import.meta as any).env?.VITE_USE_AZURE_TTS === 'true';
    const azureConfigured = (import.meta as any).env?.VITE_WS_URL !== undefined;

    if (useAzure && azureConfigured) {
      console.log('[TTSService] Using Azure TTS provider');
      return new AzureTTSProvider();
    }

    console.log('[TTSService] Using Browser TTS provider (default)');
    return new BrowserTTSProvider();
  }

  /**
   * Initialize the selected provider
   */
  private async initProvider(): Promise<void> {
    try {
      this.ensureActorActive();
      this.actor.send({ type: "INITIALIZE" });
      this.notifyStateObservers("initializing");

      console.log(`[TTSService] Initializing ${this.provider.getName()}...`);

      // Set up provider state observer to bridge to our observers
      this.provider.addStateObserver((state, data) => {
        this.notifyStateObservers(state, data);
      });

      // Initialize the provider
      await this.provider.initialize();

      this.actor.send({ type: "INITIALIZED_SUCCESS" });
      console.log(`[TTSService] ${this.provider.getName()} initialized successfully`);
    } catch (error) {
      console.error("[TTSService] Provider initialization failed:", error);
      const errorObj =
        error instanceof Error
          ? error
          : new Error("Failed to initialize TTS provider");
      this.actor.send({
        type: "INITIALIZED_ERROR",
        error: errorObj,
      });
      this.notifyStateObservers("error", { error: errorObj });
    }
  }

  /**
   * Speak the given text using the configured provider
   */
  public speak(text: string): void {
    this.ensureActorActive();
    this.actor.send({ type: "PREPARE_SPEECH", text });

    // Delegate to the provider
    this.provider.speak(text);
  }

  /**
   * Stop any ongoing speech
   */
  public stopSpeaking(): void {
    this.ensureActorActive();
    this.actor.send({ type: "STOP_SPEAKING" });

    // Delegate to the provider
    this.provider.stop();
  }

  /**
   * Check if speech is currently playing
   * Delegates to the provider
   */
  public get isPlaying(): boolean {
    return this.provider.isPlaying();
  }

  public getSnapshot() {
    return this.actor.getSnapshot();
  }
}

export default new TTSService();
