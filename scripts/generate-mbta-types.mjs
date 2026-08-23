#!/usr/bin/env node
/**
 * Fetch the MBTA V3 Swagger 2.0 spec, convert to OpenAPI 3, and emit TypeScript types.
 *
 * Usage: npm run generate:types
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';
import converter from 'swagger2openapi';

const SPEC_URL = 'https://api-v3.mbta.com/docs/swagger/swagger.json';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = path.join(ROOT, 'js/lib/types/generated/mbta-api.d.ts');

const RESOURCE_REQUIRED = ['id', 'type', 'attributes'];
const IDENTIFIER_REQUIRED = ['id', 'type'];

/** GTFS / MBTA route_type values (Light Rail … Ferry). */
const ROUTE_TYPE = [0, 1, 2, 3, 4];
const REVENUE_STATUS = ['REVENUE', 'NON_REVENUE'];

/**
 * Attributes documented as closed unions in swagger descriptions, but missing a real
 * `enum` in the upstream schema (so openapi-typescript emits `string` / `number`).
 * Paths are relative to each schema's `properties` object.
 *
 * Prefer this explicit allowlist over scraping description tables — examples and
 * markdown tables are inconsistent upstream.
 *
 * @type {ReadonlyArray<{ schema: string, path: readonly string[], enum: readonly (string | number)[] }>}
 */
