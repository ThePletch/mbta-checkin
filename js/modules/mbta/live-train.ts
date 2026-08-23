import { Route } from "./route";
import { Vehicle } from "./vehicle";

export class LiveTrain extends Vehicle {
  constructor(
    public id: string,
    route: Route,
    public destination: string,
    latLng: google.maps.LatLng,
    bearing: number,
  ) {
    super(latLng, bearing, route);
    this.id = id;
    this.destination = destination;
  }

  public override getTitle(): string {
    return this.destination;
  }
}