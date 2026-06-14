import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Coordinates, validateCoordinates } from './geo.ts';

export interface ConfigStop {
  id: string;
  name: string;
  filterHeadsigns?: string[];
}

export interface ConfigRoute {
  destination: string;
  beforeHour?: number;
  afterHour?: number;
  stops: ConfigStop[];
}

export interface ConfigLocation {
  id: string;
  name: string;
  destination?: string;
  coordinates: Coordinates;
  radius: number;
  stops?: ConfigStop[];
  routes?: ConfigRoute[];
}

export interface Config {
  refreshInterval: number;
  departuresCount: number;
  locations: ConfigLocation[];
}

function fail(message: string, err: unknown): never {
  const detail = err instanceof Error ? err.message : String(err);
  console.error(`${message}: ${detail}`);
  process.exit(1);
}

export function loadConfig(): Config {
  let raw: string;
  try {
    raw = readFileSync(resolve('config.json'), 'utf-8');
  } catch (err) {
    fail('Failed to load config.json', err);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    fail('Failed to parse config.json', err);
  }

  try {
    validateConfig(parsed);
  } catch (err) {
    fail('Invalid config.json', err);
  }
  return parsed;
}

function validateConfig(value: unknown): asserts value is Config {
  if (!value || typeof value !== 'object') {
    throw new Error('config must be an object');
  }
  const config = value as Record<string, unknown>;
  if (
    typeof config.refreshInterval !== 'number' ||
    !Number.isFinite(config.refreshInterval) ||
    config.refreshInterval <= 0
  ) {
    throw new Error('refreshInterval must be a positive finite number');
  }
  if (
    typeof config.departuresCount !== 'number' ||
    !Number.isFinite(config.departuresCount) ||
    config.departuresCount <= 0
  ) {
    throw new Error('departuresCount must be a positive finite number');
  }
  if (!Array.isArray(config.locations)) {
    throw new Error('locations must be an array');
  }
  const ids = new Set<string>();
  for (const location of config.locations) {
    validateLocation(location);
    const id = location.id;
    if (ids.has(id)) {
      throw new Error(`duplicate location id: ${id}`);
    }
    ids.add(id);
  }
}

function validateLocation(value: unknown): asserts value is ConfigLocation {
  if (!value || typeof value !== 'object') {
    throw new Error('location must be an object');
  }
  const location = value as Record<string, unknown>;
  if (typeof location.id !== 'string' || location.id.length === 0) {
    throw new Error('location id must be a non-empty string');
  }
  if (typeof location.name !== 'string' || location.name.length === 0) {
    throw new Error('location name must be a non-empty string');
  }
  if (location.destination !== undefined && typeof location.destination !== 'string') {
    throw new Error('location destination must be a string');
  }
  validateCoordinates(location.coordinates);
  if (
    typeof location.radius !== 'number' ||
    !Number.isFinite(location.radius) ||
    location.radius <= 0
  ) {
    throw new Error('location radius must be a positive finite number');
  }
  if (location.stops !== undefined && !Array.isArray(location.stops)) {
    throw new Error('location stops must be an array');
  }
  if (location.routes !== undefined && !Array.isArray(location.routes)) {
    throw new Error('location routes must be an array');
  }
  if (location.stops && location.routes) {
    throw new Error('location cannot have both stops and routes');
  }
  if (!location.stops && !location.routes) {
    throw new Error('location must have stops or routes');
  }
  if (Array.isArray(location.stops) && location.stops.length === 0) {
    throw new Error('location stops must not be empty');
  }
  if (Array.isArray(location.routes) && location.routes.length === 0) {
    throw new Error('location routes must not be empty');
  }
  if (Array.isArray(location.stops)) {
    for (const stop of location.stops) {
      validateStop(stop);
    }
  }
  if (Array.isArray(location.routes)) {
    for (const route of location.routes) {
      validateRoute(route);
    }
  }
}


function validateStop(value: unknown): asserts value is ConfigStop {
  if (!value || typeof value !== 'object') {
    throw new Error('stop must be an object');
  }
  const stop = value as Record<string, unknown>;
  if (typeof stop.id !== 'string' || stop.id.length === 0) {
    throw new Error('stop id must be a non-empty string');
  }
  if (typeof stop.name !== 'string' || stop.name.length === 0) {
    throw new Error('stop name must be a non-empty string');
  }
  if (stop.filterHeadsigns !== undefined && !Array.isArray(stop.filterHeadsigns)) {
    throw new Error('stop filterHeadsigns must be an array');
  }
  if (Array.isArray(stop.filterHeadsigns)) {
    for (const filter of stop.filterHeadsigns) {
      if (typeof filter !== 'string') {
        throw new Error('stop filterHeadsigns must contain only strings');
      }
    }
  }
}

function validateRoute(value: unknown): asserts value is ConfigRoute {
  if (!value || typeof value !== 'object') {
    throw new Error('route must be an object');
  }
  const route = value as Record<string, unknown>;
  if (typeof route.destination !== 'string' || route.destination.length === 0) {
    throw new Error('route destination must be a non-empty string');
  }
  if (route.beforeHour !== undefined && typeof route.beforeHour !== 'number') {
    throw new Error('route beforeHour must be a number');
  }
  if (route.afterHour !== undefined && typeof route.afterHour !== 'number') {
    throw new Error('route afterHour must be a number');
  }
  if (route.beforeHour !== undefined && route.afterHour !== undefined) {
    throw new Error('route cannot have both beforeHour and afterHour');
  }
  for (const hour of [route.beforeHour, route.afterHour]) {
    if (hour !== undefined && (!Number.isInteger(hour) || hour < 0 || hour > 23)) {
      throw new Error('route beforeHour/afterHour must be an integer between 0 and 23');
    }
  }
  if (!Array.isArray(route.stops)) {
    throw new Error('route stops must be an array');
  }
  if (route.stops.length === 0) {
    throw new Error('route stops must not be empty');
  }
  for (const stop of route.stops) {
    validateStop(stop);
  }
}

export const config = loadConfig();
