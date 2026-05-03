import { describe, it, expect } from "vitest";
import { withCodeLock } from "@/lib/store/locks";

describe("withCodeLock", () => {
  it("serializes concurrent fns sharing the same code", async () => {
    const trace: string[] = [];
    const slow = async (label: string, ms: number) => {
      trace.push(`${label}:start`);
      await new Promise((r) => setTimeout(r, ms));
      trace.push(`${label}:end`);
      return label;
    };
    const a = withCodeLock("ROOM1", () => slow("a", 30));
    const b = withCodeLock("ROOM1", () => slow("b", 10));
    const c = withCodeLock("ROOM1", () => slow("c", 5));
    const results = await Promise.all([a, b, c]);
    expect(results).toEqual(["a", "b", "c"]);
    // Strict serialization: each fn's end appears before the next fn's start.
    expect(trace).toEqual([
      "a:start",
      "a:end",
      "b:start",
      "b:end",
      "c:start",
      "c:end",
    ]);
  });

  it("does not serialize fns with different codes", async () => {
    const events: string[] = [];
    const tickle = (label: string, ms: number) =>
      new Promise<void>((resolve) => {
        events.push(`${label}:enter`);
        setTimeout(() => {
          events.push(`${label}:exit`);
          resolve();
        }, ms);
      });
    await Promise.all([
      withCodeLock("X", () => tickle("X", 30)),
      withCodeLock("Y", () => tickle("Y", 10)),
    ]);
    // Y starts before X finishes → both held simultaneously.
    expect(events.indexOf("Y:enter")).toBeLessThan(events.indexOf("X:exit"));
  });

  it("releases the lock even if the inner fn throws", async () => {
    await expect(
      withCodeLock("ROOM2", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    // Subsequent lock acquisition still succeeds (no deadlock).
    const result = await withCodeLock("ROOM2", async () => "ok");
    expect(result).toBe("ok");
  });
});
