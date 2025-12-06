/**
 * Echo tool for Ailumina Bridge system
 */

import type { EchoParams, AiluminaToolResponse } from '../types.js';
import { getCurrentTimestamp } from '../utils/ailumina-utils.js';
import { handleError } from '../utils/errors.js';

export class EchoTool {
  async execute(params: EchoParams): Promise<AiluminaToolResponse> {
    try {
      const { text } = params;
      
      const result = {
        echo: text,
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
      return handleError(error, "echo");
    }
  }
}