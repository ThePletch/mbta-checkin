import { Marker } from "./marker";
import Mapper from '../mapper';
import { Route } from "./route";

export class Vehicle extends Marker {
  constructor(
    latLng: google.maps.LatLng,
    public bearing: number,
    public route: Route,
  ) {
    super(latLng, route.name);
  }
  public getTitle(): string {
    return 'vroom';
  }
  render() {
    // this.marker = Mapper().placeVehicleMarker(this);
  };
}
