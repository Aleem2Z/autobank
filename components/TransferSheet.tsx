"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
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
import { MONOPOLY_US, REASON_LABELS } from "@/lib/game/monopoly";
import type {
  AssetMovement,
  CashMovement,
  Player,
  ReasonPreset,
  Room,
} from "@/lib/game/types";
import { api } from "@/lib/client/api";

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

export function TransferSheet({
  kind,
  room,
  you,
  open,
  onClose,
}: {
  kind: Kind;
  room: Room;
  you: Player;
  open: boolean;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<ReasonPreset>("other");
  const [amount, setAmount] = useState<string>("");
  const [recipientId, setRecipientId] = useState<string>("");
  const [propertyId, setPropertyId] = useState<string>("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const others = useMemo(
    () => room.players.filter((p) => p.id !== you.id),
    [room.players, you.id],
  );

  // Properties available to buy from the bank = those no player owns yet.
  // Once auctioned/owned, they're excluded until they return to the bank
  // via a future "return to bank" / auction-fail flow.
  const availableProperties = useMemo(() => {
    const owned = new Set<string>();
    for (const p of room.players) {
      for (const a of p.assets) owned.add(a.defId);
    }
    return MONOPOLY_US.filter((a) => !owned.has(a.id));
  }, [room.players]);

  // Reset only on the leading edge of `open` going false → true (or when kind changes).
  // Depending on `others` would re-fire every SSE update and clobber user input.
  const wasOpen = useRef(false);
  const initialRecipientRef = useRef<string>("");
  initialRecipientRef.current = kind === "p2p" ? others[0]?.id ?? "" : "";
  useEffect(() => {
    if (open && !wasOpen.current) {
      setReason("other");
      setAmount("");
      setRecipientId(initialRecipientRef.current);
      setPropertyId("");
      setNote("");
      setSubmitting(false);
    }
    wasOpen.current = open;
  }, [open, kind]);

  function pickReason(r: ReasonPreset) {
    setReason(r);
    const def = REASON_LABELS[r]?.default;
    if (typeof def === "number") {
      setAmount(String(def));
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

    let cash: CashMovement[] = [];
    let assets: AssetMovement[] | undefined;

    if (kind === "p2p") {
      cash = [{ fromPlayerId: you.id, toPlayerId: recipientId, amount: value }];
    } else if (kind === "pay-bank") {
      cash = [{ fromPlayerId: you.id, toPlayerId: "bank", amount: value }];
      if (reason === "buy-property" && propertyId) {
        assets = [
          {
            defId: propertyId,
            fromPlayerId: "bank",
            toPlayerId: you.id,
          },
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
      const isBuyProperty = kind === "pay-bank" && reason === "buy-property" && !!propertyId;
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
      <SheetContent side="bottom" className="h-auto max-h-[90vh] sm:max-w-lg sm:mx-auto sm:rounded-t-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{titleOf(kind)}</SheetTitle>
          <SheetDescription>
            {kind === "request-bank"
              ? "Auto-confirms in 10 seconds unless someone objects."
              : kind === "pay-bank" && reason === "buy-property"
                ? "Buying property gives others 10 seconds to object."
                : "Sends instantly. Receiver gets a notification."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-4">
          {kind !== "p2p" && (
            <div className="flex flex-col gap-2">
              <Label>Reason</Label>
              <div className="grid grid-cols-3 gap-2">
                {ALL_REASONS.map((r) => (
                  <Button
                    key={r}
                    type="button"
                    size="sm"
                    variant={reason === r ? "default" : "outline"}
                    onClick={() => pickReason(r)}
                  >
                    {REASON_LABELS[r].label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              inputMode="numeric"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </div>

          {kind === "p2p" && (
            <div className="flex flex-col gap-2">
              <Label>Recipient</Label>
              <div className="grid grid-cols-2 gap-2">
                {others.map((p) => (
                  <Button
                    key={p.id}
                    type="button"
                    size="sm"
                    variant={recipientId === p.id ? "default" : "outline"}
                    onClick={() => setRecipientId(p.id)}
                  >
                    <span
                      className="inline-block size-2 rounded-full mr-2"
                      style={{ background: p.color }}
                      aria-hidden
                    />
                    {p.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {kind === "pay-bank" && reason === "buy-property" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="property">Property</Label>
              <select
                id="property"
                className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm"
                value={propertyId}
                onChange={(e) => {
                  const id = e.target.value;
                  setPropertyId(id);
                  const def = availableProperties.find((a) => a.id === id);
                  if (def?.price) setAmount(String(def.price));
                }}
              >
                <option value="">— select —</option>
                {availableProperties.length === 0 ? (
                  <option value="" disabled>
                    No properties left in the bank
                  </option>
                ) : (
                  availableProperties.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} {a.price ? `($${a.price})` : ""}
                    </option>
                  ))
                )}
              </select>
              {propertyId && (
                <p className="text-xs text-muted-foreground">
                  Price auto-filled. Edit if your group is auctioning at a different amount.
                </p>
              )}
            </div>
          )}

          {(reason === "other" || kind === "p2p") && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="note">{kind === "p2p" ? "What for? (optional)" : "Note (optional)"}</Label>
              <Input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={kind === "p2p" ? "rent, side bet, lost a bet…" : "e.g. side bet"}
                maxLength={120}
              />
            </div>
          )}

          <div className="flex gap-2 pt-2">
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
              disabled={submitting}
              className="flex-1"
            >
              {submitting ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
