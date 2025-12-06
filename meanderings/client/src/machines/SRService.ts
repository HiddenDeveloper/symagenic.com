// SRService.ts - Speech Recognition service using Web Speech API

export interface SpeechRecognitionState {
  status:
    | "inactive"
    | "initializing"
    | "ready"
    | "listening"
    | "completed"
    | "error";
  transcript?: string;
  error?: Error;
  isInterim?: boolean; // Flag to indicate if the transcript is interim (not final)
}

// Type definition for state observers
type SpeechRecognitionObserver = (state: string, data?: any) => void;

class SRService {
  private recognition: any;
  private isRecognizing: boolean = false;
  private transcript: string = "";
  private stateObservers: SpeechRecognitionObserver[] = [];
  private currentState: SpeechRecognitionState = { status: "inactive" };
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private silenceDelay: number = 1500; // Longer silence detection delay (1.5 seconds)
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private silenceCompletedRecently: boolean = false; // Flag to track if silence detection recently completed
  private lastErrorWasNoSpeech: boolean = false; // Track if last onerror was 'no-speech'

  constructor() {
    // this.initRecognition();
  }

  /**
   * Set the silence detection delay
   * @param delay Time in milliseconds before considering the user has stopped speaking
   */
  setSilenceDelay(delay: number): void {
    if (delay > 0) {
      this.silenceDelay = delay;
      console.log(`Speech recognition silence delay set to ${delay}ms`);
    }
  }

  /**
   * Start the silence detection timer
   * This will emit a "completed" state with the current transcript
   * after the silence delay period if no new speech is detected
   */
  private startSilenceDetection(): void {
    // Clear any existing timer first
    this.clearSilenceTimer();

    // Reset the completion flag
    this.silenceCompletedRecently = false;

    // Set a new timer
    this.silenceTimer = setTimeout(() => {
      console.log(
        `Silence detected for ${this.silenceDelay}ms, considering speech complete`,
      );

      if (this.transcript && this.transcript.trim()) {
        // Only emit completed if we actually have a transcript
        this.updateState({
          status: "completed",
          transcript: this.transcript,
        });

        // Set flag to prevent duplicate completed events
        this.silenceCompletedRecently = true;

        // Dispatch a special event that will be caught by the UI layer
        // This mimics the user clicking the send button, but for voice input
        // document.dispatchEvent(new CustomEvent('voice-message-submit', {
        //   detail: {
        //     transcript: this.transcript
        //   }
        // }));

        // We intentionally DO NOT reset the transcript here
        // so that the coordinator can access it

        // Stop recognition during processing, just like in text mode
        try {
          console.log(
            "SRService: Stopping recognition after silence detection to process input",
          );

          // First, stop the current recognition session
          // We need to set isRecognizing to false temporarily to prevent
          // onend from thinking this was an unexpected termination
          this.isRecognizing = false;

          if (this.recognition) {
            // Some browsers throw when stopping an already stopped recognition
            try {
              this.recognition.stop();
            } catch (e) {
              console.log(
                "SRService: Error stopping recognition (may be already stopped):",
                e,
              );
            }
          }
        } catch (error) {
          console.error("Error in silence detection flow:", error);
        }
      }
    }, this.silenceDelay);
  }

