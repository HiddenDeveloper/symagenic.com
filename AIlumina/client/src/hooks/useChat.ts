/**
 * useChat Hook (Simplified)
 *
 * This hook provides access to the conversation state machine functionality.
 * It's a compatibility layer that uses useConversation but returns data in
 * the format expected by existing components.
 */

import { useMemo } from "react";

import {
  messageHasText,
  normalizeMessageContent,
  Role,
} from '../types/AIServiceTypes';
import type { ChatContextType } from '../types/ChatContext.types';
import { useConversation } from '../contexts/ConversationHSMCoordinator';

/**
 * useChat - A hook to access the chat functionality
 * This is now a compatibility layer on top of useConversation
 */
export const useChat = (): ChatContextType => {
  const conversation = useConversation();
  const {
    currentSubstate,
    mode,
    transcript,
    interimTranscript,
    speechRecognitionState,
    aiResponse,
  } = conversation;

  // Map state to a simplified interface for backward compatibility
  const getAIState = (): "thinking" | "responding" | "waiting" | "error" => {
    if (currentSubstate === "THINKING") {
      return "thinking";
    }
    if (currentSubstate === "RESPONDING" || currentSubstate === "SPEAKING") {
      return "responding";
    }
    // We don't have explicit error states in the minimal implementation
    return "waiting";
  };

  // Transform messages to match the expected format in ChatContextType
  const messages = useMemo(() => {
    return (
      (conversation.messages || [])
        // Filter messages with text content using utility function
        .filter(messageHasText)
        // Transform to simplified Message format
        .map((message) => {
          // Ensure id is a string
          const id =
            typeof message.id === "undefined"
              ? `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
              : String(message.id);

          // Map role to expected values using Role enum
          let role: "user" | "assistant" | "system";
          if (message.role === Role.USER || message.role === Role.SYSTEM) {
            role = message.role;
          } else if (
            message.role === Role.MODEL ||
            message.role === Role.ASSISTANT
          ) {
            role = "assistant";
          } else {
            role = "system";
          }

          // Extract content using utility function
          const content = normalizeMessageContent(message);

          return { id, role, content };
        })
    );
  }, [conversation.messages]);

  // Map voice states
  const getTTSState = (): "speaking" | "ready" => {
    if (currentSubstate === "SPEAKING") {
      return "speaking";
    }
    return "ready";
  };

  const getSpeechRecognitionState = (): string => {
    // Return the actual speech recognition state from the coordinator
    return speechRecognitionState || "ready";
  };

  // Create placeholder functions for unused methods to maintain API compatibility
  const noopFn = () => {
    // Removed console log to prevent re-renders
  };

  // Provide a simplified interface that matches the original API
  return {
    // State information
    messages,
    aiState: getAIState(),
    conversationState: currentSubstate,
    aiError: null, // Not tracking errors in minimal implementation
    isConnected: true, // We assume the service is connected

    // Voice-specific states
    ttsState: getTTSState(),
    speechRecognitionState: getSpeechRecognitionState(),
    isVoiceMode: mode.isVoice,
    transcription: transcript,
    interimTranscript: interimTranscript,

    // Current inputs/outputs
    currentTool: null, // We're not handling tools in this simplified version
    currentMessage: aiResponse,
    isTyping: getAIState() === "thinking",
    aiResponse: aiResponse,
    userState: currentSubstate,
    systemState: null,

    // Actions
    sendMessage: conversation.sendMessageToAI,
    toggleVoiceMode: () => conversation.switchMode(!mode.isVoice),
    clearTranscript: conversation.clearTranscript,

    // These methods would need real implementations in a production app, but we're just
    // providing placeholders for API compatibility
    setSpeechRecognitionState: noopFn,
    setMessages: noopFn,
    setCurrentTool: noopFn,
    setCurrentMessage: noopFn,
    setUserState: noopFn,
    setAIState: noopFn,
    setTTSState: noopFn,
    setConversationState: noopFn,
    stopAudio: () => {},
    playbackAudio: () => {},
    pushMessage: () => {
      // Removed console log
    },
    setSystemState: noopFn,
  };
};

export default useChat;
