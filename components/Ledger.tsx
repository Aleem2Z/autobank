"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Clock, XCircle, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REASON_LABELS, getAssetDef } from "@/lib/game/monopoly";
import type { Room, Transaction } from "@/lib/game/types";
import { formatMoney } from "@/lib/utils";
import { api } from "@/lib/client/api";

function StatusIcon({ status }: { status: Transaction["status"] }) {
  const cls = "size-3.5 shrink-0";
  switch (status) {
    case "pending":
      return <Clock className={`${cls} text-accent-foreground/70`} aria-label="pending" />;
    case "confirmed":
      return <CheckCircle2 className={`${cls} text-[var(--mono-green)]`} aria-label="confirmed" />;
    case "rejected":
      return <XCircle className={`${cls} text-destructive`} aria-label="rejected" />;
    case "reversed":
      return <Undo2 className={`${cls} text-muted-foreground`} aria-label="reversed" />;
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
  // For asset-move trades, prefer to show the cash leg if there is one,
  // otherwise the first asset.
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

  return (
    <section className="border rounded-xl p-3 bg-card flex flex-col gap-2">
      <header className="flex items-baseline justify-between">
        <h2 className="font-semibold text-sm">Ledger</h2>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {items.length} entr{items.length === 1 ? "y" : "ies"}
        </span>
      </header>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          No transactions yet. The first move will appear here.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          <AnimatePresence initial={false}>
            {items.map((tx) => {
              const { left, right, amount } = describe(room, tx);
              const reasonLabel = REASON_LABELS[tx.reason]?.label ?? tx.reason;
              const involved =
                tx.proposedBy === you || tx.requiresConfirmFrom.includes(you);
              const canUndo =
                tx.status === "confirmed" && !tx.reversedBy && involved;
              return (
                <motion.li
                  key={tx.id}
                  layout
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-center justify-between gap-2 border rounded-lg px-2.5 py-1.5 text-sm bg-background hover:bg-muted/40 transition-colors"
                >
                  <div className="flex flex-col min-w-0 gap-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <StatusIcon status={tx.status} />
                      <span className="truncate">
                        <span className="font-medium">{left}</span>
                        <span className="text-muted-foreground"> → </span>
                        <span className="font-medium">{right}</span>
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate pl-5">
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
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
