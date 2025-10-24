// Import and use the comprehensive Message interface from AIServiceTypes
import type { Message, Role } from "./AIServiceTypes";

// Re-export for convenient access
export type { Message, Role };

export type ChatContextType = {
  messages: Message[];
  setMessages: (messages: Message[]) => void;

  currentMessage: string;
  setCurrentMessage: (msg: string) => void;

  isTyping: boolean;

  sendMessage: (message: string) => void;
  pushMessage: (message: Message) => void;
  toggleVoiceMode: () => void;
  clearTranscript: () => void;

  transcription: string;
  interimTranscript: string; // Add interim transcript property
  aiResponse: string;
  aiError: Error | null;

  currentTool: unknown;
  setCurrentTool: (tool: unknown) => void;

  conversationState: string;
  setConversationState: (state: string) => void;

  userState: string;
  aiState: string;
  ttsState: string;
  speechRecognitionState: string;

  setUserState: (state: string) => void;
  setAIState: (state: string) => void;
  setTTSState: (state: string) => void;
  setSpeechRecognitionState: (state: string) => void;

  stopAudio: () => void;
  playbackAudio: () => void;

  systemState: unknown;
  setSystemState: (state: unknown) => void;

  isConnected: boolean;

  // Legacy voice mode (for backward compatibility)
  isVoiceMode: boolean;

  // Independent input/output controls (new API)
  speechRecognitionEnabled: boolean;
  speechSynthesisEnabled: boolean;
  toggleSpeechRecognition: () => void;
  toggleSpeechSynthesis: () => void;
};
