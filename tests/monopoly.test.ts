import { describe, it, expect } from "vitest";
import {
  MONOPOLY_US,
  getAssetDef,
  REASON_LABELS,
  GROUP_TOKENS,
  PLAYER_COLORS,
  isValidPlayerColor,
} from "@/lib/game/monopoly";

describe("Monopoly US preset", () => {
  it("contains 28 deeds (22 properties + 4 railroads + 2 utilities)", () => {
    expect(MONOPOLY_US.length).toBe(28);
    expect(MONOPOLY_US.filter((a) => a.kind === "property").length).toBe(22);
    expect(MONOPOLY_US.filter((a) => a.kind === "railroad").length).toBe(4);
    expect(MONOPOLY_US.filter((a) => a.kind === "utility").length).toBe(2);
  });

  it("all asset ids are unique", () => {
    const ids = MONOPOLY_US.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("Boardwalk has hotel rent of $2000", () => {
    const bw = getAssetDef("boardwalk");
    expect(bw?.rent?.[5]).toBe(2000);
  });

  it("REASON_LABELS includes chance and community-chest", () => {
    expect(REASON_LABELS["chance"].label).toBe("Chance");
    expect(REASON_LABELS["community-chest"].label).toBe("Community Chest");
  });

  it("every monopoly group has a color token", () => {
    const groups = new Set(MONOPOLY_US.map((a) => a.group!));
    for (const g of groups) expect(GROUP_TOKENS[g]).toBeTruthy();
  });

  it("rent arrays for properties are length 6 (base + 1-4 houses + hotel)", () => {
    for (const p of MONOPOLY_US.filter((a) => a.kind === "property")) {
      expect(p.rent?.length).toBe(6);
    }
  });
});

describe("isValidPlayerColor", () => {
  it("accepts every color in the PLAYER_COLORS palette (lowercase)", () => {
    for (const c of PLAYER_COLORS) {
      expect(isValidPlayerColor(c)).toBe(true);
    }
  });

  it("accepts uppercase hex variants of palette colors", () => {
    expect(isValidPlayerColor("#DC2626")).toBe(true);
    expect(isValidPlayerColor("#Ec4899")).toBe(true);
  });

  it("rejects valid hex that isn't in the palette", () => {
    expect(isValidPlayerColor("#000000")).toBe(false);
    expect(isValidPlayerColor("#ffffff")).toBe(false);
    expect(isValidPlayerColor("#123456")).toBe(false);
  });

  it("rejects malformed strings", () => {
    expect(isValidPlayerColor("dc2626")).toBe(false);
    expect(isValidPlayerColor("#dc262")).toBe(false);
    expect(isValidPlayerColor("#dc26266")).toBe(false);
    expect(isValidPlayerColor("red")).toBe(false);
    expect(isValidPlayerColor("")).toBe(false);
  });
});
