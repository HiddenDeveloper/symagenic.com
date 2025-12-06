/**
 * Get Time tool for Ailumina Bridge system
 */

import type { GetTimeParams, AiluminaToolResponse } from '../types.js';
import { getCurrentTimestamp } from '../utils/ailumina-utils.js';
import { handleError } from '../utils/errors.js';

export class GetTimeTool {
  async execute(params: GetTimeParams): Promise<AiluminaToolResponse> {
    try {
      const { format = 'iso' } = params;
      const now = new Date();
      let timeValue: string | number;
      
      switch (format) {
        case 'timestamp':
          timeValue = now.getTime();
          break;
        case 'human':
          timeValue = now.toLocaleString();
          break;
        default:
          timeValue = now.toISOString();
      }
      
      const result = {
        time: timeValue,
        format,
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
      return handleError(error, "get_time");
    }
  }
}