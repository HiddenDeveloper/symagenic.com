// ConversationHSMCoordinator.tsx
// Updated to observe AIService state changes
import { useMachine } from "@xstate/react";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";

import AIService from "../services/AIService";
import { Message } from "../types/AIServiceTypes";
import { AIState, ConversationMachine } from "../statemachines/ConversationHSM";
import srService from "../services/SRService";
import ttsService from "../services/ttsservice";

// Type for the values provided by this context
export interface ConversationService {
  // State information
  currentSubstate: string;
  transcript: string;
  interimTranscript: string; // Add interim transcript
  speechRecognitionState: string; // Add speech recognition state
  aiResponse: string;
  messages: Message[];
  currentTool: {
    name: string;
    startTime: number;
    isRunning: boolean;
    hasError: boolean;
    errorMessage?: string;
  } | null;

  // Input/Output mode flags (independent control)
  speechRecognitionEnabled: boolean;
  speechSynthesisEnabled: boolean;

  // Actions
  sendText: (input: string) => void;
  toggleSpeechRecognition: () => void;
  toggleSpeechSynthesis: () => void;
  sendMessageToAI: (message: string) => void;
  clearTranscript: () => void;
  isToolMessage: (message: any) => boolean;
}

// Create the context
const ConversationContext = createContext<ConversationService | null>(null);

