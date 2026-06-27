import 'dotenv/config';
import express from 'express';
import { pathToFileURL } from 'url';
import { config, ConfigLocation, ConfigRoute, ConfigStop } from './config.ts';
import { fetchStopDepartures } from './digitransit.ts';
import { LocationsResponse, LocationDepartures, StopDepartures } from './src/types.ts';
import { validateCoordinates, flatEarthDistance } from './geo.ts';

export const app = express();

if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist'));
}

export function getPort(): number {
  return Number(process.env.PORT ?? 3000);
}

export function startServer(port = getPort()): ReturnType<typeof app.listen> {
  const server = app.listen(port, () => {
    const address = server.address();
    const actualPort = typeof address === 'object' && address !== null ? address.port : port;
    console.log(`Pysäkkivahti server running on port ${actualPort}`);
  });
  return server;
}

export function buildLocationsResponse(): LocationsResponse {
  const hour = new Date().getHours();
  const logoLinkUrl = process.env.LOGO_LINK_URL?.trim();
  return {
    locations: config.locations.map((location) => {
      const route = selectRoute(location, hour);
      return {
        id: location.id,
        name: location.name,
        destination: resolveDestination(location, route),
      };
    }),
    refreshInterval: config.refreshInterval,
    ...(logoLinkUrl ? { logoLinkUrl } : {}),
  };
}

function selectRoute(location: ConfigLocation, hour: number): ConfigRoute | null {
  if (!location.routes || location.routes.length === 0) {
    return null;
  }
  let fallback: ConfigRoute | null = null;
  for (const route of location.routes) {
    if (route.beforeHour === undefined && route.afterHour === undefined) {
      if (!fallback) {
        fallback = route;
      }
      continue;
    }
    if (route.beforeHour !== undefined && hour < route.beforeHour) {
      return route;
    }
    if (route.afterHour !== undefined && hour >= route.afterHour) {
      return route;
    }
  }
  if (!fallback) {
    fallback = location.routes[0] ?? null;
    if (fallback) {
      console.warn(
        `No time-based route matched for location ${location.id} at hour ${hour}; using first route as fallback`,
      );
    }
  }
  return fallback;
}

function resolveDestination(location: ConfigLocation, route: ConfigRoute | null): string {
  return location.destination ?? route?.destination ?? '';
}

app.get('/api/locations', (_req, res) => {
  res.json(buildLocationsResponse());
});

app.get('/api/locations/nearest', (req, res) => {
  const latParam = req.query.lat;
  const lonParam = req.query.lon;

  if (
    typeof latParam !== 'string' ||
    latParam.length === 0 ||
    typeof lonParam !== 'string' ||
    lonParam.length === 0
  ) {
    return res.status(400).json({ error: 'Puuttuvat koordinaattiparametrit' });
  }

  const lat = Number(latParam);
  const lon = Number(lonParam);
  const coordinates = { lat, lon };
  try {
    validateCoordinates(coordinates);
  } catch {
    return res.status(400).json({ error: 'Virheelliset koordinaattiparametrit' });
  }

  const nearest = findNearestLocation(lat, lon);
  if (!nearest) {
    return res.status(404).json({ error: 'Sijaintia ei löytynyt' });
  }

  const hour = new Date().getHours();
  const route = selectRoute(nearest, hour);
  res.json({
    id: nearest.id,
    name: nearest.name,
    destination: resolveDestination(nearest, route),
  });
});

function findNearestLocation(userLat: number, userLon: number): ConfigLocation | null {
  let best: ConfigLocation | null = null;
  let bestDistance = Infinity;

  for (const location of config.locations) {
    const distance = flatEarthDistance(
      userLat,
      userLon,
      location.coordinates.lat,
      location.coordinates.lon,
    );
    if (distance <= location.radius && distance < bestDistance) {
      best = location;
      bestDistance = distance;
    }
  }

  return best;
}

app.get('/api/departures', async (req, res) => {
  const locationId = req.query.locationId;

  if (typeof locationId !== 'string' || locationId.length === 0) {
    return res.status(400).json({ error: 'Puuttuva tai virheellinen locationId-parametri' });
  }

  const location = config.locations.find((l) => l.id === locationId);
  if (!location) {
    return res.status(404).json({ error: 'Sijaintia ei löytynyt' });
  }

  const apiKey = process.env.PYSAKKIVAHTI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'API-avain puuttuu' });
  }

  const hour = new Date().getHours();
  const route = selectRoute(location, hour);
  const stops = location.stops ?? route?.stops ?? [];

  const results = await Promise.allSettled(
    stops.map((stop) => fetchDeparturesForStop(stop, apiKey, config.departuresCount)),
  );

  if (results.length > 0 && results.every((result) => result.status === 'rejected')) {
    return res.status(502).json({ error: 'Lähtöjen haku epäonnistui' });
  }

  const stopDepartures = results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    const stop = stops[index];
    return { stopName: stop.name, departures: [] };
  });

  const response: LocationDepartures = {
    locationId: location.id,
    destination: resolveDestination(location, route),
    stops: stopDepartures,
  };
  res.json(response);
});

async function fetchDeparturesForStop(
  stop: ConfigStop,
  apiKey: string,
  departuresCount: number,
): Promise<StopDepartures> {
  const numberOfDepartures = Math.max(departuresCount + 12, 15);
  const data = await fetchStopDepartures(stop.id, apiKey, numberOfDepartures);
  const stopName = data.stop.name;
  const allDepartures = data.stop.stoptimesWithoutPatterns;

  const departuresWithSeconds: { departure: (typeof allDepartures)[number]; secondsUntilDeparture: number }[] = [];
  for (const departure of allDepartures) {
    const scheduledDeparture = departure.scheduledDeparture;
    const serviceDay = departure.serviceDay;
    if (scheduledDeparture === undefined || serviceDay === undefined) continue;
    const departureSeconds = departure.realtime
      ? (departure.realtimeDeparture ?? scheduledDeparture)
      : scheduledDeparture;
    const departureTimestamp = serviceDay + departureSeconds;
    const secondsUntilDeparture = departureTimestamp - Math.floor(Date.now() / 1000);
    if (secondsUntilDeparture > 0) {
      departuresWithSeconds.push({ departure, secondsUntilDeparture });
    }
  }

  // filterHeadsigns uses case-insensitive substring matching by design (plan.md)
  const filtered = departuresWithSeconds
    .filter(({ departure }) => {
      if (!stop.filterHeadsigns || stop.filterHeadsigns.length === 0) return true;
      const headsign = departure.headsign ?? '';
      return stop.filterHeadsigns.some((filter) =>
        headsign.toLowerCase().includes(filter.toLowerCase()),
      );
    })
    .slice(0, departuresCount)
    .map(({ departure, secondsUntilDeparture }) => ({
      routeShortName: departure.trip?.route?.shortName ?? '',
      headsign: departure.headsign ?? '',
      minutesUntilDeparture: Math.max(1, Math.round(secondsUntilDeparture / 60)),
      realtime: departure.realtime ?? false,
    }));

  return { stopName, departures: filtered };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  startServer();
}
