// TODO: I should probably upstream this to rimless

import { withTransferable } from "rimless";

type TransferCandidate =
  | ArrayBuffer
  | MessagePort
  | ReadableStream<unknown>
  | WritableStream<unknown>
  | TransformStream<unknown, unknown>;

const hasSharedArrayBuffer = typeof SharedArrayBuffer === "function";
const chaiInspectSymbol =
  typeof Symbol === "function" && typeof Symbol.for === "function" ? Symbol.for("chai/inspect") : undefined;
let messagePortInspectPatched = false;

const ensureMessagePortInspectable = () => {
  if (messagePortInspectPatched || !chaiInspectSymbol) return;
  if (typeof MessagePort !== "function") {
    messagePortInspectPatched = true;
    return;
  }

  try {
    Object.defineProperty(MessagePort.prototype, chaiInspectSymbol, {
      configurable: true,
      value: () => "MessagePort { [transferable] }",
    });
  } catch {
    // Ignore environments that prevent redefining the inspector.
  } finally {
    messagePortInspectPatched = true;
  }
};

const isSharedArrayBuffer = (value: ArrayBuffer | SharedArrayBuffer): value is SharedArrayBuffer => {
  return hasSharedArrayBuffer && value instanceof SharedArrayBuffer;
};

const isArrayBuffer = (value: unknown): value is ArrayBuffer => value instanceof ArrayBuffer;

const isMessagePort = (value: unknown): value is MessagePort => {
  return typeof MessagePort === "function" && value instanceof MessagePort;
};

const isReadableStream = (value: unknown): value is ReadableStream<unknown> => {
  return typeof ReadableStream === "function" && value instanceof ReadableStream;
};

const isWritableStream = (value: unknown): value is WritableStream<unknown> => {
  return typeof WritableStream === "function" && value instanceof WritableStream;
};

const isTransformStream = (value: unknown): value is TransformStream<unknown, unknown> => {
  return typeof TransformStream === "function" && value instanceof TransformStream;
};

const makeMessagePortInspectable = () => {
  ensureMessagePortInspectable();
};

export const markTransferables = <T>(payload: T): T => {
  const transferables: unknown[] = [];
  const seen = new Set<unknown>();
  const visited = new WeakSet<object>();

  const addTransferable = (candidate: unknown) => {
    if (candidate == null || seen.has(candidate)) return;
    seen.add(candidate);
    transferables.push(candidate);
  };

  const addBuffer = (buffer: ArrayBuffer | SharedArrayBuffer) => {
    if (isSharedArrayBuffer(buffer)) return;
    addTransferable(buffer);
  };

  const visit = (target: unknown) => {
    if (target == null) return;

    if (isArrayBuffer(target)) {
      addBuffer(target);
      return;
    }

    if (ArrayBuffer.isView(target)) {
      addBuffer(target.buffer);
      return;
    }

    if (isMessagePort(target)) {
      makeMessagePortInspectable();
      addTransferable(target);
      return;
    }

    if (isReadableStream(target) || isWritableStream(target) || isTransformStream(target)) {
      addTransferable(target);
      return;
    }

    if (typeof target !== "object") return;
    const obj = target as object;
    if (visited.has(obj)) return;
    visited.add(obj);

    if (Array.isArray(target)) {
      for (const entry of target) {
        visit(entry);
      }
      return;
    }

    if (target instanceof Map) {
      for (const value of target.values()) {
        visit(value);
      }
      return;
    }

    if (target instanceof Set) {
      for (const value of target.values()) {
        visit(value);
      }
      return;
    }

    const record = target as Record<string | symbol, unknown>;
    for (const key of Object.keys(record)) {
      visit(record[key]);
    }
  };

  visit(payload);

  if (transferables.length === 0 || payload == null || typeof payload !== "object") {
    return payload;
  }

  const source = payload as T & object;

  return withTransferable((transfer) => {
    for (const candidate of transferables) {
      transfer(candidate as TransferCandidate);
    }
    return source;
  }) as unknown as T;
};
