Number.prototype.leftPad = function(len, padder) {
  let s = this.toString();
  if (padder == null) {
    padder = '0';
  }

  while (s.length < len) {
    s = padder + s;
  }

  return s;
};

const Helpers = {
  events: {
    _ev: {},
    bind(eventName, func) {
      const bindEvent = (name, boundFunc) => {
        const self = Helpers.events;
        if (self._ev[name] == null) {
          self._ev[name] = [];
        }
        self._ev[name].push(boundFunc);
      };
      if (eventName.constructor === Array) {
        eventName.map((name) => bindEvent(name, func));
      } else {
        bindEvent(eventName, func);
      }
    },
    fire(eventName, params) {
      const self = Helpers.events;

      if (self._ev[eventName] == null) {
        return;
      }

      for (const func of self._ev[eventName]) {
        func(params);
      }
    }
  },

  cache: {
    routes: {},
    stops: {},
    vehicles: {}
  },

  intervals: {},

  ensureJsonParsed(json) {
    const ref = typeof json;
    if (ref === String || ref === 'string') {
      return JSON.parse(json);
    } else {
      return json;
    }
  },

  toQueryString(data) {
    const params = new URLSearchParams();
    const add = (key, value) => {
      if (value != null && typeof value === 'object' && !Array.isArray(value)) {
        for (const [nestedKey, nestedValue] of Object.entries(value)) {
          add(`${key}[${nestedKey}]`, nestedValue);
        }
      } else if (value != null) {
        params.append(key, value);
      }
    };
    for (const [key, value] of Object.entries(data)) {
      add(key, value);
    }
    return params.toString();
  },

  async fetchLocalJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    return response.json();
  },

  iconUrls: {
    red: 'img/red_line.png',
    green: 'img/green_line.png',
    blue: 'img/blue_line.png',
    orange: 'img/orange_line.png',
    yellow: 'img/yellow_line.png',
    locationReticle: 'img/selected_blue.png',
    selected: 'img/selected.png',
    selectedError: 'img/selected_error.png',
    selectedSuccess: 'img/selected_success.png',
    statusLoading: 'img/spinner.gif',
    statusSuccess: 'img/success.png',
    statusError: 'img/error.png'
  },

  // these colors control the color of live train icons
  // and the color of line overlays
  lineColors: {
    red: '#ff0000',
    green: '#00bb00',
    blue: '#0077cc',
    orange: '#ff8800',
    silver: '#777777',
    bus: '#ffd700'
  },

  getLineColor(lineColor) {
    switch (lineColor) {
      case 'Green-B':
      case 'Green-C':
      case 'Green-D':
      case 'Green-E':
        return Helpers.lineColors.green;
      case 'Orange':
        return Helpers.lineColors.orange;
      case 'Blue':
        return Helpers.lineColors.blue;
      case 'Red':
      case 'Mattapan':
        return Helpers.lineColors.red;
      case '741':
      case '742':
      case '751':
      case '749':
      case '746':
        return Helpers.lineColors.silver;
      default:
        return Helpers.lineColors.bus;
    }
  },

  getLineIcon(lineColor) {
    switch (lineColor) {
      case 'Green Line':
      case 'Green Line B':
      case 'Green Line C':
      case 'Green Line D':
      case 'Green Line E':
        return Helpers.iconUrls.green;
      case 'Orange Line':
        return Helpers.iconUrls.orange;
      case 'Blue Line':
        return Helpers.iconUrls.blue;
      case 'Red Line':
      case 'Mattapan Trolley':
        return Helpers.iconUrls.red;
      case 'Location':
        return Helpers.iconUrls.locationReticle;
      default:
        return Helpers.iconUrls.yellow;
    }
  },

  getLiveIcon(train) {
    return {
      path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      fillColor: train.line.color,
      fillOpacity: 1,
      rotation: train.bearing,
      scale: 4,
      strokeWeight: 1
    };
  },

  getIcon(line) {
    return {
      scaledSize: new google.maps.Size(24, 24),
      anchor: new google.maps.Point(12, 12),
      url: Helpers.getLineIcon(line)
    };
  },

  dateToTime(date) {
    const hours = (date.getHours() - 1) % 12 + 1;
    const minutes = date.getMinutes().leftPad(2);
    const amPm = (date.getHours() >= 12) ? 'pm' : 'am';

    return `${hours}:${minutes} ${amPm}`;
  },

  secondsToTimeString(time) {
    const minutes = Math.floor(time / 60);

    if (minutes > 0) {
      return minutes + ' mins';
    } else {
      return 'Arr';
    }
  },

  vehicleName(modeName) {
    const vehicleNameMap = {
      'Rapid Transit': 'trains',
      'Local Bus': 'buses',
      'Commuter Rail': 'trains'
    };

    return vehicleNameMap[modeName];
  },

  mergePredictions(predictions) {
    const mergePair = (pair, subarrayExtractor, keyExtractor, mergeFunction) => {
      const newSet = {};
      for (const element of subarrayExtractor(pair[1])) {
        const currentValue = newSet[keyExtractor(element)];
        if (!currentValue) {
          newSet[keyExtractor(element)] = element;
        } else {
          newSet[keyExtractor(element)] = mergeFunction(currentValue, element);
        }
      }
      const results = [];
      for (const key in newSet) {
        const val = newSet[key];
        results.push(val);
      }
      return results;
    };
    const mergePredictionPair = (prediction, secondPrediction) => {
      const subarrExtractor = (prediction) => prediction.routes;
      const keyExtractor = (route) => route.self.name;
      return Object.assign(prediction, {
        routes: mergePair([prediction, secondPrediction],
          subarrExtractor,
          keyExtractor,
          mergeRoutePair)
      });
    };
    const mergeRoutePair = (route, secondRoute) => {
      const subarrExtractor = (route) => route.directions;
      const keyExtractor = (direction) => direction.name;
      return Object.assign(route, {
        directions: mergePair([route, secondRoute],
          subarrExtractor,
          keyExtractor,
          mergeDirectionPair)
      });
    };
    const mergeDirectionPair = (dir, secondDir) => {
      return {
        minutesAway: Math.min(dir.minutesAway, secondDir.minutesAway),
        minutesBetweenVehicles: dir.minutesBetweenVehicles,
        name: dir.name,
        predictedNextArrival: dir.predictedNextArrival < secondDir.predictedNextArrival
          ? dir.predictedNextArrival
          : secondDir.predictedNextArrival,
        trips: dir.trips.concat(secondDir.trips).sort((a, b) => parseInt(b.pre_away) - parseInt(a.pre_away))
      };
    };
    const newPredictions = {};
    for (const prediction of predictions) {
      if (!newPredictions[prediction.type]) {
        newPredictions[prediction.type] = prediction;
      } else {
        newPredictions[prediction.type] = mergePredictionPair(newPredictions[prediction.type], prediction);
      }
    }
    const results = [];
    for (const key in newPredictions) {
      const val = newPredictions[key];
      results.push(val);
    }
    return results;
  }
};

