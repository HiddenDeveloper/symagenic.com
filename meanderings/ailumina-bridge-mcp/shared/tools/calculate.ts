/**
 * Calculate tool for Ailumina Bridge system
 */

import type { CalculateParams, AiluminaToolResponse } from '../types.js';
import { getCurrentTimestamp } from '../utils/ailumina-utils.js';
import { handleError } from '../utils/errors.js';

export class CalculateTool {
  async execute(params: CalculateParams): Promise<AiluminaToolResponse> {
    try {
      const { expression } = params;
      
      // Simple math evaluation (safe for basic expressions)
      const result = this.evaluateExpression(expression);
      
      const response = {
        expression,
        result,
        timestamp: getCurrentTimestamp()
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    } catch (error) {
      return handleError(error, "calculate");
    }
  }

  private evaluateExpression(expression: string): number {
    // Simple safe math evaluation for basic expressions
    // Only allow numbers, operators, and whitespace
    const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
    
    if (sanitized !== expression) {
      throw new Error('Invalid characters in expression');
    }
    
    try {
      // Use Function constructor for safer evaluation than eval
      return new Function(`"use strict"; return (${sanitized})`)();
    } catch (error) {
      throw new Error('Invalid mathematical expression');
    }
  }
}