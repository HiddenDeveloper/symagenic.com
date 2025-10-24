import fs from 'fs';
import { TRANSPORT_TYPES } from '../constants/message-constants.js';
import winston from 'winston';
import {
  validateServerConfigFile,
  type ServerConfigFile,
} from '../schemas/server-config-schema.js';

/**
 * MCP Server Configuration Interface
 */
export interface ServerConfig {
  transport_type: typeof TRANSPORT_TYPES.STDIO | typeof TRANSPORT_TYPES.HTTP;
  url?: string; // For HTTP transport
  command?: string; // For STDIO transport
  args?: string[]; // For STDIO transport
  env?: Record<string, string>;
  auth_token?: string; // For HTTP transport
}

/**
 * Load server configurations and replace placeholders with environment variables
 */
function loadServerConfigSecrets(config: unknown): unknown {
  const placeholderPattern = /^<(.+)>$/;

  if (typeof config === 'object' && config !== null) {
    if (Array.isArray(config)) {
      return config.map((item) => loadServerConfigSecrets(item));
    } else {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(config)) {
        result[key] = loadServerConfigSecrets(value);
      }
      return result;
    }
  } else if (typeof config === 'string') {
    const match = placeholderPattern.exec(config);
    if (match) {
      const envVar = match[1]; // Extract placeholder name
      return process.env[envVar] || `<${envVar}_NOT_SET>`; // Default if env variable not found
    }
  }

  return config;
}

/**
 * Load server configurations with resilient error handling
 */
export function loadServerConfigs(
  logger: winston.Logger,
  configPath: string
): Record<string, ServerConfig> {
  const serverConfigs: Record<string, ServerConfig> = {};

  try {
    const rawConfigData: unknown = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    // Process config secrets (environment variable substitution)
    const processedConfig = loadServerConfigSecrets(rawConfigData);

    // Validate configuration with Zod schema
    let validatedConfig: ServerConfigFile;
    try {
      logger.debug('About to validate server configuration...');
      validatedConfig = validateServerConfigFile(processedConfig);
      logger.info(`✅ Server configuration validated successfully`);
      logger.debug('Validated config:', JSON.stringify(validatedConfig, null, 2));
    } catch (validationError: unknown) {
      const errorMessage =
        validationError instanceof Error ? validationError.message : 'Unknown validation error';
      logger.error(`❌ Server configuration validation failed:`);
      logger.error(errorMessage);
      if (validationError && typeof validationError === 'object' && 'errors' in validationError) {
        logger.error('Validation errors:', (validationError as { errors: unknown }).errors);
      }
      // Make sure this error is properly propagated to stop server startup
      const error = new Error(`Invalid server configuration: ${errorMessage}`);
      throw error;
    }

    const { mcpServers } = validatedConfig;
    if (!mcpServers || Object.keys(mcpServers).length === 0) {
      logger.warn('No "mcpServers" section found in config');
      return serverConfigs;
    }

    // Process each server config individually
    for (const [serverName, serverInfo] of Object.entries(mcpServers)) {
      try {
        // serverInfo is already validated by Zod schema, so we can use it directly
        serverConfigs[serverName] = {
          transport_type: serverInfo.transport_type,
          url: serverInfo.transport_type === TRANSPORT_TYPES.HTTP ? serverInfo.url : undefined,
          command:
            serverInfo.transport_type === TRANSPORT_TYPES.STDIO ? serverInfo.command : undefined,
          args:
            serverInfo.transport_type === TRANSPORT_TYPES.STDIO ? serverInfo.args || [] : undefined,
          env: serverInfo.transport_type === TRANSPORT_TYPES.STDIO ? serverInfo.env : undefined,
          auth_token:
            serverInfo.transport_type === TRANSPORT_TYPES.HTTP ? serverInfo.auth_token : undefined,
        };

        logger.debug(`Loaded config for ${serverName} (${serverInfo.transport_type})`);
      } catch (error) {
        logger.error(`Error parsing config for ${serverName}:`, error);
        // Continue processing other servers
        continue;
      }
    }

    logger.info(
      `Loaded ${Object.keys(serverConfigs).length} server configurations from ${configPath}`
    );
    return serverConfigs;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      logger.warn(`Config file not found: ${configPath}. Using empty configuration.`);
      return serverConfigs;
    } else if (error instanceof SyntaxError) {
      logger.error(`Invalid JSON in config file ${configPath}:`, error.message);
      throw error; // Propagate JSON syntax errors
    } else {
      logger.error(`Error reading config file ${configPath}:`, error);
      throw error; // Propagate validation and other errors
    }
  }
}
