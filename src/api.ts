import { LocationsResponse, LocationDepartures, Departure } from './types.ts';

const API_BASE = '/api';

async function apiFetch<T>(url: string, errorPrefix: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'tuntematon virhe';
    throw new Error(`${errorPrefix}: ${message}`);
  }
  if (!response.ok) {
    throw new Error(`${errorPrefix} (${response.status})`);
  }
  const data = await response.json();
  if (data === null || typeof data !== 'object') {
    throw new Error(`${errorPrefix}: virheellinen vastaus`);
  }
  return data as T;
}

function isValidDeparture(value: unknown): value is Departure {
  if (value === null || typeof value !== 'object') return false;
  const d = (value as unknown) as Record<string, unknown>;
  return (
    typeof d.routeShortName === 'string' &&
    typeof d.headsign === 'string' &&
    typeof d.minutesUntilDeparture === 'number' &&
    typeof d.realtime === 'boolean'
  );
}

export async function fetchLocations(): Promise<LocationsResponse> {
  const data = await apiFetch<LocationsResponse>(
    `${API_BASE}/locations`,
    'Sijaintien hakeminen epäonnistui',
  );
  if (!Array.isArray(data.locations) || typeof data.refreshInterval !== 'number') {
    throw new Error('Sijaintien hakeminen epäonnistui: virheellinen vastaus');
  }
  return data;
}

export async function fetchDepartures(locationId: string): Promise<LocationDepartures> {
  const data = await apiFetch<LocationDepartures>(
    `${API_BASE}/departures?locationId=${encodeURIComponent(locationId)}`,
    'Lähtöjen hakeminen epäonnistui',
  );
  if (typeof data.locationId !== 'string' || !Array.isArray(data.stops)) {
    throw new Error('Lähtöjen hakeminen epäonnistui: virheellinen vastaus');
  }
  for (const stop of data.stops) {
    const stopRecord = (stop as unknown) as Record<string, unknown>;
    if (
      stop === null ||
      typeof stop !== 'object' ||
      typeof stopRecord.stopName !== 'string' ||
      !Array.isArray(stopRecord.departures)
    ) {
      throw new Error('Lähtöjen hakeminen epäonnistui: virheellinen vastaus');
    }
    for (const departure of stopRecord.departures) {
      if (!isValidDeparture(departure)) {
        throw new Error('Lähtöjen hakeminen epäonnistui: virheellinen vastaus');
      }
    }
  }
  return data;
}
