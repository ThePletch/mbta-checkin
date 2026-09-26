import { Branded } from "../lib/types/util";
import GOOGLE_STYLE from '../json/google_style.json';
import { bind, fire } from "../lib/events";
import { Route } from "./mbta/route";
import { Stop } from "./mbta/stop";
import { LocationMarker } from "./mbta/location-marker";
import { getNearbyStops } from "./mbta";
import { Reticle } from "./mbta/reticle";
import { FeatureManager } from "./feature-manager";
import type { Mappable } from "../lib/types/map";

type TimeoutEventId = Branded<number, 'Timeout'>;

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

class Mapper {
  public map: google.maps.Map;
  private selectionReticle?: Reticle;
  private pendingSelectionEvent?: {
    timeout: TimeoutEventId;
  };
  private featureManager: FeatureManager;

  constructor() {
    const viewport = document.getElementById("viewport");
    if (viewport == undefined) {
      throw new Error("Expected element with ID #viewport - make sure one exists");
    }
    this.map = new google.maps.Map(viewport, {
      center: MAP_CENTER,
      zoom: DEFAULT_ZOOM,
      styles: GOOGLE_STYLE,
      backgroundColor: "#2a2a2a",
      disableDefaultUI: true,
    });
    this.featureManager = new FeatureManager(this.map);

    this.map.addListener("click", (clickData: google.maps.MapMouseEvent) => {
      if (!clickData.latLng) return;
      this.displayLocation(clickData.latLng);
    });

    bind("modal-closed", this.removeSelectionReticle.bind(this));

    bind("app-location-found", this.displayLocation.bind(this));

    bind("stop-selected", (stop: Stop) => this.putReticleAt(stop.latLng));

    bind("stop-fetchdata-success", () => {
      this.selectionReticle?.setState("success");
    });

    bind("stop-fetchdata-error", () => {
      this.selectionReticle?.setState("error");
      this.enqueueSelectionEvent(2000, this.removeSelectionReticle.bind(this));
    });

    bind("track-route", (routeId: string) => {
      void this.trackRoute(routeId);
    });
  }

  public putOnMap(mappable: Mappable): void {
    mappable.setMap(this.map);
  }
  
  private enqueueSelectionEvent(delayMs: number, callback: () => void) {
    this.clearPendingSelectionEvent();

    this.pendingSelectionEvent = {
      timeout: setTimeout(() => {
        this.pendingSelectionEvent = undefined;
        callback();
      }, delayMs),
    };
  }

  private clearPendingSelectionEvent() {
    if (this.pendingSelectionEvent == null) {
      return;
    }
    clearTimeout(this.pendingSelectionEvent.timeout);
    this.pendingSelectionEvent = undefined;
  }

  private isDefaultRoute(routeId: string): boolean {
    return (DEFAULT_ROUTE_IDS as readonly string[]).includes(routeId);
  }

  private async trackRoute(routeId: string): Promise<void> {
    try {
      fire("api-call-sent");
      const route = await Route.byId(routeId);
      if (this.isDefaultRoute(route.id)) {
        await this.featureManager.destroyFeature("trackedRoute");
      } else {
        await this.featureManager.addFeature("trackedRoute", route);
      }
      const vehicles = await route.getVehicles();
      await this.featureManager.addFeature("trackedVehicles", vehicles);
      fire("api-call-completed");
    } catch (err) {
      console.error(err);
      fire("api-call-error", "Could not fetch vehicle locations.");
    }
  }

  async initializeDefaultFeatures() {
    const defaultRoutes = await Promise.all(DEFAULT_ROUTE_IDS.map(Route.byId));
    this.featureManager.addFeature("defaultRoutes", defaultRoutes);
  }

  async displayLocation(coords: google.maps.LatLng): Promise<void> {
    const locationMarker = new LocationMarker(coords);
    this.featureManager.addFeature(
      "userLocation",
      locationMarker,
    );
    this.zoomToLocation(coords);
    try {
      const stops = await getNearbyStops(coords);
      this.featureManager.addFeature("localStops", stops ?? []);
    } catch (err) {
      console.error(err);
    }
  }

  private putReticleAt(latLng: google.maps.LatLng) {
    this.clearPendingSelectionEvent();
    if (this.selectionReticle == null) {
      this.selectionReticle = new Reticle(latLng);
      this.featureManager.addFeature("selectionReticle", this.selectionReticle);
    } else {
      this.selectionReticle.moveTo(latLng);
      this.selectionReticle.setState('pending');
    }
  }

  removeSelectionReticle() {
    this.clearPendingSelectionEvent();
    this.featureManager.destroyFeature("selectionReticle");
    this.selectionReticle = undefined;
  }

  zoomToLocation(location: google.maps.LatLng) {
    this.map.panTo(location);
    this.map.setZoom(16);
  }
};

let mapper: Mapper | null = null;
function getMapperSingleton() {
  if (mapper == null) {
    mapper = new Mapper();
  }

  return mapper;
}

export default getMapperSingleton;