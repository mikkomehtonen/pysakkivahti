export interface Coordinates {
  lat: number;
  lon: number;
}

export function validateCoordinates(value: unknown): asserts value is Coordinates {
  if (!value || typeof value !== 'object') {
    throw new Error('coordinates must be an object');
  }
  const coordinates = value as Record<string, unknown>;
  if (typeof coordinates.lat !== 'number' || !Number.isFinite(coordinates.lat)) {
    throw new Error('coordinates.lat must be a finite number');
  }
  if (typeof coordinates.lon !== 'number' || !Number.isFinite(coordinates.lon)) {
    throw new Error('coordinates.lon must be a finite number');
  }
  if (coordinates.lat < -90 || coordinates.lat > 90) {
    throw new Error('coordinates.lat must be between -90 and 90');
  }
  if (coordinates.lon < -180 || coordinates.lon > 180) {
    throw new Error('coordinates.lon must be between -180 and 180');
  }
}

export function flatEarthDistance(
  userLat: number,
  userLon: number,
  locLat: number,
  locLon: number,
): number {
  const dLat = (userLat - locLat) * 111_000;
  const dLon = (userLon - locLon) * 111_000 * Math.cos((locLat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLon * dLon);
}
