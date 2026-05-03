"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MoneyBill, type Denomination } from "@/components/MoneyBill";

const DENOMS: Denomination[] = [500, 100, 50, 20, 10, 5, 1];

const SOFT_CAPS: Record<Denomination, number> = {
  500: 2,
  100: 2,
  50: 2,
  20: 4,
  10: 4,
  5: 4,
  1: 5,
};

interface BillCount {
  denom: Denomination;
  count: number;
}

function breakdown(cash: number): BillCount[] {
  let remaining = Math.max(0, Math.floor(cash));
  const counts: Partial<Record<Denomination, number>> = {};

  for (const d of DENOMS) {
    const wanted = Math.floor(remaining / d);
    if (wanted > 0) {
      const take = Math.min(wanted, SOFT_CAPS[d]);
      counts[d] = (counts[d] ?? 0) + take;
      remaining -= take * d;
    }
  }
  for (const d of DENOMS) {
    if (remaining <= 0) break;
    const extra = Math.floor(remaining / d);
    if (extra > 0) {
      counts[d] = (counts[d] ?? 0) + extra;
      remaining -= extra * d;
    }
  }

  return DENOMS
    .filter((d) => (counts[d] ?? 0) > 0)
    .map((d) => ({ denom: d, count: counts[d]! }));
}

const MAX_VISIBLE = 5;

// Bill image dimensions (md size = 188×92). Half-width is the magic
// number for `margin-left: -half` so the bill's bottom-CENTER lines up
// with the parent's left:50% anchor.
const BILL_W = 188;
const BILL_HALF = BILL_W / 2;

/** Total fan spread in degrees, evenly distributed across visible bills. */
const TOTAL_ANGLE = 120;

/**
 * Bills fanned around a single bottom-CENTER pivot — Gemini's geometry.
 * Each bill sits at left:50%, margin-left:-halfWidth, bottom:0, so they
 * all share the exact same anchor point at their bottom-center; rotating
 * each one symmetrically spreads them out like a real hand of cards.
 *
 * Largest denomination at z-index 0 (back of fan) so smaller bills layer
 * on top of it.
 */
export function BillFan({ cash }: { cash: number }) {
  const bills = useMemo(() => breakdown(cash).slice(0, MAX_VISIBLE), [cash]);

  if (bills.length === 0) {
    return (
      <div
        className="rounded-lg border-2 border-dashed border-white/30 px-3 py-2 text-white/70 text-xs font-medium inline-block"
        aria-label="No notes in hand"
      >
        No notes
      </div>
    );
  }

  const total = bills.length;
  const startAngle = -TOTAL_ANGLE / 2;
  const step = total > 1 ? TOTAL_ANGLE / (total - 1) : 0;

  return (
    <div
      className="relative w-full h-full"
      aria-label={`Notes in hand: ${bills.map((b) => `$${b.denom}`).join(", ")}`}
      role="img"
    >
      <AnimatePresence initial={false}>
        {bills.map((b, idx) => {
          const rot = startAngle + step * idx;
          // Higher idx = on top. Bills are sorted largest-first by
          // breakdown(), so $500 (idx 0) sits at the back and the
          // smallest denomination (idx N-1) sits in front, on top.
          const z = idx;
          return (
            <motion.div
              key={b.denom}
              layout
              initial={{ opacity: 0, scale: 0.7, rotate: rot, y: 20 }}
              animate={{ opacity: 1, scale: 1, rotate: rot, y: 0 }}
              exit={{ opacity: 0, scale: 0.7, rotate: rot, y: 20 }}
              transition={{
                type: "spring",
                stiffness: 280,
                damping: 24,
                opacity: { duration: 0.2 },
              }}
              className="absolute bottom-0 left-1/2"
              style={{
                zIndex: z,
                marginLeft: -BILL_HALF,
                transformOrigin: "bottom center",
              }}
            >
              <MoneyBill denomination={b.denom} count={1} size="md" />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
