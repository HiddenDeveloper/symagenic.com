import { AgentConfig, ToolRegistry } from '../types/index.js';
import { OpenAICompatibleProvider } from './openai-compatible-provider.js';
import { SERVICE_PROVIDERS } from '../constants/message-constants.js';

export class LMStudioProvider extends OpenAICompatibleProvider {
  constructor(agentConfig: AgentConfig, toolRegistry?: ToolRegistry) {
    super(
      agentConfig,
      SERVICE_PROVIDERS.LMSTUDIO,
      {
        apiKey: 'lmstudio', // LMStudio doesn't require an API key, but the OpenAI client needs a value
        baseUrl: process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1',
        timeout: 60000, // 60 seconds timeout for local models
        maxTokens: 4096,
        debugMode: true, // Enable debug logging for LMStudio
      },
      toolRegistry
    );
  }

  /**
   * Override to provide LMStudio-specific max tokens
   */
  protected getMaxTokens(): number {
    return 4096;
  }
}