// The Provider component
export const ConversationHSMCoordinator: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  // Initialize state
  const [aiResponse, setAIResponse] = useState("");
  const [interimTranscript, setInterimTranscript] = useState(""); // For storing interim transcripts
  const [transcript, setTranscript] = useState(""); // For storing interim transcripts
  const [speechRecognitionState, setSpeechRecognitionState] = useState("ready"); // Track SR state
  // Use ref for timeout to avoid stale closure issues in useEffect
  const responseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use the machine with minimal options to avoid type errors
  const [state, send] = useMachine(ConversationMachine);

  // Get SR and TTS state from context (independent flags)
  const speechRecognitionEnabled = state.context.speechRecognitionEnabled;
  const speechSynthesisEnabled = state.context.speechSynthesisEnabled;

  const sendMessageToAI = (message: string) => {
    console.log("[Coordinator] sendMessageToAI:", message);

    // First, add the user message to the conversation
    send({ type: "SUBMIT_TEXT", input: message });

    // Get messages from state context to provide conversation history
    const messages = state.context.messages || [];
    console.log(
      "[Coordinator] Sending with message history:",
      messages.length,
      "messages",
    );

    // Call the AI service with message history
    try {
      AIService.sendUserMessage(message, messages);
    } catch (err) {
      // Handle synchronous errors
      const error = err as Error;
      console.error("[Coordinator] Error sending message to AI:", error);
      send({ type: "AI_ERROR", message: error.message || "Unknown error" });
    }
  };

  const clearTranscript = () => {
    console.log("[Coordinator] Clearing transcript");
    setTranscript("");
    setInterimTranscript("");
    // Also clear the transcript in the SR service
    srService.clearTranscript();
  };

  // Initialize AIService and observe its state
  useEffect(() => {
    console.log("[Coordinator] Initializing and connecting to AI service");
    AIService.initialize();

    // Add a state observer to AIService
    const removeObserver = AIService.addStateObserver((aiState, data) => {
      console.log(`[Coordinator] AI state changed: ${aiState}`, data);

      switch (aiState) {
        case AIState.THINKING:
          // AI is processing the message - transition state machine to THINKING
          // Note: User message was already added when sendMessageToAI was called
          if (
            state.matches(AIState.WAITING) ||
            state.matches(AIState.RESPONDING)
          ) {
            send({ type: "SUBMIT_TEXT", input: "" }); // Empty input since message already added
          }
          setAIResponse("");
          // Stop SR while AI is thinking (will restart after response)
          if (speechRecognitionEnabled) {
            console.log(
              "[Coordinator] AI is thinking, stopping SR to prepare for response",
            );
            srService.stop();
          }

          // Set a timeout to recover from stuck thinking state
          if (responseTimeoutRef.current) {
            clearTimeout(responseTimeoutRef.current);
          }
          responseTimeoutRef.current = setTimeout(() => {
            console.error(
              "[Coordinator] AI response timeout - recovering from stuck state",
            );
            send({
              type: "AI_ERROR",
              message: "Response timeout - please try again",
            });
            // Restart SR if enabled and TTS is not playing
            if (speechRecognitionEnabled && !ttsService.isPlaying) {
              srService.start();
            }
          }, 30000); // 30 second timeout
          break;

        case "chat_message":
          console.log("[Coordinator] chat_message received:", data);

          // Clear timeout when we receive a response
          if (responseTimeoutRef.current) {
            clearTimeout(responseTimeoutRef.current);
            responseTimeoutRef.current = null;
          }

          // Type guard for chat_message data
          if (data && typeof data === 'object' && 'role' in data) {
            const messageData = data as Message;
            // Only process AI/assistant messages, not user message echoes
            if (messageData.role === "model" || messageData.role === "assistant") {
              // Send AI response to state machine
              console.log(
                "[Coordinator] Sending AI_RESPONSE_RECEIVED with message:",
                data,
              );
              const messageData = data as any; // Type assertion for flexibility
              send({
                type: "AI_RESPONSE_RECEIVED",
                response:
                  messageData?.content || messageData?.parts?.[0]?.text || messageData?.getText?.() || "MJC NOT SET",
                message: messageData, // Pass the full message object
              });
              console.log(
                "[Coordinator] Setting AI response:",
                messageData?.content || messageData?.parts?.[0]?.text || messageData?.getText?.(),
              );
              setAIResponse(messageData?.content || messageData?.parts?.[0]?.text || messageData?.getText?.() || "");

              // If in voice mode, speak the response
              // if (isVoiceMode) {
              //   const text = data?.content || data?.parts?.[0]?.text || '';
              //   if (text) {
              //     console.log('[Coordinator] Speaking AI response in voice mode');
              //     ttsService.speak(text);
              //   }
              // }
            } else if (data?.role === "user") {
              // User messages are already in the state from SUBMIT_TEXT
              console.log("[Coordinator] Ignoring user message echo from server");
            }
          }
          break;

        case AIState.RESPONDING:
          // AI is returning a response sentence by sentence
          const respondingData = data as any;
          send({
            type: "AI_RESPONSE_RECEIVED",
            response: respondingData?.sentence || "",
          });
          setAIResponse((prev) => prev + (respondingData?.sentence || ""));
          break;

        case "sentence":
          // AI is sending a sentence
          const sentenceData = data as any;
          console.log("[Coordinator] AI sentence:", sentenceData?.sentence);

          // If speech synthesis is enabled, speak each sentence as it arrives
          if (speechSynthesisEnabled && sentenceData?.sentence) {
            console.log(
              "[Coordinator] Speaking sentence:",
              sentenceData.sentence,
            );
            // Stop SR before speaking to prevent it from picking up the AI's voice
            if (speechRecognitionEnabled) {
              srService.stop();
            }
            ttsService.speak(sentenceData.sentence);
          }
          break;

        case "tool_running":
          // AI is running a tool
          const toolRunningData = data as any;
          console.log("[Coordinator] Tool running:", toolRunningData?.tool);
          send({ type: "TOOL_STARTED", tool: toolRunningData?.tool || "unknown" });
          break;

        case "tool_complete":
          // AI completed running a tool
          const toolCompleteData = data as any;
          console.log("[Coordinator] Tool complete:", toolCompleteData?.tool);
          send({ type: "TOOL_COMPLETED", tool: toolCompleteData?.tool || "unknown" });
          break;

        case "complete":
          // AI has finished its entire response
          console.log("[Coordinator] AI response complete");

          // Clear timeout when response completes
          if (responseTimeoutRef.current) {
            clearTimeout(responseTimeoutRef.current);
            responseTimeoutRef.current = null;
          }

          send({ type: "AI_COMPLETE" });

          // Restart SR if enabled and TTS is not playing
          if (speechRecognitionEnabled && !ttsService.isPlaying) {
            console.log("[Coordinator] Response complete, restarting SR");
            srService.start();
          }
          break;

        case AIState.ERROR:
          // An error occurred
          const errorData = data as any;

          // Clear timeout on error
          if (responseTimeoutRef.current) {
            clearTimeout(responseTimeoutRef.current);
            responseTimeoutRef.current = null;
          }

          send({ type: "AI_ERROR", message: errorData?.error || "Unknown error" });
          console.error("[Coordinator] AI error:", errorData?.error);

          // Restart SR if enabled and TTS is not playing
          if (speechRecognitionEnabled && !ttsService.isPlaying) {
            console.log("[Coordinator] Error occurred, restarting SR");
            srService.start();
          }
          break;

        default:
          console.warn("[Coordinator] Unhandled AI state:", aiState);
      }
    });

    // Clean up when the component unmounts
    return () => {
      console.log("[Coordinator] Cleaning up observer");
      removeObserver();
      // Clear any pending timeout
      if (responseTimeoutRef.current) {
        clearTimeout(responseTimeoutRef.current);
        responseTimeoutRef.current = null;
      }
    };
  }, [send, speechRecognitionEnabled, speechSynthesisEnabled]);

  // Manage Speech Recognition lifecycle based on speechRecognitionEnabled flag
  useEffect(() => {
    console.log("[Coordinator] Speech Recognition state changed:", speechRecognitionEnabled);
    if (speechRecognitionEnabled) {
      console.log("[Coordinator] Starting speech recognition");
      // Don't start SR immediately if TTS is speaking
      // This prevents SR from picking up the AI's voice
      if (!ttsService.isPlaying) {
        console.log("[Coordinator] TTS not playing, starting SR");
        srService.start();
      } else {
        console.log("[Coordinator] TTS is playing, deferring SR start");
      }

      // Add a state observer to srService
      const removeObserver = srService.addStateObserver((srState, data) => {
        console.log(`[Coordinator] SR state changed: ${srState}`, data);

        switch (srState) {
          case "listening":
            // Update UI to show actively listening
            console.log("[Coordinator] SR is listening:", data?.transcript);
            setSpeechRecognitionState("listening");

            // Check if this is an interim result
            if (data?.state?.isInterim) {
              console.log(
                "[Coordinator] Interim transcript:",
                data?.transcript,
              );
              setInterimTranscript(data?.transcript || "");
            } else {
              // Clear interim transcript when we get a final result
              setInterimTranscript("");
            }
            break;

          case "completed":
            // Handle completed speech recognition with transcript
            if (data?.state?.transcript) {
              console.log(
                "[Coordinator] SR completed with transcript:",
                data.state.transcript,
              );
              setSpeechRecognitionState("completed");
              setTranscript(data.state.transcript); // Update the transcript state
              // Clear interim transcript when recognition completes
              setInterimTranscript("");

              // Reset SR state to ready after a short delay to allow ChatInput to process
              setTimeout(() => {
                setSpeechRecognitionState("ready");
              }, 100);
            }
            break;

          case "ready":
            // Handle speech recognition ready state
            console.log("[Coordinator] SR is ready");
            setSpeechRecognitionState("ready");
            break;

          case "error":
            // Handle speech recognition errors
            console.error("[Coordinator] SR error:", data?.error);
            setSpeechRecognitionState("error");
            send({
              type: "SPEECH_RECOGNITION_ERROR",
              message: data?.error?.message || "Speech recognition error",
            });
            break;

          default:
            console.log("[Coordinator] SR state:", srState, data);
        }
      });

      return () => {
        console.log("[Coordinator] Stopping SRService and removing observer");
        srService.stop();
        removeObserver();
      };
    } else {
      // Speech recognition disabled - ensure it's stopped
      console.log("[Coordinator] Speech recognition disabled, stopping SR");
      srService.stop();
    }
  }, [speechRecognitionEnabled, send]);

  // const manageSR = useCallback(() => {
  //   if (isVoiceMode) {
  //     console.log('[Coordinator] Starting SRService for voice mode');
  //     SRService.start();

  //     const srSubscription = SRService.subscribe((state) => {
  //       if (state.status === 'completed' && state.transcript) {
  //         console.log('[Coordinator] SRService completed with transcript:', state.transcript);
  //         send({ type: 'SUBMIT_TEXT', input: state.transcript });
  //       }
  //     });

  //     return () => {
  //       console.log('[Coordinator] Stopping SRService for voice mode');
  //       SRService.stop();
  //       srSubscription.unsubscribe();
  //     };
  //   } else {
  //     console.log('[Coordinator] Voice mode disabled, ensuring SRService is stopped');
  //     SRService.stop();
  //   }
  // }, [isVoiceMode, send]);

  // useEffect(() => {
  //   const cleanup = manageSR();
  //   return cleanup;
  // }, [manageSR]);

  // Log state changes for debugging
  // Effect to handle TTS service events (manages SR when both are enabled)
  useEffect(() => {
    if (speechSynthesisEnabled) {
      console.log(
        "[Coordinator] Setting up TTS service observer",
      );

      // Add a state observer to TTSService to restart SR after TTS completes
      // (only if SR is also enabled)
      const removeTtsObserver = ttsService.addStateObserver(
        (ttsState, data) => {
          console.log(`[Coordinator] TTS state changed: ${ttsState}`, data);

          switch (ttsState) {
            case "speaking":
              // TTS is speaking, ensure SR is stopped (if enabled)
              if (speechRecognitionEnabled) {
                console.log(
                  "[Coordinator] TTS is speaking, stopping speech recognition",
                );
                srService.stop();
              }
              break;

            case "ended":
              // TTS has finished speaking, restart speech recognition (if enabled)
              if (speechRecognitionEnabled) {
                console.log(
                  "[Coordinator] TTS finished speaking, restarting speech recognition",
                );
                srService.start();
              }
              break;

            case "error":
              // Handle TTS errors
              console.error("[Coordinator] TTS error:", data?.error);
              // Still restart SR even if TTS fails (if enabled)
              if (speechRecognitionEnabled) {
                srService.start();
              }
              break;
          }
        },
      );

      return () => {
        console.log("[Coordinator] Cleaning up TTS observer");
        removeTtsObserver();
      };
    }
  }, [speechSynthesisEnabled, speechRecognitionEnabled]);

  useEffect(() => {
    console.log(
      `[Coordinator] State changed: ${getCurrentSubstate()}`,
      state.value,
    );
  }, [state]);

  // Get the current AI conversation state
  const getCurrentSubstate = (): string => {
    console.log("[Coordinator] Getting current substate", state);
    // Use XState's matches to check state
    if (state.matches(AIState.WAITING)) return "WAITING_FOR_INPUT";
    if (state.matches(AIState.THINKING)) return "THINKING";
    if (state.matches(AIState.RESPONDING)) return "RESPONDING";
    if (state.matches(AIState.ERROR)) return "ERROR";
    return "UNKNOWN";
  };

  // Action handlers
  const sendText = (input: string) => {
    console.log("[Coordinator] sendText:", input);
    send({ type: "SUBMIT_TEXT", input });
  };

  const toggleSpeechRecognition = () => {
    console.log("[Coordinator] Toggling speech recognition");
    send({ type: "TOGGLE_SPEECH_RECOGNITION" });
  };

  const toggleSpeechSynthesis = () => {
    console.log("[Coordinator] Toggling speech synthesis");
    send({ type: "TOGGLE_SPEECH_SYNTHESIS" });
  };

  // Create the provider value
  const value: ConversationService = {
    currentSubstate: getCurrentSubstate(),
    transcript: transcript,
    interimTranscript: interimTranscript, // Add the interim transcript
    speechRecognitionState: speechRecognitionState, // Add the speech recognition state
    aiResponse: state.context.aiResponse || aiResponse,
    messages: state.context.messages || [],
    currentTool: state.context.currentTool,
    speechRecognitionEnabled,
    speechSynthesisEnabled,
    sendText,
    toggleSpeechRecognition,
    toggleSpeechSynthesis,
    sendMessageToAI,
    clearTranscript,
    isToolMessage: (message) => AIService.isToolMessage(message),
  };

  return (
    <ConversationContext.Provider value={value}>
      {children}
    </ConversationContext.Provider>
  );
};

// Hook to use the conversation
export const useConversation = (): ConversationService => {
  const context = useContext(ConversationContext);

  if (!context) {
    throw new Error(
      "useConversation must be used within a <ConversationHSMCoordinator>",
    );
  }

  return context;
};
