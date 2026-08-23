import { MbtaResource, MbtaResourceIdentifier } from "../../lib/types/mbta";
import { Marker, MarkerCategory } from "./marker";
import default_stops from '../../json/default_stops.json';
import stop_descendants from '../../json/stop_descendants.json';
import { fire } from "../../lib/events";
import { hasKey } from "../../lib/types/util";
import { getNextTrainsToStop } from "../mbta";

export class Stop extends Marker {
  listener: google.maps.MapsEventListener | undefined;

  constructor(
    public id: string,
    public name: string,
    latLng: google.maps.LatLng,
    category: MarkerCategory
  ) {
    super(latLng, category, name);
    this.id = id;
  }

  protected override postRender() {
    this.listener = google.maps.event.addListener(this.marker!, 'click', this.onClick);
  };

  static fromRawApi(api: MbtaResource<'Stop'>): Stop {
    return new Stop(
      api.id,
      api.attributes.name!,
      new google.maps.LatLng(api.attributes.latitude!, api.attributes.longitude!),
      "Bus",
    );
  }

  static isMainStop(id: string, parentStation?: MbtaResourceIdentifier): boolean {
    return default_stops.indexOf(id) !== -1 || parentStation != null;
  }

  onClick = async () => {
    fire('stop-selected', this);
    const stopAndChildren = hasKey(stop_descendants, this.id)
      ? ([this.id] as string[]).concat(stop_descendants[this.id])
      : [this.id];

    try {
      const predictions = await Promise.all(stopAndChildren.map((stopId) => {
        // todo make name in sig optional, get stop name in getNextTrainsToStop if not passed
        return getNextTrainsToStop({id: stopId, name: stopId});
      }));
      if (predictions.length == 0) {
        fire('stop-fetchdata-error', this);
        console.warn(`No predictions found for stop ${this.name} (ID ${this.id})`);
        return;
      }
      fire('stop-fetchdata-success', this);
      // todo
      // renderPredictions(predictions);
    } catch (err) {
      fire('stop-fetchdata-error', this);
    }
  };
}