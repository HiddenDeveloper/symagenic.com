import { AgentConfig, Message, ServiceProvider } from '../types/index.js';
import { SERVICE_PROVIDERS } from '../constants/message-constants.js';
import { OpenAIProvider } from '../services/openai-provider.js';
import { AnthropicProvider } from '../services/anthropic-provider.js';
import { GoogleProvider } from '../services/google-provider.js';
import { GroqProvider } from '../services/groq-provider.js';
import { OllamaProvider } from '../services/ollama-provider.js';
import { LMStudioProvider } from '../services/lmstudio-provider.js';

export class BaseAgent {
  private config: AgentConfig;
  private provider: ServiceProvider | null = null;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  initialize(): void {
    // Initialize the appropriate service provider
    switch (this.config.service_provider) {
      case SERVICE_PROVIDERS.OPENAI:
        this.provider = new OpenAIProvider(this.config);
        break;
      case SERVICE_PROVIDERS.ANTHROPIC:
        this.provider = new AnthropicProvider(this.config);
        break;
      case SERVICE_PROVIDERS.GOOGLE:
        this.provider = new GoogleProvider(this.config);
        break;
      case SERVICE_PROVIDERS.GROQ:
        this.provider = new GroqProvider(this.config);
        break;
      case SERVICE_PROVIDERS.OLLAMA:
        this.provider = new OllamaProvider(this.config);
        break;
      case SERVICE_PROVIDERS.LMSTUDIO:
        this.provider = new LMStudioProvider(this.config);
        break;
      default:
        throw new Error(`Unsupported provider: ${String(this.config.service_provider)}`);
    }
  }

  async processMessage(messages: Message[], userInput: string): Promise<unknown> {
    if (!this.provider) {
      throw new Error('Agent not initialized');
    }

    return this.provider.makeApiCall(messages, userInput);
  }

  getConfig(): AgentConfig {
    return this.config;
  }

  getType(): string {
    return this.config.agent_name;
  }

  getName(): string {
    return this.config.agent_name;
  }
}
