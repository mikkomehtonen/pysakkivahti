import { describe, it, expect, vi, afterEach } from 'vitest';
import { detectLocation } from '../src/geolocation.ts';

const originalNavigator = globalThis.navigator;

function setNavigator(value: Navigator | undefined): void {
  Object.defineProperty(globalThis, 'navigator', {
    value,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  setNavigator(originalNavigator);
});

describe('detectLocation', () => {
  it('returns null when navigator is undefined', async () => {
    setNavigator(undefined);
    const result = await detectLocation();
    expect(result).toBeNull();
  });

  it('returns null when navigator.geolocation is not available', async () => {
    setNavigator({} as Navigator);
    const result = await detectLocation();
    expect(result).toBeNull();
  });

  it('returns matched location when geolocation succeeds', async () => {
    setNavigator({
      geolocation: {
        getCurrentPosition: (success: PositionCallback) => {
          success({
            coords: { latitude: 61.49, longitude: 23.76 },
          } as GeolocationPosition);
        },
      },
    } as Navigator);

    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'home', name: 'Koti', destination: 'Keskusta' }),
      } as Response),
    ) as typeof fetch;

    const result = await detectLocation();
    expect(result).toEqual({ id: 'home', name: 'Koti', destination: 'Keskusta' });
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/locations/nearest?lat=61.49&lon=23.76');
  });

  it('returns null when geolocation permission is denied', async () => {
    setNavigator({
      geolocation: {
        getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) => {
          error({ code: 1, message: 'Denied' } as GeolocationPositionError);
        },
      },
    } as Navigator);

    const result = await detectLocation();
    expect(result).toBeNull();
  });

  it('returns null when nearest API returns 404', async () => {
    setNavigator({
      geolocation: {
        getCurrentPosition: (success: PositionCallback) => {
          success({
            coords: { latitude: 61.49, longitude: 23.76 },
          } as GeolocationPosition);
        },
      },
    } as Navigator);

    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Sijaintia ei löytynyt' }),
      } as Response),
    ) as typeof fetch;

    const result = await detectLocation();
    expect(result).toBeNull();
  });

  it('returns null when nearest API fetch fails', async () => {
    setNavigator({
      geolocation: {
        getCurrentPosition: (success: PositionCallback) => {
          success({
            coords: { latitude: 61.49, longitude: 23.76 },
          } as GeolocationPosition);
        },
      },
    } as Navigator);

    globalThis.fetch = vi.fn(() => Promise.reject(new Error('Network error'))) as typeof fetch;

    const result = await detectLocation();
    expect(result).toBeNull();
  });
});
