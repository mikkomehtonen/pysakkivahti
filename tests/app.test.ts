import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, statSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

vi.mock('../src/geolocation.ts', () => ({
  detectLocation: vi.fn(() => Promise.resolve(null)),
}));

import { detectLocation } from '../src/geolocation.ts';
import { App } from '../src/app.ts';
import type { LocationsResponse, LocationDepartures } from '../src/types.ts';

const mockDetectLocation = vi.mocked(detectLocation);

const cssText = readFileSync(resolve(process.cwd(), 'src/style.css'), 'utf-8');

function createContainer(): HTMLElement {
  document.body.innerHTML = '<div id="app"></div>';
  return document.getElementById('app')!;
}

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

const mountedApps: App[] = [];

function createApp(container: HTMLElement): App {
  const app = new App(container);
  mountedApps.push(app);
  return app;
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
  destination: 'Keskusta',
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
  destination: 'Keskusta',
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
  destination: 'Keskusta',
  stops: [{ stopName: 'Särkänniemi B', departures: [] }],
};

describe('App', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    for (const app of mountedApps) {
      app.destroy();
    }
    mountedApps.length = 0;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('selects first location on mount and renders header', async () => {
    mockFetchResponses(defaultLocations, { home: homeDepartures });
    const container = createContainer();
    const app = createApp(container);
    await app.mount();

    expect(container.querySelector('.location-header')?.textContent).toBe('Koti → Keskusta');
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/departures?locationId=home');
  });

  it('wraps the app title in a header element and content in a main element', async () => {
    mockFetchResponses(defaultLocations, { home: homeDepartures });
    const container = createContainer();
    const app = createApp(container);
    await app.mount();

    const header = container.querySelector('header');
    const main = container.querySelector('main');
    expect(header).toBeTruthy();
    expect(main).toBeTruthy();
    expect(header?.querySelector('.app-title')).toBeTruthy();
    expect(main?.querySelector('.location-header')).toBeTruthy();
    expect(main?.querySelector('.departures-container')).toBeTruthy();
    expect(main?.querySelector('.status-bar')).toBeTruthy();
    expect(main?.querySelector('.location-buttons')).toBeTruthy();
  });

  it('renders the logo to the left of the app title', async () => {
    mockFetchResponses(defaultLocations, { home: homeDepartures });
    const container = createContainer();
    const app = createApp(container);
    await app.mount();

    const header = container.querySelector('header.app-header');
    expect(header).toBeTruthy();

    const logo = header?.querySelector('img.app-logo');
    expect(logo).toBeTruthy();
    expect(logo?.getAttribute('src')).toBe('/favicon.svg');
    expect(logo?.getAttribute('alt')).toBe('');

    const title = header?.querySelector('.app-title');
    expect(title).toBeTruthy();
    expect(title?.textContent).toBe('Pysäkkivahti');

    const children = Array.from(header!.children);
    const logoIndex = children.findIndex((child) => child.classList.contains('app-logo'));
    const titleIndex = children.findIndex((child) => child.classList.contains('app-title'));
    expect(logoIndex).toBe(0);
    expect(titleIndex).toBe(1);
    expect(logoIndex).toBeLessThan(titleIndex);
  });

  it('wraps the logo in a link when logoLinkUrl is provided', async () => {
    const locations = { ...defaultLocations, logoLinkUrl: 'https://example.com' };
    mockFetchResponses(locations, { home: homeDepartures });
    const container = createContainer();
    const app = createApp(container);
    await app.mount();

    const header = container.querySelector('header.app-header');
    expect(header).toBeTruthy();

    const link = header?.querySelector('a.app-logo-link');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toBe('https://example.com');
    expect(link?.getAttribute('aria-label')).toBe('Pysäkkivahti');
    expect(link?.hasAttribute('target')).toBe(false);

    const logo = link?.querySelector('img.app-logo');
    expect(logo).toBeTruthy();
    expect(logo?.getAttribute('src')).toBe('/favicon.svg');
    expect(logo?.getAttribute('alt')).toBe('');

    const headerChildren = Array.from(header!.children);
    expect(headerChildren[0]).toBe(link);
  });

  it('keeps the logo as a plain image when logoLinkUrl is absent', async () => {
    mockFetchResponses(defaultLocations, { home: homeDepartures });
    const container = createContainer();
    const app = createApp(container);
    await app.mount();

    const header = container.querySelector('header.app-header');
    expect(header?.querySelector('a.app-logo-link')).toBeFalsy();

    const logo = header?.querySelector('img.app-logo');
    expect(logo?.parentElement).toBe(header);
  });

  it('keeps the logo as a plain image when logoLinkUrl is empty', async () => {
    const locations = { ...defaultLocations, logoLinkUrl: '' };
    mockFetchResponses(locations, { home: homeDepartures });
    const container = createContainer();
    const app = createApp(container);
    await app.mount();

    const header = container.querySelector('header.app-header');
    expect(header?.querySelector('a.app-logo-link')).toBeFalsy();

    const logo = header?.querySelector('img.app-logo');
    expect(logo?.parentElement).toBe(header);
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
    const app = createApp(container);
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
    const app = createApp(container);
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
    const app = createApp(container);
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
    const app = createApp(container);
    await app.mount();

    const rows = container.querySelectorAll('.departure-row');
    expect(rows[0].classList.contains('departure--realtime')).toBe(true);
    expect(rows[1].classList.contains('departure--realtime')).toBe(true);
    expect(rows[2].classList.contains('departure--realtime')).toBe(false);
  });

  it('switches location and active button on click', async () => {
    mockFetchResponses(defaultLocations, { home: homeDepartures, work: workDepartures });
    const container = createContainer();
    const app = createApp(container);
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
    const app = createApp(container);
    const mountPromise = app.mount();
    await flushPromises();

    expect(container.querySelector('.loading')).toBeTruthy();
    expect(container.querySelector('.loading')?.getAttribute('aria-label')).toBe('Ladataan');

    resolveDepartures!({ locationId: 'home', destination: 'Keskusta', stops: [] });
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
    const app = createApp(container);
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
    const app = createApp(container);
    await app.mount();

    expect(container.querySelector('.error')).toBeTruthy();
    expect(container.querySelector('.error')?.textContent).toContain('Sijaintien hakeminen epäonnistui');
  });

  it('shows error when logoLinkUrl is not a string', async () => {
    globalThis.fetch = vi.fn((input: string | Request | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/locations') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ locations: [], refreshInterval: 30, logoLinkUrl: 123 }),
        } as Response);
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found' }),
      } as Response);
    }) as typeof fetch;

    const container = createContainer();
    const app = createApp(container);
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
    const app = createApp(container);
    await app.mount();

    expect(container.querySelector('.error')).toBeTruthy();
    expect(container.querySelector('.error')?.textContent).toContain('Lähtöjen hakeminen epäonnistui');
  });

  it('shows "Ei lähtöjä" when no departures', async () => {
    mockFetchResponses(defaultLocations, { home: emptyDepartures });
    const container = createContainer();
    const app = createApp(container);
    await app.mount();

    expect(container.querySelector('.empty')?.textContent).toBe('Ei lähtöjä');
  });

  it('shows error and no buttons when locations fetch fails', async () => {
    mockFetchError('Network error');
    const container = createContainer();
    const app = createApp(container);
    await app.mount();

    expect(container.querySelector('.error')).toBeTruthy();
    expect(container.querySelectorAll('.location-btn').length).toBe(0);
    expect(container.querySelector('.empty')).toBeFalsy();
  });

  it('auto-refreshes after refreshInterval', async () => {
    vi.useFakeTimers();
    mockFetchResponses(defaultLocations, { home: homeDepartures });
    const container = createContainer();
    const app = createApp(container);
    await app.mount();

    const fetchCalls = vi.mocked(globalThis.fetch).mock.calls.length;
    await vi.advanceTimersByTimeAsync(30_000);

    expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(fetchCalls + 1);
  });

  it('manual refresh fetches and resets timer', async () => {
    vi.useFakeTimers();
    mockFetchResponses(defaultLocations, { home: homeDepartures });
    const container = createContainer();
    const app = createApp(container);
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
    const app = createApp(container);
    await app.mount();

    expect(container.querySelector('.last-updated')?.textContent).toBe('Päivitetty 0s sitten');
  });

  it('updates relative time every second via timeAgo timer', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const longRefreshIntervalLocations = { ...defaultLocations, refreshInterval: 1_000_000 };
    mockFetchResponses(longRefreshIntervalLocations, { home: homeDepartures });
    const container = createContainer();
    const app = createApp(container);
    await app.mount();

    expect(container.querySelector('.last-updated')?.textContent).toBe('Päivitetty 0s sitten');

    await vi.advanceTimersByTimeAsync(1_000);
    expect(container.querySelector('.last-updated')?.textContent).toBe('Päivitetty 1s sitten');

    await vi.advanceTimersByTimeAsync(4_000);
    expect(container.querySelector('.last-updated')?.textContent).toBe('Päivitetty 5s sitten');

    await vi.advanceTimersByTimeAsync(85_000);
    expect(container.querySelector('.last-updated')?.textContent).toBe('Päivitetty 1min sitten');

    await vi.advanceTimersByTimeAsync(30_000);
    expect(container.querySelector('.last-updated')?.textContent).toBe('Päivitetty 2min sitten');

    await vi.advanceTimersByTimeAsync(3_580_000);
    expect(container.querySelector('.last-updated')?.textContent).toBe('Päivitetty 1h sitten');

    app.destroy();
  });

  it('does not update last-updated when no data has been fetched', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
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
    const app = createApp(container);
    await app.mount();

    const lastUpdated = container.querySelector('.last-updated');
    expect(lastUpdated?.textContent).toBe('');

    await vi.advanceTimersByTimeAsync(1_000);
    expect(lastUpdated?.textContent).toBe('');

    app.destroy();
  });

  it('clears timeAgo timer on destroy', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const longRefreshIntervalLocations = { ...defaultLocations, refreshInterval: 1_000_000 };
    mockFetchResponses(longRefreshIntervalLocations, { home: homeDepartures });
    const container = createContainer();
    const app = createApp(container);
    await app.mount();

    expect(container.querySelector('.last-updated')?.textContent).toBe('Päivitetty 0s sitten');

    app.destroy();
    await vi.advanceTimersByTimeAsync(5_000);

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
    const app = createApp(container);
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
    const app = createApp(container);
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
    const app = createApp(container);
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

  it('marks GPS-detected location with location-btn--gps class and a gps-indicator element', async () => {
    mockDetectLocation.mockResolvedValue({ id: 'home', name: 'Koti', destination: 'Keskusta' });
    mockFetchResponses(defaultLocations, { home: homeDepartures });
    const container = createContainer();
    const app = createApp(container);
    await app.mount();

    const buttons = container.querySelectorAll('.location-btn');
    expect(buttons[0].classList.contains('location-btn--gps')).toBe(true);
    expect(buttons[0].classList.contains('location-btn--active')).toBe(true);

    const indicator = buttons[0].querySelector('.gps-indicator');
    expect(indicator).toBeTruthy();
    expect(indicator).toBeInstanceOf(HTMLElement);
    expect(buttons[1].querySelector('.gps-indicator')).toBeFalsy();
    expect(buttons[2].querySelector('.gps-indicator')).toBeFalsy();
  });

  it('removes location-btn--gps class and gps-indicator elements when a different location is selected manually', async () => {
    mockDetectLocation.mockResolvedValue({ id: 'home', name: 'Koti', destination: 'Keskusta' });
    mockFetchResponses(defaultLocations, { home: homeDepartures, work: workDepartures });
    const container = createContainer();
    const app = createApp(container);
    await app.mount();

    const buttonsBefore = container.querySelectorAll('.location-btn');
    expect(buttonsBefore[0].classList.contains('location-btn--gps')).toBe(true);
    expect(buttonsBefore[0].querySelector('.gps-indicator')).toBeTruthy();

    buttonsBefore[1].dispatchEvent(new MouseEvent('click'));
    await flushPromises();

    const buttonsAfter = container.querySelectorAll('.location-btn');
    expect(buttonsAfter[0].classList.contains('location-btn--gps')).toBe(false);
    expect(buttonsAfter[1].classList.contains('location-btn--gps')).toBe(false);
    expect(buttonsAfter[1].classList.contains('location-btn--active')).toBe(true);
    expect(buttonsAfter[0].querySelector('.gps-indicator')).toBeFalsy();
    expect(buttonsAfter[1].querySelector('.gps-indicator')).toBeFalsy();
    expect(buttonsAfter[2].querySelector('.gps-indicator')).toBeFalsy();
  });

  it('updates selectedLocation destination from departure response on auto-refresh', async () => {
    vi.useFakeTimers();
    mockDetectLocation.mockResolvedValue(null);

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
      if (url === '/api/departures?locationId=home') {
        callCount += 1;
        const destination = callCount === 1 ? 'Keskusta' : 'Muu';
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              locationId: 'home',
              destination,
              stops: [{ stopName: 'Särkänniemi B', departures: [] }],
            }),
        } as Response);
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found' }),
      } as Response);
    }) as typeof fetch;

    const container = createContainer();
    const app = createApp(container);
    await app.mount();

    expect(container.querySelector('.location-header')?.textContent).toBe('Koti → Keskusta');

    await vi.advanceTimersByTimeAsync(30_000);
    expect(container.querySelector('.location-header')?.textContent).toBe('Koti → Muu');
  });

  it('reloads departures when page becomes visible', async () => {
    mockFetchResponses(defaultLocations, { home: homeDepartures });
    const container = createContainer();
    const app = createApp(container);
    await app.mount();

    const fetchCalls = vi.mocked(globalThis.fetch).mock.calls.length;
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(fetchCalls + 1);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenLastCalledWith('/api/departures?locationId=home');
  });

  it('does not reload departures when page becomes hidden', async () => {
    mockFetchResponses(defaultLocations, { home: homeDepartures });
    const container = createContainer();
    const app = createApp(container);
    await app.mount();

    const fetchCalls = vi.mocked(globalThis.fetch).mock.calls.length;
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(fetchCalls);
  });

  it('does not reload after visibility change when destroyed', async () => {
    mockFetchResponses(defaultLocations, { home: homeDepartures });
    const container = createContainer();
    const app = createApp(container);
    await app.mount();

    app.destroy();
    const fetchCalls = vi.mocked(globalThis.fetch).mock.calls.length;
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(fetchCalls);
  });

  it('replaces stale error with fresh departures when page becomes visible', async () => {
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
    const app = createApp(container);
    await app.mount();
    expect(container.querySelector('.error')).toBeTruthy();

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await flushPromises();

    expect(container.querySelector('.error')).toBeFalsy();
    expect(container.querySelectorAll('.departure-row').length).toBe(3);
  });

  it('resets auto-refresh timer after visibility reload', async () => {
    vi.useFakeTimers();
    mockFetchResponses(defaultLocations, { home: homeDepartures });
    const container = createContainer();
    const app = createApp(container);
    await app.mount();

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    const fetchCallsAfterVisibility = vi.mocked(globalThis.fetch).mock.calls.length;

    await vi.advanceTimersByTimeAsync(29_000);
    expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(fetchCallsAfterVisibility);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(fetchCallsAfterVisibility + 1);
  });
});

