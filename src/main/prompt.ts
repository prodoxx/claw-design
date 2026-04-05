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
  referenceImages?: Buffer[],
): AsyncIterable<SDKUserMessage> {
  // Find the largest/most prominent element in the selection (likely the target)
  const primaryElement = domContext.elements.length > 0
    ? domContext.elements.reduce((best, el) => {
        const area = el.bounds.width * el.bounds.height;
        const bestArea = best.bounds.width * best.bounds.height;
        return area > bestArea ? el : best;
      })
    : null;

  let contextSuffix = '';
  if (primaryElement) {
    contextSuffix += `\n\n**Selected element:** \`<${primaryElement.tag}>\` at \`${primaryElement.path}\``;
    if (primaryElement.text) {
      contextSuffix += ` containing "${primaryElement.text.slice(0, 100)}"`;
    }
    contextSuffix += '\n\nApply the instruction to this element specifically. The screenshot shows exactly what the user selected.';
  }
  if (bounds) {
    contextSuffix += `\n\n**Selection bounds:** x=${bounds.x}, y=${bounds.y}, ${bounds.width}x${bounds.height}px`;
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const contentBlocks: any[] = [];

  // Build instruction blocks — split on [Image #N] references to interleave
  // text and reference images inline, so Claude sees them in context.
  const hasInlineRefs = referenceImages && referenceImages.length > 0 &&
    /\[Image #\d+\]/.test(instruction);

  if (hasInlineRefs && referenceImages) {
    // Split instruction on [Image #N] tokens
    const parts = instruction.split(/(\[Image #\d+\])/);
    let headerAdded = false;
    for (const part of parts) {
      const match = part.match(/^\[Image #(\d+)\]$/);
      if (match) {
        const idx = parseInt(match[1], 10) - 1; // 1-based to 0-based
        if (idx >= 0 && idx < referenceImages.length) {
          if (!headerAdded) {
            // Prefix with instruction header for the first text chunk
            contentBlocks.unshift({ type: 'text', text: '## Change Instruction\n\n' });
            headerAdded = true;
          }
          contentBlocks.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: referenceImages[idx].toString('base64'),
            },
          });
        }
      } else if (part) {
        if (!headerAdded) {
          contentBlocks.push({ type: 'text', text: '## Change Instruction\n\n' + part });
          headerAdded = true;
        } else {
          contentBlocks.push({ type: 'text', text: part });
        }
      }
    }
    if (contextSuffix) {
      contentBlocks.push({ type: 'text', text: contextSuffix });
    }
  } else {
    contentBlocks.push({
      type: 'text',
      text: '## Change Instruction\n\n' + instruction + contextSuffix,
    });
  }

  // Screenshot of the selected region
  contentBlocks.push({
    type: 'image',
    source: {
      type: 'base64',
      media_type: 'image/png',
      data: screenshotBuffer.toString('base64'),
    },
  });

  // Append any reference images NOT already inlined via [Image #N]
  if (referenceImages && referenceImages.length > 0 && !hasInlineRefs) {
    contentBlocks.push({
      type: 'text',
      text: `## Reference Image${referenceImages.length > 1 ? 's' : ''}\n\nThe user pasted ${referenceImages.length > 1 ? 'these images as' : 'this image as a'} reference for what the result should look like:`,
    });
    for (const buf of referenceImages) {
      contentBlocks.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: buf.toString('base64') },
      });
    }
  }

  contentBlocks.push({
    type: 'text',
    text:
      '## DOM Context\n\nElements in the selected region:\n```json\n' +
      JSON.stringify(domContext, null, 2) +
      '\n```',
  });

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
