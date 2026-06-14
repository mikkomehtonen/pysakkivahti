export interface Location {
  id: string;
  name: string;
  destination: string;
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
}

export interface LocationDepartures {
  locationId: string;
  stops: StopDepartures[];
}
