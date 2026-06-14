import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchStopDepartures } from '../digitransit.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchStopDepartures', () => {
  it('extracts stop data from the GraphQL response envelope', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            data: {
              stop: {
                name: 'Särkänniemi B',
                stoptimesWithoutPatterns: [
                  {
                    scheduledDeparture: 180,
                    realtimeDeparture: 180,
                    realtime: true,
                    serviceDay: 1_000_000_000,
                    headsign: 'Keskustori',
                    trip: { route: { shortName: '1', mode: 'TRAM' } },
                  },
                ],
              },
            },
          }),
      } as Response),
    ) as typeof fetch;

    const result = await fetchStopDepartures('tampere:0851', 'test-key');
    expect(result.stop.name).toBe('Särkänniemi B');
    expect(result.stop.stoptimesWithoutPatterns).toHaveLength(1);
    expect(result.stop.stoptimesWithoutPatterns[0].headsign).toBe('Keskustori');
  });

  it('throws when the response contains GraphQL errors', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ errors: [{ message: 'Invalid stop id' }] }),
      } as Response),
    ) as typeof fetch;

    await expect(fetchStopDepartures('tampere:0851', 'test-key')).rejects.toThrow('GraphQL errors');
  });

  it('throws when the response is missing stop data', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: {} }),
      } as Response),
    ) as typeof fetch;

    await expect(fetchStopDepartures('tampere:0851', 'test-key')).rejects.toThrow(
      'missing stop data',
    );
  });

  it('throws when the HTTP response is not ok', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        json: () => Promise.resolve({}),
      } as Response),
    ) as typeof fetch;

    await expect(fetchStopDepartures('tampere:0851', 'test-key')).rejects.toThrow('401');
  });

  it('sends the stop id as a GraphQL variable', async () => {
    const fetchMock = vi.fn<typeof fetch>((_input, _init) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            data: { stop: { name: 'Test', stoptimesWithoutPatterns: [] } },
          }),
      } as Response),
    );
    globalThis.fetch = fetchMock;

    await fetchStopDepartures('tampere:0851', 'test-key');
    const init = fetchMock.mock.calls[0][1];
    const body = JSON.parse((init?.body as string) ?? '{}');
    expect(body.variables).toEqual({ stopId: 'tampere:0851', numberOfDepartures: 15 });
  });
});
