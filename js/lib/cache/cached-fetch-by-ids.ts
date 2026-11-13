/**
 * Fetch a set of ids from a per-id memo, request only the misses in one batch,
 * and return a list for every requested id.
 *
 * An empty list is a stored hit. `read` returns `undefined` only for a miss.
 * Ids that the batch response does not mention are stored as `[]`.
 */

const inFlight = new Map<string, Promise<readonly unknown[]>>();

export type CachedFetchByIds<Id extends string, Item> = {
  key: (id: Id) => string;
  read: (key: string) => Item[] | undefined;
  write: (entries: ReadonlyMap<string, Item[]>) => void;
  fetch: (ids: readonly Id[]) => Promise<readonly Item[]>;
  idsFor: (item: Item, requested: ReadonlySet<Id>) => readonly Id[];
};

export async function cachedFetchByIds<Id extends string, Item>(
  ids: readonly Id[],
  source: CachedFetchByIds<Id, Item>,
): Promise<Map<Id, Item[]>> {
  const result = new Map<Id, Item[]>();
  const toFetch: Id[] = [];
  const waiting: Promise<void>[] = [];
  const waiterErrors: unknown[] = [];

  for (const id of uniqueIds(ids)) {
    const cacheKey = source.key(id);
    const cached = source.read(cacheKey);
    if (cached !== undefined) {
      result.set(id, cached.slice());
      continue;
    }

    const pending = inFlight.get(cacheKey) as Promise<readonly Item[]> | undefined;
    if (pending) {
      waiting.push(pending.then(
        (items) => {
          result.set(id, items.slice());
        },
        (error: unknown) => {
          waiterErrors.push(error);
        },
      ));
      continue;
    }

    toFetch.push(id);
  }

  assertUniqueKeys(toFetch, source);

  if (toFetch.length > 0) {
    const requested = new Set(toFetch);
    const batch = deferred<Map<Id, Item[]>>();
    for (const id of toFetch) {
      const cacheKey = source.key(id);
      const slice = batch.promise.then((grouped) => (grouped.get(id) ?? []).slice());
      inFlight.set(cacheKey, slice);
      void slice.then(
        () => clearInFlight(cacheKey, slice),
        () => clearInFlight(cacheKey, slice),
      );
    }

    try {
      const grouped = await loadMissing(toFetch, requested, source);
      batch.resolve(grouped);
      for (const id of toFetch) {
        result.set(id, (grouped.get(id) ?? []).slice());
      }
    } catch (error) {
      batch.reject(error);
      await Promise.all(waiting);
      throw error;
    }
  }

  await Promise.all(waiting);
  if (waiterErrors.length > 0) {
    throw waiterErrors[0];
  }
  return result;
}

async function loadMissing<Id extends string, Item>(
  ids: readonly Id[],
  requested: ReadonlySet<Id>,
  source: CachedFetchByIds<Id, Item>,
): Promise<Map<Id, Item[]>> {
  const items = await source.fetch(ids);
  const grouped = new Map<Id, Item[]>();
  for (const id of ids) {
    grouped.set(id, []);
  }
  for (const item of items) {
    const seen = new Set<Id>();
    for (const id of source.idsFor(item, requested)) {
      const list = grouped.get(id);
      if (list === undefined || seen.has(id)) {
        continue;
      }
      seen.add(id);
      list.push(item);
    }
  }

  const entries = new Map<string, Item[]>();
  for (const id of ids) {
    entries.set(source.key(id), grouped.get(id) ?? []);
  }
  source.write(entries);
  return grouped;
}

function uniqueIds<Id>(ids: readonly Id[]): Id[] {
  const seen = new Set<Id>();
  const unique: Id[] = [];
  for (const id of ids) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    unique.push(id);
  }
  return unique;
}

function assertUniqueKeys<Id extends string, Item>(
  ids: readonly Id[],
  source: CachedFetchByIds<Id, Item>,
): void {
  const owner = new Map<string, Id>();
  for (const id of ids) {
    const cacheKey = source.key(id);
    const existing = owner.get(cacheKey);
    if (existing !== undefined) {
      throw new Error(`cachedFetchByIds key "${cacheKey}" is shared by "${existing}" and "${id}"`);
    }
    owner.set(cacheKey, id);
  }
}

function clearInFlight(cacheKey: string, slice: Promise<readonly unknown[]>): void {
  if (inFlight.get(cacheKey) === slice) {
    inFlight.delete(cacheKey);
  }
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
