import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withServer, createDeparture, createStopResponse } from './helpers.ts';

vi.mock('../config.ts', () => ({
  config: {
    refreshInterval: 30,
    departuresCount: 3,
    locations: [
      {
        id: 'home',
        name: 'Koti',
        destination: 'Keskusta',
        coordinates: { lat: 61.49, lon: 23.76 },
        radius: 200,
        stops: [{ id: 'tampere:0851', name: 'Särkänniemi B', filterHeadsigns: ['Keskustori'] }],
      },
      {
        id: 'work',
        name: 'Työ',
        destination: 'Keskusta',
        coordinates: { lat: 61.45, lon: 23.86 },
        radius: 200,
        stops: [
          { id: 'tampere:0002', name: 'Työ', filterHeadsigns: [] },
          { id: 'tampere:0003', name: 'Työ 2', filterHeadsigns: ['Keskustori'] },
        ],
      },
      {
        id: 'city_centre',
        name: 'Keskusta',
        coordinates: { lat: 61.498, lon: 23.772 },
        radius: 300,
        routes: [
          {
            destination: 'Työ',
            beforeHour: 12,
            stops: [{ id: 'tampere:0001', name: 'Keskustori P', filterHeadsigns: ['TAYS'] }],
          },
          {
            destination: 'Koti',
            afterHour: 12,
            stops: [{ id: 'tampere:0855', name: 'Keskustori E', filterHeadsigns: ['Lentävänniemi'] }],
          },
        ],
      },
      {
        id: 'unfiltered',
        name: 'Suodattamaton',
        destination: 'Keskusta',
        coordinates: { lat: 61.0, lon: 23.0 },
        radius: 200,
        stops: [{ id: 'tampere:9999', name: 'Test Stop' }],
      },
      {
        id: 'city_centre_gap',
        name: 'Keskusta',
        coordinates: { lat: 61.498, lon: 23.772 },
        radius: 300,
        routes: [
          {
            destination: 'Työ',
            beforeHour: 6,
            stops: [{ id: 'tampere:0001', name: 'Keskustori P', filterHeadsigns: ['TAYS'] }],
          },
          {
            destination: 'Koti',
            afterHour: 18,
            stops: [{ id: 'tampere:0855', name: 'Keskustori E', filterHeadsigns: ['Lentävänniemi'] }],
          },
        ],
      },
    ],
  },
}));

vi.mock('../digitransit.ts', () => ({
  fetchStopDepartures: vi.fn(),
}));

import { fetchStopDepartures } from '../digitransit.ts';
import { getPort, startServer } from '../server.ts';

const mockFetchStopDepartures = vi.mocked(fetchStopDepartures);

