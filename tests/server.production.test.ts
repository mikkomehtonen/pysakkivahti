import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { resolve } from 'path';
import { withServer } from './helpers.ts';

vi.mock('../config.ts', () => ({
  config: {
    refreshInterval: 30,
    departuresCount: 3,
    locations: [],
  },
}));

const distPath = resolve('dist');
const indexPath = resolve(distPath, 'index.html');

afterEach(() => {
  vi.unstubAllEnvs();
  if (existsSync(distPath)) {
    rmSync(distPath, { recursive: true, force: true });
  }
});

describe('Production static serving', () => {
  it('serves dist files when NODE_ENV is production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();
    mkdirSync(distPath, { recursive: true });
    writeFileSync(indexPath, '<html><body>production</body></html>');

    const { app } = await import('../server.ts');
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/`);
      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toContain('production');
    }, app);
  });
});
