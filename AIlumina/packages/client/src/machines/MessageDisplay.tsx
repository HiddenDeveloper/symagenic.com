import React from "react";

import { Message as MessageType } from "./AIServiceTypes";
import Message from "./Message";

interface MessageDisplayProps {
  message: MessageType;
  isPartial?: boolean;
}

export const MessageDisplay: React.FC<MessageDisplayProps> = ({
  message,
  isPartial = false,
}) => {
  // Add partial message styling or animation if needed
  const messageWithPartial = {
    ...message,
    isPartial: isPartial,
  };

  return <Message message={messageWithPartial} />;
};
