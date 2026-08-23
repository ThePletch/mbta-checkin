import _ from 'lodash';
import type { paths, components } from '../schema';
import createClient from 'openapi-fetch';

type Ref = {
  type: string;
  id: string;
}

type ResponseWithInclusion = {
  data: {
    relationships: Record<string, {
      data: Ref | Ref[];
    }>
  }
};

export const MbtaClient = createClient<paths>({
  baseUrl: 'https://sm614m053d.execute-api.us-east-1.amazonaws.com/Prod/cached_api/',
});

export function getIncluded<Thing extends keyof components['schemas']>(
  resp: ResponseWithInclusion,
  inclusions: Ref[],
  name: keyof (typeof resp)['data']['relationships'],
): components['schemas'][Thing][] {
  if (resp.included === undefined) {
    throw new Error("Can't get inclusions from this response - no inclusions provided.")
  }

  const relationships = resp.data.relationships![name];
  const refs = Array.isArray(relationships.data) ? relationships.data : [relationships.data];
  const refsSetMap = _.chain(refs)
    .groupBy(ref => ref.type)
    .mapValues(typeRefs => new Set(typeRefs.map(typeRef => typeRef.id)))
    .value();
  return resp.included.filter((inclusion) => refsSetMap[inclusion.type].has(inclusion.id)) as components['schemas'][Thing][];
}