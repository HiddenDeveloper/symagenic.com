import { describe, it, expect } from 'vitest';
import {
  normalizeMessageContent,
  messageHasText,
  detectAIProvider,
  shouldDisplayMessage,
  hasToolContent,
  extractToolCalls,
  createNormalizedMessage,
  validateMessage,
  normalizeServiceProvider
} from './index.js';
import type { Message, ContentBlock, MessagePart, ToolCall } from '../types/index.js';

describe('Shared Utils', () => {
  describe('normalizeMessageContent', () => {
    it('should handle string content', () => {
      const message: Message = {
        role: 'user',
        content: 'Hello, world!'
      };

      expect(normalizeMessageContent(message)).toBe('Hello, world!');
    });

    it('should handle array content with text blocks', () => {
      const contentBlocks: ContentBlock[] = [
        { type: 'text', text: 'Hello' },
        { type: 'text', text: 'world' }
      ];

      const message: Message = {
        role: 'user',
        content: contentBlocks
      };

      expect(normalizeMessageContent(message)).toBe('Hello world');
    });

    it('should handle parts array (Gemini format)', () => {
      const parts: MessagePart[] = [
        { text: 'Hello' },
        { text: 'from' },
        { text: 'Gemini' }
      ];

      const message: Message = {
        role: 'user',
        parts
      };

      expect(normalizeMessageContent(message)).toBe('Hello from Gemini');
    });

    it('should filter out non-text blocks', () => {
      const contentBlocks: ContentBlock[] = [
        { type: 'text', text: 'Hello' },
        { type: 'tool_use', name: 'some_tool' },
        { type: 'text', text: 'world' }
      ];

      const message: Message = {
        role: 'user',
        content: contentBlocks
      };

      expect(normalizeMessageContent(message)).toBe('Hello world');
    });

    it('should return empty string for empty message', () => {
      const message: Message = {
        role: 'user'
      };

      expect(normalizeMessageContent(message)).toBe('');
    });
  });

  describe('messageHasText', () => {
    it('should return true for message with text', () => {
      const message: Message = {
        role: 'user',
        content: 'Hello!'
      };

      expect(messageHasText(message)).toBe(true);
    });

    it('should return false for empty message', () => {
      const message: Message = {
        role: 'user',
        content: ''
      };

      expect(messageHasText(message)).toBe(false);
    });

    it('should return false for whitespace-only message', () => {
      const message: Message = {
        role: 'user',
        content: '   \n\t  '
      };

      expect(messageHasText(message)).toBe(false);
    });
  });

  describe('detectAIProvider', () => {
    it('should detect Gemini format (parts array)', () => {
      const message: Message = {
        role: 'user',
        parts: [{ text: 'Hello' }]
      };

      expect(detectAIProvider(message)).toBe('gemini');
    });

    it('should detect Anthropic format (array content)', () => {
      const message: Message = {
        role: 'user',
        content: [{ type: 'text', text: 'Hello' }]
      };

      expect(detectAIProvider(message)).toBe('anthropic');
    });

    it('should detect OpenAI format (string content)', () => {
      const message: Message = {
        role: 'user',
        content: 'Hello'
      };

      expect(detectAIProvider(message)).toBe('openai');
    });

    it('should detect OpenAI format (tool calls)', () => {
      const toolCall: ToolCall = {
        id: 'call_123',
        type: 'function',
        function: { name: 'test', arguments: '{}' }
      };

      const message: Message = {
        role: 'assistant',
        tool_calls: [toolCall]
      };

      expect(detectAIProvider(message)).toBe('openai');
    });

    it('should return unknown for unrecognized format', () => {
      const message: Message = {
        role: 'user'
      };

      expect(detectAIProvider(message)).toBe('unknown');
    });
  });

  describe('hasToolContent', () => {
    it('should detect OpenAI tool calls', () => {
      const message: Message = {
        role: 'assistant',
        content: 'Using a tool',
        tool_calls: [{ 
          id: 'call_123', 
          type: 'function',
          function: { name: 'test', arguments: '{}' }
        }]
      };

      expect(hasToolContent(message)).toBe(true);
    });

    it('should detect Anthropic tool use blocks', () => {
      const message: Message = {
        role: 'assistant',
        content: [{ type: 'tool_use', name: 'test_tool', input: {} }]
      };

      expect(hasToolContent(message)).toBe(true);
    });

    it('should detect Gemini function calls', () => {
      const message: Message = {
        role: 'assistant',
        parts: [{ 
          functionCall: { 
            name: 'test_function', 
            args: {} 
          } 
        }]
      };

      expect(hasToolContent(message)).toBe(true);
    });

    it('should return false for messages without tool content', () => {
      const message: Message = {
        role: 'user',
        content: 'Just text'
      };

      expect(hasToolContent(message)).toBe(false);
    });
  });

  describe('extractToolCalls', () => {
    it('should extract OpenAI tool calls', () => {
      const message: Message = {
        role: 'assistant',
        tool_calls: [{
          id: 'call_123',
          type: 'function',
          function: {
            name: 'test_function',
            arguments: '{"param": "value"}'
          }
        }]
      };

      const extracted = extractToolCalls(message);
      expect(extracted).toHaveLength(1);
      expect(extracted[0].name).toBe('test_function');
      expect(extracted[0].id).toBe('call_123');
    });

    it('should extract Anthropic tool calls', () => {
      const message: Message = {
        role: 'assistant',
        content: [{
          type: 'tool_use',
          tool_use_id: 'tool_123',
          name: 'test_function',
          input: { param: 'value' }
        }]
      };

      const extracted = extractToolCalls(message);
      expect(extracted).toHaveLength(1);
      expect(extracted[0].name).toBe('test_function');
      expect(extracted[0].id).toBe('tool_123');
    });

    it('should return empty array for messages without tool calls', () => {
      const message: Message = {
        role: 'user',
        content: 'No tools here'
      };

      expect(extractToolCalls(message)).toHaveLength(0);
    });
  });

  describe('createNormalizedMessage', () => {
    it('should create a basic message', () => {
      const message = createNormalizedMessage('user', 'Hello');
      
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello');
      expect(message.id).toBeDefined();
      expect(message.timestamp).toBeDefined();
    });

    it('should accept optional parameters', () => {
      const options = {
        id: 'custom_id',
        timestamp: '2023-01-01T00:00:00Z',
        tool_call_id: 'tool_123'
      };

      const message = createNormalizedMessage('assistant', 'Response', options);
      
      expect(message.id).toBe('custom_id');
      expect(message.timestamp).toBe('2023-01-01T00:00:00Z');
      expect(message.tool_call_id).toBe('tool_123');
    });
  });

  describe('validateMessage', () => {
    it('should validate a correct message', () => {
      const message: Message = {
        role: 'user',
        content: 'Hello'
      };

      const result = validateMessage(message);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should catch missing role', () => {
      const message = {
        content: 'Hello'
      } as Message;

      const result = validateMessage(message);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Message must have a role');
    });

    it('should catch missing content', () => {
      const message: Message = {
        role: 'user'
      };

      const result = validateMessage(message);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Message must have content, parts, or tool_calls');
    });

    it('should validate tool calls', () => {
      const message: Message = {
        role: 'assistant',
        content: 'Using tool',
        tool_calls: [{ 
          id: 'call_123',
          function: {} as any // Missing name
        }]
      };

      const result = validateMessage(message);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Tool call must have function.name');
    });
  });

  describe('normalizeServiceProvider', () => {
    it('should normalize valid providers', () => {
      expect(normalizeServiceProvider('openai')).toBe('OPENAI');
      expect(normalizeServiceProvider('anthropic')).toBe('ANTHROPIC');
      expect(normalizeServiceProvider('google')).toBe('GOOGLE');
    });

    it('should return UNKNOWN for invalid providers', () => {
      expect(normalizeServiceProvider('invalid')).toBe('UNKNOWN');
      expect(normalizeServiceProvider('')).toBe('UNKNOWN');
    });

    it('should handle case insensitive input', () => {
      expect(normalizeServiceProvider('OpenAI')).toBe('OPENAI');
      expect(normalizeServiceProvider('ANTHROPIC')).toBe('ANTHROPIC');
    });
  });
});