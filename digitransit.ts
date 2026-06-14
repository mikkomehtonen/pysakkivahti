export interface StopResponse {
  stop: {
    name: string;
    stoptimesWithoutPatterns: {
      scheduledDeparture?: number;
      realtimeDeparture?: number;
      realtime?: boolean;
      serviceDay?: number;
      headsign?: string;
      trip?: {
        route?: {
          shortName?: string;
          mode?: string;
        };
      };
    }[];
  };
}

interface DigitransitResponse {
  data: StopResponse;
  errors?: unknown[];
}

const API_URL = 'https://api.digitransit.fi/routing/v2/waltti/gtfs/v1';

export async function fetchStopDepartures(
  stopId: string,
  apiKey: string,
  numberOfDepartures = 15,
): Promise<StopResponse> {
  const query = `
    query ($stopId: String!, $numberOfDepartures: Int!) {
      stop(id: $stopId) {
        name
        stoptimesWithoutPatterns(numberOfDepartures: $numberOfDepartures) {
          scheduledDeparture
          realtimeDeparture
          realtime
          serviceDay
          headsign
          trip { route { shortName mode } }
        }
      }
    }
  `;

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'digitransit-subscription-key': apiKey,
    },
    body: JSON.stringify({ query, variables: { stopId, numberOfDepartures } }),
  });

  if (!response.ok) {
    throw new Error(`Digitransit API returned ${response.status}`);
  }

  const result = (await response.json()) as DigitransitResponse;
  if (result.errors && result.errors.length > 0) {
    throw new Error(`Digitransit GraphQL errors: ${JSON.stringify(result.errors)}`);
  }
  if (!result.data || !result.data.stop) {
    throw new Error('Digitransit response missing stop data');
  }
  return result.data;
}
