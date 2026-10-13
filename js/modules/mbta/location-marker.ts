import { centeredIconOfSize, MapMarker } from "../../lib/map/map-marker";

export class LocationMarker extends MapMarker {
  constructor(private readonly latLng: google.maps.LatLng) {
    super();
  }

  protected override getMarker(): google.maps.Marker {
    return new google.maps.Marker({
      position: this.latLng,
      icon: centeredIconOfSize(24, 'img/selected_blue.png'),
    });
  }
}