describe('index.html', () => {
  it('includes viewport meta tag', () => {
    const htmlText = readFileSync(resolve(process.cwd(), 'index.html'), 'utf-8');
    expect(htmlText).toMatch(/<meta[^>]*name="viewport"[^>]*content="width=device-width, initial-scale=1"[^>]*>/);
  });

  it('includes favicon link with correct attributes', () => {
    const htmlText = readFileSync(resolve(process.cwd(), 'index.html'), 'utf-8');
    expect(htmlText).toMatch(/<link[^>]*rel="icon"[^>]*href="\/favicon\.svg"[^>]*type="image\/svg\+xml"[^>]*>/);
  });

  it('favicon link appears before the title element', () => {
    const htmlText = readFileSync(resolve(process.cwd(), 'index.html'), 'utf-8');
    const faviconPos = htmlText.indexOf('/favicon.svg');
    const titlePos = htmlText.indexOf('<title>');
    expect(faviconPos).toBeGreaterThan(-1);
    expect(titlePos).toBeGreaterThan(-1);
    expect(faviconPos).toBeLessThan(titlePos);
  });

  it('includes Google Fonts preconnect hints', () => {
    const htmlText = readFileSync(resolve(process.cwd(), 'index.html'), 'utf-8');
    expect(htmlText).toMatch(/<link[^>]*rel="preconnect"[^>]*href="https:\/\/fonts\.googleapis\.com"[^>]*>/);
    expect(htmlText).toMatch(/<link[^>]*rel="preconnect"[^>]*href="https:\/\/fonts\.gstatic\.com"[^>]*crossorigin[^>]*>/);
  });

  it('includes a Google Font link with display=swap before the title', () => {
    const htmlText = readFileSync(resolve(process.cwd(), 'index.html'), 'utf-8');
    expect(htmlText).toMatch(/<link[^>]*href="https:\/\/fonts\.googleapis\.com\/css2\?family=[^"]+display=swap"[^>]*>/);
    const fontPos = htmlText.indexOf('fonts.googleapis.com/css2');
    const titlePos = htmlText.indexOf('<title>');
    expect(fontPos).toBeGreaterThan(-1);
    expect(titlePos).toBeGreaterThan(-1);
    expect(fontPos).toBeLessThan(titlePos);
  });
});

