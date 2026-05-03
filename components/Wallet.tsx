import type { Player } from "@/lib/game/types";
import { getAssetDef } from "@/lib/game/monopoly";
import { formatMoney } from "@/lib/utils";

export function Wallet({ player }: { player: Player }) {
  return (
    <section className="border rounded-lg p-3 bg-card flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="inline-block size-3 rounded-full border"
            style={{ background: player.color }}
            aria-hidden
          />
          <span className="font-medium">{player.name}</span>
          {player.isAdmin && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              admin
            </span>
          )}
        </div>
        <div className="text-2xl font-semibold tabular-nums">
          {formatMoney(player.cash)}
        </div>
      </header>

      <div>
        <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
          Assets ({player.assets.length})
        </h3>
        {player.assets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No assets yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {player.assets.map((a, idx) => {
              const def = getAssetDef(a.defId);
              return (
                <li
                  key={`${a.defId}-${idx}`}
                  className="flex items-center justify-between text-sm border rounded px-2 py-1"
                >
                  <span>{def?.name ?? a.defId}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {a.mortgaged && <span className="text-destructive">mortgaged</span>}
                    {typeof a.houses === "number" && a.houses > 0 && (
                      <span>
                        {a.houses === 5 ? "hotel" : `${a.houses} house${a.houses === 1 ? "" : "s"}`}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
