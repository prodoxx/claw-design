import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import type { DomExtractionResult } from './dom-extract.js';

/**
 * Assemble a prompt for the Agent SDK from a user instruction, screenshot,
 * and DOM context of the selected region.
 *
 * Returns an AsyncIterable that yields a single SDKUserMessage with three
 * content blocks:
 *   1. Text block with the change instruction
 *   2. Image block with the screenshot as base64 PNG
 *   3. Text block with the DOM context as formatted JSON
 *
 * The Agent SDK query() function accepts this as its `prompt` parameter.
 */
export function assemblePrompt(
  instruction: string,
  screenshotBuffer: Buffer,
  domContext: DomExtractionResult,
): AsyncIterable<SDKUserMessage> {
  const contentBlocks = [
    {
      type: 'text' as const,
      text: '## Change Instruction\n\n' + instruction,
    },
    {
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: 'image/png' as const,
        data: screenshotBuffer.toString('base64'),
      },
    },
    {
      type: 'text' as const,
      text:
        '## DOM Context\n\nElements in the selected region:\n```json\n' +
        JSON.stringify(domContext, null, 2) +
        '\n```',
    },
  ];

  const userMessage: SDKUserMessage = {
    type: 'user',
    message: {
      role: 'user',
      content: contentBlocks,
    },
    parent_tool_use_id: null,
  };

  return (async function* () {
    yield userMessage;
  })();
}
