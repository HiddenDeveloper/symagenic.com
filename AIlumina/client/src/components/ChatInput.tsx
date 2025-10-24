import { Mic, Send, Volume2 } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { useChat } from '../hooks/useChat';

// Memo-ized chat input component to prevent unnecessary re-renders
const ChatInput: React.FC = React.memo(() => {
  const {
    sendMessage,
    clearTranscript,
    speechRecognitionEnabled,
    speechSynthesisEnabled,
    toggleSpeechRecognition,
    toggleSpeechSynthesis,
    aiState,
    speechRecognitionState,
    transcription,
    interimTranscript,
  } = useChat();

  // Using useState for the input value - this is a controlled component
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Memo-ize these derived values to prevent recalculation on every render
  const isThinking = useCallback(
    () => aiState === "thinking" || aiState === "THINKING",
    [aiState],
  );

  const isResponding = useCallback(
    () => aiState === "responding" || aiState === "RESPONDING",
    [aiState],
  );

  const isWaiting = useCallback(
    () => aiState === "waiting" || aiState === "WAITING_FOR_INPUT",
    [aiState],
  );

  const isListening = useCallback(
    () => speechRecognitionState === "listening",
    [speechRecognitionState],
  );

  // Determine if input should be disabled
  const inputDisabled = isThinking() || isResponding();

  const focusInput = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Flag to prevent transcript updates after message is sent
  const [messageSent, setMessageSent] = useState(false);

  // Effect to handle voice transcript completion
  // Only auto-submit when speech recognition reaches 'completed' state
  useEffect(() => {
    if (
      speechRecognitionEnabled &&
      transcription &&
      speechRecognitionState === "completed" &&
      !messageSent
    ) {
      setInputValue(transcription);
      setMessageSent(true);
      // Use setTimeout to ensure the input value is set before clearing
      setTimeout(() => {
        handleSendMessage();
      }, 0);
    }
  }, [speechRecognitionEnabled, transcription, speechRecognitionState, messageSent]);

  // Focus when switching from voice to text mode
  useEffect(() => {
    if (!speechRecognitionEnabled) {
      focusInput();
    }
  }, [speechRecognitionEnabled, focusInput]);

  // Auto-focus input after AI finishes responding (only in text mode)
  useEffect(() => {
    if (!speechRecognitionEnabled && isWaiting()) {
      // Small delay to ensure state has settled
      const timeoutId = setTimeout(() => {
        focusInput();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [speechRecognitionEnabled, aiState, focusInput, isWaiting]);

  // Update input value when transcription or interim changes in speech recognition mode
  // But only if a message hasn't just been sent
  useEffect(() => {
    if (speechRecognitionEnabled && !messageSent) {
      // If we have an interim transcript, show it, otherwise fall back to the final transcript
      if (interimTranscript) {
        setInputValue(interimTranscript);
      } else if (transcription) {
        setInputValue(transcription);
      }
    }
  }, [speechRecognitionEnabled, transcription, interimTranscript, messageSent]);

  // Create a debounced version of setInputValue
  const debouncedSetInputValue = useCallback((value: string) => {
    const timeoutId = setTimeout(() => {
      setInputValue(value);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, []);

  // Memoized input change handler
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      debouncedSetInputValue(value);
    },
    [debouncedSetInputValue],
  );

  // Memoized send message handler
  const handleSendMessage = useCallback(() => {
    const messageToSend = speechRecognitionEnabled ? transcription : inputValue;

    if (!messageToSend || !messageToSend.trim()) return;

    sendMessage(messageToSend);

    if (speechRecognitionEnabled) {
      // Clear everything immediately in speech recognition mode
      clearTranscript();
      setInputValue("");
      // Don't reset messageSent flag here - let it be handled by effects
    } else {
      // Clear input value for text mode
      setInputValue("");
    }
  }, [speechRecognitionEnabled, transcription, inputValue, sendMessage, clearTranscript]);

  // Memoized key down handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage],
  );

  // Clear input when transcript is cleared
  useEffect(() => {
    if (speechRecognitionEnabled && transcription === "") {
      setInputValue("");
      // Also reset the message sent flag when transcript is cleared
      if (messageSent) {
        setMessageSent(false);
      }
    }
  }, [transcription, speechRecognitionEnabled, messageSent]);

  // Reset messageSent flag when speech recognition starts listening for new input
  useEffect(() => {
    if (speechRecognitionEnabled && speechRecognitionState === "listening" && messageSent) {
      setMessageSent(false);
    }
  }, [speechRecognitionEnabled, speechRecognitionState, messageSent]);

  // Memo-ized render function to optimize render performance
  return (
    <div className="border-t border-gray-200 p-4 bg-white dark:bg-gray-900 dark:border-gray-800">
      <div className="relative flex items-center">
        {/* Speech Recognition toggle button */}
        <button
          onClick={toggleSpeechRecognition}
          className={`p-2 rounded-full mr-2 ${
            speechRecognitionEnabled
              ? "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          }`}
          aria-label={
            speechRecognitionEnabled ? "Disable speech recognition" : "Enable speech recognition"
          }
        >
          <Mic size={20} />
        </button>

        {/* Speech Synthesis toggle button */}
        <button
          onClick={toggleSpeechSynthesis}
          className={`p-2 rounded-full mr-2 ${
            speechSynthesisEnabled
              ? "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          }`}
          aria-label={
            speechSynthesisEnabled ? "Disable speech synthesis" : "Enable speech synthesis"
          }
        >
          <Volume2 size={20} />
        </button>

        {/* Input area - conditionally render either textarea or readonly div */}
        {speechRecognitionEnabled ? (
          <div
            className="flex-1 p-3 rounded-md border border-gray-300 min-h-[40px] transition-colors dark:bg-gray-800 dark:border-gray-700 dark:text-white overflow-auto"
            style={{ cursor: "default" }}
          >
            {inputValue || (
              <span className="text-gray-400">
                {isListening()
                  ? "Listening..."
                  : "Speech recognition enabled. Click microphone to disable."}
              </span>
            )}
          </div>
        ) : (
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={inputDisabled}
            className="flex-1 p-3 rounded-md border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            rows={1}
          />
        )}

        {/* Send button */}
        <button
          onClick={handleSendMessage}
          disabled={inputValue.trim() === "" || inputDisabled}
          className={`p-2 rounded-full ml-2 ${
            inputValue.trim() === "" || inputDisabled
              ? "text-gray-400 dark:text-gray-600"
              : "text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          }`}
          aria-label="Send message"
        >
          <Send size={20} />
        </button>
      </div>

      {/* Status indicators */}
      {isThinking() && (
        <div className="text-xs text-gray-500 mt-2 dark:text-gray-400">
          AI is thinking...
        </div>
      )}

      {isResponding() && (
        <div className="text-xs text-green-500 mt-2 dark:text-green-400">
          AI is responding...
        </div>
      )}

      {speechRecognitionEnabled && isListening() && (
        <div className="text-xs text-blue-600 mt-2 animate-pulse dark:text-blue-400">
          Listening...
        </div>
      )}

      {isWaiting() && !speechRecognitionEnabled && (
        <div className="text-xs text-blue-500 mt-2 dark:text-blue-400">
          Ready for your message
        </div>
      )}
    </div>
  );
});

export default ChatInput;
