import type { Server } from 'http';
import type { StopResponse } from '../digitransit.ts';
import { app } from '../server.ts';

export async function withServer(
  callback: (baseUrl: string) => Promise<void>,
  appInstance = app,
): Promise<void> {
  const server: Server = appInstance.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;
  const baseUrl = `http://localhost:${port}`;
  try {
    await callback(baseUrl);
  } finally {
    server.close();
  }
}

export function createDeparture(
  headsign: string,
  secondsUntilDeparture: number,
  options: { realtime?: boolean; shortName?: string } = {},
): StopResponse['stop']['stoptimesWithoutPatterns'][number] {
  // Digitransit uses scheduledDeparture as seconds since midnight and serviceDay as a midnight
  // timestamp. For tests, we use a relative offset so serviceDay + scheduledDeparture equals
  // approximately now + secondsUntilDeparture, keeping the mock data simple.
  const now = Math.floor(Date.now() / 1000);
  const serviceDay = now;
  const scheduledDeparture = secondsUntilDeparture;
  return {
    scheduledDeparture,
    realtimeDeparture: scheduledDeparture,
    realtime: options.realtime ?? true,
    serviceDay,
    headsign,
    trip: { route: { shortName: options.shortName ?? '1', mode: 'TRAM' } },
  };
}

export function createStopResponse(
  name: string,
  departures: StopResponse['stop']['stoptimesWithoutPatterns'],
): StopResponse {
  return { stop: { name, stoptimesWithoutPatterns: departures } };
}
