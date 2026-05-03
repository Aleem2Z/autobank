import { describe, it, expect } from "vitest";
import { computeSplitAmounts, evenPercentages } from "@/lib/game/split";

describe("computeSplitAmounts", () => {
  it("splits evenly with no remainder", () => {
    expect(computeSplitAmounts(100, [50, 50])).toEqual([50, 50]);
    expect(computeSplitAmounts(300, [33, 33, 34])).toEqual([99, 99, 102]);
  });

  it("dumps the rounding remainder onto the last recipient", () => {
    expect(computeSplitAmounts(100, [33, 33, 33])).toEqual([33, 33, 34]);
    expect(computeSplitAmounts(10, [33, 33, 34])).toEqual([3, 3, 4]);
  });

  it("normalizes weights that don't sum to 100", () => {
    // [60, 60] = weights, both get 50% of total
    expect(computeSplitAmounts(100, [60, 60])).toEqual([50, 50]);
    // [1, 1, 1] = each gets 1/3
    expect(computeSplitAmounts(90, [1, 1, 1])).toEqual([30, 30, 30]);
  });

  it("respects asymmetric percentages", () => {
    expect(computeSplitAmounts(100, [50, 30, 20])).toEqual([50, 30, 20]);
    expect(computeSplitAmounts(1000, [70, 20, 10])).toEqual([700, 200, 100]);
  });

  it("returns zeros on bad input", () => {
    expect(computeSplitAmounts(0, [50, 50])).toEqual([0, 0]);
    expect(computeSplitAmounts(-100, [50, 50])).toEqual([0, 0]);
    expect(computeSplitAmounts(100, [])).toEqual([]);
    expect(computeSplitAmounts(100, [0, 0, 0])).toEqual([0, 0, 0]);
  });

  it("handles NaN / Infinity safely", () => {
    expect(computeSplitAmounts(NaN, [50, 50])).toEqual([0, 0]);
    expect(computeSplitAmounts(100, [NaN, 50])).toEqual([0, 100]);
  });

  it("preserves total exactly even with tiny denominations", () => {
    for (let total of [1, 7, 13, 100, 1500]) {
      for (let n = 1; n <= 3; n++) {
        const amounts = computeSplitAmounts(total, evenPercentages(n));
        expect(amounts.reduce((a, b) => a + b, 0)).toBe(total);
      }
    }
  });
});

describe("evenPercentages", () => {
  it("returns [] for non-positive count", () => {
    expect(evenPercentages(0)).toEqual([]);
    expect(evenPercentages(-1)).toEqual([]);
  });

  it("sums to 100 for any positive n", () => {
    for (let n = 1; n <= 10; n++) {
      const sum = evenPercentages(n).reduce((a, b) => a + b, 0);
      expect(sum).toBe(100);
    }
  });

  it("distributes the remainder to the leading recipients", () => {
    expect(evenPercentages(1)).toEqual([100]);
    expect(evenPercentages(2)).toEqual([50, 50]);
    expect(evenPercentages(3)).toEqual([34, 33, 33]);
    expect(evenPercentages(4)).toEqual([25, 25, 25, 25]);
    expect(evenPercentages(7)).toEqual([15, 15, 14, 14, 14, 14, 14]);
  });
});
