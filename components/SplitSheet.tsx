"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle, Split as SplitIcon } from "lucide-react";
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
import { formatMoney, cn } from "@/lib/utils";

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
        className="h-auto max-h-[92vh] sm:max-w-lg sm:mx-auto overflow-hidden flex flex-col bg-background border-0"
      >
        <SheetHeader>
          <div className="flex items-start gap-3">
            <span className="size-12 rounded-full bg-brand/15 text-brand flex items-center justify-center shrink-0">
              <SplitIcon className="size-6" strokeWidth={2.5} />
            </span>
            <div className="flex flex-col gap-1 min-w-0">
              <SheetTitle>Split</SheetTitle>
              <SheetDescription>
                Split a total amount between up to {MAX_RECIPIENTS} other
                players. Even shares by default — adjust if you like.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-5 pb-32 overflow-y-auto">
          <div className="flex flex-col gap-2">
            <Label htmlFor="split-total" className="text-[13px] font-semibold">
              Total amount
            </Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-on-surface-variant pointer-events-none">
                $
              </span>
              <Input
                id="split-total"
                type="number"
                inputMode="numeric"
                min={1}
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                placeholder="0"
                className="h-16 pl-10 pr-4 text-2xl font-bold tabular-nums tracking-tight rounded-2xl bg-surface border-transparent focus-visible:bg-surface-lowest focus-visible:border-brand"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <Label className="text-[13px] font-semibold">
                Recipients ({selected.length}/{MAX_RECIPIENTS})
              </Label>
              {selected.length > 1 && (
                <button
                  type="button"
                  onClick={distributeEvenly}
                  className="text-[11px] font-semibold text-brand hover:underline"
                >
                  Distribute evenly
                </button>
              )}
            </div>
            <div className="flex gap-2 overflow-x-auto hide-scrollbar -mx-1 px-1 pb-1 snap-x">
              {others.map((p) => {
                const on = selected.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
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
          </div>

          {selected.length > 0 && (
            <div className="flex flex-col gap-3 rounded-2xl bg-surface-lowest p-4 shadow-soft">
              <div className="text-[11px] uppercase tracking-[0.06em] font-semibold text-on-surface-variant">
                Shares
              </div>
              <ul className="flex flex-col gap-3">
                {selected.map((id, idx) => {
                  const player = room.players.find((p) => p.id === id);
                  if (!player) return null;
                  return (
                    <li key={id} className="flex items-center gap-3">
                      <span
                        className="size-8 rounded-full shrink-0 flex items-center justify-center text-white font-bold text-xs"
                        style={{ background: player.color }}
                        aria-hidden
                      >
                        {player.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="text-sm font-semibold flex-1 truncate text-foreground">
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
                          className="h-10 w-16 text-right tabular-nums rounded-xl bg-surface border-transparent focus-visible:bg-surface-lowest focus-visible:border-brand"
                        />
                        <span className="text-xs text-on-surface-variant">%</span>
                      </div>
                      <span className="tabular-nums font-bold w-20 text-right text-foreground">
                        {formatMoney(computedAmounts[idx] ?? 0)}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-baseline justify-between text-[11px] mt-1 pt-3 border-t border-surface">
                <span
                  className={cn(
                    "font-semibold",
                    pctSum !== 100
                      ? "text-on-surface-variant"
                      : "text-received",
                  )}
                >
                  Shares sum to {pctSum}%
                  {pctSum !== 100 && pctSum > 0 && " (auto-normalized)"}
                </span>
                <span className="tabular-nums font-bold text-foreground">
                  Total: {formatMoney(totalNum)}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 px-5 pt-4 pb-5 bg-gradient-to-t from-background via-background to-transparent flex flex-col gap-2">
          <Button
            type="button"
            onClick={onSubmit}
            disabled={submitting || selected.length === 0 || totalNum <= 0}
            className="h-14 rounded-full text-base font-semibold bg-brand text-white shadow-ambient-brand hover:bg-brand/90 active:scale-95 flex items-center justify-center gap-2"
          >
            {submitting ? "Sending..." : "Send Split"}
            {!submitting && <CheckCircle className="size-5" />}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
