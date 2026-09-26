import { Stop } from "../modules/mbta/stop";

type EventPayloads = {
  'api-call-sent': [];
  'api-call-completed': [];
  // optionally include error message
  'api-call-error': [string] | [];
  'app-location-found': [google.maps.LatLng];
  'modal-closed': [];
  'stop-selected': [Stop];
  'stop-fetchdata-error': [Stop];
  'stop-fetchdata-success': [Stop];
  'track-route': [string];
  'prep-complete': [];
};
export type EventsWithNoArgs = keyof {
  [K in keyof EventPayloads as EventPayloads[K] extends [] ? K : never]: K;
};
const callbacks: {
  [K in keyof EventPayloads]?: ((...args: EventPayloads[K]) => void)[];
} = {};

export function fire<K extends keyof EventPayloads>(
  eventName: K,
  ...args: EventPayloads[K]): void {
    console.log("firing event", eventName, args);
  callbacks[eventName]?.forEach((f) => f(...args));
}

export function bind<K extends keyof EventPayloads>(
  eventName: K,
  func: (...args: EventPayloads[K]) => void,
): void {
  callbacks[eventName] = [...(callbacks[eventName] ?? []), func] as (typeof callbacks)[K];
}