"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { REASON_LABELS, getAssetDef } from "@/lib/game/monopoly";
import type { Room, Transaction } from "@/lib/game/types";
import { formatMoney } from "@/lib/utils";
import { api } from "@/lib/client/api";

function nameOf(room: Room, id: string): string {
  if (id === "bank") return "Bank";
  return room.players.find((p) => p.id === id)?.name ?? "Unknown";
}

function summarize(room: Room, tx: Transaction): React.ReactNode {
  const reason = REASON_LABELS[tx.reason]?.label ?? tx.reason;

  if (tx.kind === "split") {
    return (
      <div className="text-sm">
        <div>
          <span className="font-medium">{nameOf(room, tx.proposedBy)}</span>{" "}
          splits to:
        </div>
        <ul className="ml-4 list-disc">
          {tx.splitChildren?.map((c, i) => (
            <li key={i}>
              {nameOf(room, c.toPlayerId)} — {formatMoney(c.amount)}
            </li>
          ))}
        </ul>
        <div className="text-muted-foreground text-xs mt-1">{reason}</div>
      </div>
    );
  }

  const cash = tx.cash?.[0];
  const asset = tx.assets?.[0];
  return (
    <div className="text-sm">
      {cash && (
        <div>
          <span className="font-medium">{nameOf(room, cash.fromPlayerId)}</span>
          <span className="text-muted-foreground"> → </span>
          <span className="font-medium">{nameOf(room, cash.toPlayerId)}</span>
          <span className="ml-2 tabular-nums">{formatMoney(cash.amount)}</span>
        </div>
      )}
      {asset && (
        <div className="text-xs text-muted-foreground">
          asset: {getAssetDef(asset.defId)?.name ?? asset.defId}
          {" — "}
          {nameOf(room, asset.fromPlayerId)} → {nameOf(room, asset.toPlayerId)}
        </div>
      )}
      <div className="text-muted-foreground text-xs mt-1">
        {reason}
        {tx.reasonNote ? ` · ${tx.reasonNote}` : ""}
      </div>
    </div>
  );
}

export function PendingTransaction({
  room,
  you,
  tx,
}: {
  room: Room;
  you: string;
  tx: Transaction;
}) {
  const [busy, setBusy] = useState<null | "confirm" | "reject">(null);
  const [now, setNow] = useState(Date.now());

  const isRequestBank = tx.kind === "request-bank";
  const canConfirm =
    !isRequestBank &&
    tx.requiresConfirmFrom.includes(you) &&
    !tx.confirmedBy.includes(you);

  useEffect(() => {
    if (!isRequestBank || !tx.objectionDeadline) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [isRequestBank, tx.objectionDeadline]);

  const remaining = tx.objectionDeadline
    ? Math.max(0, Math.ceil((tx.objectionDeadline - now) / 1000))
    : 0;

  async function decide(decision: "confirm" | "reject" | "object") {
    setBusy(decision === "confirm" ? "confirm" : "reject");
    try {
      await api.decide(room.code, tx.id, decision);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Decision failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="border rounded-lg p-3 bg-card flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">{summarize(room, tx)}</div>
        {isRequestBank && tx.objectionDeadline && (
          <div className="text-xs tabular-nums shrink-0 text-muted-foreground">
            {remaining > 0 ? `auto-confirms in ${remaining}s` : "confirming..."}
          </div>
        )}
      </div>
      <div className="flex gap-2">
        {isRequestBank ? (
          <Button
            size="sm"
            variant="destructive"
            disabled={busy !== null}
            onClick={() => decide("object")}
            className="flex-1"
          >
            Object
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              variant="destructive"
              disabled={busy !== null}
              onClick={() => decide("reject")}
              className="flex-1"
            >
              Reject
            </Button>
            <Button
              size="sm"
              disabled={busy !== null || !canConfirm}
              onClick={() => decide("confirm")}
              className="flex-1"
            >
              Confirm
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
