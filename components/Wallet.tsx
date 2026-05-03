import type { Player } from "@/lib/game/types";
import { PropertyCard } from "@/components/PropertyCard";
import { BalanceTicker } from "@/components/animations/BalanceTicker";

export function Wallet({ player }: { player: Player }) {
  return (
    <section className="flex flex-col gap-3">
      {/* Premium debit-card hero. */}
      <div
        className="relative rounded-3xl overflow-hidden card-surface-deep text-white shadow-[0_18px_48px_-22px_rgba(20,80,50,0.65)]"
        aria-label={`${player.name}'s wallet`}
      >
        {/* Decorative chevrons in upper-right */}
        <div
          className="absolute inset-0 card-chevron pointer-events-none"
          aria-hidden
        />
        {/* Subtle paper-grain over the gradient */}
        <div className="absolute inset-0 card-grain pointer-events-none" aria-hidden />
        {/* Sheen */}
        <div
          className="absolute -top-16 -right-12 size-56 rounded-full pointer-events-none"
          aria-hidden
          style={{
            background:
              "radial-gradient(circle at center, rgba(255,255,255,0.18) 0%, transparent 60%)",
          }}
        />

        <div className="relative p-5 flex flex-col gap-7">
          {/* Top: glowing color dot + name + role */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="inline-block size-3 rounded-full shrink-0 ring-1 ring-white/40"
                style={{
                  background: player.color,
                  boxShadow: `0 0 0 3px ${player.color}33, 0 0 14px ${player.color}80`,
                }}
                aria-hidden
              />
              <span
                className="font-semibold text-lg leading-none truncate"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {player.name}
              </span>
              {player.isAdmin && (
                <span className="text-[9px] uppercase tracking-[0.2em] px-1.5 py-0.5 rounded-md bg-white/15 text-white/80 shrink-0">
                  admin
                </span>
              )}
            </div>
            <span className="text-[10px] uppercase tracking-[0.28em] text-white/60 mt-1.5 shrink-0">
              Autobank
            </span>
          </div>

          {/* Big balance */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.28em] text-white/60">
              Balance
            </span>
            <BalanceTicker
              value={player.cash}
              showCurrencyChip
              className="text-[44px] sm:text-[52px] leading-none font-black tracking-[-0.025em] tabular-nums"
            />
          </div>

          {/* Bottom row */}
          <div className="flex items-end justify-between gap-3">
            <div className="text-[11px] text-white/65 tabular-nums uppercase tracking-[0.2em]">
              {player.assets.length}{" "}
              {player.assets.length === 1 ? "deed" : "deeds"} held
            </div>
            <div className="text-[10px] text-white/50 font-mono">
              VALID · ALL GAME
            </div>
          </div>
        </div>
      </div>

      {/* Properties strip below the card */}
      <div className="rounded-2xl bg-card border border-border/60 px-3 py-3 flex flex-col gap-2">
        <h3 className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground flex items-center justify-between font-medium">
          <span>Title deeds</span>
          <span className="tabular-nums text-foreground/70">
            {player.assets.length}
          </span>
        </h3>
        {player.assets.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No deeds yet. Buy a property from the Bank to get started.
          </p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
            {player.assets.map((a, idx) => (
              <div key={`${a.defId}-${idx}`} className="snap-start">
                <PropertyCard defId={a.defId} asset={a} size="sm" />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