  /**
   * Clear the silence detection timer
   */
  private clearSilenceTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  /**
   * Clear the restart timer
   */
  private clearRestartTimer(): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  }

  /**
   * Initialize the speech recognition object
   */
  public initRecognition(): void {
    try {
      // Check for browser support with type assertion to bypass TypeScript error
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        console.error("Speech recognition not supported in this browser");
        this.updateState({
          status: "error",
          error: new Error("Speech recognition not supported in this browser"),
        });
        return;
      }

      // Clean up old recognition instance if it exists
      if (this.recognition) {
        try {
          // Remove event listeners
          this.recognition.onstart = null;
          this.recognition.onresult = null;
          this.recognition.onerror = null;
          this.recognition.onend = null;
        } catch (e) {
          console.warn("Could not clean up old recognition instance:", e);
        }
      }

      // Create fresh recognition instance
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;

      this.recognition.onstart = () => {
        console.log("SR started");
        this.isRecognizing = true;
        // For a fresh session, observers should not receive a stale transcript
        this.updateState({ status: "listening", transcript: "" });
      };

      this.recognition.onresult = (event: any) => {
        let finalTranscript = "";
        let interimTranscript = "";
        let isFinal = false;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const resultItem = event.results[i];
          if (!resultItem) continue;

          const firstResult = resultItem[0];
          if (!firstResult) continue;

          const transcript = firstResult.transcript || "";

          if (resultItem.isFinal) {
            finalTranscript += transcript;
            isFinal = true;
            console.log(`SR transcript (final): ${transcript}`);
          } else {
            interimTranscript += transcript;
            console.log(`SR transcript (interim): ${transcript}`);
          }
        }

        // Only update if we have some transcript
        if (finalTranscript || interimTranscript) {
          const combinedTranscript = finalTranscript || interimTranscript;

          // Update the transcript
          this.transcript = combinedTranscript.trim();

          // Determine if this is an interim result
          const isInterim = !isFinal && interimTranscript.length > 0;

          // Update state with interim flag
          this.updateState({
            status: "listening",
            transcript: this.transcript,
            isInterim: isInterim,
          });

          // Reset the silence timer each time we detect speech
          // But only if we have a final result or if this is the first interim result
          if (isFinal || (!finalTranscript && interimTranscript)) {
            this.startSilenceDetection();
          }
        }
      };

      this.recognition.onerror = (event: any) => {
        // Treat 'no-speech' as a normal condition to avoid noisy errors
        if (event?.error === "no-speech") {
          this.lastErrorWasNoSpeech = true;
          console.debug("SR notice: no-speech (silence). Will auto-restart.");
        } else {
          console.error("SR error:", event?.error);
          // Update state for critical errors only
          this.updateState({
            status: "error",
            error: new Error(
              event?.error || "Unknown speech recognition error",
            ),
          });
          this.isRecognizing = false;
        }

        this.clearSilenceTimer();
      };
      this.recognition.onend = () => {
        const endedAfterNoSpeech = this.lastErrorWasNoSpeech;
        if (endedAfterNoSpeech) {
          // Reset the flag so subsequent ends are handled normally
          this.lastErrorWasNoSpeech = false;
          console.debug("SR ended after no-speech (expected).");
        } else {
          console.log("SR ended");
        }

        // If this was unexpected (isRecognizing still true), try to restart
        const wasUnexpected = this.isRecognizing;

        // Update our internal state
        this.isRecognizing = false;

        // Clear timers
        this.clearSilenceTimer();

        // IMPORTANT: Only emit completed state if not already recently emitted by silence detection
        // We track completion via the silenceTimer flag, which is cleared when silence detection completes
        // This prevents duplicate 'completed' events that would cause duplicate AI responses
        if (this.transcript.trim() && !this.silenceCompletedRecently) {
          console.log("SR ended normally with transcript, emitting completed");
          this.updateState({
            status: "completed",
            transcript: this.transcript,
          });
          // Note: We don't clear the transcript here
        } else if (this.silenceCompletedRecently) {
          console.log(
            "SR ended after silence detection already completed, skipping duplicate completed event",
          );
        }

        // Notify that we're ready for new input
        this.updateState({ status: "ready" });

        // Decide whether to restart
        const shouldRestart =
          (wasUnexpected || endedAfterNoSpeech) && !this.restartTimer;
        if (shouldRestart) {
          if (wasUnexpected && !endedAfterNoSpeech) {
            console.log("SR ended unexpectedly, attempting to restart");
          } else if (endedAfterNoSpeech) {
            console.debug("SR auto-restarting after no-speech");
          }
          // Wait a bit to avoid rapid restart loops
          this.restartTimer = setTimeout(() => {
            try {
              this.start();
            } catch (e) {
              console.error("Failed to auto-restart speech recognition:", e);
            }
          }, 1000);
        }
      };

      this.updateState({ status: "ready" });
    } catch (error) {
      console.error("Failed to initialize speech recognition:", error);
      this.updateState({
        status: "error",
        error:
          error instanceof Error
            ? error
            : new Error("Unknown initialization error"),
      });
    }
  }

  /**
   * Start the speech recognition service
   */
  start(language: string = "en-US"): void {
    console.log(
      "SRService: Attempting to start speech recognition, current state:",
      this.isRecognizing ? "active" : "inactive",
    );

    // Cancel any pending restarts
    this.clearRestartTimer();

    // If already recognizing, don't try to start again
    if (this.isRecognizing) {
      console.log("SRService: Recognition already active, not starting again");
      return;
    }

    // Make sure we have a recognition instance
    if (!this.recognition) {
      console.log("SRService: No recognition instance, initializing");
      this.initRecognition();
      if (!this.recognition) {
        console.error("Cannot start speech recognition - not initialized");
        return;
      }
    }

    try {
      // Set language
      this.recognition.lang = language;

      // Clear silence timer
      this.clearSilenceTimer();
      // Reset transcript and flags for a fresh session
      this.transcript = "";
      this.silenceCompletedRecently = false;

      // Flag that we're starting recognition BEFORE calling start()
      // This helps us identify controlled vs uncontrolled stops
      this.isRecognizing = true;
      this.updateState({ status: "initializing", transcript: "" });

      // Start recognition
      console.log("SRService: Starting recognition");
      this.recognition.start();
    } catch (error) {
      console.error("Error starting speech recognition:", error);

      // Reset state on error
      this.isRecognizing = false;

      // Report error
      this.updateState({
        status: "error",
        error:
          error instanceof Error
            ? error
            : new Error("Failed to start recognition"),
      });

      // If we get an error like "recognition has already started",
      // try to completely reinitialize on next attempt
      if (
        error instanceof Error &&
        error.message &&
        error.message.includes("already started")
      ) {
        console.log(
          "SRService: Recognition seems to be in an inconsistent state, will reinitialize next time",
        );
        this.recognition = null;
      }
    }
  }

  /**
   * Stop the speech recognition service
   */
  stop(): void {
    console.log(
      "SRService: Attempting to stop speech recognition, current state:",
      this.isRecognizing ? "active" : "inactive",
    );

    // Clear any timers
    this.clearSilenceTimer();
    this.clearRestartTimer();

    // Mark that we're stopping (to differentiate from unexpected stops)
    this.isRecognizing = false;

    // If we have a transcript when stopping, emit it as completed
    if (this.transcript && this.transcript.trim()) {
      this.updateState({
        status: "completed",
        transcript: this.transcript,
      });
    }

    // Only try to stop if we have a recognition instance
    if (this.recognition) {
      try {
        console.log("SRService: Stopping recognition");
        this.recognition.stop();
      } catch (error) {
        console.error("Error stopping speech recognition:", error);
      }
    } else {
      console.log("SRService: No recognition instance to stop");
    }

    // Always update state to ready
    this.updateState({ status: "ready" });
  }

  /**
   * Check if speech recognition is currently running
   */
  isRunning(): boolean {
    return this.isRecognizing;
  }

  /**
   * Get the current transcript
   */
  getTranscript(): string {
    return this.transcript;
  }

  /**
   * Clear the current transcript
   */
  clearTranscript(): void {
    this.transcript = "";
    this.updateState({
      status: this.currentState.status,
      transcript: "",
    });
    console.log("SRService: Transcript cleared");
  }

  /**
   * Add a state observer
   * @param observer Function to be called when state changes
   * @returns Function to remove the observer
   */
  public addStateObserver(observer: SpeechRecognitionObserver): () => void {
    this.stateObservers.push(observer);
    console.log(
      `[SRService] Added state observer, count: ${this.stateObservers.length}`,
    );

    // Return a function to remove this observer
    return () => {
      this.stateObservers = this.stateObservers.filter(
        (obs) => obs !== observer,
      );
      console.log(
        `[SRService] Removed state observer, count: ${this.stateObservers.length}`,
      );
    };
  }

  /**
   * Notify observers of state changes
   * @param state The state name
   * @param data Optional data to pass to observers
   */
  private notifyStateObservers(state: string, data?: any): void {
    this.stateObservers.forEach((observer) => {
      try {
        observer(state, data);
      } catch (error) {
        console.error("[SRService] Error in state observer:", error);
      }
    });
  }

  /**
   * Subscribe to state changes (legacy method)
   * @deprecated Use addStateObserver instead
   */
  subscribe(listener: (state: SpeechRecognitionState) => void): {
    unsubscribe: () => void;
  } {
    console.warn(
      "[SRService] The subscribe method is deprecated, use addStateObserver instead",
    );

    // Create a wrapper that adapts the new observer format to the old one
    const observerWrapper = (_: string, data: any) => {
      if (data?.state) {
        listener(data.state);
      } else {
        listener({ ...this.currentState });
      }
    };

    // Add the wrapper as an observer
    const removeObserver = this.addStateObserver(observerWrapper);

    // Immediately notify with current state
    listener({ ...this.currentState });

    // Return compatible interface
    return {
      unsubscribe: removeObserver,
    };
  }

  /**
   * Update the current state and notify observers
   */
  private updateState(partialState: Partial<SpeechRecognitionState>): void {
    this.currentState = { ...this.currentState, ...partialState };

    // Notify observers using the new pattern
    this.notifyStateObservers(this.currentState.status, {
      state: { ...this.currentState },
      transcript: this.currentState.transcript,
      error: this.currentState.error,
    });

    // // Also dispatch a DOM event for compatibility with existing code
    // document.dispatchEvent(new CustomEvent('speech-recognition-event', {
    //   detail: {
    //     type: this.mapStatusToEventType(this.currentState.status),
    //     transcript: this.currentState.transcript,
    //     error: this.currentState.error
    //   }
    // }));
  }

  /**
   * Map internal status to event types for DOM events
   */
  // private mapStatusToEventType(status: string): string {
  //   switch (status) {
  //     case 'initializing': return 'START_LISTENING';
  //     case 'listening': return 'RESULT_READY';
  //     case 'completed': return 'SPEECH_END';
  //     case 'error': return 'ERROR';
  //     default: return 'STATUS_CHANGE';
  //   }
  // }
}

// Export as a singleton
const srService = new SRService();
export default srService;
