const Mbta = {
  apiUrl: 'https://sm614m053d.execute-api.us-east-1.amazonaws.com/Prod/cached_api/',
  userLocMarker: null,
  localStops: [],
  trainLocations: {},
  routeIdsToAutoUpdate: ["741", "742", "746", "749", "751", "Green-B", "Green-C", "Green-D", "Green-E", "Red", "Blue", "Orange"],
  routeAutoUpdateIntervalSeconds: 90,

  async makeApiRequest(path, additionalParams, triggerStatusEvents) {
    const params = {};

    if (additionalParams == null) {
      additionalParams = {};
    }
    if (triggerStatusEvents == null) {
      triggerStatusEvents = true;
    }

    for (const key in additionalParams) {
      const val = additionalParams[key];
      params[key] = val;
    }

    if (triggerStatusEvents) {
      Helpers.events.fire('mbta-api-sent');
    }

    const query = Helpers.toQueryString(params);
    const url = query ? `${Mbta.apiUrl}${path}?${query}` : `${Mbta.apiUrl}${path}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(response.statusText);
      }
      const data = await response.json();
      if (triggerStatusEvents) {
        Helpers.events.fire('mbta-api-completed', data);
      }
      return data;
    } catch (thrown) {
      if (triggerStatusEvents) {
        Helpers.events.fire('mbta-api-error', thrown);
      }
      throw thrown;
    }
  },

  initialize() {},

  getStopsByLocation(lat, lon) {
    return Mbta.makeApiRequest('stops', {filter: {latitude: lat, longitude: lon}});
  },

  async getNearbyStops(coords) {
    const result = await Mbta.getStopsByLocation(coords.latitude, coords.longitude);
    return result.data.filter((stop) => {
      return !Stop.isMainStop(stop.id, stop.relationships.parent_station);
    }).map((stop) => {
      return Stop.fromRawApi(stop);
    });
  },

  getRoute(routeId) {
    return Mbta.makeApiRequest('routes/' + routeId, {});
  },

  getRoutesByStop(stop) {
    return Mbta.makeApiRequest('routes', {filter: {stop: stop.id}});
  },

  getStopsByRoute(route) {
    return Mbta.makeApiRequest('stops', {filter: {route: route.id}});
  },

  async getTrainsByRoute(route) {
    // don't trigger a status indicator update for this call
    const routeInfo = await Mbta.makeApiRequest('vehicles', {filter: {route: route.id}, include: 'trip'}, false);
    return routeInfo.data.map((trainData) => {
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
        train.label,
        route,
        headsign,
        train.latitude,
        train.longitude,
        train.bearing);
    });
  },

  async getNextTrainsToStop(stop) {
    // takes a route id and the 'included' segment from the api response and builds the route object
    const routeInfoBlock = (id, inclusions) => {
      const apiInfo = inclusions.find((item) => item.id === id);

      return {
        name: [apiInfo.attributes.short_name, apiInfo.attributes.long_name].filter(Boolean).join(' - '),
        vehicleName: Helpers.vehicleName(apiInfo.attributes.description),
        directions: {}
      };
    };

    const routeDirectionName = (id, directionId, inclusions) => {
      return inclusions.find((item) => item.id === id && item.type === 'route').attributes.direction_names[directionId];
    };

    const result = await Mbta.makeApiRequest('predictions', {filter: {stop: stop.id}, include: 'route'});
    console.log(result);
    const resultsByRoute = {};

    result.data.forEach((datum) => {
      // arrival time will be null for predictions at a terminus station, so we fall back to departure time
      const prediction = new Date(datum.attributes.arrival_time || datum.attributes.departure_time);
      const routeId = datum.relationships.route.data.id;
      const directionId = datum.attributes.direction_id;

      resultsByRoute[routeId] || (resultsByRoute[routeId] = routeInfoBlock(routeId, result.included));
      resultsByRoute[routeId].directions[directionId] || (resultsByRoute[routeId].directions[directionId] = {
        name: routeDirectionName(routeId, directionId, result.included),
        predictions: []
      });
      resultsByRoute[routeId].directions[datum.attributes.direction_id].predictions.push(prediction);
    });
    Helpers.events.fire('mbta-predictions-found', {stop_name: stop.name, predictions: resultsByRoute});
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
    Helpers.events.fire('mbta-api-sent');

    try {
      const trains = await Mbta.getTrainsByRoute(route);
      route.setVehicles(trains);
      renderRoute();
      Helpers.events.fire('mbta-api-completed');
    } catch (err) {
      console.warn(`Failed to fetch trains for route ${route.name}.`);
      Helpers.events.fire('mbta-api-error', 'Could not fetch train locations.');
    }
  }
};

window.Mbta = Mbta;
