import type { Player } from "@/lib/game/types";
import { PropertyCard } from "@/components/PropertyCard";
import { BalanceTicker } from "@/components/animations/BalanceTicker";

export function Wallet({ player }: { player: Player }) {
  return (
    <section className="border rounded-xl p-4 bg-card flex flex-col gap-4 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.12)]">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="inline-block size-3.5 rounded-full border border-black/30 shadow-sm shrink-0"
            style={{ background: player.color }}
            aria-hidden
          />
          <span className="font-medium truncate">{player.name}</span>
          {player.isAdmin && (
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              admin
            </span>
          )}
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Balance
          </span>
          <BalanceTicker
            value={player.cash}
            className="text-3xl font-bold tracking-tight"
          />
        </div>
      </header>

      <div>
        <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center justify-between">
          <span>Properties · {player.assets.length}</span>
        </h3>
        {player.assets.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No deeds yet. Buy a property from the Bank to get started.
          </p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
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
