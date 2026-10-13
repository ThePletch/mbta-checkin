import { MapMarker } from "../../lib/map/map-marker";
import { fire } from "../../lib/events";
import { MbtaSchemas } from "../../lib/types/mbta-api";
import { getIncluded, MbtaClient } from "../../lib/mbta-client";
import { renderPredictions } from "../ui";
import withCache from "../../lib/local-cache";
import _ from "lodash";
import { Route } from "./route";

const DEFAULT_STOP_COLOR = "FFAA00";

export type PredictionsByRouteAndDirection = Record<string, {
  route: MbtaSchemas['RouteResource'];
  directions: {
    [direction: string]: {
      predictions: MbtaSchemas['PredictionResource'][];
      name: string;
      headsign: string;
      platform: string | null;
    };
  }
}>;

export class Stop extends MapMarker {
  listener: google.maps.MapsEventListener | undefined;
  private id: string;
  public latLng: google.maps.LatLng;

  constructor(
    public data: MbtaSchemas['StopResource'],
    private readonly mainRoute?: Route,
  ) {
    super();
    this.id = data.id;
    this.latLng = new google.maps.LatLng(this.data.attributes.latitude, this.data.attributes.longitude);
  }

  protected override getMarker(): google.maps.Marker {
    return new google.maps.Marker({
      position: this.latLng,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: `#${this.color}`,
        fillOpacity: 1.0,
        strokeWeight: 1.5,
      },
    });
  }

  static async byId(id: string): Promise<Stop> {
    const result = await withCache(`stop:${id}`, () => MbtaClient.GET('/stops/{id}', {
      params: {
        path: { id }
      }
    }));
    return Stop.fromRawApi(result.data);
  }

  static fromRawApi(api: MbtaSchemas['StopResource'], mainRoute?: Route): Stop {
    return new Stop(
      api,
      mainRoute,
    );
  }

  static async fromRawApiWithPrimaryRoute(api: MbtaSchemas['StopResource']): Promise<Stop> {
    const routesResponse = await fetchRoutesForStop(api.id);
    const primaryRouteResource = primaryRoute(routesResponse.data);
    return Stop.fromRawApi(
      api,
      primaryRouteResource != null ? new Route(primaryRouteResource) : undefined,
    );
  }

  protected override postRender() {
    this.addMarkerListener('click', this.onClick.bind(this));
  };

  getRoutes() {
    return fetchRoutesForStop(this.id);
  }

  get color(): string {
    return this.mainRoute?.color ?? DEFAULT_STOP_COLOR;
  }

  async getPredictions(): Promise<PredictionsByRouteAndDirection> {
    const [
      predictionsResponse,
      rawRouteInfo
    ] = await Promise.all([
      MbtaClient.GET('/predictions', {
        params: {
          query: {
            'filter[stop]': this.id,
            include: 'stop',
          }
        },
      }),
      this.getRoutes(),
    ]);
    const routeInfo = _.keyBy(rawRouteInfo.data, 'id');
    const predictionStops = getIncluded(predictionsResponse, 'stop');

    const routeDirectionName = (id: string, directionIndex: '0' | '1'): string  => {
      const routeProps = routeInfo[id]?.attributes;
      if (routeProps == undefined) {
        throw new Error(`No route '${id}' in route data`);
      }

      return routeProps.direction_names[directionIndex] ?? "Unknown direction";
    };

    const platformForPredictions = (directionPredictions: MbtaSchemas['PredictionResource'][]): string | null => {
      for (const prediction of directionPredictions) {
        const predStop = predictionStops[prediction.relationships.stop.data.id];
        const platform = predStop?.attributes.platform_name ?? predStop?.attributes.platform_code;
        if (platform) {
          return platform;
        }
      }
      return null;
    };
  
    return _.chain(predictionsResponse.data)
      .groupBy(prediction => prediction.relationships.route.data.id)
      .mapValues((predictions, routeId) => ({
        route: routeInfo[routeId],
        directions: _.chain(predictions)
          .groupBy(prediction => prediction.attributes.direction_id.toString())
          .mapValues((directionPredictions, directionId) => ({
            name: routeDirectionName(routeId, directionId as '0' | '1'),
            headsign: directionPredictions[0].attributes.trip_headsign
              ?? routeInfo[routeId].attributes.direction_destinations[Number(directionId)]
              ?? 'Somewhere',
            platform: platformForPredictions(directionPredictions),
            predictions: directionPredictions,
          }))
          .value(),
      }))
      .value();
  }

  onClick = async () => {
    fire('stop-selected', this);

    try {
      const predictions = await this.getPredictions();
      if (Object.keys(predictions).length == 0) {
        fire('stop-fetchdata-error', this);
        console.warn(`No predictions found for stop ${this.data.attributes.name} (ID ${this.id})`);
        return;
      }
      fire('stop-fetchdata-success', this);
      renderPredictions(this, predictions);
    } catch (err) {
      fire('stop-fetchdata-error', this);
    }
  };
}

function fetchRoutesForStop(stopId: string) {
  return withCache(`stop:${stopId}:routes`, () => MbtaClient.GET('/routes', {
    params: {
      query: {
        "filter[stop]": stopId,
        sort: "sort_order",
      }
    }
  }));
}

function primaryRoute(routes: MbtaSchemas['RouteResource'][]): MbtaSchemas['RouteResource'] | undefined {
  // Routes have no "priority" field. `sort_order` is the API's display ranking
  // (subway first, then commuter rail, then buses); `type` is a tiebreaker.
  return _.sortBy(routes, [
    (route) => route.attributes.sort_order ?? Number.MAX_SAFE_INTEGER,
    (route) => route.attributes.type ?? Number.MAX_SAFE_INTEGER,
  ])[0];
}