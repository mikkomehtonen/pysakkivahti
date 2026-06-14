import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { App } from '../src/app.ts';
import type { LocationsResponse, LocationDepartures } from '../src/types.ts';

const cssText = readFileSync(resolve(process.cwd(), 'src/style.css'), 'utf-8');

function createContainer(): HTMLElement {
  document.body.innerHTML = '<div id="app"></div>';
  return document.getElementById('app')!;
}

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function mockFetchResponses(
  locations: LocationsResponse,
  departures: Record<string, LocationDepartures>,
): void {
  globalThis.fetch = vi.fn((input: string | Request | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url === '/api/locations') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(locations),
      } as Response);
    }
    if (url.startsWith('/api/departures?')) {
      const params = new URLSearchParams(url.split('?')[1]);
      const locationId = params.get('locationId') ?? '';
      const body = departures[locationId];
      if (body) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(body),
        } as Response);
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Sijaintia ei löytynyt' }),
      } as Response);
    }
    return Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Not found' }),
    } as Response);
  }) as typeof fetch;
}

function mockFetchError(message: string): void {
  globalThis.fetch = vi.fn(() => Promise.reject(new Error(message))) as typeof fetch;
}

const defaultLocations: LocationsResponse = {
  locations: [
    { id: 'home', name: 'Koti', destination: 'Keskusta' },
    { id: 'work', name: 'Työ', destination: 'Keskusta' },
    { id: 'city_centre', name: 'Keskusta', destination: 'Koti' },
  ],
  refreshInterval: 30,
};

const homeDepartures: LocationDepartures = {
  locationId: 'home',
  stops: [
    {
      stopName: 'Särkänniemi B',
      departures: [
        { routeShortName: '1', headsign: 'Keskustori', minutesUntilDeparture: 12, realtime: true },
        { routeShortName: '1', headsign: 'Keskustori', minutesUntilDeparture: 3, realtime: true },
        { routeShortName: '1', headsign: 'Keskustori', minutesUntilDeparture: 21, realtime: false },
      ],
    },
  ],
};

const workDepartures: LocationDepartures = {
  locationId: 'work',
  stops: [
    {
      stopName: 'Työ',
      departures: [
        { routeShortName: '3', headsign: 'Keskustori', minutesUntilDeparture: 5, realtime: true },
        { routeShortName: '3', headsign: 'Keskustori', minutesUntilDeparture: 15, realtime: false },
      ],
    },
  ],
};

const emptyDepartures: LocationDepartures = {
  locationId: 'home',
  stops: [{ stopName: 'Särkänniemi B', departures: [] }],
};