class Template {
  static formats = {
    locales: "en-US",
    formats: {
      time: {
        hhmm: {
          hour: "numeric",
          minute: "numeric"
        }
      },
      relative: {
        minutes: {
          units: "minute"
        }
      }
    }
  };

  constructor(compiledTemplate) {
    this._template = compiledTemplate;
  }

  static async load(name) {
    const response = await fetch(`hb/${name}.hdbs`);
    if (!response.ok) {
      throw new Error(`Failed to load template ${name}: ${response.statusText}`);
    }
    const data = await response.text();
    return new Template(Handlebars.compile(data));
  }

  render(context) {
    return this._template(context, {
      data: {
        intl: Template.formats
      }
    });
  }
}

class Marker {
  constructor(lat, lng, category) {
    this.lat = lat;
    this.lng = lng;
    this.category = category;
  }

  render = () => {
    this.marker = Mapper.placeMarker(this);
  };

  destroy = () => {
    if (this.marker) {
      this.marker.setMap(null);
    } else {
      console.warn(this);
    }
  };
}

class LocationMarker extends Marker {
  constructor(lat, lng) {
    super(lat, lng, 'Location');
    this.lat = lat;
    this.lng = lng;
    this.category = 'Location';
  }

  render = () => {
    this.marker = Mapper.placeMarker(this.lat, this.lng, this.category, Helpers.getIcon(this.category));
  };
}

class Stop extends Marker {
  constructor(id, name, lat, lng, category) {
    super(lat, lng, category);
    this.id = id;
    this.name = name;
    this.lat = lat;
    this.lng = lng;
    this.category = category;

    Helpers.cache.stops[this.id] = this;
  }

  render = () => {
    this.marker = Mapper.placeMarker(this.lat, this.lng, this.name, Helpers.getIcon(this.category));
    if (!this.marker) {
      console.log(this.marker);
    }

    this.listener = google.maps.event.addListener(this.marker, 'click', this.onClick);
  };

  static fromRawApi(api) {
    return Helpers.cache.stops[api.id] || new Stop(api.id, api.attributes.name, parseFloat(api.attributes.latitude), parseFloat(api.attributes.longitude), "Bus");
  }

  static isMainStop(id, parentStation) {
    return Mapper.defaultStopIds.indexOf(id) !== -1 || parentStation.data !== null;
  }

  onClick = async () => {
    Helpers.events.fire('stop-selected', this);
    const stopAndChildren = [this.id].concat(jsonData.stop_descendants[this.id] || []);
    try {
      const predictions = await Promise.all(stopAndChildren.map((stopId) => {
        return Mbta.getNextTrainsToStop({id: stopId});
      }));
      const result = Helpers.mergePredictions(predictions.flat());
      if (!(result.length > 0)) {
        Helpers.events.fire('stop-fetchdata-error', this);
        console.warn(`No predictions found for stop ${result.stop_name} (ID ${result.stop_id})`);
        return;
      }
      Helpers.events.fire('mbta-predictions', {stop_name: this.name, predictions: result});
      Helpers.events.fire('stop-fetchdata-success', this);
    } catch (err) {
      Helpers.events.fire('stop-fetchdata-error', this);
    }
  };
}

