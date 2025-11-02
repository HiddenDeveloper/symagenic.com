import { AgentConfig, ToolRegistry } from '../types/index.js';
import { OpenAICompatibleProvider } from './openai-compatible-provider.js';
import { SERVICE_PROVIDERS } from '../constants/message-constants.js';

export class GroqProvider extends OpenAICompatibleProvider {
  constructor(agentConfig: AgentConfig, toolRegistry?: ToolRegistry) {
    super(
      agentConfig,
      SERVICE_PROVIDERS.GROQ,
      {
        apiKey: process.env.GROQ_API_KEY || '',
        baseUrl: 'https://api.groq.com/openai/v1',
        timeout: 30000,
        maxTokens: 4096,
      },
      toolRegistry
    );
  }

  /**
   * Override to provide Groq-specific max tokens
   */
  protected getMaxTokens(): number {
    return 4096;
  }
}