const DOCUMENTED_PROPERTY_ENUMS = [
  // String unions
  { schema: 'VehicleResource', path: ['attributes', 'current_status'], enum: ['INCOMING_AT', 'STOPPED_AT', 'IN_TRANSIT_TO'] },
  { schema: 'VehicleResource', path: ['attributes', 'revenue_status'], enum: REVENUE_STATUS },
  { schema: 'TripResource', path: ['attributes', 'revenue_status'], enum: REVENUE_STATUS },
  { schema: 'PredictionResource', path: ['attributes', 'revenue_status'], enum: REVENUE_STATUS },
  {
    schema: 'PredictionResource',
    path: ['attributes', 'schedule_relationship'],
    enum: ['ADDED', 'CANCELLED', 'CANCELED', 'NO_DATA', 'SCHEDULED', 'SKIPPED', 'UNSCHEDULED'],
  },
  {
    schema: 'PredictionResource',
    path: ['attributes', 'update_type'],
    enum: ['AT_TERMINAL', 'MID_TRIP', 'REVERSE_TRIP'],
  },
  {
    schema: 'AlertResource',
    path: ['attributes', 'lifecycle'],
    enum: ['NEW', 'ONGOING', 'ONGOING_UPCOMING', 'UPCOMING'],
  },
  {
    schema: 'OccupancyResource',
    path: ['attributes', 'status'],
    enum: [
      'MANY_SEATS_AVAILABLE',
      'FEW_SEATS_AVAILABLE',
      'STANDING_ROOM_ONLY',
      'CRUSHED_STANDING_ROOM_ONLY',
      'FULL',
      'NOT_ACCEPTING_PASSENGERS',
      'NO_DATA_AVAILABLE',
    ],
  },

  // Numeric unions
  { schema: 'RouteResource', path: ['attributes', 'type'], enum: ROUTE_TYPE },
  { schema: 'StopResource', path: ['attributes', 'vehicle_type'], enum: ROUTE_TYPE },
  { schema: 'InformedEntity', path: ['route_type'], enum: ROUTE_TYPE },
  {
    schema: 'AlertResource',
    path: ['attributes', 'severity'],
    enum: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
];

/**
 * To-one relationships whose `data` is always a resource identifier in practice
 * (never `null`). Expand as more relationships are confirmed.
 *
 * @type {ReadonlyArray<{ schema: string, relationship: string }>}
 */
const NON_NULLABLE_RELATIONSHIP_DATA = [
  { schema: 'VehicleResource', relationship: 'trip' },
  { schema: 'PredictionResource', relationship: 'route' },
];

/**
 * Nested properties that are always present (and non-null) on successful responses.
 * Paths are relative to each schema's `properties` object; the final segment is added
 * to the parent object's `required` list.
 *
 * @type {ReadonlyArray<{ schema: string, path: readonly string[] }>}
 */
const REQUIRED_PROPERTIES = [
  { schema: 'RouteResource', path: ['attributes', 'type'] },
];

async function fetchSwagger() {
  const response = await fetch(SPEC_URL, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'mbta-checkin-typegen/1.0 (+https://github.com/spletcher/mbta-checkin)',
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${SPEC_URL}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function toOpenApi3(swagger) {
  const result = await converter.convertObj(swagger, {
    patch: true,
    warnOnly: true,
  });
  return result.openapi;
}

/**
 * Upstream PhoenixSwagger.JsonApi.resource/1 never marks top-level resource fields as
 * required, even though JSON:API mandates `id` + `type` on server responses and MBTA's
 * REST serializer always emits an `attributes` object (including `{}` under sparse
 * fieldsets). Relationship identifier objects likewise always include `id` + `type`
 * when `data` is non-null.
 *
 * Several attributes are also documented as closed string/number unions but lack a
 * swagger `enum`, so they would otherwise generate as plain `string` / `number`.
 * Selected to-one relationships are patched so `data` is required and non-null.
 *
 * Patch the OpenAPI document before openapi-typescript so regenerations keep these
 * guarantees without hand-maintained wrappers.
 */
function mergeRequired(schema, keys) {
  const existing = Array.isArray(schema.required) ? schema.required : [];
  schema.required = [...new Set([...existing, ...keys])];
}

function isResourceIdentifierSchema(schema) {
  if (!schema || typeof schema !== 'object' || schema.type !== 'object') {
    return false;
  }
  const props = schema.properties;
  if (!props || typeof props !== 'object') {
    return false;
  }
  return 'id' in props && 'type' in props;
}

function patchSchemaTree(node) {
  if (!node || typeof node !== 'object') {
    return;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      patchSchemaTree(item);
    }
    return;
  }

  if (isResourceIdentifierSchema(node)) {
    mergeRequired(node, IDENTIFIER_REQUIRED);
  }

  for (const value of Object.values(node)) {
    patchSchemaTree(value);
  }
}

function getNestedProperty(schema, pathSegments) {
  let node = schema?.properties;
  for (let i = 0; i < pathSegments.length; i++) {
    const key = pathSegments[i];
    if (!node || typeof node !== 'object' || !(key in node)) {
      return null;
    }
    const next = node[key];
    if (i === pathSegments.length - 1) {
      return next;
    }
    node = next?.properties;
  }
  return null;
}

/** Parent object schema that owns `pathSegments`' final property. */
function getParentObjectSchema(schema, pathSegments) {
  if (pathSegments.length === 0) {
    return null;
  }
  if (pathSegments.length === 1) {
    return schema;
  }
  return getNestedProperty(schema, pathSegments.slice(0, -1));
}

function applyDocumentedPropertyEnums(schemas) {
  for (const { schema: schemaName, path: pathSegments, enum: values } of DOCUMENTED_PROPERTY_ENUMS) {
    const schema = schemas[schemaName];
    if (!schema) {
      console.warn(`Enum patch skipped: schema ${schemaName} not found`);
      continue;
    }
    const property = getNestedProperty(schema, pathSegments);
    if (!property || typeof property !== 'object') {
      console.warn(`Enum patch skipped: ${schemaName}.${pathSegments.join('.')} not found`);
      continue;
    }
    property.enum = [...values];
  }
}

function applyRequiredProperties(schemas) {
  for (const { schema: schemaName, path: pathSegments } of REQUIRED_PROPERTIES) {
    const schema = schemas[schemaName];
    if (!schema) {
      console.warn(`Required-property patch skipped: schema ${schemaName} not found`);
      continue;
    }
    const property = getNestedProperty(schema, pathSegments);
    const parent = getParentObjectSchema(schema, pathSegments);
    if (!property || !parent || typeof parent !== 'object') {
      console.warn(`Required-property patch skipped: ${schemaName}.${pathSegments.join('.')} not found`);
      continue;
    }
    stripNullability(property);
    mergeRequired(parent, [pathSegments[pathSegments.length - 1]]);
  }
}

/** Strip OpenAPI nullability wrappers so a schema cannot be null. */
function stripNullability(schema) {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }
  delete schema.nullable;
  for (const key of ['anyOf', 'oneOf', 'allOf']) {
    if (!Array.isArray(schema[key])) {
      continue;
    }
    schema[key] = schema[key].filter((entry) => entry?.type !== 'null');
    if (schema[key].length === 1 && typeof schema[key][0] === 'object') {
      const [only] = schema[key];
      delete schema[key];
      Object.assign(schema, only);
    } else if (schema[key].length === 0) {
      delete schema[key];
    }
  }
  return schema;
}

function applyNonNullableRelationshipData(schemas) {
  for (const { schema: schemaName, relationship } of NON_NULLABLE_RELATIONSHIP_DATA) {
    const schema = schemas[schemaName];
    if (!schema) {
      console.warn(`Non-null relationship patch skipped: schema ${schemaName} not found`);
      continue;
    }
    const rel = getNestedProperty(schema, ['relationships', relationship]);
    if (!rel || typeof rel !== 'object') {
      console.warn(`Non-null relationship patch skipped: ${schemaName}.relationships.${relationship} not found`);
      continue;
    }
    if (!rel.properties?.data) {
      console.warn(`Non-null relationship patch skipped: ${schemaName}.relationships.${relationship}.data not found`);
      continue;
    }
    stripNullability(rel.properties.data);
    mergeRequired(rel, ['data']);
  }
}

function tightenMbtaOpenApi(openapi) {
  const schemas = openapi?.components?.schemas;
  if (!schemas) {
    return openapi;
  }

  for (const [name, schema] of Object.entries(schemas)) {
    if (!name.endsWith('Resource') || !schema || typeof schema !== 'object') {
      continue;
    }
    mergeRequired(schema, RESOURCE_REQUIRED);
    patchSchemaTree(schema);
  }

  applyDocumentedPropertyEnums(schemas);
  applyRequiredProperties(schemas);
  applyNonNullableRelationshipData(schemas);

  return openapi;
}

async function main() {
  console.log(`Fetching ${SPEC_URL}…`);
  const swagger = await fetchSwagger();
  if (swagger.swagger !== '2.0' && !swagger.openapi) {
    throw new Error('Unexpected spec format: expected Swagger 2.0 or OpenAPI 3');
  }

  console.log('Converting Swagger 2 → OpenAPI 3…');
  const openapi = swagger.openapi ? swagger : await toOpenApi3(swagger);

  console.log('Tightening MBTA OpenAPI (required fields + documented enums)…');
  tightenMbtaOpenApi(openapi);

  console.log('Generating TypeScript types…');
  const ast = await openapiTS(openapi);
  const contents = [
    '/**',
    ' * This file is auto-generated by `npm run generate:types`.',
    ' * Do not edit by hand — regenerate from the live MBTA Swagger spec.',
    ` * Source: ${SPEC_URL}`,
    ` * Generated: ${new Date().toISOString()}`,
    ' *',
    ' * Patches applied by scripts/generate-mbta-types.mjs:',
    ' * - *Resource: require `id`, `type`, `attributes`',
    ' * - relationship identifiers: require `id`, `type` when present',
    ' * - documented string/number unions missing upstream `enum`',
    ' * - selected attributes: required on their parent object',
    ' * - selected to-one relationships: require non-null `data`',
    ' */',
    '',
    astToString(ast),
  ].join('\n');

  await mkdir(path.dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, contents, 'utf8');
  console.log(`Wrote ${path.relative(ROOT, OUT_FILE)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
