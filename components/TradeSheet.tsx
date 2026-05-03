"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, ArrowLeft, ArrowDownUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PropertyCard } from "@/components/PropertyCard";
import { buildTradeBody } from "@/lib/game/trade";
import type { Player, Room } from "@/lib/game/types";
import { api } from "@/lib/client/api";
import { formatMoney, cn } from "@/lib/utils";

export function TradeSheet({
  room,
  you,
  open,
  onClose,
}: {
  room: Room;
  you: Player;
  open: boolean;
  onClose: () => void;
}) {
  const others = useMemo(
    () => room.players.filter((p) => p.id !== you.id),
    [room.players, you.id],
  );

  const [partnerId, setPartnerId] = useState<string>("");
  const [giveCash, setGiveCash] = useState<string>("");
  const [getCash, setGetCash] = useState<string>("");
  const [giveAssets, setGiveAssets] = useState<string[]>([]);
  const [getAssets, setGetAssets] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Reset on (re)open or partner switch
  useEffect(() => {
    if (!open) return;
    setPartnerId(others[0]?.id ?? "");
    setGiveCash("");
    setGetCash("");
    setGiveAssets([]);
    setGetAssets([]);
    setSubmitting(false);
  }, [open, others]);

  const partner = others.find((p) => p.id === partnerId) ?? null;

  function toggle(side: "give" | "get", id: string) {
    if (side === "give") {
      setGiveAssets((curr) =>
        curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id],
      );
    } else {
      setGetAssets((curr) =>
        curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id],
      );
    }
  }

  function swap() {
    setGiveCash(getCash);
    setGetCash(giveCash);
    setGiveAssets(getAssets);
    setGetAssets(giveAssets);
  }

  async function onSubmit() {
    if (submitting) return;
    if (!partner) {
      toast.error("Pick a trade partner.");
      return;
    }
    const draft = buildTradeBody({
      youId: you.id,
      partnerId: partner.id,
      give: { cash: Number(giveCash || 0), assetIds: giveAssets },
      get: { cash: Number(getCash || 0), assetIds: getAssets },
    });
    if (!draft.ok || !draft.body) {
      toast.error(draft.reason ?? "Invalid trade.");
      return;
    }
    setSubmitting(true);
    try {
      await api.propose(room.code, draft.body);
      toast.success(`Trade proposed to ${partner.name}.`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send.");
      setSubmitting(false);
    }
  }

  const giveTotal = Number(giveCash || 0);
  const getTotal = Number(getCash || 0);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="h-[92vh] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>Trade</SheetTitle>
          <SheetDescription>
            Propose an exchange of cash and properties. Both sides must confirm.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-4 pb-6">
          {/* Partner picker */}
          <section className="flex flex-col gap-2">
            <Label>Trade with</Label>
            {others.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No other players in the room yet.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {others.map((p) => (
                  <Button
                    key={p.id}
                    type="button"
                    size="sm"
                    variant={partnerId === p.id ? "default" : "outline"}
                    onClick={() => setPartnerId(p.id)}
                  >
                    <span
                      className="inline-block size-2.5 rounded-full mr-1.5"
                      style={{ background: p.color }}
                      aria-hidden
                    />
                    {p.name}
                  </Button>
                ))}
              </div>
            )}
          </section>

          {/* Give / Get sides */}
          <div className="grid gap-3 md:grid-cols-2">
            <TradeSidePanel
              role="give"
              title="You give"
              accent="text-destructive"
              you={you}
              partner={partner}
              cash={giveCash}
              setCash={setGiveCash}
              assetIds={giveAssets}
              otherSideAssets={getAssets}
              onToggle={(id) => toggle("give", id)}
            />
            <TradeSidePanel
              role="get"
              title="You get"
              accent="text-[var(--mono-green)]"
              you={you}
              partner={partner}
              cash={getCash}
              setCash={setGetCash}
              assetIds={getAssets}
              otherSideAssets={giveAssets}
              onToggle={(id) => toggle("get", id)}
            />
          </div>

          <div className="flex justify-center -my-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={swap}
              className="gap-1.5"
              aria-label="Swap give and get sides"
            >
              <ArrowDownUp className="size-3.5" />
              Swap sides
            </Button>
          </div>

          {/* Totals */}
          <section className="border rounded-lg p-3 bg-card flex flex-col gap-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <ArrowRight className="size-3.5" /> You give
              </span>
              <span className="tabular-nums font-medium">
                {formatMoney(giveTotal)}
                {giveAssets.length > 0 && (
                  <span className="text-muted-foreground"> · {giveAssets.length} card{giveAssets.length === 1 ? "" : "s"}</span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <ArrowLeft className="size-3.5" /> You get
              </span>
              <span className="tabular-nums font-medium">
                {formatMoney(getTotal)}
                {getAssets.length > 0 && (
                  <span className="text-muted-foreground"> · {getAssets.length} card{getAssets.length === 1 ? "" : "s"}</span>
                )}
              </span>
            </div>
            {partner && (giveTotal !== 0 || getTotal !== 0) && (
              <div className="flex items-center justify-between pt-1.5 border-t">
                <span className="text-muted-foreground">Net cash</span>
                <span
                  className={cn(
                    "tabular-nums font-semibold",
                    getTotal - giveTotal > 0
                      ? "text-[var(--mono-green)]"
                      : getTotal - giveTotal < 0
                        ? "text-destructive"
                        : "",
                  )}
                >
                  {getTotal - giveTotal > 0 ? "+" : ""}
                  {formatMoney(getTotal - giveTotal)}
                </span>
              </div>
            )}
          </section>

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onSubmit}
              disabled={submitting || !partner}
              className="flex-1"
            >
              {submitting ? "Sending..." : `Send to ${partner?.name ?? "—"}`}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TradeSidePanel({
  role,
  title,
  accent,
  you,
  partner,
  cash,
  setCash,
  assetIds,
  otherSideAssets,
  onToggle,
}: {
  role: "give" | "get";
  title: string;
  accent: string;
  you: Player;
  partner: Player | null;
  cash: string;
  setCash: (v: string) => void;
  assetIds: string[];
  otherSideAssets: string[];
  onToggle: (id: string) => void;
}) {
  const source = role === "give" ? you : partner;
  const sourceAssets = source?.assets ?? [];

  return (
    <section className="border rounded-lg p-3 bg-card flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <span className={cn("text-xs uppercase tracking-wide font-semibold", accent)}>
          {title}
        </span>
        <span className="text-xs text-muted-foreground truncate">
          {source ? source.name : "—"}
        </span>
      </header>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${role}-cash`} className="text-xs">
          Cash
        </Label>
        <Input
          id={`${role}-cash`}
          type="number"
          inputMode="numeric"
          min={0}
          value={cash}
          onChange={(e) => setCash(e.target.value)}
          placeholder="0"
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Properties ({assetIds.length})</Label>
          {assetIds.length > 0 && (
            <button
              type="button"
              className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
              onClick={() => assetIds.forEach((id) => onToggle(id))}
            >
              Clear
            </button>
          )}
        </div>
        {sourceAssets.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {source ? "No properties to offer." : "Pick a partner above."}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sourceAssets.map((a) => {
              const selected = assetIds.includes(a.defId);
              const lockedOnOther = otherSideAssets.includes(a.defId);
              return (
                <PropertyCard
                  key={a.defId}
                  defId={a.defId}
                  asset={a}
                  size="sm"
                  selected={selected}
                  disabled={lockedOnOther}
                  onClick={() => onToggle(a.defId)}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
