import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { Room, RoomEvent } from "@/lib/game/types";
import type { RedisStore as RedisStoreType } from "@/lib/store/redis";

/**
 * These tests run against a real Redis instance pointed at by REDIS_URL.
 * Without REDIS_URL set, every test is a no-op so CI without a Redis
 * service stays green.
 *
 * Local: docker compose up redis -d && REDIS_URL=redis://localhost:6379 npm test
 */

const REDIS_URL = process.env.REDIS_URL;
const enabled = !!REDIS_URL;

const baseRoom = (code: string): Room => ({
  code,
  passcodeHash: "h",
  mode: "house",
  preset: "monopoly-us",
  startingBalance: 1500,
  bankCash: 0,
  bankAssets: [],
  scarcity: {},
  players: [],
  partnerships: [],
  transactions: [],
  createdAt: 1234567890,
});

// Wait for an event with a small timeout so failing tests bail fast.
function waitForEvent(events: RoomEvent[], min = 1, timeoutMs = 1500): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (events.length >= min) return resolve();
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`expected >=${min} events, got ${events.length}`));
      }
      setTimeout(tick, 10);
    };
    tick();
  });
}

describe("RedisStore", () => {
  let store: RedisStoreType | null = null;

  beforeAll(async () => {
    if (!enabled) return;
    const { RedisStore } = await import("@/lib/store/redis");
    store = new RedisStore(REDIS_URL!);
    // Best-effort flush of any test keys from prior runs.
  });

  afterAll(async () => {
    if (store) await store.disconnect();
  });

  beforeEach(() => {
    if (!enabled) return;
    // each test uses a unique code so no global flush is required.
  });

  it("saves and gets a room", async () => {
    if (!enabled || !store) return;
    const code = `T${Date.now().toString(36).slice(-3).toUpperCase()}`.padEnd(4, "X").slice(0, 4);
    const r = baseRoom(code);
    await store.saveRoom(r);
    expect(await store.getRoom(code)).toEqual(r);
  });

  it("returns null for a missing room", async () => {
    if (!enabled || !store) return;
    const code = `M${Math.random().toString(36).slice(2, 5).toUpperCase()}`.slice(0, 4);
    expect(await store.getRoom(code)).toBeNull();
  });

  it("subscribe receives a publish", async () => {
    if (!enabled || !store) return;
    const code = `S${Math.random().toString(36).slice(2, 5).toUpperCase()}`.slice(0, 4);
    const r = baseRoom(code);
    const events: RoomEvent[] = [];
    const unsub = store.subscribe(code, (e) => events.push(e));
    // Tiny delay so SUBSCRIBE round-trips before PUBLISH (Redis pub/sub
    // does not buffer for late subscribers).
    await new Promise((r) => setTimeout(r, 75));
    await store.publish(code, { type: "state", room: r });
    await waitForEvent(events, 1);
    unsub();
    expect(events.length).toBe(1);
    expect(events[0]).toEqual({ type: "state", room: r });
  });

  it("unsubscribe stops further deliveries", async () => {
    if (!enabled || !store) return;
    const code = `U${Math.random().toString(36).slice(2, 5).toUpperCase()}`.slice(0, 4);
    const r = baseRoom(code);
    const events: RoomEvent[] = [];
    const unsub = store.subscribe(code, (e) => events.push(e));
    await new Promise((r) => setTimeout(r, 75));
    await store.publish(code, { type: "state", room: r });
    await waitForEvent(events, 1);
    unsub();
    await store.publish(code, { type: "state", room: r });
    // Give a moment for any (incorrect) delivery to occur.
    await new Promise((r) => setTimeout(r, 100));
    expect(events.length).toBe(1);
  });

  it("multiple subscribers on the same channel both receive then clean up", async () => {
    if (!enabled || !store) return;
    const code = `R${Math.random().toString(36).slice(2, 5).toUpperCase()}`.slice(0, 4);
    const r = baseRoom(code);
    const a: RoomEvent[] = [];
    const b: RoomEvent[] = [];
    const unsubA = store.subscribe(code, (e) => a.push(e));
    const unsubB = store.subscribe(code, (e) => b.push(e));
    await new Promise((r) => setTimeout(r, 75));

    await store.publish(code, { type: "state", room: r });
    await Promise.all([waitForEvent(a, 1), waitForEvent(b, 1)]);
    expect(a.length).toBe(1);
    expect(b.length).toBe(1);

    // Drop one subscriber — channel should still be subscribed (refcount=1).
    unsubA();
    await store.publish(code, { type: "state", room: r });
    await waitForEvent(b, 2);
    expect(a.length).toBe(1);
    expect(b.length).toBe(2);

    // Drop the last — channel should fully unsubscribe; further publishes deliver to nobody.
    unsubB();
    await store.publish(code, { type: "state", room: r });
    await new Promise((r) => setTimeout(r, 100));
    expect(a.length).toBe(1);
    expect(b.length).toBe(2);
  });
});