describe('GET /api/locations', () => {
  it('returns locations and refreshInterval from config', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/locations`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.refreshInterval).toBe(30);
      expect(body.locations).toHaveLength(5);
      expect(body.locations.map((l: { id: string }) => l.id)).toEqual([
        'home',
        'work',
        'city_centre',
        'unfiltered',
        'city_centre_gap',
      ]);
      for (const location of body.locations) {
        expect(location.id).toBeDefined();
        expect(location.name).toBeDefined();
        expect(location.destination).toBeDefined();
      }
    });
  });
});

describe('GET /api/locations/nearest', () => {
  it('returns nearest location within radius', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/locations/nearest?lat=61.49&lon=23.76`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.id).toBe('home');
      expect(body.name).toBe('Koti');
      expect(body.destination).toBe('Keskusta');
    });
  });

  it('returns 404 when no location is within radius', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/locations/nearest?lat=60.0&lon=20.0`);
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toBeDefined();
    });
  });

  it('returns 400 when lat or lon is missing', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/locations/nearest`);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBeDefined();
    });
  });

  it('returns the closest location within its radius', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/locations/nearest?lat=61.49045&lon=23.76`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.id).toBe('home');
    });
  });
});

describe('GET /api/departures', () => {
  beforeEach(() => {
    vi.stubEnv('PYSAKKIVAHTI_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('returns departure data from Digitransit', async () => {
    mockFetchStopDepartures.mockResolvedValue(
      createStopResponse('Särkänniemi B', [createDeparture('Keskustori', 180)]),
    );

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/departures?locationId=home`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.locationId).toBe('home');
      expect(body.destination).toBe('Keskusta');
      expect(body.stops).toHaveLength(1);
      expect(body.stops[0].stopName).toBe('Särkänniemi B');
      expect(body.stops[0].departures.length).toBe(1);
      expect(body.stops[0].departures[0].routeShortName).toBe('1');
      expect(body.stops[0].departures[0].headsign).toBe('Keskustori');
      expect(body.stops[0].departures[0].minutesUntilDeparture).toBe(3);
      expect(body.stops[0].departures[0].realtime).toBe(true);
    });
  });

  it('includes departures matching filterHeadsigns and excludes others', async () => {
    mockFetchStopDepartures.mockResolvedValue(
      createStopResponse('Särkänniemi B', [
        createDeparture('Keskustori', 180),
        createDeparture('Lentävänniemi', 360),
        createDeparture('Keskustori', 540),
      ]),
    );

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/departures?locationId=home`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.stops[0].departures).toHaveLength(2);
      expect(body.stops[0].departures.map((d: { headsign: string }) => d.headsign)).toEqual([
        'Keskustori',
        'Keskustori',
      ]);
    });
  });

  it('performs case-insensitive headsign filtering', async () => {
    mockFetchStopDepartures.mockResolvedValue(
      createStopResponse('Särkänniemi B', [createDeparture('KESKUSTORI', 180)]),
    );

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/departures?locationId=home`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.stops[0].departures).toHaveLength(1);
      expect(body.stops[0].departures[0].headsign).toBe('KESKUSTORI');
    });
  });

  it('returns all departures when filterHeadsigns is empty', async () => {
    mockFetchStopDepartures.mockResolvedValue(
      createStopResponse('Työ', [
        createDeparture('Keskustori', 180),
        createDeparture('Lentävänniemi', 360),
      ]),
    );

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/departures?locationId=work`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.stops[0].departures).toHaveLength(2);
    });
  });

  it('returns at most departuresCount departures per stop', async () => {
    mockFetchStopDepartures.mockResolvedValue(
      createStopResponse('Särkänniemi B', [
        createDeparture('Keskustori', 180),
        createDeparture('Keskustori', 360),
        createDeparture('Keskustori', 540),
        createDeparture('Keskustori', 720),
      ]),
    );

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/departures?locationId=home`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.stops[0].departures).toHaveLength(3);
    });
  });

  it('excludes departures with secondsUntilDeparture <= 0', async () => {
    mockFetchStopDepartures.mockResolvedValue(
      createStopResponse('Särkänniemi B', [
        createDeparture('Keskustori', -60),
        createDeparture('Keskustori', 180),
      ]),
    );

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/departures?locationId=home`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.stops[0].departures).toHaveLength(1);
      expect(body.stops[0].departures[0].minutesUntilDeparture).toBe(3);
    });
  });

  it('returns 503 when API key is missing', async () => {
    vi.unstubAllEnvs();
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/departures?locationId=home`);
      expect(response.status).toBe(503);
      const body = await response.json();
      expect(body.error).toBe('API-avain puuttuu');
    });
  });

  it('returns 502 when Digitransit API fails for all stops', async () => {
    mockFetchStopDepartures.mockRejectedValue(new Error('Network error'));

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/departures?locationId=home`);
      expect(response.status).toBe(502);
      const body = await response.json();
      expect(body.error).toBe('Lähtöjen haku epäonnistui');
    });
  });

  it('returns partial data when one stop fails out of two', async () => {
    mockFetchStopDepartures
      .mockResolvedValueOnce(createStopResponse('Työ', [createDeparture('Keskustori', 180)]))
      .mockRejectedValueOnce(new Error('Network error'));

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/departures?locationId=work`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.stops).toHaveLength(2);
      expect(body.stops[0].departures).toHaveLength(1);
      expect(body.stops[1].departures).toHaveLength(0);
    });
  });

  it('returns 404 for a nonexistent location', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/departures?locationId=nonexistent`);
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toBeDefined();
    });
  });

  it('returns 400 when locationId is missing', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/departures`);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBeDefined();
    });
  });
});

describe('Time-based routing', () => {
  beforeEach(() => {
    vi.stubEnv('PYSAKKIVAHTI_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('uses beforeHour route when current hour is before the boundary', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 14, 8, 0, 0));

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/locations`);
      const body = await response.json();
      const cityCentre = body.locations.find((l: { id: string }) => l.id === 'city_centre');
      expect(cityCentre.destination).toBe('Työ');
    });
  });

  it('uses afterHour route when current hour is at or after the boundary', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 14, 14, 0, 0));

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/locations`);
      const body = await response.json();
      const cityCentre = body.locations.find((l: { id: string }) => l.id === 'city_centre');
      expect(cityCentre.destination).toBe('Koti');
    });
  });

  it('departures response uses the time-based destination', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 14, 14, 0, 0));
    mockFetchStopDepartures.mockResolvedValue(
      createStopResponse('Keskustori E', [createDeparture('Lentävänniemi', 180)]),
    );

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/departures?locationId=city_centre`);
      const body = await response.json();
      expect(body.destination).toBe('Koti');
      expect(body.stops[0].stopName).toBe('Keskustori E');
    });
  });

  it('uses the first route as fallback when no route matches the current hour', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 14, 12, 0, 0));
    mockFetchStopDepartures.mockResolvedValue(createStopResponse('Keskustori P', []));

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/locations`);
      const body = await response.json();
      const cityCentre = body.locations.find((l: { id: string }) => l.id === 'city_centre_gap');
      expect(cityCentre.destination).toBe('Työ');

      const departuresResponse = await fetch(`${baseUrl}/api/departures?locationId=city_centre_gap`);
      const departuresBody = await departuresResponse.json();
      expect(departuresBody.destination).toBe('Työ');
      expect(departuresBody.stops[0].stopName).toBe('Keskustori P');
    });
  });
});

describe('GET /api/departures with absent filterHeadsigns', () => {
  it('returns all departures when filterHeadsigns is absent', async () => {
    vi.stubEnv('PYSAKKIVAHTI_API_KEY', 'test-key');
    mockFetchStopDepartures.mockResolvedValue(
      createStopResponse('Test Stop', [
        createDeparture('Keskustori', 180),
        createDeparture('Lentävänniemi', 360),
      ]),
    );

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/departures?locationId=unfiltered`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.stops[0].departures).toHaveLength(2);
    });

    vi.unstubAllEnvs();
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
