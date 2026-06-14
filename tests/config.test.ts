import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(),
  },
  readFileSync: vi.fn(),
}));

import { readFileSync } from 'fs';

const mockReadFileSync = vi.mocked(readFileSync);

describe('loadConfig', () => {
  let originalExit: typeof process.exit;

  beforeEach(() => {
    vi.resetModules();
    originalExit = process.exit;
    process.exit = vi.fn((code: number) => {
      throw new Error(`process.exit(${String(code)})`);
    }) as typeof process.exit;
  });

  afterEach(() => {
    process.exit = originalExit;
  });

  it('exits with an error when config.json is missing', async () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory');
    });

    await expect(import('../config.ts')).rejects.toThrow('process.exit(1)');
  });

  it('exits with an error when config.json contains invalid JSON', async () => {
    mockReadFileSync.mockReturnValue('{ invalid json');

    await expect(import('../config.ts')).rejects.toThrow('process.exit(1)');
  });
});
