import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import type { DomExtractionResult } from './dom-extract.js';
import type { CSSRect } from './capture.js';

/**
 * Assemble a prompt for the Agent SDK from a user instruction, screenshot,
 * and DOM context of the selected region.
 *
 * Returns an AsyncIterable that yields a single SDKUserMessage with three
 * content blocks:
 *   1. Text block with the change instruction and selection context
 *   2. Image block with the screenshot as base64 PNG
 *   3. Text block with the DOM context as formatted JSON
 *
 * The Agent SDK query() function accepts this as its `prompt` parameter.
 */
export function assemblePrompt(
  instruction: string,
  screenshotBuffer: Buffer,
  domContext: DomExtractionResult,
  bounds?: CSSRect,
): AsyncIterable<SDKUserMessage> {
  // Find the largest/most prominent element in the selection (likely the target)
  const primaryElement = domContext.elements.length > 0
    ? domContext.elements.reduce((best, el) => {
        const area = el.bounds.width * el.bounds.height;
        const bestArea = best.bounds.width * best.bounds.height;
        return area > bestArea ? el : best;
      })
    : null;

  let instructionText = '## Change Instruction\n\n' + instruction;
  if (primaryElement) {
    instructionText += `\n\n**Selected element:** \`<${primaryElement.tag}>\` at \`${primaryElement.path}\``;
    if (primaryElement.text) {
      instructionText += ` containing "${primaryElement.text.slice(0, 100)}"`;
    }
    instructionText += '\n\nApply the instruction to this element specifically. The screenshot shows exactly what the user selected.';
  }
  if (bounds) {
    instructionText += `\n\n**Selection bounds:** x=${bounds.x}, y=${bounds.y}, ${bounds.width}x${bounds.height}px`;
  }

  const contentBlocks = [
    {
      type: 'text' as const,
      text: instructionText,
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
