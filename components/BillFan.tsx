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
  // Smallest denomination sits at the FRONT of the fan (highest z, least
  // rotated) and the largest bill is BEHIND everything else, peeking out
  // at the steepest rotation. Same convention as the reference photo.
  const fanOrder = [...bills].reverse();
  const total = fanOrder.length;
  // Front bill horizontal, each subsequent bill +32° CCW from the previous.
  // Five bills × 32° = 128° total spread — bills sweep OVER the pivot like
  // the reference photo (the back bill ends up near-upside-down).
  const STEP_DEG = 32;
  return (
    <>
      {fanOrder.map((b, idx) => {
        const rot = -idx * STEP_DEG;
        // idx 0 (smallest) sits on top.
        const z = total - idx;
        return (
          <motion.div
            key={b.denom}
            layout
            initial={{ opacity: 0, scale: 0.7, rotate: rot + 30 }}
            animate={{ opacity: 1, scale: 1, rotate: rot }}
            exit={{ opacity: 0, scale: 0.7, rotate: rot + 30 }}
            transition={{
              type: "spring",
              stiffness: 280,
              damping: 24,
              opacity: { duration: 0.2 },
            }}
            className="absolute bottom-0 left-0"
            style={{
              zIndex: z,
              // All bills pivot around the SAME bottom-left point — the
              // shared anchor is what turns this into a real hand-fan
              // instead of a pile of rotated rectangles.
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
