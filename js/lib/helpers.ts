import type { LineColor, MbtaResource, RouteId } from './types/mbta';
import { Branded } from './types/util';

import { routeAutoUpdateIntervalSeconds, routeIdsToAutoUpdate, updateVehicleLocations } from '../modules/mbta';
import { Vehicle } from '../modules/mbta/vehicle';
import { Route } from '../modules/mbta/route';

export type HexColor = Branded<string, 'Hex'>;
export type IntervalEventId = Branded<number, 'Interval'>;

export const intervals: Record<string, IntervalEventId> = {};

export function ensureJsonParsed(json: string | object): object {
  if (typeof json === 'string') {
    return JSON.parse(json);
  } else {
    return json;
  }
}

export async function fetchLocalJson(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }
  return response.json();
};

// these colors control the color of live train icons
// and the color of line overlays
export const lineColors = {
  red: '#ff0000',
  green: '#00bb00',
  blue: '#0077cc',
  orange: '#ff8800',
  silver: '#777777',
  bus: '#ffd700'
} satisfies Record<LineColor, HexColor>;

export function getLineColor(lineName: RouteId): HexColor {
  switch (lineName) {
    case 'Green-B':
    case 'Green-C':
    case 'Green-D':
    case 'Green-E':
      return lineColors.green;
    case 'Orange':
      return lineColors.orange;
    case 'Blue':
      return lineColors.blue;
    case 'Red':
    case 'Mattapan':
      return lineColors.red;
    case '741':
    case '742':
    case '751':
    case '749':
    case '746':
      return lineColors.silver;
    default:
      return lineColors.bus;
  }
};

export function getLiveIcon(train: Vehicle): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
    fillColor: train.route.color,
    fillOpacity: 1,
    rotation: train.bearing,
    scale: 4,
    strokeWeight: 1
  };
};

export function dateToTime(date: Date): string {
  return date.toLocaleTimeString('en-us', {
    hour: 'numeric',
    hour12: true,
    minute: '2-digit',
  }).toLowerCase();
};

export function secondsToTimeString(time: number): string {
  const minutes = Math.floor(time / 60);

  if (minutes > 0) {
    return minutes + ' mins';
  } else {
    return 'Arr';
  }
};

// Corresponds to documented vehicle types under `attributes.type` in Route schema
export const vehicleNameMap = {
  0: 'trains',  // Light rail
  1: 'trains',  // heavy rail
  2: 'trains',  // Commuter rail
  3: 'buses',   // Bus
  4: 'boats',   // Ferry
} satisfies Record<MbtaResource<'Route'>['attributes']['type'], string>;

// load templates and JSON before initializing map
$(async () => {

  const updateTrains = () => Promise.all(
    routeIdsToAutoUpdate.map(
      (routeId) => Route.byId(routeId).then(updateVehicleLocations)
    )
  );
  await updateTrains();
  // this should probably live in the mbta file
  intervals['periodicTrainUpdateInterval'] = setInterval(updateTrains, routeAutoUpdateIntervalSeconds * 1000);
});
