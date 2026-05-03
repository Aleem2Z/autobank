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
import type { Player, Room } from "@/lib/game/types";
import { api } from "@/lib/client/api";

const MAX_RECIPIENTS = 3;

export function SplitSheet({
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
  const [selected, setSelected] = useState<string[]>([]);
  const [amount, setAmount] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected([]);
    setAmount("");
    setSubmitting(false);
  }, [open]);

  function toggle(id: string) {
    setSelected((curr) => {
      if (curr.includes(id)) return curr.filter((x) => x !== id);
      if (curr.length >= MAX_RECIPIENTS) {
        toast.error(`At most ${MAX_RECIPIENTS} recipients per split.`);
        return curr;
      }
      return [...curr, id];
    });
  }

  async function onSubmit() {
    if (submitting) return;
    if (selected.length === 0) {
      toast.error("Pick at least one recipient.");
      return;
    }
    const value = Math.floor(Number(amount));
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a positive amount per recipient.");
      return;
    }

    setSubmitting(true);
    try {
      await api.propose(room.code, {
        kind: "split",
        reason: "other",
        splitChildren: selected.map((id) => ({ toPlayerId: id, amount: value })),
      });
      toast.success("Split proposed.");
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
          <SheetTitle>Split</SheetTitle>
          <SheetDescription>
            Pay the same amount to up to {MAX_RECIPIENTS} other players.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-4">
          <div className="flex flex-col gap-2">
            <Label>Recipients ({selected.length}/{MAX_RECIPIENTS})</Label>
            <div className="grid grid-cols-2 gap-2">
              {others.map((p) => {
                const on = selected.includes(p.id);
                return (
                  <Button
                    key={p.id}
                    type="button"
                    size="sm"
                    variant={on ? "default" : "outline"}
                    onClick={() => toggle(p.id)}
                  >
                    <span
                      className="inline-block size-2 rounded-full mr-2"
                      style={{ background: p.color }}
                      aria-hidden
                    />
                    {p.name}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="split-amount">Amount per recipient</Label>
            <Input
              id="split-amount"
              type="number"
              inputMode="numeric"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </div>

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
