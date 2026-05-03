import { describe, expect, it } from "vitest";
import { buildTradeBody } from "@/lib/game/trade";

describe("buildTradeBody", () => {
  const base = {
    youId: "p1",
    partnerId: "p2",
    give: { cash: 0, assetIds: [] as string[] },
    get: { cash: 0, assetIds: [] as string[] },
  };

  it("rejects when partner missing", () => {
    const r = buildTradeBody({ ...base, partnerId: "" });
    expect(r.ok).toBe(false);
  });

  it("rejects self-trade", () => {
    const r = buildTradeBody({ ...base, partnerId: "p1" });
    expect(r.ok).toBe(false);
  });

  it("rejects empty trade (no cash, no assets)", () => {
    const r = buildTradeBody(base);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/add cash or properties/i);
  });

  it("rejects negative cash", () => {
    const r = buildTradeBody({
      ...base,
      give: { cash: -10, assetIds: [] },
    });
    expect(r.ok).toBe(false);
  });

  it("rejects same property on both sides", () => {
    const r = buildTradeBody({
      ...base,
      give: { cash: 0, assetIds: ["boardwalk"] },
      get: { cash: 0, assetIds: ["boardwalk"] },
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/both sides/i);
  });

  it("builds cash-only trade in both directions", () => {
    const r = buildTradeBody({
      ...base,
      give: { cash: 50, assetIds: [] },
      get: { cash: 100, assetIds: [] },
    });
    expect(r.ok).toBe(true);
    expect(r.body?.kind).toBe("asset-move");
    expect(r.body?.cash).toEqual([
      { fromPlayerId: "p1", toPlayerId: "p2", amount: 50 },
      { fromPlayerId: "p2", toPlayerId: "p1", amount: 100 },
    ]);
    expect(r.body?.assets).toBeUndefined();
  });

  it("builds asset-only trade", () => {
    const r = buildTradeBody({
      ...base,
      give: { cash: 0, assetIds: ["boardwalk"] },
      get: { cash: 0, assetIds: ["mediterranean", "baltic"] },
    });
    expect(r.ok).toBe(true);
    expect(r.body?.cash).toBeUndefined();
    expect(r.body?.assets).toEqual([
      { defId: "boardwalk", fromPlayerId: "p1", toPlayerId: "p2" },
      { defId: "mediterranean", fromPlayerId: "p2", toPlayerId: "p1" },
      { defId: "baltic", fromPlayerId: "p2", toPlayerId: "p1" },
    ]);
  });

  it("builds mixed trade and floors fractional cash", () => {
    const r = buildTradeBody({
      ...base,
      give: { cash: 199.9, assetIds: ["park-place"] },
      get: { cash: 0, assetIds: ["boardwalk"] },
    });
    expect(r.ok).toBe(true);
    expect(r.body?.cash).toEqual([
      { fromPlayerId: "p1", toPlayerId: "p2", amount: 199 },
    ]);
    expect(r.body?.assets).toEqual([
      { defId: "park-place", fromPlayerId: "p1", toPlayerId: "p2" },
      { defId: "boardwalk", fromPlayerId: "p2", toPlayerId: "p1" },
    ]);
  });

  it("dedupes asset ids on each side", () => {
    const r = buildTradeBody({
      ...base,
      give: { cash: 0, assetIds: ["boardwalk", "boardwalk"] },
      get: { cash: 100, assetIds: [] },
    });
    expect(r.ok).toBe(true);
    expect(r.body?.assets).toEqual([
      { defId: "boardwalk", fromPlayerId: "p1", toPlayerId: "p2" },
    ]);
  });
});
