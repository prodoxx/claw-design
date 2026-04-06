import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const pkg = JSON.parse(
  readFileSync(resolve(__dirname, '../../package.json'), 'utf-8')
);

describe('package.json structure (D-12, D-13, D-18, D-19)', () => {
  it('has electron in dependencies', () => {
    expect(pkg.dependencies).toHaveProperty('electron');
    expect(pkg.devDependencies?.electron).toBeUndefined();
  });

  it('has files whitelist', () => {
    expect(pkg.files).toBeDefined();
    expect(pkg.files).toContain('dist/');
    expect(pkg.files).toContain('out/');
    expect(pkg.files).toContain('LICENSE');
  });

  it('has repository field', () => {
    expect(pkg.repository).toBeDefined();
  });

  it('has keywords', () => {
    expect(pkg.keywords).toBeDefined();
    expect(pkg.keywords.length).toBeGreaterThan(0);
  });

  it('has homepage', () => {
    expect(pkg.homepage).toBeDefined();
  });

  it('has author', () => {
    expect(pkg.author).toBeDefined();
  });

  it('has prepublishOnly script', () => {
    expect(pkg.scripts.prepublishOnly).toBeDefined();
    expect(pkg.scripts.prepublishOnly).toContain('build');
  });

  it('has unified build script', () => {
    expect(pkg.scripts.build).toContain('tsc');
    expect(pkg.scripts.build).toContain('electron-vite');
  });

  it('name is unscoped claw-design', () => {
    expect(pkg.name).toBe('claw-design');
  });
});
