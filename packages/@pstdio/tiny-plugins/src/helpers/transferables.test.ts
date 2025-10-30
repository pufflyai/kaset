import { describe, expect, it } from "vitest";
import { markTransferables } from "./transferables";

const getTransferList = (value: unknown): unknown[] => {
  if (!value || typeof value !== "object") return [];
  for (const symbol of Object.getOwnPropertySymbols(value)) {
    const transferList = (value as Record<symbol, unknown>)[symbol];
    if (Array.isArray(transferList)) {
      return transferList;
    }
  }
  return [];
};

describe("markTransferables", () => {
  it("returns payload unchanged when no transferables are present", () => {
    const payload = { foo: "bar" };
    const result = markTransferables(payload);

    expect(result).toBe(payload);
    expect(Object.getOwnPropertySymbols(result)).toHaveLength(0);
  });

  it("marks ArrayBuffer views for transfer", () => {
    const bytes = new Uint8Array([1, 2, 3]);

    const result = markTransferables({ bytes });
    const transfers = getTransferList(result);

    expect(transfers).toHaveLength(1);
    expect(transfers[0]).toBe(bytes.buffer);
  });

  it("deduplicates shared buffers across multiple views", () => {
    const buffer = new ArrayBuffer(8);
    const viewA = new Uint8Array(buffer);
    const viewB = new DataView(buffer);

    const result = markTransferables({ viewA, viewB });
    const transfers = getTransferList(result);

    expect(transfers).toHaveLength(1);
    expect(transfers[0]).toBe(buffer);
  });

  it("does not mark SharedArrayBuffer instances", () => {
    if (typeof SharedArrayBuffer !== "function") {
      return;
    }

    const shared = new SharedArrayBuffer(8);
    const result = markTransferables({ shared });

    expect(getTransferList(result)).toHaveLength(0);
  });

  it("marks nested transferables, including MessagePort and ReadableStream", () => {
    if (typeof MessageChannel !== "function") {
      return;
    }

    const { port1, port2 } = new MessageChannel();
    const stream =
      typeof ReadableStream === "function"
        ? new ReadableStream({
            start(controller) {
              controller.close();
            },
          })
        : null;

    const payload = {
      ports: [port1, port2],
      meta: new Map(stream ? [["stream", stream]] : []),
    };

    const result = markTransferables(payload);
    const transfers = getTransferList(result);

    expect(transfers).toContain(port1);
    expect(transfers).toContain(port2);
    if (stream) expect(transfers).toContain(stream);

    port1.close();
    port2.close();
  });
});
