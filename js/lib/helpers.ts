import Handlebars from 'handlebars';
import type { LatLng, LineColor, MbtaResource, MbtaResponse, RouteId, RouteLongName, ShapePoint } from './types/mbta';
import { Branded, hasKey } from './types/util';

import shapes_by_route from '../json/shapes_by_route.json';


type EventCallback = (params: unknown) => void;

type MarkerCategory = RouteLongName | 'Bus' | 'Location';
type HexColor = Branded<string, 'Hex'>;


export const events = {
  _ev: {} as Record<string, EventCallback[]>,
  bind(eventName: string | string[], func: EventCallback) {
    const bindEvent = (name: string, boundFunc: EventCallback) => {
      if (!(name in events._ev)) {
        events._ev[name] = [];
      }
      events._ev[name].push(boundFunc);
    };

    if (eventName instanceof Array) {
      eventName.map((name) => bindEvent(name, func));
    } else {
      bindEvent(eventName, func);
    }
  },
  fire(eventName: string, params?: unknown) {
    if (!(eventName in events._ev)) {
      return;
    }

    for (const func of events._ev[eventName]) {
      func(params);
    }
  }
};

export const cache = {
  routes: {} as Record<string, Route>,
  stops: {} as Record<string, Stop>,
  vehicles: {} as Record<string, Vehicle>,
},

export const intervals: {};

