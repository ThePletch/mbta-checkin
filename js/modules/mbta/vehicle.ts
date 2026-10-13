import { MbtaSchemas } from "../../lib/types/mbta-api";
import { MapMarker } from "../../lib/map/map-marker";
import { Route } from "./route";

export class Vehicle extends MapMarker {
  constructor(
    private readonly latLng: google.maps.LatLng,
    private readonly bearing: number,
    private readonly route: Route,
    private readonly trip?: MbtaSchemas['TripResource'],
  ) {
    super();
  }

  protected override getMarker(): google.maps.Marker {
    const headsign = this.trip?.attributes.headsign;
    return new google.maps.Marker({
      position: this.latLng,
      icon: {
        path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
        rotation: this.bearing ?? 0,
        scale: 4,
        fillColor: `#${this.route.color}`,
        fillOpacity: 1.0,
        strokeWeight: 1.5,
      },
      title: headsign ? `${this.route.name} - ${headsign}` : this.route.name,
    });
  }
}
