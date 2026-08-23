import { Branded } from "../lib/types/util";
import defaultStops from '../json/default_stops.json';
import googleStyle from '../json/google_style.json';
import routes from '../json/routes.json';
import stops from '../json/stops.json';
import { bind } from "../lib/events";
import { Route } from "./mbta/route";
import { Stop } from "./mbta/stop";
import { LocationMarker } from "./mbta/location-marker";
import { getNearbyStops } from "./mbta";

type Renderable = { render(): void; destroy(): void; };
type Renderables = Renderable | Renderable[];
type TimeoutEventId = Branded<number, 'Timeout'>;

type MarkerStates = 'error' | 'success';

const iconUrls = {
  selected: 'img/selected.png',
  selectedError: 'img/selected_error.png',
  selectedSuccess: 'img/selected_success.png',
};

const MAP_CENTER = {
  lat: 42.358,
  lng: -71.064,
};
const DEFAULT_ZOOM = 14;
export const DEFAULT_ROUTE_IDS = [
  "741",
  "742",
  "746",
  "749",
  "751",
  "Green-B",
  "Green-C",
  "Green-D",
  "Green-E",
  "Red",
  "Blue",
  "Orange",
] as const;

class FeatureManager {
  private features: {[k: string]: Renderables};

  constructor() {
    this.features = {};
  }

  addFeature(key: string, feature: Renderables): void {
    this.destroyFeature(key);
    this.features[key] = feature;
    this.renderFeature(key);
  }

  // boilerplate getter to avoid needing to expose features
  getFeature(key: string): Renderables | undefined {
    return this.features[key];
  }

  destroyFeature(key: string): void {
    if (!this.features[key]) {
      return;
    }
    const feature = this.features[key];

    if (Array.isArray(feature)) {
      feature.forEach(feature => feature.destroy);
    } else {
      feature.destroy();
    }
  }

  renderFeature(key: string) {
    if (!this.features[key]) {
      return;
    }
    const feature = this.features[key];

    if (Array.isArray(feature)) {
      feature.forEach(feature => feature.render());
    } else {
      feature.render();
    }
  }
}

class Mapper {
  map: google.maps.Map;
  selected?: google.maps.marker.AdvancedMarkerElement;
  pendingSelectionEvent?: TimeoutEventId;
  featureManager: FeatureManager;

  constructor() {
    const viewport = document.getElementById("viewport");
    if (viewport == undefined) {
      throw new Error("Expected element with ID #viewport - make sure one exists");
    }
    this.map = new google.maps.Map(viewport, {
      center: MAP_CENTER,
      zoom: DEFAULT_ZOOM,
      styles: googleStyle,
      backgroundColor: "#2a2a2a",
      disableDefaultUI: true,
    });
    this.featureManager = new FeatureManager();

    this.map.addListener("click", (clickData: google.maps.MapMouseEvent) => {
      if (!clickData.latLng) return;
      this.displayLocation(clickData.latLng);
    });

    this.featureManager.addFeature(
      "defaultRoutes",
      DEFAULT_ROUTE_IDS.map((routeId) => {
        const route = routes[routeId];
        // todo update json with route mode
        return new Route(route.id as typeof routeId, route.name, "blarf");
      }),
    );

    this.featureManager.addFeature(
      "defaultStops",
      (defaultStops as (keyof typeof stops)[]).map((stopId) => {
        const stop = stops[stopId];
        // uses Bus for consistent yellow color
        return new Stop(stop.id, stop.name, new google.maps.LatLng(stop.lat, stop.lon), "Bus");
      }),
    );

    bind("modal-closed", this.removeSelected);

    bind("app-location-found", this.displayLocation);

    bind("stop-selected", this.markStopSelected);

    bind("stop-fetchdata-success", () => {
      this.markSelectedStopState("success");
    });

    bind("stop-fetchdata-error", () => {
      this.markSelectedStopState("error");
      this.pendingSelectionEvent = setTimeout(this.removeSelected, 2000);
    });
  }

  async displayLocation(coords: google.maps.LatLng): Promise<void> {
    this.featureManager.addFeature(
      "userLocation",
      new LocationMarker(coords),
    );
    this.zoomToLocation(coords);
    try {
      const stops = await getNearbyStops(coords);
      this.featureManager.addFeature("localStops", stops);
    } catch (err) {
      console.error(err);
    }
  }

  markerImage(state: MarkerStates): Element {
    const img = document.createElement('img');
    img.src = {
      error: iconUrls.selectedError,
      success: iconUrls.selectedSuccess,
    }[state];
    img.style.width = '33px';
    img.style.height = '33px';

    return img;
  }

  markSelectedStopState(state: MarkerStates) {
    if (this.selected == undefined) {
      console.warn("Tried to set selection marker state with no selection");
      return;
    }



    this.selected.replaceChildren(this.markerImage(state));
  }

  // TODO improve naming in marker manipulation methods
  markStopSelected(stop: Stop): void {
    // delete any existing selection marker
    if (this.selected != null) {
      this.removeSelected();
    }

    const imageNode = document.createElement('img');
    // imageNode.src = stop.icon;
    imageNode.style.width = '33px';
    imageNode.style.height = '33px';

    this.selected = new google.maps.marker.AdvancedMarkerElement({
      position: stop.latLng,
      map: this.map,
      content: imageNode,
    });
  }

  placeMarker(position: google.maps.LatLng, title: string, content: Element) {
    return new google.maps.marker.AdvancedMarkerElement({
      position,
      map: this.map,
      title,
      content,
    });
  }

  removeSelected() {
    if (this.pendingSelectionEvent) {
      clearTimeout(this.pendingSelectionEvent);
    }
    if (this.selected) {
      this.selected.remove();
      this.selected = undefined;
    }
  }

  zoomToLocation(location: google.maps.LatLng) {
    this.map.panTo(location);
    this.map.setZoom(16);
  }
};

let mapper: Mapper | null = null;
export default function getMapperSingleton() {
  if (mapper == null) {
    mapper = new Mapper();
  }

  return mapper;
}