export function ensureJsonParsed(json: string | object): object {
  if (typeof json === 'string') {
    return JSON.parse(json);
  } else {
    return json;
  }
}

  export function toQueryString(data?: QuerySerializable): string {
    function isNestedObject(val: unknown): val is QuerySerializable {
      return typeof val === 'object' && val !== null && !Array.isArray(val);
    }
    const params = new URLSearchParams();
    const add = (key: string, value: QuerySerializable[string]) => {
      if (isNestedObject(value)) {
        for (const [nestedKey, nestedValue] of Object.entries(value)) {
          add(`${key}[${nestedKey}]`, nestedValue);
        }
      } else if (value !== undefined) {
        params.append(key, value.toString());
      }
    };
    for (const [key, value] of Object.entries(data ?? {})) {
      add(key, value);
    }
    return params.toString();
  };

  export async function fetchLocalJson(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    return response.json();
  };

  export const iconUrls = {
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
  } as Record<LineColor, HexColor>;

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

  export function getLineIcon(longName: MarkerCategory): string {
    switch (longName) {
      case 'Green Line B':
      case 'Green Line C':
      case 'Green Line D':
      case 'Green Line E':
        return iconUrls.green;
      case 'Orange Line':
        return iconUrls.orange;
      case 'Blue Line':
        return iconUrls.blue;
      case 'Red Line':
        return iconUrls.red;
      case 'Location':
        return iconUrls.locationReticle;
      default:
        return iconUrls.yellow;
    }
  };

  export function getLiveIcon(train: LiveTrain) {
    return {
      path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      fillColor: train.line.color,
      fillOpacity: 1,
      rotation: train.bearing,
      scale: 4,
      strokeWeight: 1
    };
  };

  export function getIcon(line: MarkerCategory): google.maps.Icon {
    return {
      scaledSize: new google.maps.Size(24, 24),
      anchor: new google.maps.Point(12, 12),
      url: getLineIcon(line)
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

  export const vehicleNameMap = {
    'Rapid Transit': 'trains',
    'Local Bus': 'buses',
    'Commuter Rail': 'trains'
  };

  export function mergePredictions(predictions: MbtaResource<'Prediction'>[]) {
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
    const mergePredictionPair = (prediction: MbtaResource<'Prediction'>, secondPrediction: MbtaResource<'Prediction'>) => {
      const subarrExtractor = (prediction) => prediction.routes;
      const keyExtractor = (route) => route.self.name;
      return {
        ...prediction,
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
    const newPredictions = predictions.reduce((acc, prediction) => {
      const existingPrediction = acc[prediction.type]
      return {
        ...acc,
        [prediction.type]: (acc[prediction.type]
      };
    }, {} as Record<string, MbtaResource<'Prediction'>>);
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

export class Template<K> {
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

  constructor(private template: Handlebars.TemplateDelegate<K>) {}

  static async load<K = any>(name: string): Promise<Template<K>> {
    const response = await fetch(`hb/${name}.hdbs`);
    if (!response.ok) {
      throw new Error(`Failed to load template ${name}: ${response.statusText}`);
    }
    const data = await response.text();
    return new Template(Handlebars.compile(data) as Handlebars.TemplateDelegate<K>);
  }

  render(context: K): string {
    return this.template(context, {
      data: {
        intl: Template.formats
      }
    });
  }
}

abstract class Marker {
  protected marker: google.maps.Marker | undefined;
  public readonly title: string;

  constructor(
    public readonly lat: number,
    public readonly lng: number,
    public readonly category: MarkerCategory,
    title?: string,
  ) {
    this.title = title ?? category;
  }

  public render(): asserts this is Rendered<typeof this> {
    this.marker = Mapper.placeMarker(this.lat, this.lng, this.title, Helpers.getIcon(this.category));
    this.postRender(this.marker);
  };

  protected postRender(marker: google.maps.Marker): void {}

  destroy = () => {
    if (this.marker) {
      this.marker.setMap(null);
    } else {
      console.warn(this);
    }
  };
}

type Rendered<K extends Marker> = K & { marker: google.maps.Marker };

export class LocationMarker extends Marker {
  constructor(lat: number, lng: number) {
    super(lat, lng, 'Location');
  }
}

export class Stop extends Marker {
  listener: google.maps.MapsEventListener | undefined;

  constructor(
    public id: string,
    public name: string,
    lat: number,
    lng: number,
    category: MarkerCategory) {
    super(lat, lng, category, name);
    this.id = id;

    cache.stops[this.id] = this;
  }

  protected override postRender() {
    this.listener = google.maps.event.addListener(this.marker!, 'click', this.onClick);
  };

  static fromRawApi(api: MbtaResource<'Stop'>) {
    return cache.stops[api.id] || new Stop(api.id, api.attributes.name!, api.attributes.latitude!, api.attributes.longitude!, "Bus");
  }

  static isMainStop(id: string, parentStation) {
    return Mapper.defaultStopIds.indexOf(id) !== -1 || parentStation.data !== null;
  }

  onClick = async () => {
    events.fire('stop-selected', this);
    const stopAndChildren = [this.id].concat(jsonData.stop_descendants[this.id] || []);
    try {
      const predictions = await Promise.all(stopAndChildren.map((stopId) => {
        return Mbta.getNextTrainsToStop({id: stopId});
      }));
      const result = mergePredictions(predictions.flat());
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

export class Vehicle extends Marker {
  render = () => {
    this.marker = Mapper.placeVehicleMarker(this);
  };
}

export class LiveTrain extends Vehicle {
  public bearing: number;

  constructor(
    public id: string,
    public line: Route,
    public destination: unknown,
    lat: number,
    lng: number,
    bearing: number,
  ) {
    super(lat, lng, line);
    this.id = id;
    this.line = line;
    this.destination = destination;
    this.bearing = bearing;

    cache.vehicles[this.id] = this;
  }
}

export class Alert {
  public timestamp: Date;

  constructor(private text: string) {
    this.timestamp = new Date();
  }

  matches(text: string) {
    return this.text === text;
  }

  equals(thing: unknown) {
    return this === thing || (typeof thing === "string" && this.matches(thing));
  }
}

export class Route {
  private color: HexColor;
  private stops: Stop[];
  private vehicles: Vehicle[];
  private paths: google.maps.Polyline[] | undefined;

  constructor(
    public id: RouteId,
    private name: string,
    private mode: string,
    stops?: Stop[],
    vehicles?: Vehicle[],
  ) {
    this.color = getLineColor(this.id);
    this.stops = stops ?? [];
    this.vehicles = vehicles ?? [];

    cache.routes[this.id] = this;
  }

  setVehicles(vehicles: Vehicle[]) {
    Mapper.featureManager.addFeature(`live-vehicles-${this.id}`, vehicles);
    this.vehicles = vehicles;
  }

  static async byId(id: string) {
    if (cache.routes[id]) {
      return cache.routes[id];
    }
    const result = await Mbta.getRoute(id);
    return Route.fromRawApi(result);
  }

  static fromRawApi(api: MbtaResponse<'Route'>) {
    const route = api.data;
    if (cache.routes[route.id] == null) {
      cache.routes[route.id] = new Route(route.id as RouteId, route.attributes.short_name!, "Subway");
    }
    return cache.routes[route.id];
  }

  static async getShapes(id: RouteId): Promise<LatLng[][]> {
    if (!hasKey(shapes_by_route, id)) {
      return [];
    }
    const shapeSet = await Promise.all(shapes_by_route[id].map((shapeId) => {
      return Helpers.fetchLocalJson(`shapes/routes/${shapeId}.json`) as Promise<ShapePoint[]>;
    }));
    return shapeSet.map((latLons) => {
      return latLons.map((point) => {
        return {lat: point.lat, lng: point.lon};
      });
    });
  }

  async render(renderStops: boolean): Promise<void> {
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
    this.paths = undefined;
    this.stops.map((stop) => stop.destroy());
  }

  opacity() {
    return 1.0;
  }
}

export default Helpers;

const templates = {};

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
    Handlebars.registerHelper('arriving', (date: number) => {
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
    await Promise.all(['google_style', 'routes', 'routes_by_line', 'shapes_by_route', 'stops', 'stop_descendants'].map(async (jsonName) => {
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
