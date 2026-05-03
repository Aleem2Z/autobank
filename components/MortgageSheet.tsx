"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, CheckCircle, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PropertyCard } from "@/components/PropertyCard";
import { getAssetDef } from "@/lib/game/monopoly";
import type { Player, PlayerAsset, Room } from "@/lib/game/types";
import { api } from "@/lib/client/api";
import { formatMoney, cn } from "@/lib/utils";

/**
 * Click-a-property → mortgage / unmortgage flow.
 *
 * Mortgaging gives the player the listed mortgage value from the bank and
 * marks the deed face-down. Unmortgaging costs `mortgage + 10%` (standard
 * Monopoly rate, rounded up) — the deed flips back face-up.
 *
 * Both operations auto-confirm — you're acting on your own property,
 * there's nothing for other players to object to.
 */
export function MortgageSheet({
  asset,
  room,
  you,
  open,
  onClose,
}: {
  asset: PlayerAsset;
  room: Room;
  you: Player;
  open: boolean;
  onClose: () => void;
}) {
  const def = getAssetDef(asset.defId);
  const isMortgaged = !!asset.mortgaged;
  const mortgageValue = def?.mortgage ?? 0;
  const unmortgageCost = Math.ceil(mortgageValue * 1.1);
  const [submitting, setSubmitting] = useState(false);

  if (!def) return null;

  const action = isMortgaged ? "Unmortgage" : "Mortgage";
  const reason = isMortgaged ? "unmortgage" : "mortgage";
  const Icon = isMortgaged ? Unlock : Lock;
  const tone = isMortgaged
    ? "bg-received/15 text-received"
    : "bg-sent/15 text-sent";
  const cashAmount = isMortgaged ? unmortgageCost : mortgageValue;

  async function onSubmit() {
    if (submitting || !def) return;
    setSubmitting(true);
    try {
      await api.propose(room.code, {
        kind: "p2p",
        reason,
        reasonNote: isMortgaged
          ? `Unmortgage ${def.name}`
          : `Mortgage ${def.name}`,
        cash: isMortgaged
          ? [
              {
                fromPlayerId: you.id,
                toPlayerId: "bank",
                amount: unmortgageCost,
              },
            ]
          : [
              {
                fromPlayerId: "bank",
                toPlayerId: you.id,
                amount: mortgageValue,
              },
            ],
        // Self-move with the new mortgaged flag — applyTransaction filters
        // the deed out of the player's assets, then re-pushes it with the
        // updated flag.
        assets: [
          {
            defId: def.id,
            fromPlayerId: you.id,
            toPlayerId: you.id,
            mortgaged: !isMortgaged,
          },
        ],
      });
      toast.success(
        isMortgaged
          ? `Unmortgaged ${def.name}.`
          : `Mortgaged ${def.name}.`,
      );
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed.");
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
            <span
              className={cn(
                "size-12 rounded-full flex items-center justify-center shrink-0",
                tone,
              )}
            >
              <Icon className="size-6" strokeWidth={2.5} />
            </span>
            <div className="flex flex-col gap-1 min-w-0">
              <SheetTitle>{action} property</SheetTitle>
              <SheetDescription>
                {isMortgaged
                  ? `Pay ${formatMoney(unmortgageCost)} to the bank to bring ${def.name} back into play.`
                  : `Hand ${def.name} to the bank for ${formatMoney(mortgageValue)} cash. Reverse anytime.`}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-5 pb-32 overflow-y-auto items-center">
          {/* Card preview — flipped/desaturated when mortgaged */}
          <div className="my-2">
            <PropertyCard defId={def.id} asset={asset} size="lg" />
          </div>

          {/* Cash impact summary */}
          <div className="w-full rounded-2xl bg-surface-lowest p-4 shadow-soft flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-on-surface-variant text-sm">
                {isMortgaged ? (
                  <ArrowUpRight className="size-4 text-sent" strokeWidth={2.5} />
                ) : (
                  <ArrowDownLeft
                    className="size-4 text-received"
                    strokeWidth={2.5}
                  />
                )}
                {isMortgaged ? "You pay" : "You receive"}
              </div>
              <span
                className={cn(
                  "tabular-nums font-bold text-2xl",
                  isMortgaged ? "text-sent" : "text-received",
                )}
              >
                {isMortgaged ? "− " : "+ "}
                {formatMoney(cashAmount)}
              </span>
            </div>
            {!isMortgaged && (
              <p className="text-xs text-on-surface-variant">
                Unmortgaging later costs {formatMoney(unmortgageCost)} (
                {mortgageValue} +&nbsp;10% interest).
              </p>
            )}
            {you.cash < cashAmount && isMortgaged && (
              <p className="text-xs text-destructive">
                You only have {formatMoney(you.cash)} — short by{" "}
                {formatMoney(cashAmount - you.cash)}.
              </p>
            )}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 px-5 pt-4 pb-5 bg-gradient-to-t from-background via-background to-transparent flex flex-col gap-2">
          <Button
            type="button"
            onClick={onSubmit}
            disabled={submitting || (isMortgaged && you.cash < cashAmount)}
            className={cn(
              "h-14 rounded-full text-base font-semibold text-white active:scale-95 flex items-center justify-center gap-2",
              isMortgaged
                ? "bg-received hover:bg-received/90 shadow-[0_15px_40px_rgba(0,192,175,0.35)]"
                : "bg-sent hover:bg-sent/90 shadow-[0_15px_40px_rgba(253,137,70,0.35)]",
            )}
          >
            {submitting ? "Working…" : `${action} ${def.name}`}
            {!submitting && <CheckCircle className="size-5" />}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
