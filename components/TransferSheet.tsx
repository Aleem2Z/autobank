"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CheckCircle,
  Landmark,
  Search,
  Users,
} from "lucide-react";
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
import { GROUP_TOKENS, MONOPOLY_US, REASON_LABELS } from "@/lib/game/monopoly";
import type {
  AssetMovement,
  CashMovement,
  Player,
  ReasonPreset,
  Room,
} from "@/lib/game/types";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils";

type Kind = "p2p" | "pay-bank" | "request-bank";

const HIDDEN: ReasonPreset[] = ["sell-building", "mortgage", "unmortgage"];

const ALL_REASONS: ReasonPreset[] = (
  Object.keys(REASON_LABELS) as ReasonPreset[]
).filter((r) => !HIDDEN.includes(r));

function titleOf(kind: Kind): string {
  switch (kind) {
    case "p2p":
      return "Pay Player";
    case "pay-bank":
      return "Pay Bank";
    case "request-bank":
      return "Request from Bank";
  }
}

function HeroIcon({ kind }: { kind: Kind }) {
  const Icon = kind === "request-bank" ? ArrowDownLeft : ArrowUpRight;
  const tone =
    kind === "request-bank"
      ? "bg-received/15 text-received"
      : "bg-sent/15 text-sent";
  return (
    <span
      className={cn(
        "size-12 rounded-full flex items-center justify-center shrink-0",
        tone,
      )}
    >
      <Icon className="size-6" strokeWidth={2.5} />
    </span>
  );
}

