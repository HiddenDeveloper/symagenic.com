import { describe, it, expect } from 'vitest';
import type { 
  Message, 
  MessagePart, 
  ContentBlock, 
  ToolCall, 
  MessageValidationResult,
  AgentConfig,
  ToolDefinition 
} from './index.js';
import { MessageShape } from './index.js';

describe('Shared Types', () => {
  describe('Message Interface', () => {
    it('should create a valid message with string content', () => {
      const message: Message = {
        role: 'user',
        content: 'Hello, world!'
      };

      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello, world!');
    });

    it('should create a valid message with array content', () => {
      const contentBlock: ContentBlock = {
        type: 'text',
        text: 'Hello from array content'
      };

      const message: Message = {
        role: 'assistant',
        content: [contentBlock]
      };

      expect(message.role).toBe('assistant');
      expect(Array.isArray(message.content)).toBe(true);
      expect((message.content as ContentBlock[])[0].text).toBe('Hello from array content');
    });

    it('should create a valid message with parts', () => {
      const part: MessagePart = {
        text: 'Text part',
        type: 'text'
      };

      const message: Message = {
        role: 'user',
        parts: [part]
      };

      expect(message.parts).toHaveLength(1);
      expect(message.parts?.[0].text).toBe('Text part');
    });

    it('should create a valid message with tool calls', () => {
      const toolCall: ToolCall = {
        id: 'call_123',
        type: 'function',
        function: {
          name: 'test_function',
          arguments: '{"param": "value"}'
        }
      };

      const message: Message = {
        role: 'assistant',
        content: 'Calling a function',
        tool_calls: [toolCall]
      };

      expect(message.tool_calls).toHaveLength(1);
      expect(message.tool_calls?.[0].function?.name).toBe('test_function');
    });
  });

  describe('MessageShape Enum', () => {
    it('should have correct string values', () => {
      expect(MessageShape.STRING_CONTENT).toBe('string_content');
      expect(MessageShape.ARRAY_CONTENT).toBe('array_content');
      expect(MessageShape.PARTS_ARRAY).toBe('parts_array');
      expect(MessageShape.TOOL_CALLS).toBe('tool_calls');
      expect(MessageShape.UNKNOWN).toBe('unknown');
    });
  });

  describe('AgentConfig Interface', () => {
    it('should create a valid agent configuration', () => {
      const config: AgentConfig = {
        agent_name: 'test_agent',
        service_provider: 'OPENAI',
        model_name: 'gpt-4',
        description: 'Test agent',
        system_prompt: 'You are a helpful assistant',
        do_stream: true,
        available_functions: ['function1', 'function2']
      };

      expect(config.agent_name).toBe('test_agent');
      expect(config.service_provider).toBe('OPENAI');
      expect(config.do_stream).toBe(true);
      expect(config.available_functions).toHaveLength(2);
    });
  });

  describe('ToolDefinition Interface', () => {
    it('should create a valid tool definition', () => {
      const tool: ToolDefinition = {
        name: 'test_tool',
        description: 'A test tool',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          }
        },
        enabled: true
      };

      expect(tool.name).toBe('test_tool');
      expect(tool.enabled).toBe(true);
      expect(tool.parameters.type).toBe('object');
    });
  });

  describe('MessageValidationResult Interface', () => {
    it('should create a valid validation result', () => {
      const result: MessageValidationResult = {
        isValid: true,
        errors: [],
        warnings: ['Minor formatting issue'],
        detectedShape: MessageShape.STRING_CONTENT
      };

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.detectedShape).toBe(MessageShape.STRING_CONTENT);
    });
  });
});