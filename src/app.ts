import { fetchDepartures as apiFetchDepartures, fetchLocations } from './api.ts';
import { detectLocation } from './geolocation.ts';
import { Departure, Location, LocationDepartures } from './types.ts';
import './style.css';

interface AppState {
  locations: Location[];
  selectedLocation: Location | null;
  departures: LocationDepartures | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refreshInterval: number;
}

export class App {
  private container: HTMLElement;
  private state: AppState;
  private timer: ReturnType<typeof setInterval> | null = null;
  private requestId = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    this.state = {
      locations: [],
      selectedLocation: null,
      departures: null,
      loading: false,
      error: null,
      lastUpdated: null,
      refreshInterval: 30,
    };
  }

  async mount(): Promise<void> {
    this.renderSkeleton();
    try {
      const locationsResponse = await fetchLocations();
      this.state.locations = locationsResponse.locations;
      this.state.refreshInterval = locationsResponse.refreshInterval;

      const detected = await detectLocation(this.state.locations);
      const selected = detected ?? this.state.locations[0] ?? null;
      this.state.selectedLocation = selected;

      if (selected) {
        await this.loadDepartures(selected.id);
      } else {
        this.render();
      }
    } catch (err) {
      this.state.error = err instanceof Error ? err.message : 'Tuntematon virhe';
      this.render();
    }
  }

  destroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async loadDepartures(locationId: string): Promise<void> {
    const requestId = ++this.requestId;
    this.state.loading = true;
    this.state.error = null;
    this.render();

    try {
      const departures = await apiFetchDepartures(locationId);
      if (requestId !== this.requestId) return;
      this.state.departures = departures;
      this.state.lastUpdated = new Date();
    } catch (err) {
      if (requestId !== this.requestId) return;
      this.state.error = err instanceof Error ? err.message : 'Tuntematon virhe';
      this.state.departures = null;
    } finally {
      if (requestId === this.requestId) {
        this.state.loading = false;
      }
    }

    if (requestId === this.requestId) {
      this.resetTimer();
      this.render();
    }
  }

  private selectLocation(location: Location): void {
    if (this.state.selectedLocation?.id === location.id) return;
    this.state.selectedLocation = location;
    void this.loadDepartures(location.id);
  }

  private refresh(): void {
    if (this.state.selectedLocation) {
      void this.loadDepartures(this.state.selectedLocation.id);
    } else if (this.state.locations.length === 0) {
      void this.reloadLocations();
    }
  }

  private async reloadLocations(): Promise<void> {
    this.state.loading = true;
    this.state.error = null;
    this.render();

    try {
      const locationsResponse = await fetchLocations();
      this.state.locations = locationsResponse.locations;
      this.state.refreshInterval = locationsResponse.refreshInterval;

      const selected = this.state.locations[0] ?? null;
      this.state.selectedLocation = selected;

      if (selected) {
        await this.loadDepartures(selected.id);
      } else {
        this.state.loading = false;
        this.render();
      }
    } catch (err) {
      this.state.loading = false;
      this.state.error = err instanceof Error ? err.message : 'Tuntematon virhe';
      this.render();
    }
  }

  private resetTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.timer = setInterval(() => this.refresh(), this.state.refreshInterval * 1000);
  }

  private renderSkeleton(): void {
    this.container.innerHTML = '';

    const title = document.createElement('h1');
    title.className = 'app-title';
    title.textContent = 'Pysäkkivahti';

    const header = document.createElement('div');
    header.className = 'location-header';

    const departures = document.createElement('div');
    departures.className = 'departures-container';

    const status = document.createElement('div');
    status.className = 'status-bar';

    const buttons = document.createElement('div');
    buttons.className = 'location-buttons';

    this.container.append(title, header, departures, status, buttons);
  }

  private render(): void {
    this.renderHeader();
    this.renderDepartures();
    this.renderStatus();
    this.renderLocationButtons();
  }

  private renderHeader(): void {
    const header = this.container.querySelector('.location-header');
    if (!header) return;
    const selected = this.state.selectedLocation;
    header.textContent = selected ? `${selected.name} → ${selected.destination}` : '';
  }

  private renderDepartures(): void {
    const container = this.container.querySelector('.departures-container');
    if (!container) return;
    container.innerHTML = '';

    if (this.state.loading) {
      const loading = document.createElement('div');
      loading.className = 'loading';
      loading.textContent = 'Ladataan...';
      loading.setAttribute('aria-label', 'Ladataan');
      container.appendChild(loading);
      return;
    }

    if (this.state.error) {
      const error = document.createElement('div');
      error.className = 'error';
      error.textContent = this.state.error;
      container.appendChild(error);
      return;
    }

    if (this.state.departures === null) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = this.state.locations.length === 0 ? 'Ei sijainteja saatavilla' : 'Ei lähtöjä';
      container.appendChild(empty);
      return;
    }

    const departures = this.state.departures;
    const stops = Array.isArray(departures.stops) ? departures.stops : [];
    const hasDepartures = stops.some(
      (stop) => Array.isArray(stop.departures) && stop.departures.length > 0,
    );
    if (!hasDepartures) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'Ei lähtöjä';
      container.appendChild(empty);
      return;
    }

    for (const stop of stops) {
      const stopDepartures = Array.isArray(stop.departures) ? stop.departures : [];
      const sorted = [...stopDepartures].sort((a, b) => a.minutesUntilDeparture - b.minutesUntilDeparture);
      for (const departure of sorted) {
        container.appendChild(this.createDepartureRow(departure));
      }
    }
  }

  private createDepartureRow(departure: Departure): HTMLElement {
    const row = document.createElement('div');
    row.className = 'departure-row';
    if (departure.realtime) {
      row.classList.add('departure--realtime');
    }

    const route = document.createElement('span');
    route.className = 'route-number';
    route.textContent = departure.routeShortName;

    const headsign = document.createElement('span');
    headsign.className = 'departure-headsign';
    headsign.textContent = departure.headsign;

    const time = document.createElement('span');
    time.className = 'departure-time';
    time.textContent = `${departure.minutesUntilDeparture} min`;

    row.append(route, headsign, time);
    return row;
  }

  private renderStatus(): void {
    const status = this.container.querySelector('.status-bar');
    if (!status) return;
    status.innerHTML = '';

    const updated = document.createElement('span');
    updated.className = 'last-updated';
    updated.textContent = this.state.lastUpdated
      ? `Päivitetty ${formatTimeAgo(this.state.lastUpdated)}`
      : '';

    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'refresh-btn';
    refreshBtn.textContent = 'Päivitä';
    refreshBtn.addEventListener('click', () => this.refresh());

    status.append(updated, refreshBtn);
  }

  private renderLocationButtons(): void {
    const buttons = this.container.querySelector('.location-buttons');
    if (!buttons) return;
    buttons.innerHTML = '';

    for (const location of this.state.locations) {
      const btn = document.createElement('button');
      btn.className = 'location-btn';
      btn.textContent = location.name;
      if (this.state.selectedLocation?.id === location.id) {
        btn.classList.add('location-btn--active');
      }
      btn.addEventListener('click', () => this.selectLocation(location));
      buttons.appendChild(btn);
    }
  }
}

export function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s sitten`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min sitten`;
  return `${Math.floor(minutes / 60)}h sitten`;
}
