import React from "react";

import { useConversation } from '../contexts/ConversationHSMCoordinator';

const ConversationStateIndicator: React.FC = () => {
  const conversation = useConversation();
  const { speechRecognitionEnabled, speechSynthesisEnabled, currentSubstate, transcript, aiResponse } = conversation;

  return (
    <div className="p-4 bg-gray-100 border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
      <h3 className="font-medium mb-2 text-gray-900 dark:text-gray-100">
        Conversation State
      </h3>

      <div className="mt-2 text-xs text-gray-700 dark:text-gray-300">
        <div className="mb-1">
          <span className="font-semibold">Input Mode:</span>{" "}
          <span className={speechRecognitionEnabled ? "text-blue-600 font-bold dark:text-blue-400" : ""}>
            {speechRecognitionEnabled ? "🎤 Speech Recognition" : "⌨️ Text"}
          </span>
          {" "}
          <span className="text-gray-500">({String(speechRecognitionEnabled)})</span>
        </div>

        <div className="mb-1">
          <span className="font-semibold">Output Mode:</span>{" "}
          <span className={speechSynthesisEnabled ? "text-green-600 font-bold dark:text-green-400" : ""}>
            {speechSynthesisEnabled ? "🔊 Speech Synthesis" : "📖 Text"}
          </span>
          {" "}
          <span className="text-gray-500">({String(speechSynthesisEnabled)})</span>
        </div>

        <div className="mb-1">
          <span className="font-semibold">Current State:</span>{" "}
          <span className="font-mono">{currentSubstate}</span>
        </div>

        <div className="mb-1">
          <span className="font-semibold">Transcript:</span>{" "}
          <span className="font-mono">{transcript || "None"}</span>
        </div>

        <div className="mb-1">
          <span className="font-semibold">AI Response:</span>{" "}
          <span className="font-mono overflow-hidden text-ellipsis">
            {aiResponse || "None"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ConversationStateIndicator;
