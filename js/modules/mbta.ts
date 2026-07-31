import { events, LiveTrain, Route, Stop, toQueryString } from '../lib/helpers';
import { LatitudeLongitude, MbtaResource, MbtaResponse, RouteId, StopId } from '../lib/types/mbta';
import type { QuerySerializable } from '../lib/types/util';

const Mbta = {
  apiUrl: 'https://sm614m053d.execute-api.us-east-1.amazonaws.com/Prod/cached_api/',
  userLocMarker: null,
  localStops: [],
  trainLocations: {},
  routeIdsToAutoUpdate: ["741", "742", "746", "749", "751", "Green-B", "Green-C", "Green-D", "Green-E", "Red", "Blue", "Orange"],
  routeAutoUpdateIntervalSeconds: 90,

  async makeApiRequest<Response = any>(path: string, params?: QuerySerializable, triggerStatusEvents?: boolean): Promise<Response> {
    if (triggerStatusEvents ?? false) {
      events.fire('mbta-api-sent');
    }

    const query = toQueryString(params);
    const url = query ? `${Mbta.apiUrl}${path}?${query}` : `${Mbta.apiUrl}${path}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(response.statusText);
      }
      const data = await response.json() as Response;
      if (triggerStatusEvents) {
        events.fire('mbta-api-completed', data);
      }
      return data;
    } catch (thrown) {
      if (triggerStatusEvents) {
        events.fire('mbta-api-error', thrown);
      }
      throw thrown;
    }
  },

  getStopsByLocation(latitude: number, longitude: number): Promise<MbtaResponse<'Stops'>> {
    return Mbta.makeApiRequest<MbtaResponse<'Stops'>>('stops', {filter: {latitude, longitude}});
  },

  async getNearbyStops(coords: LatitudeLongitude) {
    const result = await Mbta.getStopsByLocation(coords.latitude, coords.longitude);
    return result.data.filter((stop) => {
      return !Stop.isMainStop(stop.id, stop.relationships?.parent_station);
    }).map((stop) => {
      return Stop.fromRawApi(stop);
    });
  },

  getRoute(routeId: RouteId): Promise<MbtaResponse<'Routes'>> {
    return Mbta.makeApiRequest('routes/' + routeId, {});
  },

  getRoutesByStop(stop: Stop): Promise<MbtaResponse<'Routes'>> {
    return Mbta.makeApiRequest('routes', {filter: {stop: stop.id}});
  },

  getStopsByRoute(route: Route): Promise<MbtaResponse<'Stops'>> {
    return Mbta.makeApiRequest('stops', {filter: {route: route.id}});
  },

  async getTrainsByRoute(route: Route) {
    // don't trigger a status indicator update for this call
    const routeInfo = await Mbta.makeApiRequest<MbtaResponse<'Vehicles'>>('vehicles', {filter: {route: route.id}, include: 'trip'}, false);
    return routeInfo.data.filter(
      (trainData) => {
        return (['latitude', 'longitude', 'bearing'] as const).every((attribute) => trainData.attributes[attribute] !== undefined);
      }).map((trainData) => {
      const trip = routeInfo.included.find((item) => item.id === trainData.relationships.trip.data.id);
      const train = trainData.attributes;
      let headsign = null;

      if (trip) {
        headsign = trip.attributes.headsign;
      } else {
        console.warn("Found a vehicle with no matching trip. Assuming that this is the Night Train (BOTTOMS UP).");
        console.warn(trainData);
        console.warn(routeInfo);
        headsign = 'THE NIGHT TRAIN';
      }

      return new LiveTrain(
        train.label ?? "Unknown",
        route,
        headsign,
        train.latitude!,
        train.longitude!,
        train.bearing!);
    });
  },

  async getNextTrainsToStop(stop: Stop) {
    // takes a route id and the 'included' segment from the api response and builds the route object
    const routeInfoBlock = (id: string, routes: MbtaResource<'Route'>[]) => {
      const apiInfo = routes.find((item) => item.id === id);

      if (apiInfo == undefined) {
        throw new Error("Could not find requested route");
      }

      return {
        name: [apiInfo.attributes.short_name, apiInfo.attributes.long_name].filter(Boolean).join(' - '),
        vehicleName: vehicleNameMap[apiInfo.attributes.description],
        directions: {}
      };
    };

    const routeDirectionName = (id: string, directionIndex: number, routes: MbtaResource<'Route'>[]) => {
      return routes.find((item) => item.id === id && item.type === 'route').attributes.direction_names![directionIndex];
    };

    const result = await Mbta.makeApiRequest<MbtaResponse<'Predictions'>>('predictions', {filter: {stop: stop.id}, include: 'route'});
    console.log(result);
    const resultsByRoute = {};

    result.data.reduce((acc, prediction) => {
      // arrival time will be null for predictions at a terminus station, so we fall back to departure time
      const predictionDate = new Date(datum.attributes.arrival_time ?? datum.attributes.departure_time ?? 0);
      const routeId = prediction.relationships?.route?.data?.id;
      if (routeId === undefined) {
        console.error("Prediction didn't include requested route", prediction);
        return acc;
      }
      const directionId = prediction.attributes.direction_id;

      if 

      resultsByRoute[routeId] || (resultsByRoute[routeId] = routeInfoBlock(routeId, result.included));
      resultsByRoute[routeId].directions[directionId] || (resultsByRoute[routeId].directions[directionId] = {
        name: routeDirectionName(routeId, directionId, result.included),
        predictions: []
      });
      resultsByRoute[routeId].directions[datum.attributes.direction_id].predictions.push(prediction);
    });
    events.fire('mbta-predictions-found', {stop_name: stop.name, predictions: resultsByRoute});
    return resultsByRoute;
  },

  async updateVehicleLocations(route) {
    const renderRoute = () => {
      if (Mapper.defaultRouteIds.includes(route.id)) {
        Mapper.featureManager.destroyFeature('traced-route');
      } else {
        Mapper.featureManager.addFeature('traced-route', route);
      }
    };
    events.fire('mbta-api-sent');

    try {
      const trains = await Mbta.getTrainsByRoute(route);
      route.setVehicles(trains);
      renderRoute();
      events.fire('mbta-api-completed');
    } catch (err) {
      console.warn(`Failed to fetch trains for route ${route.name}.`);
      events.fire('mbta-api-error', 'Could not fetch train locations.');
    }
  }
};

window.Mbta = Mbta;
