import { describe, expect, it, vi } from "vitest";
import { createAsyncCache } from "./cache";

describe("createAsyncCache", () => {
  it("caches a value within TTL (producer runs once)", async () => {
    const cache = createAsyncCache<number>({ ttlMs: 10_000, now: () => 1000 });
    const producer = vi.fn(async () => 42);
    expect(await cache.get("k", producer)).toBe(42);
    expect(await cache.get("k", producer)).toBe(42);
    expect(producer).toHaveBeenCalledTimes(1);
  });

  it("de-duplicates concurrent in-flight requests for the same key", async () => {
    const cache = createAsyncCache<number>({ ttlMs: 10_000, now: () => 1000 });
    let resolve!: (v: number) => void;
    const producer = vi.fn(() => new Promise<number>((r) => (resolve = r)));
    const a = cache.get("k", producer);
    const b = cache.get("k", producer);
    resolve(7);
    expect(await a).toBe(7);
    expect(await b).toBe(7);
    expect(producer).toHaveBeenCalledTimes(1); // one shared job
  });

  it("recomputes after TTL expiry", async () => {
    let t = 1000;
    const cache = createAsyncCache<number>({ ttlMs: 100, now: () => t });
    const producer = vi.fn(async () => t);
    expect(await cache.get("k", producer)).toBe(1000);
    t = 1201; // past TTL
    expect(await cache.get("k", producer)).toBe(1201);
    expect(producer).toHaveBeenCalledTimes(2);
  });

  it("invalidate forces recompute", async () => {
    const cache = createAsyncCache<number>({ ttlMs: 10_000, now: () => 1000 });
    const producer = vi.fn(async () => Math.random());
    const first = await cache.get("k", producer);
    cache.invalidate("k");
    const second = await cache.get("k", producer);
    expect(second).not.toBe(first);
    expect(producer).toHaveBeenCalledTimes(2);
  });

  it("drops a failed producer so the next call retries", async () => {
    const cache = createAsyncCache<number>({ ttlMs: 10_000, now: () => 1000 });
    const producer = vi
      .fn<() => Promise<number>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(5);
    await expect(cache.get("k", producer)).rejects.toThrow("boom");
    expect(await cache.get("k", producer)).toBe(5);
  });
});
