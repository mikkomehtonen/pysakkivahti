import { describe, it, expect, vi } from 'vitest';
import type { Server } from 'http';
import { app, getPort, startServer } from '../server.ts';
import { LocationsResponse, LocationDepartures } from '../src/types.ts';

async function withServer(callback: (baseUrl: string) => Promise<void>): Promise<void> {
  const server: Server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;
  const baseUrl = `http://localhost:${port}`;
  try {
    await callback(baseUrl);
  } finally {
    server.close();
  }
}

describe('GET /api/locations', () => {
  it('returns 200 with locations and refreshInterval', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/locations`);
      expect(response.status).toBe(200);
      const body = (await response.json()) as LocationsResponse;
      expect(body.refreshInterval).toBe(30);
      expect(body.locations).toHaveLength(3);
      expect(body.locations.map((l) => l.id)).toEqual(['home', 'work', 'city_centre']);
      for (const location of body.locations) {
        expect(location.id).toBeDefined();
        expect(location.name).toBeDefined();
        expect(location.destination).toBeDefined();
      }
    });
  });
});

describe('GET /api/departures', () => {
  it('returns departure data for a valid location', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/departures?locationId=home`);
      expect(response.status).toBe(200);
      const body = (await response.json()) as LocationDepartures;
      expect(body.locationId).toBe('home');
      expect(body.stops.length).toBeGreaterThan(0);
      for (const stop of body.stops) {
        expect(stop.stopName).toBeTruthy();
        expect(stop.departures.length).toBeLessThanOrEqual(3);
        for (const departure of stop.departures) {
          expect(departure.routeShortName).toBeDefined();
          expect(departure.headsign).toBeDefined();
          expect(departure.minutesUntilDeparture).toBeGreaterThanOrEqual(0);
          expect(typeof departure.realtime).toBe('boolean');
        }
      }
    });
  });

  it('returns 404 for a nonexistent location', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/departures?locationId=nonexistent`);
      expect(response.status).toBe(404);
      const body = (await response.json()) as { error: string };
      expect(body.error).toBeDefined();
    });
  });

  it('returns 400 when locationId is missing', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/departures`);
      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: string };
      expect(body.error).toBeDefined();
    });
  });

  it('returns city_centre data with only Koti direction', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/departures?locationId=city_centre`);
      expect(response.status).toBe(200);
      const body = (await response.json()) as LocationDepartures;
      expect(body.locationId).toBe('city_centre');
      expect(body.stops.length).toBeGreaterThan(0);
      for (const stop of body.stops) {
        expect(stop.departures.length).toBeLessThanOrEqual(3);
      }
    });
  });
});

describe('Server startup', () => {
  it('defaults to port 3000 when PORT is not set', () => {
    vi.stubEnv('PORT', undefined);
    expect(getPort()).toBe(3000);
  });

  it('uses PORT environment variable when set', () => {
    vi.stubEnv('PORT', '4000');
    expect(getPort()).toBe(4000);
  });

  it('logs a startup message when listening', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    let server: ReturnType<typeof startServer> | undefined;
    try {
      server = startServer(0);
      await new Promise<void>((resolve) => server!.once('listening', resolve));

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Pysäkkivahti server running on port'));
    } finally {
      server?.close();
      logSpy.mockRestore();
    }
  });
});
