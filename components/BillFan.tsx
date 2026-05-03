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

// MoneyBill renders LANDSCAPE (188w × 92h). For the fan to read like
// the Gemini reference (where bills are portrait and fan around their
// bottom-center), each bill is wrapped in a PORTRAIT box and pre-rotated
// 90° inside that box.
const BILL_W = 188;
const BILL_H = 92;
const PORTRAIT_W = BILL_H; // 92
const PORTRAIT_H = BILL_W; // 188

const MAX_VISIBLE = 5;
const TOTAL_ANGLE = 100; // 5 bills × 25° step — clean hand-of-cards fan

/**
 * Hand of Monopoly notes — one bill per unique denomination present,
 * capped at 5 to keep the fan readable. The fan is a *visual indicator*
 * of which denominations the player holds, not a literal count of bills.
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
          // Largest at z=0 (back), smallest in front, on top.
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
                width: PORTRAIT_W,
                height: PORTRAIT_H,
                marginLeft: -PORTRAIT_W / 2,
                transformOrigin: "bottom center",
              }}
            >
              {/* Landscape MoneyBill (with stacked count) rotated 90°
                  inside the portrait wrapper. */}
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
