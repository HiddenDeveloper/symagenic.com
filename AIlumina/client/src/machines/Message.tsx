import DOMPurify from "dompurify";
import { AlertCircle, Bot, BrainCircuit, User } from "lucide-react";
import { marked } from "marked";
import React from "react";

import {
  Message as MessageType,
  normalizeMessageContent,
} from "./AIServiceTypes";
import ToolRunDisplay from "./ToolRunDisplay";

interface MessageProps {
  message: MessageType;
}

marked.setOptions({
  gfm: true,
  breaks: true,
});

const formatMessageTime = (timestamp: number | string): string => {
  const date = new Date(timestamp);
  return isNaN(date.getTime())
    ? new Date().toLocaleTimeString()
    : date.toLocaleTimeString();
};

const Message: React.FC<MessageProps> = ({ message }) => {
  const { role, timestamp, toolRuns, isPartial, isError } = message;

  // Determine role visual settings
  const isUser = role === "user";
  const isSystem = ["system", "function", "tool"].includes(role);
  const isAssistant = role === "assistant" || role === "model";
  const Icon = isUser
    ? User
    : isSystem
      ? isError
        ? AlertCircle
        : BrainCircuit
      : Bot;

  const alignment = isUser ? "justify-end" : "justify-start";
  const bgColor = isUser
    ? "bg-blue-100 dark:bg-blue-900"
    : isAssistant
      ? "bg-green-100 dark:bg-green-900"
      : isSystem
        ? isError
          ? "bg-red-100 dark:bg-red-900"
          : "bg-gray-100 dark:bg-gray-800"
        : "bg-gray-200";

  const textColor = isUser
    ? "text-blue-900 dark:text-blue-100"
    : isSystem
      ? isError
        ? "text-red-900 dark:text-red-100"
        : "text-gray-800 dark:text-gray-200"
      : "text-green-900 dark:text-green-100";

  // Use the normalizeMessageContent helper to get string content
  const textContent = normalizeMessageContent(message);

  const renderMarkdown = (text: string) => {
    const rawHTML = marked.parse(text) as string;
    const sanitized = DOMPurify.sanitize(rawHTML);
    return (
      <div
        className="contents"
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    );
  };

  return (
    <div className={`flex ${alignment} mb-4`}>
      <div
        className={`flex items-start max-w-xl lg:max-w-2xl xl:max-w-3xl ${isUser ? "flex-row-reverse" : "flex-row"}`}
      >
        <Icon
          className={`flex-shrink-0 w-6 h-6 mt-1 ${isUser ? "ml-2" : "mr-2"} ${textColor}`}
        />
        <div
          className={`px-4 py-2 rounded-lg shadow-md ${bgColor} ${textColor}`}
        >
          <div className="prose prose-sm dark:prose-invert max-w-none break-words text-left message-prose">
            {renderMarkdown(textContent)}
            {isPartial && (
              <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
            )}
          </div>

          {Array.isArray(toolRuns) && toolRuns.length > 0 && (
            <div className="mt-2 border-t border-gray-300 dark:border-gray-600 pt-2">
              {toolRuns.map((run, idx) => (
                <ToolRunDisplay key={idx} toolRun={run} />
              ))}
            </div>
          )}

          {timestamp && (
            <p
              className={`text-xs mt-1 ${isUser ? "text-right" : "text-left"} ${textColor} opacity-70`}
            >
              {formatMessageTime(timestamp)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Message;