describe('favicon.svg', () => {
  it('exists in public/ directory with non-zero size', () => {
    const faviconPath = resolve(process.cwd(), 'public/favicon.svg');
    expect(existsSync(faviconPath)).toBe(true);
    const stats = statSync(faviconPath);
    expect(stats.size).toBeGreaterThan(0);
  });

  it('no longer exists at project root', () => {
    const rootFaviconPath = resolve(process.cwd(), 'favicon.svg');
    expect(existsSync(rootFaviconPath)).toBe(false);
  });
});

describe('impeccable', () => {
  it('detects no anti-patterns in src/', () => {
    let exitCode = 0;
    try {
      execSync('npx --no-install impeccable detect src/', {
        encoding: 'utf-8',
        cwd: process.cwd(),
        stdio: 'pipe',
      });
    } catch (err) {
      exitCode = (err as { status?: number }).status ?? 1;
    }
    expect(exitCode).toBe(0);
  });
});

describe('style.css', () => {
  it('has required CSS rules', () => {
    expect(cssText).toMatch(/\.location-btn\s*\{[^}]*min-height\s*:\s*44px/s);
    expect(cssText).toMatch(/\.route-number\s*\{[^}]*font-size\s*:\s*1\.25rem/s);
    expect(cssText).toMatch(/body\s*\{[^}]*max-width\s*:\s*100vw/s);
    expect(cssText).toMatch(/body\s*\{[^}]*overflow-x\s*:\s*hidden/s);
    expect(cssText).toMatch(/\.location-btn--gps\s*\{/s);
  });

  it('styles the header as a flex row and sizes the logo', () => {
    const headerRule = cssText.match(/\.app-header\s*\{([^}]*)\}/s);
    expect(headerRule).toBeTruthy();
    expect(headerRule![1]).toMatch(/display\s*:\s*flex/s);
    expect(headerRule![1]).toMatch(/align-items\s*:\s*center/s);
    expect(headerRule![1]).toMatch(/gap\s*:\s*var\(--space-/s);
    expect(headerRule![1]).toMatch(/margin-bottom\s*:/s);

    const logoRule = cssText.match(/\.app-logo\s*\{([^}]*)\}/s);
    expect(logoRule).toBeTruthy();
    const widthMatch = logoRule![1].match(/width\s*:\s*([\d.]+rem)/s);
    const heightMatch = logoRule![1].match(/height\s*:\s*([\d.]+rem)/s);
    expect(widthMatch).toBeTruthy();
    expect(heightMatch).toBeTruthy();
    expect(widthMatch![1]).toBe(heightMatch![1]);
    expect(logoRule![1]).toMatch(/flex-shrink\s*:\s*0/s);
  });

  it('styles the logo link wrapper and adds a focus ring', () => {
    const linkRule = cssText.match(/\.app-logo-link\s*\{([^}]*)\}/s);
    expect(linkRule).toBeTruthy();
    expect(linkRule![1]).toMatch(/display\s*:\s*inline-flex/s);
    expect(linkRule![1]).toMatch(/flex-shrink\s*:\s*0/s);
    expect(linkRule![1]).toMatch(/text-decoration\s*:\s*none/s);

    const focusRule = cssText.match(/\.app-logo-link:focus-visible\s*\{([^}]*)\}/s);
    expect(focusRule).toBeTruthy();
    expect(focusRule![1]).toMatch(/outline/s);
  });

  it('defines the brand accent and a 4px spacing scale', () => {
    expect(cssText).toMatch(/--color-accent\s*:\s*oklch\(/s);
    const spaceMatches = cssText.match(/--space-\w+\s*:/g) ?? [];
    expect(spaceMatches.length).toBeGreaterThanOrEqual(4);
  });

  it('uses the Google Font display face for headings and a system font for body', () => {
    expect(cssText).toMatch(/\.app-title\s*\{[^}]*font-family\s*:\s*var\(--font-display\)/s);
    expect(cssText).toMatch(/\.location-header\s*\{[^}]*font-family\s*:\s*var\(--font-display\)/s);
    expect(cssText).toMatch(/body\s*\{[^}]*font-family\s*:\s*var\(--font-body\)/s);
  });

  it('has a body font-size of at least 1rem and a modular type scale', () => {
    const bodyMatch = cssText.match(/body\s*\{[^}]*font-size\s*:\s*([\d.]+)rem/s);
    expect(bodyMatch).toBeTruthy();
    expect(parseFloat(bodyMatch![1])).toBeGreaterThanOrEqual(1);
    const typeScale = [0.875, 1.125, 1.5, 2.0];
    for (const size of typeScale) {
      expect(cssText).toMatch(new RegExp(`font-size\\s*:\\s*${size.toString().replace('.', '\\.')}rem`));
    }
    for (let i = 1; i < typeScale.length; i += 1) {
      expect(typeScale[i] / typeScale[i - 1]).toBeGreaterThanOrEqual(1.25);
    }
  });

  it('does not use a side-tab border on the GPS button', () => {
    const gpsRule = cssText.match(/\.location-btn--gps\s*\{([^}]*)\}/s);
    expect(gpsRule).toBeTruthy();
    expect(gpsRule![1]).not.toMatch(/border-left\s*:/);
  });

  it('does not use extreme border-radius on cards or gradient text', () => {
    expect(cssText).not.toMatch(/border-radius\s*:\s*(1[7-9]|[2-9]\d)\s*px/);
    expect(cssText).not.toMatch(/background-clip\s*:\s*text/);
  });

  it('does not use purple, violet, or cyan as the primary color', () => {
    expect(cssText).not.toMatch(/oklch\([^)]*0\.(1[0-9]|[2-9][0-9])\s+(?:2[7-9][0-9]|3[0-3][0-9])(?:\.\d+)?\)/);
    expect(cssText).not.toMatch(/#7c3aed|#8b5cf6|#06b6d4/);
  });

  it('does not use a warm cream or beige background', () => {
    const rootMatch = cssText.match(/:root\s*\{[^}]*--color-bg\s*:\s*(#[0-9a-f]{6})/s);
    expect(rootMatch).toBeTruthy();
    expect(rootMatch![1]).not.toMatch(/f5f5f5|faf5ee/i);
    const bodyMatch = cssText.match(/body\s*\{([^}]*)\}/s);
    expect(bodyMatch).toBeTruthy();
    expect(bodyMatch![1]).not.toMatch(/#f5f5f5|#faf5ee/i);
  });

  it('provides visible focus rings on buttons', () => {
    expect(cssText).toMatch(/\.location-btn:focus-visible\s*\{[^}]*(?:outline|box-shadow)/s);
    expect(cssText).toMatch(/\.refresh-btn:focus-visible\s*\{[^}]*(?:outline|box-shadow)/s);
  });

  it('has hover and active states with short transitions', () => {
    expect(cssText).toMatch(/\.location-btn:hover\s*\{/s);
    expect(cssText).toMatch(/\.location-btn:active\s*\{/s);
    const transitionMatch = cssText.match(/\.location-btn\s*\{[^}]*transition\s*:([^}]*)\}/s)
      ?? cssText.match(/\.refresh-btn\s*\{[^}]*transition\s*:([^}]*)\}/s);
    expect(transitionMatch).toBeTruthy();
    const durations = [...transitionMatch![1].matchAll(/(\d+)ms/g)].map((m) => parseInt(m[1], 10));
    expect(durations.length).toBeGreaterThan(0);
    expect(Math.max(...durations)).toBeLessThanOrEqual(200);
    expect(cssText).not.toMatch(/transition-timing-function\s*:\s*[^;]*(?:bounce|elastic)/);
  });

  it('respects reduced motion preferences', () => {
    expect(cssText).toMatch(/@media\s*\(prefers-reduced-motion\s*:\s*reduce\)\s*\{[^}]*transition-duration\s*:\s*0s/s);
  });
});
