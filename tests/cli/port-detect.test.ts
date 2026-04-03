import { describe, it, expect, afterEach } from 'vitest';
import { createServer, type Server } from 'node:net';

// Will import from the module under test once created
import {
  extractPortFromOutput,
  waitForPort,
  getProcessOnPort,
  PORT_PATTERNS,
} from '../../src/cli/utils/port-detect.js';

describe('extractPortFromOutput', () => {
  it('extracts port from http://localhost:3000', () => {
    expect(extractPortFromOutput('http://localhost:3000')).toBe(3000);
  });

  it('extracts port from https://localhost:8080/path', () => {
    expect(extractPortFromOutput('https://localhost:8080/path')).toBe(8080);
  });

  it('extracts port from http://127.0.0.1:5173', () => {
    expect(extractPortFromOutput('http://127.0.0.1:5173')).toBe(5173);
  });

  it('extracts port from http://0.0.0.0:4321', () => {
    expect(extractPortFromOutput('http://0.0.0.0:4321')).toBe(4321);
  });

  it('extracts port from http://[::]:3000', () => {
    expect(extractPortFromOutput('http://[::]:3000')).toBe(3000);
  });

  it('extracts port from Vite format: "Local: http://localhost:5173/"', () => {
    expect(extractPortFromOutput('Local: http://localhost:5173/')).toBe(5173);
  });

  it('extracts port from Next.js format: "ready - started server on 0.0.0.0:3000"', () => {
    expect(
      extractPortFromOutput('ready - started server on 0.0.0.0:3000')
    ).toBe(3000);
  });

  it('extracts port from "Port 8080"', () => {
    expect(extractPortFromOutput('Port 8080')).toBe(8080);
  });

  it('extracts port from "port: 3000"', () => {
    expect(extractPortFromOutput('port: 3000')).toBe(3000);
  });

  it('extracts port from "listening on port 4000"', () => {
    expect(extractPortFromOutput('listening on port 4000')).toBe(4000);
  });

  it('returns null for "Compiled successfully!"', () => {
    expect(extractPortFromOutput('Compiled successfully!')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractPortFromOutput('')).toBeNull();
  });

  it('URL match takes priority over generic "port" match for mixed output', () => {
    // The database port (5432) appears with generic "port" keyword,
    // but the URL with localhost:3000 should win because URL patterns come first
    const output =
      'Connected to database on port 5432\nhttp://localhost:3000';
    expect(extractPortFromOutput(output)).toBe(3000);
  });

  it('returns null for port 0', () => {
    expect(extractPortFromOutput('http://localhost:0')).toBeNull();
  });

  it('returns null for port > 65535', () => {
    expect(extractPortFromOutput('Port 99999')).toBeNull();
  });

  it('PORT_PATTERNS array starts with URL regex (most specific first)', () => {
    // First pattern should match URLs
    expect(PORT_PATTERNS[0].test('http://localhost:3000')).toBe(true);
  });
});

describe('waitForPort', () => {
  let server: Server | null = null;

  afterEach(() => {
    if (server) {
      server.close();
      server = null;
    }
  });

  it('rejects with timeout error when port is not open', { timeout: 5000 }, async () => {
    // Use a port that nothing should be listening on
    await expect(
      waitForPort(19876, { timeout: 200 })
    ).rejects.toThrow('Timeout');
  });

  it('resolves when port accepts TCP connection', { timeout: 5000 }, async () => {
    // Start a server on a random port
    server = createServer();
    await new Promise<void>((resolve) => {
      server!.listen(0, '127.0.0.1', () => resolve());
    });
    const port = (server.address() as { port: number }).port;

    // waitForPort should resolve successfully
    await expect(waitForPort(port, { timeout: 2000 })).resolves.toBeUndefined();
  });
});

describe('getProcessOnPort', () => {
  it('returns null for a port nothing is listening on', () => {
    const result = getProcessOnPort(19877);
    expect(result).toBeNull();
  });
});
