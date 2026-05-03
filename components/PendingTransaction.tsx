"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { REASON_LABELS, getAssetDef } from "@/lib/game/monopoly";
import type { Room, Transaction } from "@/lib/game/types";
import { formatMoney, cn } from "@/lib/utils";
import { api } from "@/lib/client/api";

const OBJECTION_WINDOW_MS = 10_000;

function nameOf(room: Room, id: string): string {
  if (id === "bank") return "Bank";
  return room.players.find((p) => p.id === id)?.name ?? "Unknown";
}

function summarize(room: Room, tx: Transaction): React.ReactNode {
  const reason = REASON_LABELS[tx.reason]?.label ?? tx.reason;

  if (tx.kind === "split") {
    return (
      <div className="text-sm flex flex-col gap-0.5">
        <div>
          <span className="font-medium">{nameOf(room, tx.proposedBy)}</span>{" "}
          splits to:
        </div>
        <ul className="ml-4 list-disc">
          {tx.splitChildren?.map((c, i) => (
            <li key={i}>
              {nameOf(room, c.toPlayerId)} —{" "}
              <span className="tabular-nums">{formatMoney(c.amount)}</span>
            </li>
          ))}
        </ul>
        <div className="text-muted-foreground text-xs mt-1">{reason}</div>
      </div>
    );
  }

  // Trade (asset-move with assets on both sides) — render explicit two-sided summary
  if (tx.kind === "asset-move") {
    const proposer = nameOf(room, tx.proposedBy);
    const partnerId =
      tx.requiresConfirmFrom.find((id) => id !== tx.proposedBy) ??
      tx.cash?.find((c) => c.fromPlayerId !== tx.proposedBy && c.fromPlayerId !== "bank")?.fromPlayerId ??
      tx.cash?.find((c) => c.toPlayerId !== tx.proposedBy && c.toPlayerId !== "bank")?.toPlayerId ??
      tx.assets?.find((a) => a.fromPlayerId !== tx.proposedBy && a.fromPlayerId !== "bank")?.fromPlayerId ??
      tx.assets?.find((a) => a.toPlayerId !== tx.proposedBy && a.toPlayerId !== "bank")?.toPlayerId ??
      "";
    const partner = partnerId ? nameOf(room, partnerId) : "—";

    const proposerGivesCash = (tx.cash ?? [])
      .filter((c) => c.fromPlayerId === tx.proposedBy)
      .reduce((s, c) => s + c.amount, 0);
    const partnerGivesCash = (tx.cash ?? [])
      .filter((c) => c.fromPlayerId === partnerId)
      .reduce((s, c) => s + c.amount, 0);
    const proposerGivesAssets = (tx.assets ?? []).filter(
      (a) => a.fromPlayerId === tx.proposedBy,
    );
    const partnerGivesAssets = (tx.assets ?? []).filter(
      (a) => a.fromPlayerId === partnerId,
    );

    return (
      <div className="text-sm flex flex-col gap-1">
        <div>
          <span className="font-medium">{proposer}</span>
          <span className="text-muted-foreground"> ⇄ </span>
          <span className="font-medium">{partner}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground">{proposer} gives</span>
            {proposerGivesCash > 0 && (
              <span className="tabular-nums">{formatMoney(proposerGivesCash)}</span>
            )}
            {proposerGivesAssets.map((a) => (
              <span key={a.defId}>{getAssetDef(a.defId)?.name ?? a.defId}</span>
            ))}
            {proposerGivesCash === 0 && proposerGivesAssets.length === 0 && (
              <span className="italic text-muted-foreground">nothing</span>
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground">{partner} gives</span>
            {partnerGivesCash > 0 && (
              <span className="tabular-nums">{formatMoney(partnerGivesCash)}</span>
            )}
            {partnerGivesAssets.map((a) => (
              <span key={a.defId}>{getAssetDef(a.defId)?.name ?? a.defId}</span>
            ))}
            {partnerGivesCash === 0 && partnerGivesAssets.length === 0 && (
              <span className="italic text-muted-foreground">nothing</span>
            )}
          </div>
        </div>
        <div className="text-muted-foreground text-xs">
          {reason}
          {tx.reasonNote ? ` · ${tx.reasonNote}` : ""}
        </div>
      </div>
    );
  }

  const cash = tx.cash?.[0];
  const asset = tx.assets?.[0];
  return (
    <div className="text-sm flex flex-col gap-0.5">
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
      <div className="text-muted-foreground text-xs">
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
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [isRequestBank, tx.objectionDeadline]);

  const remainingMs = tx.objectionDeadline
    ? Math.max(0, tx.objectionDeadline - now)
    : 0;
  const fraction = isRequestBank
    ? Math.max(0, Math.min(1, remainingMs / OBJECTION_WINDOW_MS))
    : 1;
  const remainingSec = Math.ceil(remainingMs / 1000);

  // Color shifts from accent (gold) → destructive as it approaches expiry
  const barColor =
    fraction > 0.5
      ? "var(--accent)"
      : fraction > 0.2
        ? "color-mix(in oklch, var(--accent) 50%, var(--destructive))"
        : "var(--destructive)";

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
    <motion.div
      layout
      initial={{ opacity: 0, y: -10, scale: 0.97 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: [1, 1.02, 1],
      }}
      transition={{
        opacity: { duration: 0.25 },
        y: { duration: 0.25 },
        scale: { duration: 0.5, times: [0, 0.5, 1] },
      }}
      className={cn(
        "border rounded-xl p-3 bg-card flex flex-col gap-2 relative overflow-hidden",
        "shadow-[0_1px_0_rgba(0,0,0,0.04),0_4px_18px_-8px_rgba(0,0,0,0.18)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">{summarize(room, tx)}</div>
        {isRequestBank && tx.objectionDeadline && (
          <div className="text-[11px] tabular-nums shrink-0 text-muted-foreground text-right">
            <div className="font-medium text-foreground">{remainingSec}s</div>
            <div>auto-confirms</div>
          </div>
        )}
      </div>

      {isRequestBank && tx.objectionDeadline && (
        <div className="h-1.5 rounded-full bg-muted overflow-hidden" aria-hidden>
          <motion.div
            initial={false}
            animate={{ width: `${fraction * 100}%` }}
            transition={{ ease: "linear", duration: 0.1 }}
            style={{ background: barColor }}
            className="h-full rounded-full"
          />
        </div>
      )}

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
    </motion.div>
  );
}
