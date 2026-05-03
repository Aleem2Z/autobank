"use client";

import { motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Building2,
  CreditCard,
  Eye,
  Split,
} from "lucide-react";
import type { Player, Room } from "@/lib/game/types";
import { PropertyCard } from "@/components/PropertyCard";
import { BalanceTicker } from "@/components/animations/BalanceTicker";
import { cn } from "@/lib/utils";

export type WalletAction =
  | { kind: "transfer"; transferKind: "p2p" | "pay-bank" | "request-bank" }
  | { kind: "split" }
  | { kind: "trade" };

export function Wallet({
  player,
  room,
  onAction,
}: {
  player: Player;
  room: Room;
  onAction: (a: WalletAction) => void;
}) {
  const splitDisabled = room.mode === "official";

  return (
    <section className="flex flex-col gap-6">
      {/* Hero balance card — gradient teal→cyan with isometric "card stack" */}
      <div
        className="relative w-full rounded-[2rem] bg-gradient-hero p-6 overflow-hidden shadow-ambient-brand text-white"
        aria-label={`${player.name}'s wallet`}
      >
        {/* Decorative blurred orbs */}
        <div className="absolute top-0 right-0 size-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 size-48 bg-white/10 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex justify-between items-start gap-3">
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-white/80">
                Available Balance
              </span>
              <BalanceTicker
                value={player.cash}
                showCurrencyChip
                className="text-[44px] sm:text-[52px] leading-none font-bold tracking-tight tabular-nums"
              />
              <div className="flex items-center gap-2 mt-2 min-w-0">
                <span
                  className="inline-block size-3 rounded-full shrink-0 ring-1 ring-white/40"
                  style={{
                    background: player.color,
                    boxShadow: `0 0 0 2px ${player.color}33, 0 0 12px ${player.color}80`,
                  }}
                  aria-hidden
                />
                <span className="text-sm font-semibold truncate">
                  {player.name}
                </span>
                {player.isAdmin && (
                  <span className="text-[9px] uppercase tracking-[0.2em] px-1.5 py-0.5 rounded-md bg-white/15 text-white/85 shrink-0">
                    admin
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              aria-label="Toggle balance visibility"
              className="bg-white/20 p-2 rounded-full backdrop-blur-sm text-white hover:bg-white/30 transition-colors active:scale-95"
            >
              <Eye className="size-5" />
            </button>
          </div>

          {/* Isometric card stack */}
          <div className="h-32 relative mt-2">
            <div className="absolute bottom-0 right-4 w-3/4 h-20 bg-white/20 rounded-lg transform -skew-y-6 translate-y-4 border border-white/30 backdrop-blur-md shadow-lg" />
            <div className="absolute bottom-2 right-6 w-3/4 h-20 bg-white/40 rounded-lg transform -skew-y-6 translate-y-2 border border-white/40 backdrop-blur-md shadow-lg" />
            <div className="absolute bottom-4 right-8 w-3/4 h-20 bg-white rounded-lg transform -skew-y-6 flex items-center justify-between p-4 shadow-[0_10px_20px_-5px_rgba(0,0,0,0.1)]">
              <div className="size-8 rounded-full bg-surface flex items-center justify-center">
                <CreditCard className="size-4 text-brand" />
              </div>
              <div className="flex gap-1">
                <span className="size-2 rounded-full bg-surface-highest" />
                <span className="size-2 rounded-full bg-surface-highest" />
                <span className="size-2 rounded-full bg-surface-highest" />
                <span className="size-2 rounded-full bg-surface-highest" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions bento — 4-column grid */}
      <div className="grid grid-cols-4 gap-3">
        <QuickAction
          label="Pay"
          icon={ArrowUpRight}
          tone="sent"
          onClick={() =>
            onAction({ kind: "transfer", transferKind: "p2p" })
          }
        />
        <QuickAction
          label="Request"
          icon={ArrowDownLeft}
          tone="received"
          onClick={() =>
            onAction({ kind: "transfer", transferKind: "request-bank" })
          }
        />
        <QuickAction
          label="Trade"
          icon={ArrowLeftRight}
          tone="brand"
          onClick={() => onAction({ kind: "trade" })}
        />
        <QuickAction
          label="Split"
          icon={Split}
          tone="brand"
          disabled={splitDisabled}
          onClick={() => onAction({ kind: "split" })}
        />
      </div>

      {/* Portfolio strip */}
      <section className="flex flex-col gap-3 -mx-5">
        <div className="flex justify-between items-center px-5">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Portfolio
          </h2>
          <span className="text-sm tabular-nums text-on-surface-variant">
            {player.assets.length}{" "}
            {player.assets.length === 1 ? "deed" : "deeds"}
          </span>
        </div>
        {player.assets.length === 0 ? (
          <div className="px-5">
            <div className="rounded-2xl border-2 border-dashed border-outline-variant px-5 py-6 flex flex-col items-center gap-2 text-center">
              <div className="size-10 rounded-full bg-brand/10 flex items-center justify-center text-brand">
                <Building2 className="size-5" />
              </div>
              <p className="text-sm text-on-surface-variant">
                No deeds yet. Buy a property from the Bank to get started.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex overflow-x-auto hide-scrollbar snap-x snap-mandatory px-5 pb-2 gap-3">
            {player.assets.map((a, idx) => (
              <div key={`${a.defId}-${idx}`} className="snap-center shrink-0">
                <PropertyCard defId={a.defId} asset={a} size="md" />
              </div>
            ))}
            <div className="shrink-0 w-2" />
          </div>
        )}
      </section>
    </section>
  );
}

function QuickAction({
  label,
  icon: Icon,
  tone,
  onClick,
  disabled,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tone: "sent" | "received" | "brand";
  onClick: () => void;
  disabled?: boolean;
}) {
  const toneClass = {
    sent: "bg-sent/15 text-sent",
    received: "bg-received/15 text-received",
    brand: "bg-brand/15 text-brand",
  }[tone];

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      className={cn(
        "flex flex-col items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl py-1",
        disabled && "opacity-40 cursor-not-allowed",
      )}
      aria-label={label}
    >
      <span
        className={cn(
          "size-14 rounded-full flex items-center justify-center shadow-card-soft transition-shadow",
          toneClass,
          !disabled && "hover:shadow-[0_12px_24px_-6px_rgba(0,0,0,0.08)]",
        )}
      >
        <Icon className="size-6" strokeWidth={2.5} />
      </span>
      <span className="text-[13px] font-semibold text-on-surface-variant">
        {label}
      </span>
    </motion.button>
  );
}
