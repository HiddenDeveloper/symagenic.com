/**
 * Ailumina Chat tool for Ailumina Bridge system
 */

import type { AiluminaChatParams, AiluminaToolResponse } from '../types.js';
import { getCurrentTimestamp } from '../utils/ailumina-utils.js';
import { executeAiluminaChat } from '../utils/websocket-client.js';
import { handleError } from '../utils/errors.js';

export class AiluminaChatTool {
  async execute(params: AiluminaChatParams): Promise<AiluminaToolResponse> {
    try {
      const { agent_type, user_input, chat_messages = [], fileId, server_url } = params;
      
      // Validate required parameters
      if (!agent_type || !user_input) {
        throw new Error('Missing required parameters: agent_type and user_input');
      }

      // No agent_type validation - allow communication with any configured agent

      const options = server_url ? { serverUrl: server_url } : undefined;
      const response = await executeAiluminaChat(
        agent_type,
        user_input,
        chat_messages,
        fileId,
        options
      );
      
      const result = {
        agent_type,
        user_input,
        response,
        timestamp: getCurrentTimestamp()
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return handleError(error, "ailumina_chat");
    }
  }
}