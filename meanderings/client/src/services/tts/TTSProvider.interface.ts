/**
 * TTSProvider Interface
 *
 * This interface defines the contract that all Text-to-Speech providers must implement.
 * This allows us to swap between different TTS implementations (Browser, Azure, etc.)
 * without changing the TTSService or state machine code.
 *
 * Design Pattern: Strategy Pattern
 * - Defines a family of algorithms (TTS providers)
 * - Makes them interchangeable
 * - Lets the algorithm vary independently from clients that use it
 */

/**
 * Callback type for state change notifications
 * @param state - The new state (e.g., "speaking", "ended", "error")
 * @param data - Optional data associated with the state change
 */
export type TTSStateCallback = (state: string, data?: any) => void;

export interface TTSProvider {
  /**
   * Initialize the TTS provider
   * This might involve connecting to a service, loading voices, etc.
   * @returns Promise that resolves when initialization is complete
   */
  initialize(): Promise<void>;

  /**
   * Convert text to speech and play it
   * @param text - The text to speak
   */
  speak(text: string): void;

  /**
   * Stop any currently playing speech
   */
  stop(): void;

  /**
   * Check if this provider is available in the current environment
   * @returns true if the provider can be used
   */
  isAvailable(): boolean;

  /**
   * Get a human-readable name for this provider
   * @returns The provider name (e.g., "Browser Speech API", "Azure Cognitive Services")
   */
  getName(): string;

  /**
   * Add a callback to be notified of state changes
   * @param callback - Function to call when state changes
   * @returns Function to remove this callback
   */
  addStateObserver(callback: TTSStateCallback): () => void;

  /**
   * Check if audio is currently playing
   * @returns true if speech is currently being played
   */
  isPlaying(): boolean;
}
