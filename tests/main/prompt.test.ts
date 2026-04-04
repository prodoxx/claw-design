import { describe, it, expect } from 'vitest';
import { assemblePrompt } from '../../src/main/prompt.js';
import type { DomExtractionResult } from '../../src/main/dom-extract.js';

const sampleDom: DomExtractionResult = {
  elements: [
    {
      tag: 'div',
      id: 'main',
      classes: ['container'],
      text: 'Hello world',
      bounds: { x: 10, y: 20, width: 300, height: 150 },
      path: 'div#main',
    },
  ],
  viewport: { width: 1920, height: 1080 },
};

// Small PNG magic bytes buffer for most tests
const smallBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

describe('assemblePrompt', () => {
  it('returns an async iterable that yields exactly 1 SDKUserMessage', async () => {
    const iterable = assemblePrompt('change the color', smallBuffer, sampleDom);
    const messages = [];
    for await (const msg of iterable) {
      messages.push(msg);
    }
    expect(messages).toHaveLength(1);
  });

  it('yields a message with type "user" and message.role === "user"', async () => {
    const iterable = assemblePrompt('change the color', smallBuffer, sampleDom);
    const messages = [];
    for await (const msg of iterable) {
      messages.push(msg);
    }
    const msg = messages[0];
    expect(msg.type).toBe('user');
    expect(msg.message.role).toBe('user');
  });

  it('message.content is an array of 3 content blocks (text, image, text)', async () => {
    const iterable = assemblePrompt('change the color', smallBuffer, sampleDom);
    const messages = [];
    for await (const msg of iterable) {
      messages.push(msg);
    }
    const content = messages[0].message.content;
    expect(Array.isArray(content)).toBe(true);
    expect(content).toHaveLength(3);
    expect(content[0].type).toBe('text');
    expect(content[1].type).toBe('image');
    expect(content[2].type).toBe('text');
  });

  it('first content block is type "text" containing the instruction string', async () => {
    const instruction = 'Make the button red';
    const iterable = assemblePrompt(instruction, smallBuffer, sampleDom);
    const messages = [];
    for await (const msg of iterable) {
      messages.push(msg);
    }
    const content = messages[0].message.content as Array<{ type: string; text?: string }>;
    expect(content[0].type).toBe('text');
    expect(content[0].text).toContain(instruction);
    expect(content[0].text).toContain('## Change Instruction');
  });

  it('second content block is type "image" with base64 PNG source', async () => {
    const iterable = assemblePrompt('change it', smallBuffer, sampleDom);
    const messages = [];
    for await (const msg of iterable) {
      messages.push(msg);
    }
    const content = messages[0].message.content as Array<{
      type: string;
      source?: { type: string; media_type: string; data: string };
    }>;
    const imageBlock = content[1];
    expect(imageBlock.type).toBe('image');
    expect(imageBlock.source!.type).toBe('base64');
    expect(imageBlock.source!.media_type).toBe('image/png');
    expect(imageBlock.source!.data).toBe(smallBuffer.toString('base64'));
  });

  it('third content block is type "text" containing DOM Context and JSON of domContext', async () => {
    const iterable = assemblePrompt('change it', smallBuffer, sampleDom);
    const messages = [];
    for await (const msg of iterable) {
      messages.push(msg);
    }
    const content = messages[0].message.content as Array<{ type: string; text?: string }>;
    const domBlock = content[2];
    expect(domBlock.type).toBe('text');
    expect(domBlock.text).toContain('DOM Context');
    expect(domBlock.text).toContain(JSON.stringify(sampleDom, null, 2));
  });

  it('empty instruction string still produces valid content blocks', async () => {
    const iterable = assemblePrompt('', smallBuffer, sampleDom);
    const messages = [];
    for await (const msg of iterable) {
      messages.push(msg);
    }
    const msg = messages[0];
    expect(msg.type).toBe('user');
    const content = msg.message.content as Array<{ type: string; text?: string }>;
    expect(content).toHaveLength(3);
    expect(content[0].type).toBe('text');
    expect(content[0].text).toContain('## Change Instruction');
  });

  it('large screenshot buffer (1MB+) encodes correctly to base64', async () => {
    const largeBuffer = Buffer.alloc(1024 * 1024 + 1, 0xab);
    const iterable = assemblePrompt('change it', largeBuffer, sampleDom);
    const messages = [];
    for await (const msg of iterable) {
      messages.push(msg);
    }
    const content = messages[0].message.content as Array<{
      type: string;
      source?: { type: string; data: string };
    }>;
    const imageBlock = content[1];
    expect(imageBlock.source!.data).toBe(largeBuffer.toString('base64'));
    expect(imageBlock.source!.data.length).toBeGreaterThan(1_000_000);
  });

  it('sets parent_tool_use_id to null', async () => {
    const iterable = assemblePrompt('change it', smallBuffer, sampleDom);
    const messages = [];
    for await (const msg of iterable) {
      messages.push(msg);
    }
    expect(messages[0].parent_tool_use_id).toBeNull();
  });
});
