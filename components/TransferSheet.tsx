"use client";

import { useEffect, useMemo, useState } from "react";
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

  // Reset when re-opening or kind changes.
  useEffect(() => {
    if (!open) return;
    setReason("other");
    setAmount("");
    setRecipientId(kind === "p2p" ? others[0]?.id ?? "" : "");
    setPropertyId("");
    setNote("");
    setSubmitting(false);
  }, [open, kind, others]);

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
        reason,
        reasonNote: reason === "other" && note.trim() ? note.trim() : undefined,
        cash,
        assets,
      });
      toast.success(
        kind === "request-bank"
          ? "Requested. Auto-confirms in 10s unless objected."
          : "Proposed.",
      );
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send.");
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{titleOf(kind)}</SheetTitle>
          <SheetDescription>
            {kind === "request-bank"
              ? "Request will auto-confirm in 10 seconds unless someone objects."
              : "Proposes a transaction. Affected players must confirm."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-4">
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
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
              >
                <option value="">— select —</option>
                {MONOPOLY_US.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} {a.price ? `($${a.price})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {reason === "other" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="note">Note (optional)</Label>
              <Input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. side bet"
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
