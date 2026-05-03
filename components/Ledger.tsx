"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { REASON_LABELS, getAssetDef } from "@/lib/game/monopoly";
import type { Room, Transaction } from "@/lib/game/types";
import { formatMoney } from "@/lib/utils";
import { api } from "@/lib/client/api";

function statusIcon(status: Transaction["status"]) {
  switch (status) {
    case "pending":
      return "⏳";
    case "confirmed":
      return "✓";
    case "rejected":
      return "✕";
    case "reversed":
      return "↺";
  }
}

function nameOf(room: Room, id: string): string {
  if (id === "bank") return "Bank";
  return room.players.find((p) => p.id === id)?.name ?? "Unknown";
}

function describe(room: Room, tx: Transaction): { left: string; right: string; amount: number | null } {
  if (tx.kind === "split") {
    const total = tx.splitChildren?.reduce((s, c) => s + c.amount, 0) ?? 0;
    const recipients = tx.splitChildren?.map((c) => nameOf(room, c.toPlayerId)).join(", ") ?? "";
    return { left: nameOf(room, tx.proposedBy), right: recipients || "split", amount: total };
  }
  const cash = tx.cash?.[0];
  if (cash) {
    return {
      left: nameOf(room, cash.fromPlayerId),
      right: nameOf(room, cash.toPlayerId),
      amount: cash.amount,
    };
  }
  const asset = tx.assets?.[0];
  if (asset) {
    const def = getAssetDef(asset.defId);
    return {
      left: nameOf(room, asset.fromPlayerId),
      right: `${nameOf(room, asset.toPlayerId)} (${def?.name ?? asset.defId})`,
      amount: null,
    };
  }
  return { left: nameOf(room, tx.proposedBy), right: "", amount: null };
}

export function Ledger({ room, you }: { room: Room; you: string }) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const items = [...room.transactions]
    .sort((a, b) => b.proposedAt - a.proposedAt)
    .slice(0, 30);

  async function onUndo(id: string) {
    setBusyId(id);
    try {
      await api.undo(room.code, id);
      toast.success("Reversed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not undo.");
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return (
      <section className="border rounded-lg p-3 bg-card">
        <h2 className="font-medium mb-1">Ledger</h2>
        <p className="text-sm text-muted-foreground">No transactions yet.</p>
      </section>
    );
  }

  return (
    <section className="border rounded-lg p-3 bg-card flex flex-col gap-2">
      <h2 className="font-medium">Ledger</h2>
      <ul className="flex flex-col gap-1.5">
        {items.map((tx) => {
          const { left, right, amount } = describe(room, tx);
          const reasonLabel = REASON_LABELS[tx.reason]?.label ?? tx.reason;
          const involved =
            tx.proposedBy === you || tx.requiresConfirmFrom.includes(you);
          const canUndo =
            tx.status === "confirmed" && !tx.reversedBy && involved;
          return (
            <li
              key={tx.id}
              className="flex items-center justify-between gap-2 border rounded px-2 py-1.5 text-sm"
            >
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span aria-hidden>{statusIcon(tx.status)}</span>
                  <span className="truncate">
                    <span className="font-medium">{left}</span>
                    <span className="text-muted-foreground"> → </span>
                    <span className="font-medium">{right}</span>
                  </span>
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {reasonLabel}
                  {tx.reasonNote ? ` · ${tx.reasonNote}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {amount !== null && (
                  <span className="tabular-nums font-medium">
                    {formatMoney(amount)}
                  </span>
                )}
                {canUndo && (
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={busyId === tx.id}
                    onClick={() => onUndo(tx.id)}
                  >
                    Undo
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
