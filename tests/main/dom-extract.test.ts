import { describe, it, expect } from 'vitest';
import { buildDomExtractionScript } from '../../src/main/dom-extract.js';

describe('buildDomExtractionScript', () => {
  const rect = { x: 100, y: 200, width: 300, height: 150 };

  it('returns a string wrapping in IIFE', () => {
    const script = buildDomExtractionScript(rect);
    expect(script.trim()).toMatch(/^\(function\(\)/);
  });

  it('contains document.querySelectorAll', () => {
    const script = buildDomExtractionScript(rect);
    expect(script).toContain("document.querySelectorAll('*')");
  });

  it('includes the passed rect coordinates in the output script', () => {
    const script = buildDomExtractionScript(rect);
    expect(script).toContain('x: 100');
    expect(script).toContain('y: 200');
    expect(script).toContain('w: 300');
    expect(script).toContain('h: 150');
  });

  it('contains overlap check logic', () => {
    const script = buildDomExtractionScript(rect);
    expect(script).toContain('elRect.right < rect.x');
    expect(script).toContain('elRect.left > rect.x + rect.w');
  });

  it('contains visibility filter for display:none and visibility:hidden', () => {
    const script = buildDomExtractionScript(rect);
    expect(script).toContain("style.display === 'none'");
    expect(script).toContain("style.visibility === 'hidden'");
  });

  it('contains text truncation to 200 chars', () => {
    const script = buildDomExtractionScript(rect);
    expect(script).toContain('substring(0, 200)');
  });

  it('contains getElementPath function for hierarchy', () => {
    const script = buildDomExtractionScript(rect);
    expect(script).toContain('getElementPath');
  });

  it('returns an object with elements and viewport keys', () => {
    const script = buildDomExtractionScript(rect);
    expect(script).toContain('elements: elements');
    expect(script).toContain('viewport:');
    expect(script).toContain('window.innerWidth');
    expect(script).toContain('window.innerHeight');
  });

  it('handles zero-dimension rect without NaN or script errors', () => {
    const zeroRect = { x: 0, y: 0, width: 0, height: 0 };
    const script = buildDomExtractionScript(zeroRect);
    expect(script).toContain('x: 0');
    expect(script).toContain('y: 0');
    expect(script).toContain('w: 0');
    expect(script).toContain('h: 0');
    expect(script).not.toContain('NaN');
    // Script uses `undefined` as a JS literal (el.id || undefined) which is valid
    // Check that the rect coordinates themselves don't produce undefined
    expect(script).not.toMatch(/x: undefined|y: undefined|w: undefined|h: undefined/);
  });

  it('handles negative coordinates without script errors', () => {
    const negRect = { x: -10, y: -20, width: 100, height: 50 };
    const script = buildDomExtractionScript(negRect);
    expect(script).toContain('x: -10');
    expect(script).toContain('y: -20');
    expect(script).not.toContain('NaN');
  });

  it('uses getComputedStyle for visibility checks', () => {
    const script = buildDomExtractionScript(rect);
    expect(script).toContain('getComputedStyle');
  });

  it('extracts tag name as lowercase', () => {
    const script = buildDomExtractionScript(rect);
    expect(script).toContain('el.tagName.toLowerCase()');
  });
});
