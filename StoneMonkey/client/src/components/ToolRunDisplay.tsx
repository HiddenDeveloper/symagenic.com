import React from "react";

interface ToolRun {
  name: string;
  input?: any;
  output?: any;
  startTime?: number;
  endTime?: number;
  error?: string;
}

interface ToolRunDisplayProps {
  toolRun: ToolRun;
}

const ToolRunDisplay: React.FC<ToolRunDisplayProps> = ({ toolRun }) => {
  const { name, input, output, error } = toolRun;

  // Calculate duration if startTime and endTime exist
  const duration =
    toolRun.startTime && toolRun.endTime
      ? ((toolRun.endTime - toolRun.startTime) / 1000).toFixed(2)
      : null;

  return (
    <div className="text-sm border border-gray-300 dark:border-gray-600 rounded-md p-2 my-1">
      <div className="font-semibold flex justify-between items-center">
        <span>{name}</span>
        {duration && <span className="text-xs text-gray-500">{duration}s</span>}
      </div>

      {input && (
        <div className="mt-1">
          <div className="text-xs text-gray-500">Input:</div>
          <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-1 rounded overflow-x-auto">
            {typeof input === "object"
              ? JSON.stringify(input, null, 2)
              : input.toString()}
          </pre>
        </div>
      )}

      {output && !error && (
        <div className="mt-1">
          <div className="text-xs text-gray-500">Output:</div>
          <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-1 rounded overflow-x-auto">
            {typeof output === "object"
              ? JSON.stringify(output, null, 2)
              : output.toString()}
          </pre>
        </div>
      )}

      {error && (
        <div className="mt-1">
          <div className="text-xs text-red-500">Error:</div>
          <pre className="text-xs bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 p-1 rounded overflow-x-auto">
            {error}
          </pre>
        </div>
      )}
    </div>
  );
};

export default ToolRunDisplay;
