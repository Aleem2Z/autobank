"use client";

import { Building2 } from "lucide-react";
import type { Player, PlayerAsset } from "@/lib/game/types";
import { PropertyCard } from "@/components/PropertyCard";
import { BalanceTicker } from "@/components/animations/BalanceTicker";
import { BillFan } from "@/components/BillFan";

export function Wallet({
  player,
  onPropertyTap,
}: {
  player: Player;
  onPropertyTap?: (asset: PlayerAsset) => void;
}) {
  return (
    <section className="flex flex-col gap-6">
      {/* Hero balance card — gradient teal→cyan with fanned Monopoly notes
          tucked into the bottom-right. Compact: balance sits top-left,
          fan overlaps the lower-right of the same card. */}
      <div
        className="relative w-full rounded-[2rem] bg-gradient-hero p-5 pb-6 overflow-hidden shadow-ambient-brand text-white min-h-[200px]"
        aria-label={`${player.name}'s wallet`}
      >
        {/* Decorative blurred orbs */}
        <div className="absolute top-0 right-0 size-56 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
        <div className="absolute bottom-0 left-0 size-40 bg-white/10 rounded-full blur-2xl -ml-8 -mb-8 pointer-events-none" />

        {/* Balance — top-left */}
        <div className="relative z-10 flex flex-col gap-1 min-w-0 max-w-[60%]">
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-white/80">
            Available Balance
          </span>
          <BalanceTicker
            value={player.cash}
            showCurrencyChip
            className="text-[42px] sm:text-[48px] leading-none font-bold tracking-tight tabular-nums"
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

        {/* Fan anchored to bottom-right of the card. The fan's pivot is at
            its own bottom-left; the bills sweep up-and-to-the-right from
            there, naturally hugging the right edge of the card. */}
        <div
          className="absolute z-0 pointer-events-none"
          style={{
            // Pivot near bottom-right of card, leaving room for the bills
            // to sweep upward without colliding with the balance text.
            right: "32%",
            bottom: 16,
            width: 0,
            height: 0,
          }}
        >
          <BillFan cash={player.cash} />
        </div>
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
                <PropertyCard
                  defId={a.defId}
                  asset={a}
                  size="md"
                  onClick={
                    onPropertyTap ? () => onPropertyTap(a) : undefined
                  }
                />
              </div>
            ))}
            <div className="shrink-0 w-2" />
          </div>
        )}
      </section>
    </section>
  );
}
