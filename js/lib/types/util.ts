export type MaybePromise<T> = T | Promise<T>;
export type Branded<K, Name> = K & { __brand?: Name };
export type RequireKeys<Base, K extends keyof Base> = Omit<Base, K> &
  Required<Pick<Base, K>>;
export function hasKey<O extends object>(
  obj: O,
  key: string | number | symbol,
): key is keyof O {
  return key in obj;
}

/** Keys of `T` that are required (not optional). */
export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

/** Rest-args tuple: optional if `Init` has no required keys. */
export type OptionalArgs<Init> = [RequiredKeys<Init>] extends [never]
  ? [Init?]
  : [Init];

/**
 * Split `S` on delimiter `D`. `string` (non-literal) is left as `string` so
 * the recursion cannot explode.
 */
export type SplitOn<S extends string, D extends string> = string extends S
  ? string
  : S extends `${infer Head}${D}${infer Rest}`
    ? Head | SplitOn<Rest, D>
    : S;

/** `params.query` from an openapi-fetch-style init object. */
export type QueryOf<Init> = Init extends { params: { query: infer Q } }
  ? Q
  : Init extends { params?: { query?: infer Q } }
    ? Q
    : unknown;

/**
 * Rewrite the `data` field of a successful `{ data, error, response }` result.
 * Error branches are left unchanged.
 */
export type MapSuccessData<Result, NewData> = Result extends {
  data: unknown;
  error?: never;
  response: Response;
}
  ? { data: NewData; error?: never; response: Response }
  : Result;

/** Success-body payload from an openapi-fetch `{ data, error }` result union. */
export type UnwrapFetchData<Result> = Result extends {
  data: infer Body;
  error?: never;
}
  ? Body
  : never;
