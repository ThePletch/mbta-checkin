import type { paths, components } from "../../schema";
import type {
  FetchResponse,
  MaybeOptionalInit,
} from "openapi-fetch";
import type { PathsWithMethod } from "openapi-typescript-helpers";
import type { MapSuccessData, OptionalArgs, QueryOf, SplitOn, UnwrapFetchData } from "./util";

export type MbtaSchemas = components["schemas"];

export type ResourceRef = {
  type: string;
  id: string;
};

export type RelationshipData = {
  relationships?: Record<string, { data?: ResourceRef | ResourceRef[] | null }>;
};

/**
 * Relationship `include` keys → JSON:API resource objects.
 * Aliases (e.g. `parent_station`) map to the resource that actually appears in `included`.
 */
export type InclusionToResource = {
  trip: MbtaSchemas["TripResource"];
  vehicle: MbtaSchemas["VehicleResource"];
  route: MbtaSchemas["RouteResource"];
  stop: MbtaSchemas["StopResource"];
  parent_station: MbtaSchemas["StopResource"];
  child_stops: MbtaSchemas["StopResource"];
  stops: MbtaSchemas["StopResource"];
  schedule: MbtaSchemas["ScheduleResource"];
  prediction: MbtaSchemas["PredictionResource"];
  predictions: MbtaSchemas["PredictionResource"];
  route_pattern: MbtaSchemas["RoutePatternResource"];
  route_patterns: MbtaSchemas["RoutePatternResource"];
  line: MbtaSchemas["LineResource"];
  shape: MbtaSchemas["ShapeResource"];
  service: MbtaSchemas["ServiceResource"];
  occupancy: MbtaSchemas["OccupancyResource"];
  occupancies: MbtaSchemas["OccupancyResource"];
  alert: MbtaSchemas["AlertResource"];
  alerts: MbtaSchemas["AlertResource"];
  facility: MbtaSchemas["FacilityResource"];
  facilities: MbtaSchemas["FacilityResource"];
};

/** `"trip,stop"` / `"trip.route"` → `"trip" | "stop"` / `"trip" | "route"` */
export type IncludeKeys<S extends string> = SplitOn<SplitOn<S, ",">, ".">;

export type IncludedResources<Include> = Include extends string
  ? IncludeKeys<Include> extends infer Key
    ? Key extends keyof InclusionToResource
      ? InclusionToResource[Key]
      : never
    : never
  : never;

type IncludeFromInit<Init> = QueryOf<Init> extends { include: infer I }
  ? I
  : QueryOf<Init> extends { include?: infer I }
    ? I
    : undefined;

type AddIncluded<Body, Include> = [IncludedResources<Include>] extends [never]
  ? Body
  : Omit<Body, "included"> & { included: IncludedResources<Include>[] };

/**
 * On a successful fetch, replace the untyped JSON:API `included` list with the
 * resource types implied by `params.query.include`. Error responses are unchanged.
 */
export type WithTypedIncludes<Result, Init> = Result extends {
  data: infer Body;
  error?: never;
  response: Response;
}
  ? MapSuccessData<Result, AddIncluded<Body, IncludeFromInit<Init>>>
  : Result;

type OperationQuery<Path extends PathsWithMethod<paths, "get">> =
  paths[Path]["get"] extends { parameters: { query?: infer Q } }
    ? NonNullable<Q>
    : Record<never, never>;

/**
 * `Include` is inferred from `params.query.include` so comma-separated literals
 * are preserved. The OpenAPI `include?: string` field would otherwise widen them.
 */
export type MbtaGet = <
  Path extends PathsWithMethod<paths, "get">,
  const Include extends string | undefined = undefined,
>(
  url: Path,
  ...init: OptionalArgs<
    MaybeOptionalInit<paths[Path], "get"> & {
      params?: {
        query?: Omit<OperationQuery<Path>, "include"> & { include?: Include };
      };
    }
  >
) => Promise<
  UnwrapFetchData<
    WithTypedIncludes<
      FetchResponse<
        paths[Path]["get"],
        MaybeOptionalInit<paths[Path], "get">,
        `${string}/${string}`
      >,
      { params: { query: { include: Include } } }
    >
  >
>;

export type ResponseWithInclusion<K> = {
  data: RelationshipData | RelationshipData[];
  included: K[];
};

export type ResponseWithNamedInclusion<K extends keyof InclusionToResource> =
  ResponseWithInclusion<InclusionToResource[K]>;
