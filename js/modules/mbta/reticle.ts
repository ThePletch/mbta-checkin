import { centeredIconOfSize, MapMarker } from "../../lib/map/map-marker";

const iconUrls = {
  pending: 'img/selected.png',
  error: 'img/selected_error.png',
  success: 'img/selected_success.png',
};

type ReticleState = keyof typeof iconUrls;

export class Reticle extends MapMarker {
  constructor(
    private latLng: google.maps.LatLng,
    private state: ReticleState = 'pending'
  ) {
    super();
  }

  protected override getMarker(): google.maps.Marker {
    return new google.maps.Marker({
      position: this.latLng,
      icon: centeredIconOfSize(24, iconUrls[this.state]),
    });
  }

  public moveTo(latLng: google.maps.LatLng): void {
    this.latLng = latLng;
    this.marker.setPosition(latLng);
  }

  setState(state: ReticleState) {
    this.state = state;
    this.marker.setIcon(centeredIconOfSize(24, iconUrls[state]));
  }
}