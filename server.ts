import 'dotenv/config';
import express from 'express';
import { pathToFileURL } from 'url';
import { LocationsResponse, LocationDepartures } from './src/types.ts';

export const app = express();

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

const locationsResponse: LocationsResponse = {
  locations: [
    { id: 'home', name: 'Koti', destination: 'Keskusta' },
    { id: 'work', name: 'Työ', destination: 'Keskusta' },
    { id: 'city_centre', name: 'Keskusta', destination: 'Koti' },
  ],
  refreshInterval: 30,
};

const departuresByLocation: Record<string, LocationDepartures> = {
  home: {
    locationId: 'home',
    stops: [
      {
        stopName: 'Särkänniemi B',
        departures: [
          { routeShortName: '1', headsign: 'Keskustori', minutesUntilDeparture: 3, realtime: true },
          { routeShortName: '1', headsign: 'Keskustori', minutesUntilDeparture: 12, realtime: true },
          { routeShortName: '1', headsign: 'Keskustori', minutesUntilDeparture: 21, realtime: false },
        ],
      },
    ],
  },
  work: {
    locationId: 'work',
    stops: [
      {
        stopName: 'Työ',
        departures: [
          { routeShortName: '3', headsign: 'Keskustori', minutesUntilDeparture: 5, realtime: true },
          { routeShortName: '3', headsign: 'Keskustori', minutesUntilDeparture: 15, realtime: false },
          { routeShortName: '3', headsign: 'Keskustori', minutesUntilDeparture: 25, realtime: true },
        ],
      },
    ],
  },
  city_centre: {
    locationId: 'city_centre',
    stops: [
      {
        stopName: 'Keskustori E',
        departures: [
          { routeShortName: '1', headsign: 'Lentävänniemi', minutesUntilDeparture: 4, realtime: true },
          { routeShortName: '1', headsign: 'Lentävänniemi', minutesUntilDeparture: 14, realtime: true },
          { routeShortName: '1', headsign: 'Lentävänniemi', minutesUntilDeparture: 24, realtime: false },
        ],
      },
    ],
  },
};

app.get('/api/locations', (_req, res) => {
  res.json(locationsResponse);
});

app.get('/api/departures', (req, res) => {
  const locationId = req.query.locationId;

  if (typeof locationId !== 'string' || locationId.length === 0) {
    return res.status(400).json({ error: 'Puuttuva tai virheellinen locationId-parametri' });
  }

  const departures = departuresByLocation[locationId];
  if (!departures) {
    return res.status(404).json({ error: 'Sijaintia ei löytynyt' });
  }

  res.json(departures);
});

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  startServer();
}
