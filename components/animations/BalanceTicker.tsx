"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useMotionValue, AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/utils";

export interface BalanceTickerProps {
  value: number;
  className?: string;
  /** Duration of the value tween in ms. */
  durationMs?: number;
  /** Optional override for the "+$X / -$X" delta floater. */
  showDelta?: boolean;
  /**
   * If true, renders the leading "$" as a smaller, baseline-shifted chip
   * for premium-card display ("$1,500" style with offset $). Default false.
   */
  showCurrencyChip?: boolean;
}

interface DeltaToast {
  id: number;
  delta: number;
}

let nextId = 0;

export function BalanceTicker({
  value,
  className,
  durationMs = 700,
  showDelta = true,
  showCurrencyChip = false,
}: BalanceTickerProps) {
  const motionValue = useMotionValue(value);
  const [display, setDisplay] = useState(value);
  const [deltas, setDeltas] = useState<DeltaToast[]>([]);
  const previousRef = useRef(value);
  const mountedRef = useRef(false);

  useEffect(() => {
    const unsub = motionValue.on("change", (latest) => {
      setDisplay(Math.round(latest));
    });
    return () => unsub();
  }, [motionValue]);

  useEffect(() => {
    const prev = previousRef.current;
    if (!mountedRef.current) {
      mountedRef.current = true;
      previousRef.current = value;
      motionValue.set(value);
      setDisplay(value);
      return;
    }
    if (prev === value) return;

    const controls = animate(motionValue, value, {
      duration: durationMs / 1000,
      ease: [0.22, 1, 0.36, 1],
    });

    if (showDelta) {
      const delta = value - prev;
      const toast = { id: ++nextId, delta };
      setDeltas((curr) => [...curr, toast]);
      const timeout = window.setTimeout(() => {
        setDeltas((curr) => curr.filter((d) => d.id !== toast.id));
      }, 1200);
      previousRef.current = value;
      return () => {
        controls.stop();
        window.clearTimeout(timeout);
      };
    }

    previousRef.current = value;
    return () => controls.stop();
  }, [value, motionValue, durationMs, showDelta]);

  const formatted = formatMoney(display);
  // formatMoney always returns either "$1,234" or "-$1,234"; split out the
  // sign + currency from the digits so we can present the "$" in a stylized
  // chip when requested.
  const negative = formatted.startsWith("-");
  const digits = negative ? formatted.slice(2) : formatted.slice(1);

  return (
    <span className={cn("relative inline-flex items-baseline tabular-nums", className)}>
      {showCurrencyChip ? (
        <span aria-live="polite">
          {negative && <span>−</span>}
          <span className="balance-currency">$</span>
          {digits}
        </span>
      ) : (
        <span aria-live="polite">{formatted}</span>
      )}
      <AnimatePresence>
        {deltas.map((d) => {
          const positive = d.delta >= 0;
          return (
            <motion.span
              key={d.id}
              initial={{ opacity: 0, y: positive ? 6 : -6, scale: 0.92 }}
              animate={{ opacity: 1, y: positive ? -22 : 22, scale: 1 }}
              exit={{ opacity: 0, y: positive ? -34 : 34, scale: 0.95 }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "absolute right-0 top-0 text-xs font-semibold tabular-nums px-1.5 py-0.5 rounded-md pointer-events-none",
                positive
                  ? "text-[var(--mono-green)] bg-[var(--mono-green)]/10"
                  : "text-destructive bg-destructive/10",
              )}
              aria-hidden
            >
              {positive ? "+" : "−"}${Math.abs(d.delta).toLocaleString("en-US")}
            </motion.span>
          );
        })}
      </AnimatePresence>
    </span>
  );
}
