type Awaitable<T> = T | PromiseLike<T>;

type AsyncOrSyncIterable<T> = AsyncIterable<T> | Iterable<Awaitable<T>>;

type PolyfilledArrayConstructor = typeof Array & {
  fromAsync?: <T, U = Awaited<T>>(
    source: AsyncOrSyncIterable<T> | null | undefined,
    mapFn?: (value: Awaited<T>, index: number) => Awaitable<U>,
    thisArg?: unknown,
  ) => Promise<U[]>;
};

declare global {
  interface ArrayConstructor {
    fromAsync?<T, U = Awaited<T>>(
      source: AsyncOrSyncIterable<T> | null | undefined,
      mapFn?: (value: Awaited<T>, index: number) => Awaitable<U>,
      thisArg?: unknown,
    ): Promise<U[]>;
  }
}

function hasAsyncIterator<T>(value: AsyncOrSyncIterable<T>): value is AsyncIterable<T> {
  return typeof (value as AsyncIterable<T>)[Symbol.asyncIterator] === "function";
}

function hasSyncIterator<T>(value: AsyncOrSyncIterable<T>): value is Iterable<Awaitable<T>> {
  return typeof (value as Iterable<Awaitable<T>>)[Symbol.iterator] === "function";
}

async function* toAsyncIterable<T>(source: AsyncOrSyncIterable<T>): AsyncIterable<Awaited<T>> {
  if (hasAsyncIterator(source)) {
    for await (const item of source) {
      yield item as Awaited<T>;
    }
    return;
  }

  if (hasSyncIterator(source)) {
    for (const item of source) {
      yield await item;
    }
    return;
  }

  throw new TypeError("Array.fromAsync requires an async or sync iterable");
}

function ensureArrayFromAsyncPolyfill() {
  const arrayCtor = Array as PolyfilledArrayConstructor;

  if (typeof arrayCtor.fromAsync === "function") return;

  arrayCtor.fromAsync = async function fromAsync<T, U = Awaited<T>>(
    source: AsyncOrSyncIterable<T> | null | undefined,
    mapFn?: (value: Awaited<T>, index: number) => Awaitable<U>,
    thisArg?: unknown,
  ): Promise<U[]> {
    if (source == null) {
      throw new TypeError("Array.fromAsync requires an iterable");
    }

    const useMap = typeof mapFn === "function";
    const mapper = useMap ? mapFn!.bind(thisArg ?? undefined) : null;
    const results: U[] = [];
    let index = 0;

    for await (const raw of toAsyncIterable(source)) {
      const value = raw as Awaited<T>;
      const mapped = mapper ? await mapper(value, index) : (value as unknown as U);
      results.push(mapped);
      index += 1;
    }

    return results;
  };
}

ensureArrayFromAsyncPolyfill();

export {};