class Vehicle extends Marker {
  render = () => {
    this.marker = Mapper.placeVehicleMarker(this);
  };
}

class LiveTrain extends Vehicle {
  constructor(id, line, destination, lat, lng, bearing) {
    super(parseFloat(lat), parseFloat(lng), line);
    this.id = id;
    this.line = line;
    this.destination = destination;
    this.bearing = parseInt(bearing);

    Helpers.cache.vehicles[this.id] = this;
  }
}

class Alert {
  constructor(text) {
    this.text = text;
    this.timestamp = new Date();
  }

  matches(text) {
    return this.text === text;
  }

  equals(thing) {
    return this === thing || this.matches(thing);
  }
}

class Route {
  constructor(id, name, mode, stops, vehicles) {
    this.id = id;
    this.name = name;
    this.mode = mode;
    this.stops = stops;
    this.vehicles = vehicles;
    this.color = Helpers.getLineColor(this.id);
    if (this.stops == null) {
      this.stops = [];
    }
    if (this.vehicles == null) {
      this.vehicles = [];
    }

    Helpers.cache.routes[this.id] = this;
  }

  setVehicles(vehicles) {
    Mapper.featureManager.addFeature(`live-vehicles-${this.id}`, vehicles);
    this.vehicles = vehicles;
  }

  static async byId(id) {
    if (Helpers.cache.routes[id]) {
      return Helpers.cache.routes[id];
    }
    const result = await Mbta.getRoute(id);
    return Route.fromRawApi(result);
  }

  static fromRawApi(api) {
    const route = api.data;
    if (Helpers.cache.routes[route.id] == null) {
      Helpers.cache.routes[route.id] = new Route(route.id, route.attributes.name, "Subway");
    }
    return Helpers.cache.routes[route.id];
  }

  static async getShapes(id) {
    const shapeSet = await Promise.all(jsonData.shapes_by_route[id].map((shapeId) => {
      return Helpers.fetchLocalJson(`shapes/routes/${shapeId}.json`);
    }));
    return shapeSet.map((latLons) => {
      return latLons.map((point) => {
        return {lat: point.lat, lng: point.lon};
      });
    });
  }

  async render(renderStops) {
    const shapes = await Route.getShapes(this.id);
    if (this.paths == null) {
      this.paths = shapes.map((shape) => {
        return new google.maps.Polyline({
          path: shape,
          strokeColor: this.color,
          strokeOpacity: this.opacity(),
          strokeWeight: 5
        });
      });
    }
    this.paths.map((path) => path.setMap(Mapper.map));

    if (renderStops) {
      this.stops.map((stop) => stop.render());
    }
  }

  destroy() {
    this.paths?.map((path) => path.setMap(null));
    this.paths = null;
    this.stops.map((stop) => stop.destroy());
  }

  opacity() {
    return 1.0;
  }
}

window.Helpers = Helpers;
window.Template = Template;
window.Marker = Marker;
window.LocationMarker = LocationMarker;
window.Stop = Stop;
window.Vehicle = Vehicle;
window.LiveTrain = LiveTrain;
window.Alert = Alert;
window.Route = Route;

window.templates = {};
window.jsonData = {};

// load templates and JSON before initializing map
$(async () => {
  const registerHandlebarsHelpers = () => {
    Handlebars.registerHelper('time', (date) => {
      return date.toLocaleString('en-US', {
        timeZone: "America/New_York",
        hour: "numeric",
        minute: "numeric"
      });
    });
    Handlebars.registerHelper('arriving', (date) => {
      const minutesAway = new Date(date - new Date()).getMinutes();
      if (minutesAway === 0) {
        return "Arriving";
      } else {
        return `${minutesAway} minutes`;
      }
    });
  };

  const compileTemplates = async () => {
    registerHandlebarsHelpers();
    await Promise.all(['prediction-info', 'alerts'].map(async (templateName) => {
      window.templates[templateName] = await Template.load(templateName);
    }));
    Helpers.events.fire('templates-rendered');
  };

  const loadJson = async () => {
    await Promise.all(['default_stops', 'google_style', 'routes', 'routes_by_line', 'shapes_by_route', 'stops', 'stop_descendants'].map(async (jsonName) => {
      window.jsonData[jsonName] = await Helpers.fetchLocalJson(`js/json/${jsonName}.json`);
    }));
    Helpers.events.fire('json-loaded');
  };

  Helpers.events.bind('prep-complete', () => {
    const updateTrains = () => {
      Mbta.routeIdsToAutoUpdate.map(async (routeId) => {
        const route = await Route.byId(routeId);
        await Mbta.updateVehicleLocations(route);
      });
    };
    updateTrains();
    Helpers.intervals['periodicTrainUpdateInterval'] = setInterval(updateTrains, Mbta.routeAutoUpdateIntervalSeconds * 1000);
  });

  try {
    await Promise.all([loadJson(), compileTemplates()]);
    Helpers.events.fire('prep-complete');
  } catch (error) {
    console.error(error);
  }
});
