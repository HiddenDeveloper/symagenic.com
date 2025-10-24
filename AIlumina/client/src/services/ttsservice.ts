import { createActor } from "xstate";

import { TextToSpeechStateMachine } from '../statemachines/TextToSpeechStateMachine';

// type TTSContext = {
//   text: string;
//   error?: Error;
// };

// Type definition for state observers
type TTSStateObserver = (state: string, data?: any) => void;

class TTSService {
  private actor = createActor(TextToSpeechStateMachine).start();
  private wsUrl =
    ((import.meta as any).env?.VITE_WS_URL as string | undefined)?.replace(
      /\/$/,
      "",
    ) || window.location.origin.replace(/^http/, "ws");

  private wsPath = "/ws/tts";
  private socket: WebSocket | null = null;
  private audioQueue: Blob[] = [];
  public isPlaying = false;
  private currentAudio: HTMLAudioElement | null = null;

  // Observer pattern implementation
  private stateObservers: TTSStateObserver[] = [];

  constructor() {
    this.startActor();
    this.initSocket();
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

  private initSocket() {
    try {
      this.ensureActorActive();
      this.actor.send({ type: "INITIALIZE" });
      this.notifyStateObservers("initializing");

      this.socket = new WebSocket(this.wsUrl + this.wsPath);
      this.socket.binaryType = "arraybuffer";

      this.socket.onopen = () => {
        console.log("🔊 TTS WebSocket connected");
        this.actor.send({ type: "INITIALIZED_SUCCESS" });
        this.notifyStateObservers("connected");
      };

      this.socket.onmessage = (event) => this.handleAudioResponse(event);

      this.socket.onerror = (event) => {
        console.error("TTS WebSocket error:", event);
        // WebSocket onerror receives an Event, not an Error object
        const errorObj = new Error("WebSocket connection error");
        this.actor.send({
          type: "ERROR",
          error: errorObj,
        });
        this.notifyStateObservers("error", { error: errorObj });
      };

      this.socket.onclose = () => {
        console.warn("TTS WebSocket closed. Reconnecting in 3s...");
        this.notifyStateObservers("disconnected", { reconnecting: true });
        setTimeout(() => this.initSocket(), 3000);
      };
    } catch (error) {
      console.error("TTS WebSocket initialization failed:", error);
      const errorObj =
        error instanceof Error
          ? error
          : new Error("Failed to initialize WebSocket");
      this.actor.send({
        type: "INITIALIZED_ERROR",
        error: errorObj,
      });
      this.notifyStateObservers("error", { error: errorObj });
    }
  }

  public speak(text: string) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket not ready, cannot send speech request.");
      this.notifyStateObservers("error", {
        error: new Error("WebSocket not ready"),
      });
      return;
    }

    this.ensureActorActive();
    this.actor.send({ type: "PREPARE_SPEECH", text });
    this.notifyStateObservers("preparing", { text });
    this.socket.send(JSON.stringify({ text }));
  }

  private handleAudioResponse(event: MessageEvent) {
    const blob = new Blob([event.data], { type: "audio/mpeg" });
    this.audioQueue.push(blob);

    this.ensureActorActive();
    this.actor.send({ type: "SPEECH_READY" });
    this.notifyStateObservers("ready", { queueLength: this.audioQueue.length });

    if (!this.isPlaying) {
      this.playNextAudio();
    }
  }

  private playNextAudio() {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      this.actor.send({ type: "SPEECH_ENDED" });
      this.notifyStateObservers("ended");
      return;
    }

    const blob = this.audioQueue.shift();
    if (!blob) return;

    this.currentAudio = new Audio(URL.createObjectURL(blob));
    this.isPlaying = true;

    this.ensureActorActive();
    this.actor.send({ type: "START_SPEAKING" });
    this.notifyStateObservers("speaking", {
      remainingAudio: this.audioQueue.length,
    });

    this.currentAudio.onended = () => {
      this.playNextAudio();
    };

    this.currentAudio.onerror = (err) => {
      console.error("Audio playback error:", err);
      const error = new Error("Audio playback failed");
      this.ensureActorActive();
      this.actor.send({ type: "ERROR", error });
      this.notifyStateObservers("error", { error });
      this.playNextAudio();
    };

    this.currentAudio.play();
  }

  public stopSpeaking() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
    }
    this.audioQueue = [];
    this.isPlaying = false;
    this.ensureActorActive();
    this.actor.send({ type: "STOP_SPEAKING" });
    this.notifyStateObservers("stopped");
  }

  public getSnapshot() {
    return this.actor.getSnapshot();
  }
}

export default new TTSService();
