import { Stop } from './mbta/stop';
import { MbtaClient } from '../lib/mbta-client';

export const userLocMarker = null;
export const localStops = [];
export const trainLocations = {};
export const routeIdsToAutoUpdate = ["741", "742", "746", "749", "751", "Green-B", "Green-C", "Green-D", "Green-E", "Red", "Blue", "Orange"];
export const routeAutoUpdateIntervalSeconds = 90;

export function getStopsByLocation(coords: google.maps.LatLng) {
  return MbtaClient.GET('/stops', {
    params: {
      query: {
        "filter[latitude]": coords.lat().toString(),
        "filter[longitude]": coords.lng().toString(),
      }
    }
  });
}

export async function getNearbyStops(coords: google.maps.LatLng) {
  const result = await getStopsByLocation(coords);
  return Promise.all(result.data.map((stop) => Stop.fromRawApiWithPrimaryRoute(stop)));
}

