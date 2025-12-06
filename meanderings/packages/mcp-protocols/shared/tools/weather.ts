/**
 * Weather tool implementation (simulated data)
 */

import { ToolResult, WeatherArgs } from "../types.js";
import { validateArgs, WeatherArgsSchema } from "../utils/validation.js";

export const weatherToolDefinition = {
  name: "get_weather",
  description: "Get weather information for a location (simulated data)",
  inputSchema: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description: "The location to get weather for (city, country)",
      },
      units: {
        type: "string",
        enum: ["celsius", "fahrenheit"],
        description: "Temperature units (default: celsius)",
      },
    },
    required: ["location"],
  },
};

export function executeWeatherTool(args: unknown): ToolResult {
  const { location, units } = validateArgs(WeatherArgsSchema, args);
  
  const tempUnit = units === "fahrenheit" ? "°F" : "°C";
  
  // Simulate weather data
  const temp = units === "fahrenheit" ?
    Math.floor(Math.random() * 40) + 50 : // 50-90°F
    Math.floor(Math.random() * 25) + 10;  // 10-35°C
  
  const conditions = ["Sunny", "Cloudy", "Partly Cloudy", "Rainy", "Overcast"];
  const condition = conditions[Math.floor(Math.random() * conditions.length)];
  
  const humidity = Math.floor(Math.random() * 40) + 30; // 30-70%
  
  const weatherText = `Weather in ${location}:
Temperature: ${temp}${tempUnit}
Conditions: ${condition}
Humidity: ${humidity}%
(Note: This is simulated weather data for demonstration)`;
  
  return {
    content: [
      {
        type: "text",
        text: weatherText,
      },
    ],
  };
}