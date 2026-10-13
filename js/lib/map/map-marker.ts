import { MapFeature, mappableRenderable } from './map-feature';
import { Renderable } from '../types/map';
import { MaybePromise } from '../types/util';

export function centeredIconOfSize(size: number, url: string): google.maps.Icon {
  return {
    url,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
  };
}

export abstract class MapMarker extends MapFeature {
  private _marker?: google.maps.Marker;

  protected get marker(): google.maps.Marker {
    if (this._marker == null) {
      this._marker = this.getMarker();
    }
    return this._marker;
  }

  protected abstract getMarker(): google.maps.Marker;

  protected override getRenderables(): Renderable[] {
    return [mappableRenderable(this.marker)];
  }

  protected addMarkerListener(event: string, callback: () => MaybePromise<void>) {
    google.maps.event.addListener(this.marker, event, callback);
  }
}
