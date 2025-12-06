// filepath: /Users/hidden/develop/home/xstate-vite-demo/src/machines/CurrentToolDisplay.tsx
import React from "react";

import { useConversation } from "./ConversationHSMCoordinator";
import ToolStatusIndicator from "./ToolStatusIndicator";

/**
 * Component to display the currently running tool status
 * Uses the ToolStatusIndicator component and gets its data from
 * the ConversationHSMCoordinator context
 */
const CurrentToolDisplay: React.FC = () => {
  // Get the current tool status from the conversation context
  const { currentTool } = useConversation();

  // Only render if there's an active tool
  if (!currentTool) {
    return null;
  }

  return (
    <ToolStatusIndicator
      tool={currentTool.name}
      startTime={currentTool.startTime}
      isRunning={currentTool.isRunning}
      hasError={currentTool.hasError}
      errorMessage={currentTool.errorMessage}
    />
  );
};

export default CurrentToolDisplay;
