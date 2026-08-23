import _ from 'lodash';

import { MbtaResource, RouteId } from '../lib/types/mbta';
import { DEFAULT_ROUTE_IDS } from './mapper';
import Mapper from './mapper';
import { fire } from '../lib/events';
import { Stop } from './mbta/stop';
import { Route } from './mbta/route';
import { LiveTrain } from './mbta/live-train';
import { getIncluded, MbtaClient } from '../lib/mbta-client';

// export const apiUrl = 'https://sm614m053d.execute-api.us-east-1.amazonaws.com/Prod/cached_api/';
export const userLocMarker = null;
export const localStops = [];
export const trainLocations = {};
export const routeIdsToAutoUpdate = ["741", "742", "746", "749", "751", "Green-B", "Green-C", "Green-D", "Green-E", "Red", "Blue", "Orange"] as RouteId[];
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
  return result.data?.data.filter(stop => {
    Stop.isMainStop(stop.id, stop.relationships?.parent_station?.data)
  }).map(Stop.fromRawApi);
}

export function getRoute(id: RouteId) {
  return MbtaClient.GET('/routes/:id', {
    params: {
      path: { id }
    }
  });
};

export function getRoutesByStop(stop: Stop) {
  return MbtaClient.GET('/routes', {
    params: {
      query: {
        "filter[stop]": stop.id
      }
    }
  });
}

export function getStopsByRoute(route: Route) {
  return MbtaClient.GET('/stops', {params: {query: {"filter[route]": route.id}}});
}

export async function getTrainsByRoute(route: Route): Promise<LiveTrain[]> {
  // don't trigger a status indicator update for this call todo
  const routeInfo = await MbtaClient.GET('/vehicles', {
    params: {
      query: {
        "filter[route]": route.id,
        include: 'trip',
      }
    }
  });
  return Promise.all(
    routeInfo.data!.data.map(async (trainData) => {
      const trip = await MbtaClient.GET('/trips', {id: trainData.relationships.trip.data.id})
      const train = trainData.attributes;
      const headsign = trip.data.attributes.headsign;

      return new LiveTrain(
        train.label ?? "Unknown",
        route,
        headsign ?? "Unknown headsign",
        new google.maps.LatLng(train.latitude!, train.longitude!),
        train.bearing!);
    })
  );
}

export async function getNextTrainsToStop(stop: Pick<Stop, 'id' | 'name'>): Promise<PredictionsByRouteAndDirection> {
  const predictionsResponse = (await makeApiRequest('Predictions', {filter: {stop: stop.id}, include: 'route'})).data;
  // todo cache this
  const routeInfo = _.keyBy(
    (await makeApiRequest('Routes', {filter: {id: predictionsResponse.map((prediction) => prediction.relationships.route.data.id) }})).data,
    (route) => route.id,
  );

  const routeDirectionName = (id: RouteId, directionIndex: number | "N/A"): string  => {
    const routeProps = routeInfo[id]?.attributes;
    if (routeProps == undefined) {
      throw new Error(`No route '${id}' in route data`);
    }

    // todo this is probably a valid state we need to handle gracefully
    if (routeProps.direction_names == undefined) {
      throw new Error(`No direction names returned for route '${id}'`);
    }

    if (directionIndex === "N/A" || routeProps.direction_names[directionIndex] == null) {
      return "Unknown direction";
    }

    return routeProps.direction_names[directionIndex];
  };

  const groupedByRoute = _.groupBy(predictionsResponse, prediction => prediction.relationships.route.data.id);
  const groupedByRouteAndDirection = _.mapValues(groupedByRoute, (predictions, routeId) => ({
    name: [routeInfo[routeId].attributes.short_name, routeInfo[routeId].attributes.long_name].filter((str) => str != undefined && str !== "").join(' - '),
    directions: _.groupBy(predictions, (prediction) => routeDirectionName(routeId as RouteId, prediction.attributes.direction_id ?? 'N/A'))
  }));
  // todo
  // renderPredictions({stop_name: stop.name, predictions: groupedByRouteAndDirection});
  return groupedByRouteAndDirection;
}

export async function updateVehicleLocations(route: Route): Promise<void> {
  // todo handle route feature overwrites in mapper
  const renderRoute = () => {
    if ((DEFAULT_ROUTE_IDS as readonly string[]).includes(route.id)) {
      Mapper().featureManager.destroyFeature('traced-route');
    } else {
      Mapper().featureManager.addFeature('traced-route', route);
    }
  };
  fire('api-call-sent');

  try {
    const trains = await getTrainsByRoute(route);
    route.setVehicles(trains);
    renderRoute();
    fire('api-call-completed');
  } catch (err) {
    console.warn(`Failed to fetch trains for route ${route.name}.`);
    fire('api-call-error', 'Could not fetch train locations.');
  }
}