export function TransferSheet({
  initialKind,
  allowKindToggle = true,
  room,
  you,
  open,
  onClose,
}: {
  initialKind: Kind;
  /** When true and the flow isn't a Bank-request, show a Player/Bank toggle. */
  allowKindToggle?: boolean;
  room: Room;
  you: Player;
  open: boolean;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<Kind>(initialKind);
  const [reason, setReason] = useState<ReasonPreset>("other");
  const [amount, setAmount] = useState<string>("");
  const [recipientId, setRecipientId] = useState<string>("");
  const [propertyId, setPropertyId] = useState<string>("");
  const [propertyQuery, setPropertyQuery] = useState<string>("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const others = useMemo(
    () => room.players.filter((p) => p.id !== you.id),
    [room.players, you.id],
  );

  const availableProperties = useMemo(() => {
    const owned = new Set<string>();
    for (const p of room.players) {
      for (const a of p.assets) owned.add(a.defId);
    }
    const list = MONOPOLY_US.filter((a) => !owned.has(a.id));
    if (!propertyQuery) return list;
    const q = propertyQuery.toLowerCase();
    return list.filter((a) => a.name.toLowerCase().includes(q));
  }, [room.players, propertyQuery]);

  const wasOpen = useRef(false);
  const initialRecipientRef = useRef<string>("");
  initialRecipientRef.current =
    initialKind === "p2p" ? others[0]?.id ?? "" : "";
  useEffect(() => {
    if (open && !wasOpen.current) {
      setKind(initialKind);
      setReason("other");
      setAmount("");
      setRecipientId(initialRecipientRef.current);
      setPropertyId("");
      setPropertyQuery("");
      setNote("");
      setSubmitting(false);
    }
    wasOpen.current = open;
  }, [open, initialKind]);

  function switchKind(next: Kind) {
    setKind(next);
    // Reset mode-specific state so leftovers from the other mode don't bleed in.
    setReason("other");
    setPropertyId("");
    setPropertyQuery("");
    if (next === "p2p") {
      setRecipientId(others[0]?.id ?? "");
    } else {
      setRecipientId("");
    }
  }

  const showKindToggle = allowKindToggle && kind !== "request-bank";

  function pickReason(r: ReasonPreset) {
    setReason(r);
    const def = REASON_LABELS[r]?.default;
    if (typeof def === "number") {
      setAmount(String(def));
    }
    if (r !== "buy-property") {
      setPropertyId("");
    }
  }

  async function onSubmit() {
    if (submitting) return;
    const value = Math.floor(Number(amount));
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a positive amount.");
      return;
    }
    if (kind === "p2p" && !recipientId) {
      toast.error("Pick a recipient.");
      return;
    }
    if (kind === "pay-bank" && reason === "buy-property" && !propertyId) {
      toast.error("Pick a property to buy.");
      return;
    }

    let cash: CashMovement[] = [];
    let assets: AssetMovement[] | undefined;

    if (kind === "p2p") {
      cash = [{ fromPlayerId: you.id, toPlayerId: recipientId, amount: value }];
    } else if (kind === "pay-bank") {
      cash = [{ fromPlayerId: you.id, toPlayerId: "bank", amount: value }];
      if (reason === "buy-property" && propertyId) {
        assets = [
          { defId: propertyId, fromPlayerId: "bank", toPlayerId: you.id },
        ];
      }
    } else {
      cash = [{ fromPlayerId: "bank", toPlayerId: you.id, amount: value }];
    }

    setSubmitting(true);
    try {
      await api.propose(room.code, {
        kind,
        reason: kind === "p2p" ? "other" : reason,
        reasonNote: note.trim() || undefined,
        cash,
        assets,
      });
      const isBuyProperty =
        kind === "pay-bank" && reason === "buy-property" && !!propertyId;
      toast.success(
        kind === "request-bank" || isBuyProperty
          ? "Sent. Auto-confirms in 10s unless objected."
          : "Sent.",
      );
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send.");
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="h-auto max-h-[92vh] sm:max-w-lg sm:mx-auto overflow-hidden flex flex-col bg-background border-0"
      >
        <SheetHeader>
          <div className="flex items-start gap-3">
            <HeroIcon kind={kind} />
            <div className="flex flex-col gap-1 min-w-0">
              <SheetTitle>{titleOf(kind)}</SheetTitle>
              <SheetDescription>
                {kind === "request-bank"
                  ? "Auto-confirms in 10 seconds unless someone objects."
                  : kind === "pay-bank" && reason === "buy-property"
                    ? "Buying property gives others 10 seconds to object."
                    : "Sends instantly. Receiver gets a notification."}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-5 pb-32 overflow-y-auto">
          {showKindToggle && (
            <div className="grid grid-cols-2 gap-1 bg-surface rounded-full p-1">
              <button
                type="button"
                onClick={() => switchKind("p2p")}
                className={cn(
                  "h-11 rounded-full text-sm font-semibold transition-all active:scale-95 inline-flex items-center justify-center gap-2",
                  kind === "p2p"
                    ? "bg-surface-lowest text-foreground shadow-card-soft"
                    : "text-on-surface-variant hover:text-foreground",
                )}
              >
                <Users className="size-4" strokeWidth={2.5} />
                Player
              </button>
              <button
                type="button"
                onClick={() => switchKind("pay-bank")}
                className={cn(
                  "h-11 rounded-full text-sm font-semibold transition-all active:scale-95 inline-flex items-center justify-center gap-2",
                  kind === "pay-bank"
                    ? "bg-surface-lowest text-foreground shadow-card-soft"
                    : "text-on-surface-variant hover:text-foreground",
                )}
              >
                <Landmark className="size-4" strokeWidth={2.5} />
                Bank
              </button>
            </div>
          )}

          {kind !== "p2p" && (
            <div className="flex flex-col gap-2">
              <Label className="text-[13px] font-semibold">Reason</Label>
              <div className="grid grid-cols-3 gap-2">
                {ALL_REASONS.map((r) => {
                  const active = reason === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => pickReason(r)}
                      className={cn(
                        "h-10 rounded-full text-xs font-semibold transition-all active:scale-95 px-3",
                        active
                          ? "bg-brand text-white shadow-card-soft"
                          : "bg-surface text-on-surface-variant hover:bg-surface-high",
                      )}
                    >
                      {REASON_LABELS[r].label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="amount" className="text-[13px] font-semibold">
              Amount
            </Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-on-surface-variant pointer-events-none">
                $
              </span>
              <Input
                id="amount"
                type="number"
                inputMode="numeric"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="h-16 pl-10 pr-4 text-2xl font-bold tabular-nums tracking-tight rounded-2xl bg-surface border-transparent focus-visible:bg-surface-lowest focus-visible:border-brand"
              />
            </div>
          </div>

          {kind === "p2p" && (
            <div className="flex flex-col gap-2">
              <Label className="text-[13px] font-semibold">Recipient</Label>
              <div className="flex gap-2 overflow-x-auto hide-scrollbar -mx-1 px-1 pb-1 snap-x">
                {others.map((p) => {
                  const selected = recipientId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setRecipientId(p.id)}
                      className={cn(
                        "shrink-0 snap-start flex flex-col items-center gap-2 w-[80px] px-2 py-3 rounded-2xl border transition-all active:scale-95",
                        selected
                          ? "border-brand bg-brand/5 shadow-card-soft"
                          : "border-border bg-surface-lowest",
                      )}
                    >
                      <span
                        className="size-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                        style={{
                          background: p.color,
                          boxShadow: selected
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
            </div>
          )}

          {kind === "pay-bank" && reason === "buy-property" && (
            <div className="flex flex-col gap-3">
              <Label className="text-[13px] font-semibold">
                Market listings
              </Label>
              <div className="relative">
                <Search className="size-5 absolute left-4 top-1/2 -translate-y-1/2 text-outline" />
                <Input
                  type="text"
                  value={propertyQuery}
                  onChange={(e) => setPropertyQuery(e.target.value)}
                  placeholder="Search available deeds..."
                  className="h-12 pl-12 pr-4 text-base rounded-2xl bg-surface border-transparent focus-visible:bg-surface-lowest focus-visible:border-brand"
                />
              </div>
              {availableProperties.length === 0 ? (
                <div className="rounded-2xl bg-surface border border-dashed border-outline-variant p-6 text-center text-sm text-on-surface-variant">
                  No properties left in the bank.
                </div>
              ) : (
                <ul className="flex flex-col bg-surface-lowest rounded-2xl shadow-card-soft divide-y divide-surface max-h-[42vh] overflow-y-auto">
                  {availableProperties.map((a) => {
                    const selected = propertyId === a.id;
                    const groupColor =
                      GROUP_TOKENS[a.group ?? "utility"] ??
                      "var(--mono-utility)";
                    return (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setPropertyId(a.id);
                            if (a.price) setAmount(String(a.price));
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-3 text-left transition-colors active:scale-[0.99]",
                            selected
                              ? "bg-brand/10"
                              : "hover:bg-surface-low",
                          )}
                        >
                          <span
                            className="w-1 self-stretch rounded-full shrink-0"
                            style={{ background: groupColor }}
                            aria-hidden
                          />
                          <span className="flex-1 min-w-0 flex flex-col">
                            <span className="text-[15px] font-semibold text-foreground truncate leading-tight">
                              {a.name}
                            </span>
                            <span className="text-[11px] uppercase tracking-[0.05em] text-outline mt-0.5">
                              {a.kind === "property"
                                ? `${a.group} group`
                                : a.kind}
                            </span>
                          </span>
                          <span className="tabular-nums font-bold text-foreground shrink-0">
                            ${a.price ?? 0}
                          </span>
                          {selected ? (
                            <span className="size-6 rounded-full bg-brand text-white flex items-center justify-center shrink-0">
                              <Check className="size-4" strokeWidth={3} />
                            </span>
                          ) : (
                            <span className="size-6 rounded-full border-2 border-outline-variant shrink-0" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {propertyId && (
                <p className="text-xs text-on-surface-variant">
                  Price auto-filled. Edit above if your group is auctioning at a
                  different amount.
                </p>
              )}
            </div>
          )}

          {(reason === "other" || kind === "p2p") && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="note" className="text-[13px] font-semibold">
                {kind === "p2p" ? "What for? (optional)" : "Note (optional)"}
              </Label>
              <Input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  kind === "p2p"
                    ? "rent, side bet, lost a bet…"
                    : "e.g. side bet"
                }
                maxLength={120}
                className="h-12 text-base rounded-2xl bg-surface border-transparent focus-visible:bg-surface-lowest focus-visible:border-brand"
              />
            </div>
          )}
        </div>

        {/* Sticky bottom CTA */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pt-4 pb-5 bg-gradient-to-t from-background via-background to-transparent flex flex-col gap-2">
          <Button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className="h-14 rounded-full text-base font-semibold bg-brand text-white shadow-ambient-brand hover:bg-brand/90 active:scale-95 flex items-center justify-center gap-2"
          >
            {submitting ? "Sending..." : titleOf(kind)}
            {!submitting && <CheckCircle className="size-5" />}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