describe('App', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('selects first location on mount and renders header', async () => {
    mockFetchResponses(defaultLocations, { home: homeDepartures });
    const container = createContainer();
    const app = new App(container);
    await app.mount();

    expect(container.querySelector('.location-header')?.textContent).toBe('Koti → Keskusta');
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/departures?locationId=home');
  });

  it('renders when no locations are available', async () => {
    globalThis.fetch = vi.fn((input: string | Request | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/locations') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ locations: [], refreshInterval: 30 }),
        } as Response);
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found' }),
      } as Response);
    }) as typeof fetch;

    const container = createContainer();
    const app = new App(container);
    await app.mount();

    expect(container.querySelector('.location-header')).toBeTruthy();
    expect(container.querySelector('.location-buttons')).toBeTruthy();
    expect(container.querySelectorAll('.location-btn').length).toBe(0);
    expect(container.querySelector('.empty')?.textContent).toBe('Ei sijainteja saatavilla');
  });

  it('refresh button re-fetches locations when none are available', async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn((input: string | Request | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/locations') {
        callCount += 1;
        const locations = callCount === 1 ? [] : defaultLocations.locations;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ locations, refreshInterval: 30 }),
        } as Response);
      }
      if (url === '/api/departures?locationId=home') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(homeDepartures),
        } as Response);
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found' }),
      } as Response);
    }) as typeof fetch;

    const container = createContainer();
    const app = new App(container);
    await app.mount();
    expect(container.querySelector('.empty')?.textContent).toBe('Ei sijainteja saatavilla');

    container.querySelector('.refresh-btn')?.dispatchEvent(new MouseEvent('click'));
    await flushPromises();

    expect(container.querySelector('.location-header')?.textContent).toBe('Koti → Keskusta');
    expect(container.querySelectorAll('.location-btn').length).toBe(3);
  });

  it('renders exactly N departure rows ordered by minutes ascending', async () => {
    mockFetchResponses(defaultLocations, { home: homeDepartures });
    const container = createContainer();
    const app = new App(container);
    await app.mount();

    const rows = container.querySelectorAll('.departure-row');
    expect(rows.length).toBe(3);

    const times = Array.from(rows).map((row) => row.querySelector('.departure-time')?.textContent);
    expect(times).toEqual(['3 min', '12 min', '21 min']);

    const firstRow = rows[0];
    expect(firstRow.querySelector('.route-number')?.textContent).toBe('1');
    expect(firstRow.querySelector('.departure-headsign')?.textContent).toBe('Keskustori');
  });

  it('adds realtime class for realtime departures', async () => {
    mockFetchResponses(defaultLocations, { home: homeDepartures });
    const container = createContainer();
    const app = new App(container);
    await app.mount();

    const rows = container.querySelectorAll('.departure-row');
    expect(rows[0].classList.contains('departure--realtime')).toBe(true);
    expect(rows[1].classList.contains('departure--realtime')).toBe(true);
    expect(rows[2].classList.contains('departure--realtime')).toBe(false);
  });

  it('switches location and active button on click', async () => {
    mockFetchResponses(defaultLocations, { home: homeDepartures, work: workDepartures });
    const container = createContainer();
    const app = new App(container);
    await app.mount();

    const buttonsBefore = container.querySelectorAll('.location-btn');
    expect(buttonsBefore[0].classList.contains('location-btn--active')).toBe(true);

    buttonsBefore[1].dispatchEvent(new MouseEvent('click'));
    await flushPromises();

    const buttonsAfter = container.querySelectorAll('.location-btn');
    expect(container.querySelector('.location-header')?.textContent).toBe('Työ → Keskusta');
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/departures?locationId=work');
    expect(buttonsAfter[1].classList.contains('location-btn--active')).toBe(true);
    expect(buttonsAfter[0].classList.contains('location-btn--active')).toBe(false);
  });

  it('shows loading indicator during fetch', async () => {
    let resolveDepartures: (value: LocationDepartures) => void;
    const departuresPromise = new Promise<LocationDepartures>((resolve) => {
      resolveDepartures = resolve;
    });

    globalThis.fetch = vi.fn((input: string | Request | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/locations') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(defaultLocations),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => departuresPromise,
      } as Response);
    }) as typeof fetch;

    const container = createContainer();
    const app = new App(container);
    const mountPromise = app.mount();
    await flushPromises();

    expect(container.querySelector('.loading')).toBeTruthy();
    expect(container.querySelector('.loading')?.getAttribute('aria-label')).toBe('Ladataan');

    resolveDepartures!({ locationId: 'home', stops: [] });
    await mountPromise;

    expect(container.querySelector('.loading')).toBeFalsy();
  });

  it('shows error on network failure', async () => {
    globalThis.fetch = vi.fn((input: string | Request | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/locations') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(defaultLocations),
        } as Response);
      }
      return Promise.reject(new Error('Network error'));
    }) as typeof fetch;

    const container = createContainer();
    const app = new App(container);
    await app.mount();

    const error = container.querySelector('.error');
    expect(error).toBeTruthy();
    expect(error?.textContent).toContain('Lähtöjen hakeminen epäonnistui');
  });

  it('shows error when locations response is malformed', async () => {
    globalThis.fetch = vi.fn((input: string | Request | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/locations') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ locations: 'not-an-array' }),
        } as Response);
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found' }),
      } as Response);
    }) as typeof fetch;

    const container = createContainer();
    const app = new App(container);
    await app.mount();

    expect(container.querySelector('.error')).toBeTruthy();
    expect(container.querySelector('.error')?.textContent).toContain('Sijaintien hakeminen epäonnistui');
  });

  it('shows error when departures response is malformed', async () => {
    globalThis.fetch = vi.fn((input: string | Request | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/locations') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(defaultLocations),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            locationId: 'home',
            stops: [{ stopName: 'X', departures: [{ invalid: true }] }],
          }),
      } as Response);
    }) as typeof fetch;

    const container = createContainer();
    const app = new App(container);
    await app.mount();

    expect(container.querySelector('.error')).toBeTruthy();
    expect(container.querySelector('.error')?.textContent).toContain('Lähtöjen hakeminen epäonnistui');
  });

  it('shows "Ei lähtöjä" when no departures', async () => {
    mockFetchResponses(defaultLocations, { home: emptyDepartures });
    const container = createContainer();
    const app = new App(container);
    await app.mount();

    expect(container.querySelector('.empty')?.textContent).toBe('Ei lähtöjä');
  });

  it('shows error and no buttons when locations fetch fails', async () => {
    mockFetchError('Network error');
    const container = createContainer();
    const app = new App(container);
    await app.mount();

    expect(container.querySelector('.error')).toBeTruthy();
    expect(container.querySelectorAll('.location-btn').length).toBe(0);
    expect(container.querySelector('.empty')).toBeFalsy();
  });

  it('auto-refreshes after refreshInterval', async () => {
    vi.useFakeTimers();
    mockFetchResponses(defaultLocations, { home: homeDepartures });
    const container = createContainer();
    const app = new App(container);
    await app.mount();

    const fetchCalls = vi.mocked(globalThis.fetch).mock.calls.length;
    await vi.advanceTimersByTimeAsync(30_000);

    expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(fetchCalls + 1);
  });

  it('manual refresh fetches and resets timer', async () => {
    vi.useFakeTimers();
    mockFetchResponses(defaultLocations, { home: homeDepartures });
    const container = createContainer();
    const app = new App(container);
    await app.mount();

    await vi.advanceTimersByTimeAsync(15_000);
    const fetchCallsBeforeClick = vi.mocked(globalThis.fetch).mock.calls.length;

    container.querySelector('.refresh-btn')?.dispatchEvent(new MouseEvent('click'));
    await Promise.resolve();

    expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(fetchCallsBeforeClick + 1);

    await vi.advanceTimersByTimeAsync(15_000);
    expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(fetchCallsBeforeClick + 1);

    await vi.advanceTimersByTimeAsync(15_000);
    expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(fetchCallsBeforeClick + 2);
  });

  it('displays last updated timestamp after successful fetch', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    mockFetchResponses(defaultLocations, { home: homeDepartures });
    const container = createContainer();
    const app = new App(container);
    await app.mount();

    expect(container.querySelector('.last-updated')?.textContent).toBe('Päivitetty 0s sitten');
  });

  it('replaces error with departures after successful auto-refresh', async () => {
    vi.useFakeTimers();
    let callCount = 0;
    globalThis.fetch = vi.fn((input: string | Request | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/locations') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(defaultLocations),
        } as Response);
      }
      callCount += 1;
      if (callCount === 1) {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(homeDepartures),
      } as Response);
    }) as typeof fetch;

    const container = createContainer();
    const app = new App(container);
    await app.mount();
    expect(container.querySelector('.error')).toBeTruthy();

    await vi.advanceTimersByTimeAsync(30_000);
    expect(container.querySelector('.error')).toBeFalsy();
    expect(container.querySelectorAll('.departure-row').length).toBe(3);
  });

  it('does not show a duplicated error message for API errors', async () => {
    globalThis.fetch = vi.fn((input: string | Request | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/locations') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(defaultLocations),
        } as Response);
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found' }),
      } as Response);
    }) as typeof fetch;

    const container = createContainer();
    const app = new App(container);
    await app.mount();

    const error = container.querySelector('.error');
    expect(error?.textContent).toBe('Lähtöjen hakeminen epäonnistui (404)');
  });

  it('ignores stale departure responses after switching location', async () => {
    let resolveHome: (value: LocationDepartures) => void;
    let resolveWork: (value: LocationDepartures) => void;
    const homePromise = new Promise<LocationDepartures>((resolve) => {
      resolveHome = resolve;
    });
    const workPromise = new Promise<LocationDepartures>((resolve) => {
      resolveWork = resolve;
    });

    globalThis.fetch = vi.fn((input: string | Request | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/locations') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(defaultLocations),
        } as Response);
      }
      if (url === '/api/departures?locationId=home') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => homePromise,
        } as Response);
      }
      if (url === '/api/departures?locationId=work') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => workPromise,
        } as Response);
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found' }),
      } as Response);
    }) as typeof fetch;

    const container = createContainer();
    const app = new App(container);
    const mountPromise = app.mount();
    await flushPromises();

    const buttons = container.querySelectorAll('.location-btn');
    buttons[1].dispatchEvent(new MouseEvent('click'));
    await flushPromises();

    resolveWork!(workDepartures);
    await flushPromises();
    resolveHome!(homeDepartures);
    await mountPromise;

    expect(container.querySelector('.location-header')?.textContent).toBe('Työ → Keskusta');
    const rows = container.querySelectorAll('.departure-row');
    expect(rows.length).toBe(2);
    expect(rows[0].querySelector('.route-number')?.textContent).toBe('3');
    expect(rows[0].querySelector('.departure-time')?.textContent).toBe('5 min');
  });
});

describe('index.html', () => {
  it('includes viewport meta tag', () => {
    const htmlText = readFileSync(resolve(process.cwd(), 'index.html'), 'utf-8');
    expect(htmlText).toMatch(/<meta[^>]*name="viewport"[^>]*content="width=device-width, initial-scale=1"[^>]*>/);
  });
});

describe('style.css', () => {
  it('has required CSS rules', () => {
    expect(cssText).toMatch(/\.location-btn\s*\{[^}]*min-height\s*:\s*44px/s);
    expect(cssText).toMatch(/\.route-number\s*\{[^}]*font-size\s*:\s*1\.25rem/s);
    expect(cssText).toMatch(/body\s*\{[^}]*max-width\s*:\s*100vw/s);
    expect(cssText).toMatch(/body\s*\{[^}]*overflow-x\s*:\s*hidden/s);
  });
});
