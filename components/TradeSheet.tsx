"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, ArrowLeft, ArrowDownUp, ArrowLeftRight, CheckCircle } from "lucide-react";
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

  // Reset on the leading edge of `open` going false → true. Using a ref
  // for the previous-open avoids re-resetting on every parent re-render
  // (which would otherwise wipe the user's typed cash whenever `others`
  // gets a new array identity).
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setPartnerId(others[0]?.id ?? "");
      setGiveCash("");
      setGetCash("");
      setGiveAssets([]);
      setGetAssets([]);
      setSubmitting(false);
    }
    wasOpen.current = open;
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
        className="h-auto max-h-[92vh] sm:max-w-2xl sm:mx-auto overflow-hidden flex flex-col bg-background border-0"
      >
        <SheetHeader>
          <div className="flex items-start gap-3">
            <span className="size-12 rounded-full bg-brand/15 text-brand flex items-center justify-center shrink-0">
              <ArrowLeftRight className="size-6" strokeWidth={2.5} />
            </span>
            <div className="flex flex-col gap-1 min-w-0">
              <SheetTitle>Trade</SheetTitle>
              <SheetDescription>
                Propose an exchange of cash and properties. Both sides must
                confirm.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-5 pb-32 overflow-y-auto">
          {/* Partner picker */}
          <section className="flex flex-col gap-2">
            <Label className="text-[13px] font-semibold">Trade with</Label>
            {others.length === 0 ? (
              <p className="text-sm text-on-surface-variant">
                No other players in the room yet.
              </p>
            ) : (
              <div className="flex gap-2 overflow-x-auto hide-scrollbar -mx-1 px-1 pb-1 snap-x">
                {others.map((p) => {
                  const on = partnerId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPartnerId(p.id)}
                      className={cn(
                        "shrink-0 snap-start flex flex-col items-center gap-2 w-[80px] px-2 py-3 rounded-2xl border transition-all active:scale-95",
                        on
                          ? "border-brand bg-brand/5 shadow-card-soft"
                          : "border-border bg-surface-lowest",
                      )}
                    >
                      <span
                        className="size-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                        style={{
                          background: p.color,
                          boxShadow: on
                            ? `0 0 0 2px var(--surface-lowest), 0 0 0 4px ${p.color}`
                            : "0 1px 2px rgba(0,0,0,0.08)",
                        }}
                      >
                        {p.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="text-[12px] font-semibold text-foreground truncate max-w-full">
                        {p.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Give / Get sides */}
          <div className="grid gap-3 md:grid-cols-2">
            <TradeSidePanel
              role="give"
              title="You give"
              tone="sent"
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
              tone="received"
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
            <button
              type="button"
              onClick={swap}
              aria-label="Swap give and get sides"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-surface text-on-surface-variant text-xs font-semibold hover:bg-surface-high active:scale-95 transition-all"
            >
              <ArrowDownUp className="size-3.5" />
              Swap sides
            </button>
          </div>

          {/* Totals */}
          <section className="rounded-2xl bg-surface-lowest p-4 shadow-soft flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-on-surface-variant">
                <ArrowRight className="size-3.5" /> You give
              </span>
              <span className="tabular-nums font-semibold text-foreground">
                {formatMoney(giveTotal)}
                {giveAssets.length > 0 && (
                  <span className="text-on-surface-variant">
                    {" "}
                    · {giveAssets.length} card
                    {giveAssets.length === 1 ? "" : "s"}
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-on-surface-variant">
                <ArrowLeft className="size-3.5" /> You get
              </span>
              <span className="tabular-nums font-semibold text-foreground">
                {formatMoney(getTotal)}
                {getAssets.length > 0 && (
                  <span className="text-on-surface-variant">
                    {" "}
                    · {getAssets.length} card
                    {getAssets.length === 1 ? "" : "s"}
                  </span>
                )}
              </span>
            </div>
            {partner && (giveTotal !== 0 || getTotal !== 0) && (
              <div className="flex items-center justify-between pt-2 border-t border-surface">
                <span className="text-on-surface-variant">Net cash</span>
                <span
                  className={cn(
                    "tabular-nums font-bold",
                    getTotal - giveTotal > 0
                      ? "text-received"
                      : getTotal - giveTotal < 0
                        ? "text-sent"
                        : "text-foreground",
                  )}
                >
                  {getTotal - giveTotal > 0 ? "+" : ""}
                  {formatMoney(getTotal - giveTotal)}
                </span>
              </div>
            )}
          </section>
        </div>

        <div className="absolute bottom-0 left-0 right-0 px-5 pt-4 pb-5 bg-gradient-to-t from-background via-background to-transparent flex flex-col gap-2">
          <Button
            type="button"
            onClick={onSubmit}
            disabled={submitting || !partner}
            className="h-14 rounded-full text-base font-semibold bg-brand text-white shadow-ambient-brand hover:bg-brand/90 active:scale-95 flex items-center justify-center gap-2"
          >
            {submitting ? "Sending..." : `Send to ${partner?.name ?? "—"}`}
            {!submitting && <CheckCircle className="size-5" />}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TradeSidePanel({
  role,
  title,
  tone,
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
  tone: "sent" | "received";
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
  const accent = tone === "sent" ? "text-sent" : "text-received";
  const accentBar = tone === "sent" ? "bg-sent" : "bg-received";

  return (
    <section className="rounded-2xl bg-surface-lowest p-4 shadow-soft flex flex-col gap-3 relative overflow-hidden">
      <span className={cn("absolute top-0 left-0 right-0 h-[4px]", accentBar)} aria-hidden />
      <header className="flex items-center justify-between mt-1">
        <span
          className={cn(
            "text-[11px] uppercase tracking-[0.06em] font-bold",
            accent,
          )}
        >
          {title}
        </span>
        <span className="text-xs text-on-surface-variant truncate font-medium">
          {source ? source.name : "—"}
        </span>
      </header>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${role}-cash`} className="text-xs font-semibold">
          Cash
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base font-bold text-on-surface-variant pointer-events-none">
            $
          </span>
          <Input
            id={`${role}-cash`}
            type="number"
            inputMode="numeric"
            min={0}
            value={cash}
            onChange={(e) => setCash(e.target.value)}
            placeholder="0"
            className="h-11 pl-8 pr-3 text-base font-bold tabular-nums rounded-xl bg-surface border-transparent focus-visible:bg-surface-lowest focus-visible:border-brand"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">
            Properties ({assetIds.length})
          </Label>
          {assetIds.length > 0 && (
            <button
              type="button"
              className="text-[11px] font-semibold text-on-surface-variant hover:text-foreground underline-offset-2 hover:underline"
              onClick={() => assetIds.forEach((id) => onToggle(id))}
            >
              Clear
            </button>
          )}
        </div>
        {sourceAssets.length === 0 ? (
          <p className="text-xs text-on-surface-variant italic">
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
