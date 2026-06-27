import { fetchDepartures as apiFetchDepartures, fetchLocations } from './api.ts';
import { detectLocation } from './geolocation.ts';
import { Departure, Location, LocationDepartures } from './types.ts';
import './style.css';

interface AppState {
  locations: Location[];
  selectedLocation: Location | null;
  gpsLocationId: string | null;
  departures: LocationDepartures | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refreshInterval: number;
  logoLinkUrl: string;
}

export class App {
  private container: HTMLElement;
  private state: AppState;
  private timer: ReturnType<typeof setInterval> | null = null;
  private timeAgoTimer: ReturnType<typeof setInterval> | null = null;
  private requestId = 0;

  private onVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      this.refresh();
    }
  };

  constructor(container: HTMLElement) {
    this.container = container;
    this.state = {
      locations: [],
      selectedLocation: null,
      gpsLocationId: null,
      departures: null,
      loading: false,
      error: null,
      lastUpdated: null,
      refreshInterval: 30,
      logoLinkUrl: '',
    };
  }

  async mount(): Promise<void> {
    this.renderSkeleton();
    this.timeAgoTimer = setInterval(() => this.updateTimeAgo(), 1000);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    try {
      const locationsResponse = await fetchLocations();
      this.state.locations = locationsResponse.locations;
      this.state.refreshInterval = locationsResponse.refreshInterval;
      this.state.logoLinkUrl = locationsResponse.logoLinkUrl ?? '';
      this.applyLogoLink();

      const detected = await detectLocation();
      this.state.gpsLocationId = detected?.id ?? null;
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
    if (this.timeAgoTimer) {
      clearInterval(this.timeAgoTimer);
      this.timeAgoTimer = null;
    }
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
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
      if (this.state.selectedLocation) {
        this.state.selectedLocation = {
          ...this.state.selectedLocation,
          destination: departures.destination,
        };
      }
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
    this.state.gpsLocationId = null;
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
      this.state.logoLinkUrl = locationsResponse.logoLinkUrl ?? '';
      this.applyLogoLink();

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

    const logo = document.createElement('img');
    logo.className = 'app-logo';
    logo.src = '/favicon.svg';
    logo.alt = '';

    const title = document.createElement('h1');
    title.className = 'app-title';
    title.textContent = 'Pysäkkivahti';

    const appHeader = document.createElement('header');
    appHeader.className = 'app-header';
    appHeader.append(logo, title);

    const locationHeader = document.createElement('div');
    locationHeader.className = 'location-header';

    const departures = document.createElement('div');
    departures.className = 'departures-container';

    const status = document.createElement('div');
    status.className = 'status-bar';

    const buttons = document.createElement('div');
    buttons.className = 'location-buttons';

    const main = document.createElement('main');
    main.className = 'app-main';
    main.append(locationHeader, departures, status, buttons);

    this.container.append(appHeader, main);
  }

  private applyLogoLink(): void {
    const header = this.container.querySelector('.app-header');
    if (!header) return;
    const logo = header.querySelector('img.app-logo');
    if (!logo) return;
    const url = this.state.logoLinkUrl.trim();
    if (!url) return;
    const parent = logo.parentElement;
    if (parent instanceof HTMLAnchorElement && parent.classList.contains('app-logo-link')) {
      parent.href = url;
      return;
    }
    const link = document.createElement('a');
    link.className = 'app-logo-link';
    link.href = url;
    link.setAttribute('aria-label', 'Pysäkkivahti');
    logo.replaceWith(link);
    link.appendChild(logo);
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

  private updateTimeAgo(): void {
    const updated = this.container.querySelector('.last-updated');
    if (updated && this.state.lastUpdated) {
      updated.textContent = `Päivitetty ${formatTimeAgo(this.state.lastUpdated)}`;
    }
  }

  private renderLocationButtons(): void {
    const buttons = this.container.querySelector('.location-buttons');
    if (!buttons) return;
    buttons.innerHTML = '';

    for (const location of this.state.locations) {
      const btn = document.createElement('button');
      btn.className = 'location-btn';
      if (this.state.gpsLocationId === location.id) {
        btn.classList.add('location-btn--gps');
        const gpsIndicator = document.createElement('span');
        gpsIndicator.className = 'gps-indicator';
        btn.appendChild(gpsIndicator);
      }
      btn.appendChild(document.createTextNode(location.name));
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
