import _ from 'lodash';
import type { paths } from '../schema';
import createClient from 'openapi-fetch';
import type {
  InclusionToResource,
  MbtaGet,
  RelationshipData,
  ResourceRef,
} from './types/mbta-api';

const rawOpenAPIClient = createClient<paths>({
  baseUrl: import.meta.env.DEV
    ? "/mbta-api/"
    : "https://api-v3.mbta.com/",
  headers: {
    'x-api-key': `5b1ca80157b74611857c912337044985`
  },
});

export class MbtaApiError<T = unknown> extends Error {
  constructor(public readonly error: T) {
    super("MBTA API request failed");
    this.name = "MbtaApiError";
  }
}

async function unwrapGet(url: any, ...init: any[]) {
  const result = await rawOpenAPIClient.GET(url, ...init);
  if (result.error != null) {
    throw new MbtaApiError(result.error);
  }
  if (result.data == null) {
    throw new Error(
      "MBTA API returned neither data nor an error; this is a failsafe indicating an internal bug, not a valid state.",
    );
  }
  return result.data;
}

export const MbtaClient = {
  ...rawOpenAPIClient,
  GET: unwrapGet as MbtaGet,
};

function relationshipRefs(
  data: RelationshipData | RelationshipData[],
  name: string,
): ResourceRef[] {
  const items = Array.isArray(data) ? data : [data];
  return items.flatMap((item) => {
    const rel = item.relationships?.[name];
    if (rel == null || rel.data == null) {
      return [];
    }
    return Array.isArray(rel.data) ? rel.data : [rel.data];
  });
}

export function getIncluded<Thing extends keyof InclusionToResource>(
  resp: {
    data: RelationshipData | RelationshipData[];
    included: ReadonlyArray<
      InclusionToResource[Thing] | { type: string; id: string }
    >;
  },
  name: Thing,
): Record<string, InclusionToResource[Thing]> {
  if (resp.included === undefined) {
    throw new Error("Can't get inclusions from this response - no inclusions found.");
  }

  const refs = relationshipRefs(resp.data, name);
  const refsSetMap = _.chain(refs)
    .groupBy((ref) => ref.type)
    .mapValues((typeRefs) => new Set(typeRefs.map((typeRef) => typeRef.id)))
    .value();
  return _.keyBy(
    resp.included.filter((inclusion) =>
      refsSetMap[inclusion.type]?.has(inclusion.id),
    ) as InclusionToResource[Thing][],
    (inclusion) => inclusion.id,
  );
}
