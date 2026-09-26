import { Branded } from './types/util';

export type HexColor = Branded<string, 'Hex'>;
// export type IntervalEventId = Branded<number, 'Interval'>;

export function ensureJsonParsed(json: string | object): object {
  if (typeof json === 'string') {
    return JSON.parse(json);
  } else {
    return json;
  }
}

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
};