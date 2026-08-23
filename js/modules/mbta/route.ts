import { fetchLocalJson, getLineColor, HexColor } from "../../lib/helpers";
import { LatLng, MbtaResponse, RouteId, ShapePoint } from "../../lib/types/mbta";
import { hasKey } from "../../lib/types/util";
import Mapper from '../mapper';
import { getRoute } from "../mbta";
import { Stop } from "./stop";
import { Vehicle } from "./vehicle";
import shapes_by_route from '../../json/shapes_by_route.json';

export class Route {
  public color: HexColor;
  public stops: Stop[];
  public vehicles: Vehicle[];
  public paths: google.maps.Polyline[] | undefined;

  constructor(
    public id: RouteId,
    public name: string,
    public mode: string,
    stops?: Stop[],
    vehicles?: Vehicle[],
  ) {
    this.color = getLineColor(this.id);
    this.stops = stops ?? [];
    this.vehicles = vehicles ?? [];
  }

  setVehicles(vehicles: Vehicle[]) {
    Mapper().featureManager.addFeature(`live-vehicles-${this.id}`, vehicles);
    this.vehicles = vehicles;
  }

  static async byId(id: RouteId): Promise<Route> {
    const result = await getRoute(id);
    return Route.fromRawApi(result);
  }

  static fromRawApi(api: MbtaResponse<'Route'>): Route {
    return new Route(api.data.id as RouteId, api.data.attributes.short_name!, "Subway");
  }

  static async getShapes(id: RouteId): Promise<LatLng[][]> {
    if (!hasKey(shapes_by_route, id)) {
      return [];
    }
    const shapeSet = await Promise.all(shapes_by_route[id].map((shapeId) => {
      return fetchLocalJson(`shapes/routes/${shapeId}.json`).then(JSON.parse) as Promise<ShapePoint[]>;
    }));
    return shapeSet.map((latLons) => {
      return latLons.map((point) => {
        return {lat: point.lat, lng: point.lon};
      });
    });
  }

  async render(renderStops?: boolean): Promise<void> {
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
    this.paths.map((path) => path.setMap(Mapper().map));

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
