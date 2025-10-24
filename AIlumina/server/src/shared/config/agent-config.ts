import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { AgentConfig, AgentConfigCollection } from '../types/index.js';
import { validateAgentsFile, REQUIRED_AGENTS } from '../schemas/agents-schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class AgentConfigManager {
  private static instance: AgentConfigManager;
  private agentConfigs: AgentConfigCollection = {};
  private configPath: string;

  private constructor(configPath?: string) {
    this.configPath = configPath || this.findAgentsJsonPath();
    this.loadConfigurations();
  }

  static getInstance(configPath?: string): AgentConfigManager {
    if (!AgentConfigManager.instance) {
      AgentConfigManager.instance = new AgentConfigManager(configPath);
    }
    return AgentConfigManager.instance;
  }

  private findAgentsJsonPath(): string {
    // Try different possible locations
    const possiblePaths = [
      resolve(process.cwd(), 'agents.json'),
      resolve(process.cwd(), 'src/config/agents.json'),
      resolve(__dirname, '../../../config/agents.json'),
    ];

    for (const path of possiblePaths) {
      try {
        readFileSync(path, 'utf8');
        return path;
      } catch {
        // Continue to next path
      }
    }

    throw new Error('agents.json file not found. Checked paths: ' + possiblePaths.join(', '));
  }

  private loadConfigurations(): void {
    try {
      const configData = readFileSync(this.configPath, 'utf8');
      const rawConfigs = JSON.parse(configData) as unknown;

      // Transform configs to match AgentConfig interface (key -> agent_name)
      const transformedConfigs: Record<string, unknown> = {};
      if (rawConfigs && typeof rawConfigs === 'object' && !Array.isArray(rawConfigs)) {
        for (const [agentName, config] of Object.entries(rawConfigs)) {
          if (config && typeof config === 'object') {
            const configObj = config as Record<string, unknown>;
            transformedConfigs[agentName] = {
              ...configObj,
              agent_name: configObj.agent_name || agentName, // Use key if present, fallback to agentName
            };
          }
        }
      }

      // Validate entire agents file with Zod schema
      try {
        const validatedConfigs = validateAgentsFile(transformedConfigs);
        console.info(`✅ Agents configuration validated successfully`);
        console.info(
          `✅ All required agents are present: ${REQUIRED_AGENTS.filter((name) => name in validatedConfigs).join(', ')}`
        );

        // Store validated configurations
        this.agentConfigs = validatedConfigs;
      } catch (validationError: unknown) {
        const errorMessage =
          validationError instanceof Error ? validationError.message : 'Unknown validation error';
        console.error(`❌ Agents configuration validation failed:`, errorMessage);
        if (validationError && typeof validationError === 'object' && 'errors' in validationError) {
          console.error('Validation errors:', (validationError as { errors: unknown }).errors);
        }
        throw new Error(`Invalid agents configuration: ${errorMessage}`);
      }

      console.log(
        `Loaded ${Object.keys(this.agentConfigs).length} agent configurations from ${this.configPath}`
      );
    } catch (error: unknown) {
      let message = 'Unknown error';
      if (error instanceof Error) {
        message = error.message;
      }
      console.error('Error loading agent configurations:', message);
      throw new Error(`Failed to load agent configurations from ${this.configPath}: ${message}`);
    }
  }

  getAgentConfig(agentName: string): AgentConfig | null {
    return this.agentConfigs[agentName] || null;
  }

  getAllAgentConfigs(): AgentConfigCollection {
    return { ...this.agentConfigs };
  }

  getAgentNames(): string[] {
    return Object.keys(this.agentConfigs);
  }

  hasAgent(agentName: string): boolean {
    return agentName in this.agentConfigs;
  }

  getAgentsByProvider(provider: string): Record<string, AgentConfig> {
    const filteredAgents: Record<string, AgentConfig> = {};

    for (const [name, config] of Object.entries(this.agentConfigs)) {
      if (config.service_provider === provider) {
        filteredAgents[name] = config;
      }
    }

    return filteredAgents;
  }

  reload(): void {
    this.agentConfigs = {};
    this.loadConfigurations();
  }

  getConfigFilePath(): string {
    return this.configPath;
  }
}
