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
import type { Player, Room } from "@/lib/game/types";
import { api } from "@/lib/client/api";
import { computeSplitAmounts, evenPercentages } from "@/lib/game/split";
import { formatMoney } from "@/lib/utils";

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
  const [percentages, setPercentages] = useState<number[]>([]);
  const [total, setTotal] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Reset only on the leading edge of `open` going false → true.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setSelected([]);
      setPercentages([]);
      setTotal("");
      setSubmitting(false);
    }
    wasOpen.current = open;
  }, [open]);

  function toggle(id: string) {
    setSelected((curr) => {
      const without = curr.filter((x) => x !== id);
      let next: string[];
      if (without.length < curr.length) {
        next = without; // was selected → remove
      } else if (curr.length >= MAX_RECIPIENTS) {
        toast.error(`At most ${MAX_RECIPIENTS} recipients per split.`);
        return curr;
      } else {
        next = [...curr, id]; // add
      }
      // Reset percentages to even whenever the selection changes.
      setPercentages(evenPercentages(next.length));
      return next;
    });
  }

  function updatePct(idx: number, raw: string) {
    const v = Math.max(0, Math.min(100, Math.round(Number(raw) || 0)));
    setPercentages((curr) => curr.map((p, i) => (i === idx ? v : p)));
  }

  function distributeEvenly() {
    setPercentages(evenPercentages(selected.length));
  }

  const totalNum = Math.max(0, Math.floor(Number(total) || 0));
  const pctSum = percentages.reduce((a, b) => a + b, 0);
  const computedAmounts = computeSplitAmounts(totalNum, percentages);

  async function onSubmit() {
    if (submitting) return;
    if (selected.length === 0) {
      toast.error("Pick at least one recipient.");
      return;
    }
    if (totalNum <= 0) {
      toast.error("Enter a positive total amount.");
      return;
    }
    if (pctSum <= 0) {
      toast.error("Set a non-zero share for at least one recipient.");
      return;
    }

    setSubmitting(true);
    try {
      const splitChildren = selected
        .map((id, i) => ({ toPlayerId: id, amount: computedAmounts[i] }))
        .filter((c) => c.amount > 0);
      if (splitChildren.length === 0) throw new Error("Nothing to send.");
      await api.propose(room.code, {
        kind: "split",
        reason: "other",
        splitChildren,
      });
      toast.success(`Split sent: ${formatMoney(totalNum)}.`);
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
        className="h-auto max-h-[90vh] sm:max-w-lg sm:mx-auto sm:rounded-t-2xl overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>Split</SheetTitle>
          <SheetDescription>
            Split a total amount between up to {MAX_RECIPIENTS} other players.
            Sets even percentages by default — adjust each share if you like.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="split-total">Total amount</Label>
            <Input
              id="split-total"
              type="number"
              inputMode="numeric"
              min={1}
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              placeholder="0"
              className="h-12 text-lg font-semibold"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <Label>Recipients ({selected.length}/{MAX_RECIPIENTS})</Label>
              {selected.length > 1 && (
                <button
                  type="button"
                  onClick={distributeEvenly}
                  className="text-[11px] text-[var(--mono-green)] hover:underline"
                >
                  Distribute evenly
                </button>
              )}
            </div>
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

          {selected.length > 0 && (
            <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/30 p-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Shares
              </div>
              <ul className="flex flex-col gap-2">
                {selected.map((id, idx) => {
                  const player = room.players.find((p) => p.id === id);
                  if (!player) return null;
                  return (
                    <li key={id} className="flex items-center gap-2">
                      <span
                        className="inline-block size-2.5 rounded-full shrink-0"
                        style={{ background: player.color }}
                        aria-hidden
                      />
                      <span className="text-sm font-medium flex-1 truncate">
                        {player.name}
                      </span>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={100}
                          value={percentages[idx] ?? 0}
                          onChange={(e) => updatePct(idx, e.target.value)}
                          className="h-9 w-16 text-right tabular-nums"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                      <span className="tabular-nums font-semibold w-20 text-right">
                        {formatMoney(computedAmounts[idx] ?? 0)}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-baseline justify-between text-[11px] mt-1 pt-2 border-t border-border/40">
                <span
                  className={
                    pctSum !== 100
                      ? "text-muted-foreground"
                      : "text-[var(--mono-green)]"
                  }
                >
                  Shares sum to {pctSum}%
                  {pctSum !== 100 && pctSum > 0 && " (auto-normalized)"}
                </span>
                <span className="tabular-nums font-semibold text-foreground">
                  Total: {formatMoney(totalNum)}
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 h-12"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onSubmit}
              disabled={submitting || selected.length === 0 || totalNum <= 0}
              className="flex-1 h-12"
            >
              {submitting ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
