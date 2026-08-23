import { Marker } from "./marker";

export class LocationMarker extends Marker {
  constructor(latLng: google.maps.LatLng) {
    super(latLng, 'Location');
  }
}