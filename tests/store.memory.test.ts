import { describe, it, expect, beforeEach } from "vitest";
import { MemoryStore } from "@/lib/store/memory";
import type { Room, RoomEvent } from "@/lib/game/types";

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
  createdAt: Date.now(),
});

describe("MemoryStore", () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
  });

  it("saves and gets a room", async () => {
    const r = baseRoom("AAAA");
    await store.saveRoom(r);
    expect(await store.getRoom("AAAA")).toEqual(r);
  });

  it("returns null for missing room", async () => {
    expect(await store.getRoom("ZZZZ")).toBeNull();
  });

  it("subscribe receives published events", async () => {
    const r = baseRoom("BBBB");
    await store.saveRoom(r);
    const events: RoomEvent[] = [];
    const unsub = store.subscribe("BBBB", (e) => events.push(e));
    await store.publish("BBBB", { type: "state", room: r });
    unsub();
    expect(events.length).toBe(1);
  });

  it("unsubscribe stops further events", async () => {
    const r = baseRoom("CCCC");
    const events: RoomEvent[] = [];
    const unsub = store.subscribe("CCCC", (e) => events.push(e));
    await store.publish("CCCC", { type: "state", room: r });
    unsub();
    await store.publish("CCCC", { type: "state", room: r });
    expect(events.length).toBe(1);
  });
});
