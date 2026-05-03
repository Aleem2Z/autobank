import { describe, it, expect } from "vitest";
import {
  generateRoomCode,
  isValidCode,
  ROOM_CODE_LENGTH,
} from "@/lib/game/codes";

describe("room codes", () => {
  it("generates codes of the configured length from the safe alphabet", () => {
    const re = new RegExp(`^[A-HJ-NP-Z2-9]{${ROOM_CODE_LENGTH}}$`);
    for (let i = 0; i < 50; i++) {
      const c = generateRoomCode();
      expect(c).toMatch(re);
    }
  });

  it("avoids ambiguous chars I, O, 0, 1", () => {
    for (let i = 0; i < 200; i++) {
      const c = generateRoomCode();
      expect(c.includes("I")).toBe(false);
      expect(c.includes("O")).toBe(false);
      expect(c.includes("0")).toBe(false);
      expect(c.includes("1")).toBe(false);
    }
  });

  it("isValidCode accepts a generated code", () => {
    const c = generateRoomCode();
    expect(isValidCode(c)).toBe(true);
  });

  it("isValidCode rejects bad input", () => {
    expect(isValidCode("abc")).toBe(false);
    expect(isValidCode("ABCD")).toBe(false); // too short (was the old length)
    expect(isValidCode("ABCDEFGHI")).toBe(false); // too long
    expect(isValidCode("ABCDEFGI")).toBe(false); // forbidden I
    expect(isValidCode("ABCDEFGO")).toBe(false); // forbidden O
    expect(isValidCode("ABCDEFG0")).toBe(false); // forbidden 0
    expect(isValidCode("ABCDEFG1")).toBe(false); // forbidden 1
  });
});
