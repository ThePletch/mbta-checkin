import { Renderable, Renderables } from "../lib/types/map";
import { MaybePromise } from "../lib/types/util";

export class FeatureManager {
  private features: { [k: string]: Renderable[] };

  constructor(private readonly map: google.maps.Map) {
    this.features = {};
  }

  addFeature(key: string, feature: Renderables): void;
  addFeature(key: string, feature: Promise<Renderables>): Promise<void>;
  async addFeature(key: string, feature: MaybePromise<Renderables>): Promise<void> {
    if (this.features[key]) {
      console.warn("Trying to recreate existing feature - update features instead of recreating.")
      await this.destroyFeature(key);
    }
    const resolvedFeature = await feature;
    this.features[key] = Array.isArray(resolvedFeature) ? resolvedFeature : [resolvedFeature];
    await Promise.all(this.features[key].map(feature => feature.render(this.map)));
  }

  public async destroyFeature(key: string): Promise<void> {
    if (!this.features[key]) {
      return;
    }
    await Promise.all(this.features[key].map(feature => feature.destroy()));
    delete this.features[key];
  }

  private presentFeature(key: string) {
    this.features[key].forEach(feature => feature.render(this.map));
  }
}
