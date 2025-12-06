/**
 * Resource registry and exports
 */

import { Resource, ResourceHandler } from "../types.js";
import { 
  serverStatusResourceDefinition, 
  createServerStatusResource 
} from "./server-status.js";
import { 
  serverInfoResourceDefinition, 
  createServerInfoResource 
} from "./server-info.js";

/**
 * Registry of all available resources
 */
export const resourceDefinitions: Resource[] = [
  serverStatusResourceDefinition,
  serverInfoResourceDefinition,
];

/**
 * Create resource handler with server context
 */
export function createResourceHandlers(
  startTime: number,
  getRequestCount: () => number
): Record<string, ResourceHandler> {
  return {
    "server://status": () => createServerStatusResource(startTime, getRequestCount()),
    "server://info": () => createServerInfoResource(),
  };
}

/**
 * Execute a resource request by URI
 */
export async function getResource(
  uri: string,
  handlers: Record<string, ResourceHandler>
) {
  const handler = handlers[uri];
  if (!handler) {
    throw new Error(`Resource not found: ${uri}`);
  }
  
  return await handler(uri);
}

/**
 * Get resource definition by URI
 */
export function getResourceDefinition(uri: string): Resource | undefined {
  return resourceDefinitions.find(resource => resource.uri === uri);
}

/**
 * Re-export individual resources for direct import
 */
export {
  serverStatusResourceDefinition,
  createServerStatusResource,
  serverInfoResourceDefinition,
  createServerInfoResource,
};