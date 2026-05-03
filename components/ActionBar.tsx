"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Banknote, Plus, Users, Split, ArrowLeftRight } from "lucide-react";
import { TransferSheet } from "./TransferSheet";
import { SplitSheet } from "./SplitSheet";
import { TradeSheet } from "./TradeSheet";
import type { Player, Room } from "@/lib/game/types";
import { cn } from "@/lib/utils";

type Open =
  | null
  | { kind: "transfer"; transferKind: "p2p" | "pay-bank" | "request-bank" }
  | { kind: "split" }
  | { kind: "trade" };

interface NavBtn {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  disabled?: boolean;
  emphasis?: boolean;
}

export function ActionBar({ room, you }: { room: Room; you: Player }) {
  const [open, setOpen] = useState<Open>(null);
  const close = () => setOpen(null);

  const buttons: NavBtn[] = [
    {
      label: "Pay Bank",
      icon: Banknote,
      onClick: () => setOpen({ kind: "transfer", transferKind: "pay-bank" }),
    },
    {
      label: "Request",
      icon: Plus,
      onClick: () => setOpen({ kind: "transfer", transferKind: "request-bank" }),
    },
    {
      label: "Pay Player",
      icon: Users,
      emphasis: true,
      onClick: () => setOpen({ kind: "transfer", transferKind: "p2p" }),
    },
    {
      label: "Split",
      icon: Split,
      onClick: () => setOpen({ kind: "split" }),
      disabled: room.mode === "official",
    },
    {
      label: "Trade",
      icon: ArrowLeftRight,
      onClick: () => setOpen({ kind: "trade" }),
    },
  ];

  return (
    <>
      <div
        className={cn(
          "sticky bottom-0 inset-x-0 z-10",
          "bg-card/95 supports-[backdrop-filter]:bg-card/80 backdrop-blur",
          "border-t border-border/60 nav-bar-shadow",
          "rounded-t-2xl",
        )}
      >
        <div
          className="max-w-2xl mx-auto px-2 pt-2"
          style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="grid grid-cols-5 gap-1">
            {buttons.map((b) => {
              const Icon = b.icon;
              return (
                <motion.button
                  key={b.label}
                  type="button"
                  onClick={b.onClick}
                  disabled={b.disabled}
                  whileTap={b.disabled ? undefined : { scale: 0.92 }}
                  transition={{ type: "spring", stiffness: 500, damping: 20 }}
                  className={cn(
                    "group flex flex-col items-center justify-center gap-1 rounded-2xl py-2.5 px-1 min-h-[60px]",
                    "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    b.disabled
                      ? "opacity-40 cursor-not-allowed"
                      : "active:bg-muted/60 hover:bg-muted/40",
                  )}
                  aria-label={b.label}
                >
                  <span
                    className={cn(
                      "size-8 rounded-xl flex items-center justify-center transition-colors",
                      b.emphasis
                        ? "bg-[var(--mono-green)] text-white shadow-[0_4px_12px_-4px_color-mix(in_oklch,var(--mono-green)_55%,transparent)]"
                        : "bg-muted/70 text-foreground/80 group-hover:bg-muted",
                    )}
                  >
                    <Icon className="size-[18px]" />
                  </span>
                  <span
                    className={cn(
                      "text-[10.5px] font-medium leading-none tracking-tight",
                      b.emphasis ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {b.label}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {open?.kind === "transfer" && (
        <TransferSheet
          kind={open.transferKind}
          room={room}
          you={you}
          open
          onClose={close}
        />
      )}

      {open?.kind === "split" && (
        <SplitSheet room={room} you={you} open onClose={close} />
      )}

      {open?.kind === "trade" && (
        <TradeSheet room={room} you={you} open onClose={close} />
      )}
    </>
  );
}
