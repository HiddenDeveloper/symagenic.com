import { AlertCircle, CheckCircle, Cpu } from "lucide-react";
import React, { useEffect, useState } from "react";

interface ToolStatusProps {
  tool: string;
  startTime: number;
  isRunning: boolean;
  hasError?: boolean; // Add error state support
  errorMessage?: string; // Optional error details
}

const ToolStatusIndicator: React.FC<ToolStatusProps> = ({
  tool,
  startTime,
  isRunning,
  hasError = false,
  errorMessage,
}) => {
  const [elapsed, setElapsed] = useState<number>(0);
  const [visible, setVisible] = useState<boolean>(true);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isRunning) {
      // Update elapsed time every second
      intervalId = setInterval(() => {
        const newElapsed = Math.floor((Date.now() - startTime) / 1000);
        setElapsed(newElapsed);
      }, 1000);
    } else {
      // Final elapsed time when tool completes
      setElapsed(Math.floor((Date.now() - startTime) / 1000));

      // Auto hide after showing completion or error
      const timeoutId = setTimeout(
        () => {
          setVisible(false);
        },
        hasError ? 5000 : 2000,
      ); // Keep error messages visible longer

      return () => clearTimeout(timeoutId);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isRunning, startTime, hasError]);

  if (!visible) return null;

  // Determine display style based on status
  const getStatusStyles = () => {
    if (isRunning) {
      // Use neutral gray for running state
      return "animate-fadeIn bg-gray-100 dark:bg-gray-700";
    } else if (hasError) {
      return "animate-fadeIn bg-red-50 dark:bg-red-900/20";
    } else {
      return "animate-fadeOut bg-green-50 dark:bg-green-900/20";
    }
  };

  return (
    <div
      className={`flex items-center p-2 mx-4 my-2 rounded-md text-sm ${getStatusStyles()}`}
    >
      {isRunning ? (
        <>
          {/* Update icon and text color for running state */}
          <Cpu size={16} className="text-gray-500 animate-pulse mr-2" />
          <span className="text-gray-700 dark:text-gray-300">
            Running: {tool} ({elapsed}s)
          </span>
        </>
      ) : hasError ? (
        <>
          <AlertCircle size={16} className="text-red-500 mr-2" />
          <span className="text-red-700 dark:text-red-300">
            Error: {tool} ({elapsed}s)
            {errorMessage && (
              <span className="block text-xs mt-1">{errorMessage}</span>
            )}
          </span>
        </>
      ) : (
        <>
          <CheckCircle size={16} className="text-green-500 mr-2" />
          <span className="text-green-700 dark:text-green-300">
            Completed: {tool} ({elapsed}s)
          </span>
        </>
      )}
    </div>
  );
};

export default ToolStatusIndicator;
