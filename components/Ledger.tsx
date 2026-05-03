"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Clock, XCircle, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REASON_LABELS, getAssetDef } from "@/lib/game/monopoly";
import type { Room, Transaction } from "@/lib/game/types";
import { formatMoney, cn } from "@/lib/utils";
import { api } from "@/lib/client/api";

function StatusChip({ status }: { status: Transaction["status"] }) {
  const map = {
    pending: {
      Icon: Clock,
      label: "Pending",
      cls: "text-accent-foreground/80 bg-accent/15",
    },
    confirmed: {
      Icon: CheckCircle2,
      label: "Done",
      cls: "text-[var(--mono-green)] bg-[color-mix(in_oklch,var(--mono-green)_14%,transparent)]",
    },
    rejected: {
      Icon: XCircle,
      label: "Rejected",
      cls: "text-destructive bg-destructive/10",
    },
    reversed: {
      Icon: Undo2,
      label: "Reversed",
      cls: "text-muted-foreground bg-muted",
    },
  } as const;
  const { Icon, label, cls } = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide",
        cls,
      )}
      aria-label={status}
    >
      <Icon className="size-2.5" />
      {label}
    </span>
  );
}

function nameOf(room: Room, id: string): string {
  if (id === "bank") return "Bank";
  return room.players.find((p) => p.id === id)?.name ?? "Unknown";
}

interface Described {
  left: string;
  right: string;
  amount: number | null;
  /** From the viewer's perspective: +1 if money came IN, -1 if money went OUT, 0 if neutral. */
  signForViewer: 1 | -1 | 0;
}

function describe(room: Room, tx: Transaction, you: string): Described {
  if (tx.kind === "split") {
    const total = tx.splitChildren?.reduce((s, c) => s + c.amount, 0) ?? 0;
    const recipients = tx.splitChildren?.map((c) => nameOf(room, c.toPlayerId)).join(", ") ?? "";
    let signForViewer: 1 | -1 | 0 = 0;
    if (tx.proposedBy === you) signForViewer = -1;
    else if (tx.splitChildren?.some((c) => c.toPlayerId === you)) signForViewer = 1;
    return {
      left: nameOf(room, tx.proposedBy),
      right: recipients || "split",
      amount: total,
      signForViewer,
    };
  }
  const cash = tx.cash?.[0];
  if (cash) {
    let signForViewer: 1 | -1 | 0 = 0;
    if (cash.toPlayerId === you) signForViewer = 1;
    else if (cash.fromPlayerId === you) signForViewer = -1;
    return {
      left: nameOf(room, cash.fromPlayerId),
      right: nameOf(room, cash.toPlayerId),
      amount: cash.amount,
      signForViewer,
    };
  }
  const asset = tx.assets?.[0];
  if (asset) {
    const def = getAssetDef(asset.defId);
    return {
      left: nameOf(room, asset.fromPlayerId),
      right: `${nameOf(room, asset.toPlayerId)} (${def?.name ?? asset.defId})`,
      amount: null,
      signForViewer: 0,
    };
  }
  return {
    left: nameOf(room, tx.proposedBy),
    right: "",
    amount: null,
    signForViewer: 0,
  };
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
    <section className="rounded-2xl bg-card border border-border/60 flex flex-col">
      <header className="flex items-baseline justify-between px-4 pt-3.5 pb-2">
        <h2 className="text-[10px] uppercase tracking-[0.28em] font-medium text-muted-foreground">
          Ledger
        </h2>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {items.length} {items.length === 1 ? "entry" : "entries"}
        </span>
      </header>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic px-4 pb-4">
          No transactions yet. The first move will appear here.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/40 px-1 pb-1">
          <AnimatePresence initial={false}>
            {items.map((tx) => {
              const { left, right, amount, signForViewer } = describe(
                room,
                tx,
                you,
              );
              const reasonLabel = REASON_LABELS[tx.reason]?.label ?? tx.reason;
              const involved =
                tx.proposedBy === you || tx.requiresConfirmFrom.includes(you);
              const canUndo =
                tx.status === "confirmed" && !tx.reversedBy && involved;

              const amountColor =
                tx.status === "reversed" || tx.status === "rejected"
                  ? "text-muted-foreground line-through"
                  : signForViewer === 1
                    ? "text-[var(--mono-green)]"
                    : signForViewer === -1
                      ? "text-destructive"
                      : "text-foreground";
              const sign =
                signForViewer === 1 ? "+" : signForViewer === -1 ? "−" : "";

              return (
                <motion.li
                  key={tx.id}
                  layout
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className="flex flex-col min-w-0 gap-0.5 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <StatusChip status={tx.status} />
                      <span className="truncate text-[13px]">
                        <span className="font-semibold text-foreground">
                          {left}
                        </span>
                        <span className="text-muted-foreground"> → </span>
                        <span className="font-semibold text-foreground">
                          {right}
                        </span>
                      </span>
                    </div>
                    <div className="text-[12px] truncate flex items-baseline gap-1.5">
                      <span className="text-muted-foreground/80 uppercase tracking-wider text-[10px] font-medium">
                        {reasonLabel}
                      </span>
                      {tx.reasonNote && (
                        <span className="text-foreground/80 truncate italic">
                          &ldquo;{tx.reasonNote}&rdquo;
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {amount !== null && (
                      <span
                        className={cn(
                          "tabular-nums font-bold text-[15px]",
                          amountColor,
                        )}
                      >
                        {sign}
                        {formatMoney(amount).replace(/^-/, "")}
                      </span>
                    )}
                    {canUndo && (
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={busyId === tx.id}
                        onClick={() => onUndo(tx.id)}
                        className="rounded-lg"
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
