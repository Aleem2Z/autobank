"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MoneyBill, type Denomination } from "@/components/MoneyBill";

const DENOMS: Denomination[] = [500, 100, 50, 20, 10, 5, 1];

/**
 * Per-denomination soft caps that mirror the real Monopoly starting wallet
 * distribution. Forces variety so round amounts produce a varied fan
 * instead of collapsing into a single denomination.
 */
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

/**
 * Hand-of-cards fan of Monopoly notes.
 *
 * All bills share a single pivot at their own bottom-left corner — the
 * front bill (largest denomination) lies nearly horizontal extending
 * right; each smaller denomination behind it rotates further
 * counter-clockwise so the stack sweeps up and to the right like a
 * real hand of fanned bills held in your right hand.
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

  return (
    <div
      className="relative w-full h-full"
      aria-label={`Notes in hand: ${bills.map((b) => `$${b.denom}`).join(", ")}`}
      role="img"
    >
      <BillHand bills={bills} />
    </div>
  );
}

function BillHand({ bills }: { bills: BillCount[] }) {
  const total = bills.length;
  // The front (largest) bill leans slightly right — like a hand of cards
  // that's not perfectly upright. Each subsequent bill rotates further
  // counter-clockwise from the same pivot, sweeping the fan up-and-left.
  const FRONT_ROT_DEG = -6;
  const STEP_DEG = 18;
  return (
    <>
      {bills.map((b, idx) => {
        // idx 0 = largest = front of fan, on top, least rotated
        const rot = FRONT_ROT_DEG - idx * STEP_DEG;
        const z = total - idx;
        return (
          <motion.div
            key={b.denom}
            layout
            initial={{ opacity: 0, scale: 0.7, rotate: rot + 25 }}
            animate={{ opacity: 1, scale: 1, rotate: rot }}
            exit={{ opacity: 0, scale: 0.7, rotate: rot + 25 }}
            transition={{
              type: "spring",
              stiffness: 280,
              damping: 24,
              opacity: { duration: 0.2 },
            }}
            className="absolute bottom-0 left-0"
            style={{
              zIndex: z,
              // All bills pivot around the SAME bottom-left point — that
              // shared anchor is what makes the fan look like a real
              // hand of cards rather than a swirl.
              transformOrigin: "bottom left",
            }}
          >
            <MoneyBill denomination={b.denom} count={1} size="sm" />
          </motion.div>
        );
      })}
    </>
  );
}
