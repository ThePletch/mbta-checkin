import type { Mappable, Renderable } from "../types/map";
import type { MaybePromise } from "../types/util";

export function mappableRenderable(mappable: Mappable): Renderable {
  return {
    render: (map: google.maps.Map) => {
      if (mappable.getMap() == map) {
        console.warn("Tried to re-render a rendered object - alter existing renderables instead of re-rendering")
        return;
      }
      mappable.setMap(map);
    },
    destroy: () => mappable.setMap(null),
  };
}

export abstract class MapFeature implements Renderable {
  public async render(map: google.maps.Map): Promise<void> {
    for (const renderable of await this.getRenderables()) {
      console.log(this, renderable, map);
      renderable.render(map);
    }
    await this.postRender();
  }

  protected abstract getRenderables(): MaybePromise<Renderable[]>;

  protected postRender(): MaybePromise<void> {}

  async destroy(): Promise<void> {
    (await this.getRenderables()).forEach(renderable => renderable.destroy());
  }
}
