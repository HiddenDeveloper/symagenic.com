import { AgentConfig, ToolRegistry } from '../types/index.js';
import { OpenAICompatibleProvider } from './openai-compatible-provider.js';
import { SERVICE_PROVIDERS } from '../constants/message-constants.js';

export class OllamaProvider extends OpenAICompatibleProvider {
  constructor(agentConfig: AgentConfig, toolRegistry?: ToolRegistry) {
    super(
      agentConfig,
      SERVICE_PROVIDERS.OLLAMA,
      {
        apiKey: 'ollama', // Ollama doesn't require an API key, but the OpenAI client needs a value
        baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
        timeout: 240000, // 240 seconds (4 minutes) timeout - for deep philosophical reasoning
        // Omitting maxTokens as Ollama handles this differently
      },
      toolRegistry
    );
  }

  /**
   * Override to return undefined for max tokens
   * Ollama handles token limits differently
   */
  protected getMaxTokens(): number | undefined {
    return undefined;
  }
}
