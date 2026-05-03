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

// MoneyBill renders LANDSCAPE (188w × 92h). For the fan to read like the
// Gemini reference (where bills are portrait and fan around their
// bottom-center), each bill is wrapped in a PORTRAIT box and pre-rotated
// 90° inside that box. Text ends up sideways — that's intentional and
// matches how real fanned cash looks.
const BILL_W = 188;
const BILL_H = 92;
const PORTRAIT_W = BILL_H; // 92
const PORTRAIT_H = BILL_W; // 188

/**
 * Hard cap on individually rendered bills — the breakdown already keeps
 * the visible count modest for typical Monopoly amounts (≤30 for any
 * balance up to ~$3000). Past this we'd just render too many DOM nodes
 * with no visual gain.
 */
const MAX_BILLS = 32;

/** Total fan spread in degrees, scaled by bill count. */
function fanSpread(billCount: number): number {
  if (billCount <= 1) return 0;
  // Smooth ramp: 5 bills → 80°, 15 → 130°, 25+ → 160°. Bigger fans for
  // bigger hands, like a real spread of cash.
  return Math.min(160, 60 + billCount * 4);
}

export function BillFan({ cash }: { cash: number }) {
  // Expand the per-denomination breakdown into one entry per individual
  // bill so the fan literally sums to the displayed balance.
  const bills = useMemo(() => {
    const grouped = breakdown(cash);
    const out: { denom: Denomination; key: string }[] = [];
    for (const g of grouped) {
      for (let i = 0; i < g.count; i++) {
        out.push({ denom: g.denom, key: `${g.denom}-${i}` });
        if (out.length >= MAX_BILLS) return out;
      }
    }
    return out;
  }, [cash]);

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
  const spread = fanSpread(total);
  const startAngle = -spread / 2;
  const step = total > 1 ? spread / (total - 1) : 0;

  return (
    <div
      className="relative w-full h-full"
      aria-label={`${total} note${total === 1 ? "" : "s"} in hand totalling $${cash.toLocaleString()}`}
      role="img"
    >
      <AnimatePresence initial={false}>
        {bills.map((b, idx) => {
          const rot = startAngle + step * idx;
          // Largest bill (idx 0) at z=0 (back). Smallest (highest idx)
          // sits in front, on top — matches the reference photo and the
          // earlier preference for "highest denominations at the bottom".
          const z = idx;
          return (
            <motion.div
              key={b.key}
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
                width: PORTRAIT_W,
                height: PORTRAIT_H,
                marginLeft: -PORTRAIT_W / 2,
                transformOrigin: "bottom center",
              }}
            >
              {/* Landscape MoneyBill rotated 90° inside the portrait
                  wrapper so the bill's long edge runs vertically. */}
              <div
                className="absolute"
                style={{
                  top: "50%",
                  left: "50%",
                  width: BILL_W,
                  height: BILL_H,
                  transform: "translate(-50%, -50%) rotate(90deg)",
                  transformOrigin: "center center",
                }}
              >
                <MoneyBill denomination={b.denom} count={1} size="md" />
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
