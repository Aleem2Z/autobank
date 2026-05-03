"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MoneyBill, type Denomination } from "@/components/MoneyBill";

const DENOMS: Denomination[] = [500, 100, 50, 20, 10, 5, 1];

/**
 * Per-denomination soft caps that mirror the real Monopoly starting wallet
 * distribution (2× $500, 2× $100, 2× $50, 6× $20, 5× $10, 5× $5, 5× $1).
 * Forces variety so round amounts like $1500 produce a fan instead of
 * collapsing into a single denomination.
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
 * Hand of Monopoly notes pinned to the bottom-center of the area, fanning
 * upward like cards held in front of you. Each unique denomination shows
 * once — the fan represents *which* notes you hold, not how many.
 */
export function BillFan({ cash }: { cash: number }) {
  const bills = useMemo(() => breakdown(cash).slice(0, MAX_VISIBLE), [cash]);

  return (
    <div
      className="h-48 relative"
      aria-label={
        bills.length === 0
          ? "No notes in hand"
          : `Notes in hand: ${bills.map((b) => `$${b.denom}`).join(", ")}`
      }
      role="img"
    >
      {bills.length === 0 ? (
        <div className="absolute right-2 bottom-2 rounded-lg border-2 border-dashed border-white/30 px-4 py-3 text-white/70 text-sm font-medium">
          No notes
        </div>
      ) : (
        <BillHand bills={bills} />
      )}
    </div>
  );
}

function BillHand({ bills }: { bills: BillCount[] }) {
  const total = bills.length;
  // Symmetric fan around the bottom-center pivot — bills sweep upward and
  // outward like cards held in your hand, with the largest denomination on
  // top (least rotation) and smaller denominations behind it.
  const STEP_DEG = 13;
  const center = (total - 1) / 2;
  return (
    <div className="absolute left-1/2 bottom-0 -translate-x-1/2">
      <AnimatePresence initial={false}>
        {bills.map((b, idx) => {
          // Largest denom (idx 0) sits in the middle — the most-prominent
          // bill of a real fan held front-and-center.
          const offset = idx - center;
          const rot = offset * STEP_DEG;
          const z = total - idx;
          return (
            <motion.div
              key={b.denom}
              layout
              initial={{ opacity: 0, scale: 0.8, y: 12, rotate: rot * 0.4 }}
              animate={{ opacity: 1, scale: 1, y: 0, rotate: rot }}
              exit={{ opacity: 0, scale: 0.8, y: 12, rotate: rot * 0.4 }}
              transition={{
                type: "spring",
                stiffness: 280,
                damping: 24,
                opacity: { duration: 0.2 },
              }}
              className="absolute bottom-0 left-1/2"
              style={{
                zIndex: z,
                // Pivot at the bottom-center of each bill so they rotate
                // around the same point at the base of the fan.
                transformOrigin: "50% 100%",
                marginLeft: -66, // half of sm bill width (132/2)
              }}
            >
              <MoneyBill denomination={b.denom} count={1} size="sm" />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
