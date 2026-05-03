/**
 * Convert a total + per-recipient percentages into integer dollar amounts.
 *
 * - Percentages are normalized: if they sum to anything ≠ 100 (e.g. [60, 60])
 *   they're treated as weights and rescaled.
 * - Each recipient's share is floored, and any rounding remainder goes
 *   to the LAST recipient so the sum exactly equals `total`.
 * - All inputs are validated; non-finite or non-positive totals → all zeros.
 */
export function computeSplitAmounts(total: number, percentages: number[]): number[] {
  if (!Number.isFinite(total) || total <= 0 || percentages.length === 0) {
    return percentages.map(() => 0);
  }
  const sumPct = percentages.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  if (sumPct <= 0) return percentages.map(() => 0);

  const out: number[] = percentages.map((p) =>
    Math.max(0, Math.floor((total * (Number.isFinite(p) ? p : 0)) / sumPct)),
  );
  const consumed = out.reduce((a, b) => a + b, 0);
  const remainder = total - consumed;
  if (remainder !== 0 && out.length > 0) {
    out[out.length - 1] += remainder;
  }
  return out;
}

/** Returns evenly-distributed percentages that sum to 100 for n recipients. */
export function evenPercentages(n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(100 / n);
  const remainder = 100 - base * n;
  // Spread the remainder onto the first `remainder` recipients so 3-way split
  // is [34, 33, 33] (sum 100) rather than [33, 33, 33] (sum 99).
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}
