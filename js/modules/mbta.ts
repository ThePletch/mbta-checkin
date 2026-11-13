import { Stop } from './mbta/stop';
import { routePatternsByStop } from './mbta/route-pattern';
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

export async function getNearbyStops(coords: google.maps.LatLng): Promise<Stop[]> {
  const result = await getStopsByLocation(coords);
  const patternsByStop = await routePatternsByStop(result.data.map((stop) => stop.id));
  return result.data.flatMap((stop) => {
    const patterns = patternsByStop.get(stop.id) ?? [];
    if (patterns.length === 0) {
      return [];
    }
    const routes = patterns.flatMap((pattern) => pattern.route != null ? [pattern.route] : []);
    return [Stop.fromRawApiWithRoutes(stop, routes)];
  });
}

