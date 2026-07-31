export type LineColor = 'red' | 'green' | 'blue' | 'orange' | 'silver' | 'bus';

/**
 * Auto-generated MBTA V3 API types (`npm run generate:types`).
 * Prefer `components["schemas"]["PredictionResource"]` etc. for response bodies.
 */
export type { components, operations, paths } from './generated/mbta-api';

import type { components } from './generated/mbta-api';

import type routes from '../../json/routes.json';
import type stops from '../../json/stops.json';
import { RequireKeys } from './util';
export type RouteId = keyof typeof routes;
export type StopId = keyof typeof stops;

type ResourceWithAttributes = { id?: string; attributes?: unknown; type?: string; };
export type FilledInResource<K extends ResourceWithAttributes> = RequireKeys<K, 'id' | 'type' | 'attributes'>;
export type ResponseWithDataType<K, D> = Omit<K, 'data'> & { data: D };

type MbtaSchemas = components['schemas'];
interface MbtaApi {
    Responses: {
        Predictions: ResponseWithDataType<MbtaSchemas['Predictions'], MbtaResource<'Prediction'>[]>;
        Route: ResponseWithDataType<MbtaSchemas['Route'], MbtaResource<'Route'>>;
        Routes: ResponseWithDataType<MbtaSchemas['Routes'], MbtaResource<'Route'>[]>;
        Stop: ResponseWithDataType<MbtaSchemas['Stop'], MbtaResource<'Stop'>>;
        Stops: ResponseWithDataType<MbtaSchemas['Stops'], MbtaResource<'Stop'>[]>;
        Vehicle: ResponseWithDataType<MbtaSchemas['Vehicle'], MbtaResource<'Vehicle'>>;
        Vehicles: ResponseWithDataType<MbtaSchemas['Vehicles'], MbtaResource<'Vehicle'>[]>;
    }
    RawResources: {
        Prediction: MbtaSchemas['PredictionResource'];
        Route: MbtaSchemas['RouteResource'];
        Schedule: MbtaSchemas['ScheduleResource'];
        Stop: MbtaSchemas['StopResource'];
        Trip: MbtaSchemas['TripResource'];
        Vehicle: MbtaSchemas['VehicleResource'];
        Alert: MbtaSchemas['AlertResource'];
    };
    Resources: {
        [Resource in keyof MbtaApi['RawResources']]: FilledInResource<MbtaApi['RawResources'][Resource]>;
    }
}
export type MbtaRawResource<K extends keyof MbtaApi['Resources']> = MbtaApi['RawResources'][K];
export type MbtaResource<K extends keyof MbtaApi['Resources']> = MbtaApi['Resources'][K];
export type MbtaResourceAttributes<K extends keyof MbtaApi['Resources']> = MbtaResource<K>['attributes'];
export type MbtaResponse<K extends keyof MbtaApi['Responses']> = MbtaApi['Responses'][K];

export type ShapePoint = {
    lat: number;
    lon: number;
    order: number;
}
export type LatLng = {
    lat: number;
    lng: number;
}
export type LatitudeLongitude = {
    latitude: number;
    longitude: number;
}