export type Renderable = {
  render(map: google.maps.Map): void;
  destroy(): void;
};
export type Renderables = Renderable | Renderable[];

export interface Mappable {
  setMap(map: google.maps.Map | null): void;
  getMap(): google.maps.Map | google.maps.StreetViewPanorama | null;
}