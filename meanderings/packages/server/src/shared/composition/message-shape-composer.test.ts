import { describe, it, expect } from 'vitest';
import { MessageShapeComposer } from './message-shape-composer.js';
import { MessageShape, ContentBlock } from '../types/message-types.js';
import { MESSAGE_ROLES, PART_TYPES } from '../constants/message-constants.js';

describe('MessageShapeComposer', () => {
  const composer = new MessageShapeComposer();

  describe('detectShape', () => {
    it('should detect STRING_CONTENT shape for string content', () => {
      const message = {
        role: MESSAGE_ROLES.USER,
        content: 'Hello world',
      };

      const detection = composer.detectShape(message);

      expect(detection.shape).toBe(MessageShape.STRING_CONTENT);
      expect(detection.confidence).toBe(1.0);
      expect(detection.metadata?.length).toBe(11);
    });

    it('should detect ARRAY_CONTENT shape for Anthropic-style content blocks', () => {
      const message = {
        role: MESSAGE_ROLES.ASSISTANT,
        content: [
          { type: PART_TYPES.TEXT, text: 'Hello' },
          { type: PART_TYPES.TOOL_USE, id: '123', name: 'test_tool', input: {} },
        ],
      };

      const detection = composer.detectShape(message);

      expect(detection.shape).toBe(MessageShape.ARRAY_CONTENT);
      expect(detection.confidence).toBe(1.0);
      expect(detection.metadata?.blockCount).toBe(2);
      expect(detection.metadata?.blockTypes).toEqual([PART_TYPES.TEXT, PART_TYPES.TOOL_USE]);
      expect(detection.metadata?.hasText).toBe(true);
      expect(detection.metadata?.hasToolUse).toBe(true);
    });

    it('should detect PARTS_ARRAY shape for Google-style parts', () => {
      const message = {
        role: MESSAGE_ROLES.USER,
        parts: [{ text: 'Hello' }, { functionCall: { name: 'test_function', args: {} } }],
      };

      const detection = composer.detectShape(message);

      expect(detection.shape).toBe(MessageShape.PARTS_ARRAY);
      expect(detection.confidence).toBe(1.0);
      expect(detection.metadata?.partCount).toBe(2);
      expect(detection.metadata?.hasText).toBe(true);
      expect(detection.metadata?.hasFunctionCall).toBe(true);
    });

    it('should detect TOOL_CALLS shape for OpenAI-style tool calls', () => {
      const message = {
        role: MESSAGE_ROLES.ASSISTANT,
        content: 'I will call a tool',
        tool_calls: [
          {
            id: 'call_123',
            type: 'function' as const,
            function: {
              name: 'test_tool',
              arguments: '{"param": "value"}',
            },
          },
        ],
      };

      const detection = composer.detectShape(message);

      expect(detection.shape).toBe(MessageShape.TOOL_CALLS);
      expect(detection.confidence).toBe(1.0);
      expect(detection.metadata?.callCount).toBe(1);
      expect(detection.metadata?.toolNames).toEqual(['test_tool']);
      expect(detection.metadata?.hasContent).toBe(true);
    });
  });

  describe('compose', () => {
    it('should compose string content message correctly', () => {
      const message = {
        role: MESSAGE_ROLES.USER,
        content: 'Test message',
      };

      const composed = composer.compose(message);

      expect(composed.role).toBe(MESSAGE_ROLES.USER);
      expect(composed.content).toBe('Test message');
      expect(composed._compositionType).toBe(MessageShape.STRING_CONTENT);
    });

    it('should compose Anthropic content blocks correctly', () => {
      const message = {
        role: MESSAGE_ROLES.ASSISTANT,
        content: [
          { type: PART_TYPES.TEXT, text: 'Hello' },
          { type: 'tool_use', id: '123', name: 'test_tool', input: { param: 'value' } },
        ],
      };

      const composed = composer.compose(message);

      expect(composed.role).toBe(MESSAGE_ROLES.ASSISTANT);
      expect(Array.isArray(composed.content)).toBe(true);
      expect(composed._compositionType).toBe(MessageShape.ARRAY_CONTENT);

      const content = composed.content as ContentBlock[];
      expect(content[0]).toEqual({ type: PART_TYPES.TEXT, text: 'Hello' });
      expect(content[1]).toEqual({
        type: PART_TYPES.TOOL_USE,
        id: '123',
        name: 'test_tool',
        input: { param: 'value' },
      });
    });
  });
});
