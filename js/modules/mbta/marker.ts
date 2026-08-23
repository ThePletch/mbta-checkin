import Mapper from '../mapper';
import { RouteLongName } from "../../lib/types/mbta";

export type MarkerCategory = RouteLongName | 'Bus' | 'Location';

export const iconUrls = {
  red: 'img/red_line.png',
  green: 'img/green_line.png',
  blue: 'img/blue_line.png',
  orange: 'img/orange_line.png',
  yellow: 'img/yellow_line.png',
  locationReticle: 'img/selected_blue.png',
};

function getIcon(line: MarkerCategory): Element {
  const img = document.createElement('img');
  img.src = getLineIcon(line);
  img.style.height = "24";
  img.style.width = "24";

  return img;
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

export abstract class Marker {
  protected marker: google.maps.marker.AdvancedMarkerElement | undefined;
  public readonly title: string;

  constructor(
    public readonly latLng: google.maps.LatLng,
    public readonly category: MarkerCategory,
    title?: string,
  ) {
    this.title = title ?? category;
  }

  public render(): asserts this is Rendered<typeof this> {
    this.marker = Mapper().placeMarker(this.latLng, this.title, getIcon(this.category));
    this.postRender(this.marker);
  };

  public get icon(): Element | undefined {
    if (this.marker && this.marker.childElementCount > 0) {
      return this.marker.children[0];
    }

    // redundant but good to be explicit
    return undefined;
  }

  protected postRender(_marker: google.maps.marker.AdvancedMarkerElement): void {}

  destroy() {
    this.marker?.remove();
  };
}

type Rendered<K extends Marker> = K & {
  marker: google.maps.marker.AdvancedMarkerElement;
  icon(): Element;
};