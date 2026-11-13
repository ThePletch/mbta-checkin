import { Stop } from './mbta/stop';
import { routePatternsByStop } from './mbta/route-pattern';
import { MbtaClient } from '../lib/mbta-client';
import type { MbtaSchemas } from '../lib/types/mbta-api';

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
  const activeStops = result.data.filter((stop) => (patternsByStop.get(stop.id) ?? []).length > 0);
  return withoutCoveredChildStops(activeStops).map((stop) => {
    const patterns = patternsByStop.get(stop.id) ?? [];
    const routes = patterns.flatMap((pattern) => pattern.route != null ? [pattern.route] : []);
    return Stop.fromRawApiWithRoutes(stop, routes);
  });
}

/**
 * A station (`location_type` 1) is the parent of its platforms, and predictions
 * filtered to that station include every child. When the station is already
 * in the result, the child stops are the same place shown again.
 * Children stay when their station is outside the result.
 */
function withoutCoveredChildStops(
  stops: MbtaSchemas['StopResource'][],
): MbtaSchemas['StopResource'][] {
  const stationIds = new Set(
    stops
      .filter((stop) => stop.attributes.location_type === 1)
      .map((stop) => stop.id),
  );
  return stops.filter((stop) => {
    const parentId = stop.relationships?.parent_station?.data?.id;
    return parentId == null || !stationIds.has(parentId);
  });
}

