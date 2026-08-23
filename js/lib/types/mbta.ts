export type LineColor = "red" | "green" | "blue" | "orange" | "silver" | "bus";

/**
 * Auto-generated MBTA V3 API types (`npm run generate:types`).
 * Prefer `components["schemas"]["PredictionResource"]` etc. for response bodies.
 */
export type { components, operations, paths } from "./generated/mbta-api";

import type { components } from "./generated/mbta-api";

import type routes from "../../json/routes.json";
import type stops from "../../json/stops.json";
export type RouteId = keyof typeof routes;
export type StopId = keyof typeof stops;
/** Display name from local routes.json (e.g. "Blue Line"). */
export type RouteLongName = (typeof routes)[RouteId]["name"];

export type Serializable = { toString(): string };

/**
 * Resource `id` / `type` / `attributes` are required in generated types via
 * `scripts/generate-mbta-types.mjs` (JSON:API + MBTA REST guarantees). No
 * FilledInResource / RequireKeys pass is needed for those fields.
 */
type MbtaSchemas = components["schemas"];
export type MbtaSchemaName = keyof MbtaSchemas;
export type MbtaResourceName = MbtaSchemaName & `${string}Resource`;
export type MbtaResourceKey = MbtaResourceName extends `${infer Name}Resource`
  ? Name
  : never;
export type MbtaResource<K extends MbtaResourceKey> =
  MbtaSchemas[`${K}Resource` & MbtaSchemaName];
export type MbtaResourceAttributes<K extends MbtaResourceKey> =
  MbtaResource<K>["attributes"];

export type MbtaResourceIdentifier = {
  id: string;
  type: string;
}

export type MbtaSingularResponseName = keyof {
  [
    Schema in MbtaSchemaName as Schema extends `${infer Thing}Resource`
      ? Thing & MbtaSchemaName
      : never
  ]: any;
};
export type MbtaPluralResponseName =
  | (`${MbtaSchemaName}s` & MbtaSchemaName)
  | "Facilities"
  | "LiveFacilities"
  | "Predictions";
type MbtaPluralToSingularResource = {
  [
    K in Exclude<MbtaPluralResponseName, "Facilities" | "LiveFacilities">
  ]: K extends `${infer Singular}s`
    ? `${Singular}Resource` & MbtaSchemaName
    : never;
} & {
  Facilities: "FacilityResource";
  LiveFacilities: "LiveFacilityResource";
};

export type MbtaResponseName =
  MbtaSingularResponseName | MbtaPluralResponseName;

type SingleResponseResource<K extends MbtaSingularResponseName> =
  MbtaSchemas[`${K}Resource`];
type ListResponseResource<K extends MbtaPluralResponseName> =
  MbtaSchemas[MbtaPluralToSingularResource[K]];
export type ResponseData<K extends MbtaResponseName> =
  K extends MbtaSingularResponseName
    ? SingleResponseResource<K>
    : K extends MbtaPluralResponseName
      ? ListResponseResource<K>[]
      : never;
export type ResponseResource<K extends MbtaResponseName> =
  ResponseData<K> extends any[] ? ResponseData<K>[number] : ResponseData<K>;
export type MbtaResponseWithDataType<
  K extends MbtaResponseName,
  DataType,
> = Omit<MbtaSchemas[K], "data"> & { data: DataType };
export type MbtaResponse<K extends MbtaResponseName> = MbtaResponseWithDataType<
  K,
  ResponseData<K>
>;
export type RequireRelationships<
  K,
  Included extends string | undefined,
> = Included extends string
  ? K extends { relationships?: infer Children }
    ? Omit<K, "relationships"> & {
        relationships: {
          [K in keyof Children & Included]: NonNullable<Children[K]>;
        } & Omit<Children, Included>;
      }
    : K extends { relationships?: infer Children }[]
      ? (Omit<K[number], "relationships"> & {
          relationships: {
            [Key in keyof Children & Included]: NonNullable<Children[Key]>;
          } & Omit<Children, Included>;
        })[]
      : K
  : K;
export type QuerySerializable = {
  [key: string]: Serializable | Serializable[] | QuerySerializable;
};

type Inclusions<T extends MbtaResponseName> =
  ResponseResource<T> extends { relationships?: infer R } ? keyof R : never;

export type CommaSeparatedInclusions<
  T extends MbtaResponseName,
  S extends string,
> =
  S extends Inclusions<T>
    ? S
    : S extends `${infer Head extends Inclusions<T>},${infer Rest}`
      ? `${Head},${CommaSeparatedInclusions<T, Rest>}`
      : never;

export type QueryParamsWithInclusions<T extends MbtaResponseName, Params> = {
  [K in keyof Params]: K extends "include"
    ? Params[K] extends string
      ? CommaSeparatedInclusions<T, Params[K]>
      : never
    : Params[K];
};

export type ShapePoint = {
  lat: number;
  lon: number;
  order: number;
};
export type LatLng = {
  lat: number;
  lng: number;
};
export type LatitudeLongitude = {
  latitude: number;
  longitude: number;
};
