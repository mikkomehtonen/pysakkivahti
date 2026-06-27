export interface Location {
  id: string;
  name: string;
  destination: string;
}

export function isValidLocation(value: unknown): value is Location {
  if (value === null || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.name === 'string' &&
    typeof record.destination === 'string'
  );
}

export interface Departure {
  routeShortName: string;
  headsign: string;
  minutesUntilDeparture: number;
  realtime: boolean;
}

export interface StopDepartures {
  stopName: string;
  departures: Departure[];
}

export interface LocationsResponse {
  locations: Location[];
  refreshInterval: number;
  logoLinkUrl?: string;
}

export interface LocationDepartures {
  locationId: string;
  destination: string;
  stops: StopDepartures[];
}
