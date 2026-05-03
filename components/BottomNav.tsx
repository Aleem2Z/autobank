"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Split as SplitIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type PaymentAction = "pay" | "request" | "trade" | "split";

const ACTIONS: {
  id: PaymentAction;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tone: "sent" | "received" | "brand";
}[] = [
  { id: "pay", label: "Pay", icon: ArrowUpRight, tone: "sent" },
  { id: "request", label: "Request", icon: ArrowDownLeft, tone: "received" },
  { id: "trade", label: "Trade", icon: ArrowLeftRight, tone: "brand" },
  { id: "split", label: "Split", icon: SplitIcon, tone: "brand" },
];

export function BottomNav({
  onAction,
  splitDisabled,
}: {
  onAction: (a: PaymentAction) => void;
  splitDisabled?: boolean;
}) {
  return (
    <nav
      className="fixed bottom-0 left-0 w-full z-40 rounded-t-[40px] border-t border-border/30 bg-surface-lowest/85 backdrop-blur-xl nav-bar-shadow"
      aria-label="Payment actions"
    >
      <div
        className="max-w-2xl mx-auto flex justify-around items-center px-4 pt-3"
        style={{
          paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {ACTIONS.map((a) => (
          <PaymentButton
            key={a.id}
            label={a.label}
            icon={a.icon}
            tone={a.tone}
            disabled={a.id === "split" && splitDisabled}
            onActivate={() => onAction(a.id)}
          />
        ))}
      </div>
    </nav>
  );
}

function PaymentButton({
  label,
  icon: Icon,
  tone,
  disabled,
  onActivate,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tone: "sent" | "received" | "brand";
  disabled?: boolean;
  onActivate: () => void;
}) {
  const [pulseId, setPulseId] = useState(0);
  const [bounce, setBounce] = useState(false);

  const toneIconClass = {
    sent: "bg-sent/15 text-sent",
    received: "bg-received/15 text-received",
    brand: "bg-brand/15 text-brand",
  }[tone];
  const toneRing = {
    sent: "var(--sent)",
    received: "var(--received)",
    brand: "var(--brand)",
  }[tone];

  function handleClick() {
    if (disabled) return;
    setPulseId((n) => n + 1);
    setBounce(true);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(8);
      } catch {
        // Some browsers throw on cross-origin iframes; safe to ignore.
      }
    }
    // Slight delay so the press feedback is visible before the sheet opens.
    setTimeout(() => onActivate(), 110);
    setTimeout(() => setBounce(false), 320);
  }

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.92 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      className={cn(
        "relative flex flex-col items-center justify-center gap-1 min-w-[64px] py-1 outline-none rounded-2xl",
        disabled && "opacity-40 cursor-not-allowed",
      )}
      aria-label={label}
    >
      <span className="relative inline-flex items-center justify-center">
        {/* Expanding glow ring on tap */}
        <AnimatePresence>
          {pulseId > 0 && (
            <motion.span
              key={pulseId}
              initial={{ scale: 0.6, opacity: 0.55 }}
              animate={{ scale: 1.8, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 size-12 rounded-full pointer-events-none"
              style={{ background: toneRing }}
              aria-hidden
            />
          )}
        </AnimatePresence>
        {/* Icon chip — bounces up briefly on tap */}
        <motion.span
          animate={
            bounce
              ? { y: [-1, -5, 0], scale: [1, 1.08, 1] }
              : { y: 0, scale: 1 }
          }
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "relative size-12 rounded-full flex items-center justify-center shadow-card-soft",
            toneIconClass,
          )}
        >
          <Icon className="size-5" strokeWidth={2.5} />
        </motion.span>
      </span>
      <span className="font-semibold text-[10px] uppercase tracking-widest text-on-surface-variant">
        {label}
      </span>
    </motion.button>
  );
}
