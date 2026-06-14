import { Location, isValidLocation } from './types.ts';

const API_BASE = '/api';

export function detectLocation(): Promise<Location | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          const response = await fetch(`${API_BASE}/locations/nearest?lat=${lat}&lon=${lon}`);
          if (!response.ok) {
            resolve(null);
            return;
          }
          const data = (await response.json()) as unknown;
          if (!isValidLocation(data)) {
            resolve(null);
            return;
          }
          resolve(data);
        } catch {
          resolve(null);
        }
      },
      () => {
        resolve(null);
      },
    );
  });
}
