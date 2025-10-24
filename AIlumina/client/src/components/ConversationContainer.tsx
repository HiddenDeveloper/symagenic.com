import { Activity, PanelLeft } from "lucide-react";
import React, { useState } from "react";

import ChatInput from "./ChatInput";
import ConversationStateIndicator from "./ConversationStateIndicator";
import CurrentToolDisplay from "./CurrentToolDisplay";
import MessageList from "./MessageList";
import { useChat } from '../hooks/useChat';

const isDebugMode = new URLSearchParams(window.location.search).has("debug");

const ConversationContainer: React.FC = () => {
  // Use the updated useChat hook which is now a wrapper around useConversation
  const { isVoiceMode } = useChat();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showStateDebug, setShowStateDebug] = useState(isDebugMode);

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);
  const toggleDebugView = () => setShowStateDebug((prev) => !prev);

  return (
    <div className="flex h-screen w-full">
      {/* Sidebar */}
      {isSidebarOpen && (
        <div className="w-64 bg-white border-r border-gray-200 dark:bg-gray-900 dark:border-gray-800">
          <div className="p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Sidebar
            </h2>
            {/* Sidebar content would go here */}
          </div>
        </div>
      )}

      <div className="flex flex-col flex-1 h-screen">
        {/* Header */}
        <div className="flex items-center bg-white p-3 border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800">
          {!isSidebarOpen && (
            <button
              onClick={toggleSidebar}
              className="mr-2 p-1 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              aria-label="Open sidebar"
            >
              <PanelLeft size={20} />
            </button>
          )}
          <div className="flex-1">
            <div className="font-medium">
              {isVoiceMode ? "Voice Chat" : "Text Chat"}
            </div>
          </div>

          {/* Debug toggle button */}
          {isDebugMode && (
            <button
              onClick={toggleDebugView}
              className="ml-2 p-1 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              aria-label="Toggle debug view"
            >
              <Activity size={20} />
            </button>
          )}
        </div>

        {/* Debug View */}
        {showStateDebug && <ConversationStateIndicator />}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
          <MessageList />
        </div>

        {/* Tool Status Indicator */}
        <CurrentToolDisplay />

        {/* Chat Input */}
        <ChatInput />
      </div>
    </div>
  );
};

export default ConversationContainer;
