import { AgentConfig, ToolRegistry } from '../types/index.js';
import { OpenAICompatibleProvider } from './openai-compatible-provider.js';
import { SERVICE_PROVIDERS } from '../constants/message-constants.js';

export class OpenAIProvider extends OpenAICompatibleProvider {
  constructor(agentConfig: AgentConfig, toolRegistry?: ToolRegistry) {
    super(
      agentConfig,
      SERVICE_PROVIDERS.OPENAI,
      {
        apiKey: process.env.OPENAI_API_KEY || '',
        baseUrl: undefined, // Use default OpenAI URL
        timeout: 30000,
        // maxTokens: 4096,
      },
      toolRegistry
    );
  }

  /**
   * Override to provide OpenAI-specific max tokens
   */
  protected getMaxTokens(): number {
    return 4096;
  }
}
