import React, { useEffect, useRef } from "react";

import { shouldDisplayMessage } from "./AIServiceTypes";
import { MessageDisplay } from "./MessageDisplay";
import { useChat } from "./useChat";
// import { useConversation } from './ConversationHSMCoordinator';

const MessageList: React.FC = () => {
  // Get messages directly from both sources to debug
  const { messages, aiResponse } = useChat();
  // const conversation = useConversation();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Debug both message sources
  console.log("useChat messages:", messages);

  // Filter messages to hide system and tool messages for OpenAI
  const displayMessages = [...(messages || [])].filter((message) =>
    shouldDisplayMessage(message),
  );

  // Auto-scroll on updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages, aiResponse]);

  return (
    <div className="flex flex-col p-4 space-y-4 pb-20">
      {displayMessages.map((message, index) => {
        // Debug each message we're trying to render
        console.log(`Rendering message ${index}:`, message);

        // Handle various message formats
        const messageToDisplay = {
          id: message.id || `msg-${index}`,
          role: message.role || "system",
          content:
            message.content ||
            ((message as any).parts && (message as any).parts[0]?.text) ||
            "Message content unavailable",
        };

        return (
          <MessageDisplay
            key={index}
            message={messageToDisplay}
            isPartial={message.id === "typing-indicator"}
          />
        );
      })}

      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;
