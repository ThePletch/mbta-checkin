import { cachedFetchByIds } from "../../lib/cache/cached-fetch-by-ids";
import { readCached, writeCached } from "../../lib/cache/local-cache";
import { MbtaClient } from "../../lib/mbta-client";
import type { MbtaSchemas } from "../../lib/types/mbta-api";

const PAGE_LIMIT = 100;
const MAX_PAGES = 20;
const SERVICE_TIME_ZONE = "America/New_York";
/** Trips between midnight and 3am belong to the previous MBTA service day. */
const SERVICE_DAY_ROLLOVER_HOUR = 3;
const PATTERN_INCLUDE = "representative_trip.stops.parent_station,route" as const;

export type StopRoutePattern = {
  id: string;
  route: MbtaSchemas["RouteResource"] | null;
  stopIds: string[];
};

type ResourceRef = { type: string; id: string };

type JsonResource = {
  type: string;
  id: string;
  relationships?: Record<string, { data?: ResourceRef | ResourceRef[] | null }>;
};

/**
 * The published OpenAPI document types `GET /route_patterns` as one
 * RoutePattern. The endpoint returns a page.
 */
type RoutePatternPage = {
  data: MbtaSchemas["RoutePatternResource"][];
  included?: JsonResource[];
  links?: { next?: string };
};

export async function routePatternsByStop(
  stopIds: readonly string[],
): Promise<Map<string, StopRoutePattern[]>> {
  const serviceDate = mbtaServiceDate();
  return cachedFetchByIds(stopIds, {
    key: (stopId) => `route-patterns:${serviceDate}:${stopId}`,
    read: (key) => {
      const cached = readCached<StopRoutePattern[]>(key);
      return cached === null ? undefined : cached;
    },
    write: (entries) => {
      for (const [key, patterns] of entries) {
        writeCached(key, patterns);
      }
    },
    fetch: (missing) => fetchPatternsForStops(missing, serviceDate),
    idsFor: (pattern, requested) => pattern.stopIds.filter((stopId) => requested.has(stopId)),
  });
}

async function fetchPatternsForStops(
  stopIds: readonly string[],
  serviceDate: string,
): Promise<StopRoutePattern[]> {
  const patterns: StopRoutePattern[] = [];
  let offset = 0;
  for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex += 1) {
    const page = await MbtaClient.GET("/route_patterns", {
      params: {
        query: {
          "filter[stop]": stopIds.join(","),
          "filter[date]": serviceDate,
          include: PATTERN_INCLUDE,
          "page[limit]": PAGE_LIMIT,
          "page[offset]": offset,
        },
      },
    }) as unknown as RoutePatternPage;
    patterns.push(...patternsFromPage(page));
    if (page.data.length === 0 || page.links?.next == null) {
      break;
    }
    offset += page.data.length;
  }
  return patterns;
}

function patternsFromPage(page: {
  data: MbtaSchemas["RoutePatternResource"][];
  included?: JsonResource[];
}): StopRoutePattern[] {
  const included = new Map<string, JsonResource>();
  const routes = new Map<string, MbtaSchemas["RouteResource"]>();
  for (const resource of page.included ?? []) {
    included.set(`${resource.type}:${resource.id}`, resource);
    if (resource.type === "route") {
      routes.set(resource.id, resource as MbtaSchemas["RouteResource"]);
    }
  }

  return page.data.map((pattern) => {
    const routeId = relationshipRefs(pattern, "route")[0]?.id;
    return {
      id: pattern.id,
      route: routeId != null ? routes.get(routeId) ?? null : null,
      stopIds: stopIdsForPattern(pattern, included),
    };
  });
}

function stopIdsForPattern(
  pattern: MbtaSchemas["RoutePatternResource"],
  included: Map<string, JsonResource>,
): string[] {
  const tripRef = relationshipRefs(pattern, "representative_trip")[0];
  const trip = tripRef != null ? included.get(`${tripRef.type}:${tripRef.id}`) : undefined;
  if (trip == null) {
    return [];
  }

  const stopIds: string[] = [];
  for (const stopRef of relationshipRefs(trip, "stops")) {
    stopIds.push(stopRef.id);
    const stop = included.get(`${stopRef.type}:${stopRef.id}`);
    const parentId = stop != null ? relationshipRefs(stop, "parent_station")[0]?.id : undefined;
    if (parentId != null) {
      stopIds.push(parentId);
    }
  }
  return stopIds;
}

function relationshipRefs(
  resource: { relationships?: JsonResource["relationships"] },
  name: string,
): ResourceRef[] {
  const data = resource.relationships?.[name]?.data;
  if (data == null) {
    return [];
  }
  return Array.isArray(data) ? data : [data];
}

function mbtaServiceDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SERVICE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((entry) => entry.type === type)?.value);
  let year = part("year");
  let month = part("month");
  let day = part("day");
  if (part("hour") < SERVICE_DAY_ROLLOVER_HOUR) {
    const previous = new Date(Date.UTC(year, month - 1, day));
    previous.setUTCDate(previous.getUTCDate() - 1);
    year = previous.getUTCFullYear();
    month = previous.getUTCMonth() + 1;
    day = previous.getUTCDate();
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
