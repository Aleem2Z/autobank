import { describe, it, expect } from "vitest";
import { generateRoomCode, isValidCode } from "@/lib/game/codes";

describe("room codes", () => {
  it("generates 4 uppercase letters from the safe alphabet", () => {
    for (let i = 0; i < 50; i++) {
      const c = generateRoomCode();
      expect(c).toMatch(/^[A-HJ-NP-Z]{4}$/);
    }
  });

  it("avoids ambiguous chars I and O", () => {
    for (let i = 0; i < 200; i++) {
      const c = generateRoomCode();
      expect(c.includes("I")).toBe(false);
      expect(c.includes("O")).toBe(false);
    }
  });

  it("isValidCode accepts a generated code", () => {
    const c = generateRoomCode();
    expect(isValidCode(c)).toBe(true);
  });

  it("isValidCode rejects bad input", () => {
    expect(isValidCode("abc")).toBe(false);
    expect(isValidCode("ABCDE")).toBe(false);
    expect(isValidCode("AIBC")).toBe(false);
    expect(isValidCode("AOBC")).toBe(false);
    expect(isValidCode("1234")).toBe(false);
  });
});
