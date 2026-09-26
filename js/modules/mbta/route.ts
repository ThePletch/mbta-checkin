import { Stop } from "./stop";
import { Vehicle } from "./vehicle";
import type { MbtaSchemas } from "../../lib/types/mbta-api";
import { getIncluded, MbtaClient } from "../../lib/mbta-client";
import withCache from "../../lib/local-cache";
import { MapFeature, mappableRenderable } from "../../lib/map/map-feature";
import { Renderable } from "../../lib/types/map";

const ROUTE_OPACITY = 1.0;

export class Route extends MapFeature {
  public id: string;
  public name: string;
  public color: string;
  private stops?: Stop[];
  private vehicles?: Vehicle[];
  private paths: Renderable[] | undefined;

  constructor(
    raw: MbtaSchemas['RouteResource'],
    stops?: MbtaSchemas['StopResource'][],
    vehicles?: Vehicle[],
  ) {
    super();
    this.id = raw.id;
    this.name = raw.attributes.short_name;
    this.color = raw.attributes.color;
    console.log(stops);
    this.stops = stops?.map((stop) => Stop.fromRawApi(stop, this));
    this.vehicles = vehicles;
  }

  static async byId(id: string): Promise<Route> {
    const result = await withCache(`route:${id}`, () => 
      MbtaClient.GET('/routes/{id}', {
      params: {
        path: { id },
      }
    }));

    return new Route(result.data);
  }

  async getShapes(): Promise<google.maps.LatLng[][]> {
    const shapes = await withCache(`route:${this.id}:shapes`, () => MbtaClient.GET('/shapes', {
      params: {
        query: {
          'filter[route]': this.id
        }
      }
    }));
    return shapes.data.map((shape) => google.maps.geometry.encoding.decodePath(shape.attributes.polyline));
  }

  async getStops(): Promise<Stop[]> {
    const stopsResponse = await withCache(
      `route:${this.id}:stops`,
      () => MbtaClient.GET('/stops', {params: {query: {"filter[route]": this.id}}})
    );
    console.log(stopsResponse.data);
    this.stops = stopsResponse.data.map((stop) => Stop.fromRawApi(stop, this));
    return this.stops;
  }

  async getVehicles(): Promise<Vehicle[]> {
    const routeVehicles = await MbtaClient.GET('/vehicles', {
      params: {
        query: {
          "filter[route]": this.id,
          include: 'trip',
        }
      }
    });
    const trips = routeVehicles.included != null
      ? getIncluded(routeVehicles, 'trip')
      : {};

    this.vehicles = routeVehicles.data.flatMap((vehicle) => {
      const { latitude, longitude, bearing } = vehicle.attributes;
      if (latitude == null || longitude == null) {
        return [];
      }
      const tripId = vehicle.relationships?.trip?.data?.id;
      const trip = tripId != null ? trips[tripId] : undefined;

      return [new Vehicle(
        new google.maps.LatLng(latitude, longitude),
        bearing ?? 0,
        this,
        trip,
      )];
    });
    return this.vehicles;
  }

  protected override async getRenderables(): Promise<Renderable[]> {
    if (this.paths == null) {
      const shapes = await this.getShapes();
      this.paths = shapes.map((path) => {
        return mappableRenderable(new google.maps.Polyline({
          path,
          strokeColor: `#${this.color}`,
          strokeOpacity: ROUTE_OPACITY,
          strokeWeight: 5
        }));
      });
    }
    if (this.stops == null) {
      this.stops = await this.getStops();
    }

    return [
      ...this.paths,
      ...this.stops,
    ];
  }
}
