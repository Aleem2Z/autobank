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
    const total = tx.splitChildren?.reduce((s, c) => s + c.amount, 0) ?? 0;
    return (
      <div className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <div
            className="text-base font-semibold leading-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            <span>{nameOf(room, tx.proposedBy)}</span>
            <span className="text-muted-foreground font-normal"> splits </span>
          </div>
          <span className="text-2xl font-black tracking-tight tabular-nums leading-none">
            {formatMoney(total)}
          </span>
        </div>
        <ul className="text-sm text-muted-foreground flex flex-col gap-0.5">
          {tx.splitChildren?.map((c, i) => (
            <li key={i} className="flex justify-between">
              <span>{nameOf(room, c.toPlayerId)}</span>
              <span className="tabular-nums font-medium text-foreground">
                {formatMoney(c.amount)}
              </span>
            </li>
          ))}
        </ul>
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/80">
          {reason}
          {tx.reasonNote ? ` · ${tx.reasonNote}` : ""}
        </div>
      </div>
    );
  }

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
      <div className="flex flex-col gap-2.5">
        <div
          className="text-base font-semibold leading-tight"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          <span>{proposer}</span>
          <span className="text-muted-foreground font-normal"> ⇄ </span>
          <span>{partner}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[13px]">
          <div className="flex flex-col gap-0.5 rounded-xl bg-muted/40 px-3 py-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {proposer} gives
            </span>
            {proposerGivesCash > 0 && (
              <span className="tabular-nums font-semibold">{formatMoney(proposerGivesCash)}</span>
            )}
            {proposerGivesAssets.map((a) => (
              <span key={a.defId} className="text-foreground/80">
                {getAssetDef(a.defId)?.name ?? a.defId}
              </span>
            ))}
            {proposerGivesCash === 0 && proposerGivesAssets.length === 0 && (
              <span className="italic text-muted-foreground">nothing</span>
            )}
          </div>
          <div className="flex flex-col gap-0.5 rounded-xl bg-muted/40 px-3 py-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {partner} gives
            </span>
            {partnerGivesCash > 0 && (
              <span className="tabular-nums font-semibold">{formatMoney(partnerGivesCash)}</span>
            )}
            {partnerGivesAssets.map((a) => (
              <span key={a.defId} className="text-foreground/80">
                {getAssetDef(a.defId)?.name ?? a.defId}
              </span>
            ))}
            {partnerGivesCash === 0 && partnerGivesAssets.length === 0 && (
              <span className="italic text-muted-foreground">nothing</span>
            )}
          </div>
        </div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/80">
          {reason}
          {tx.reasonNote ? ` · ${tx.reasonNote}` : ""}
        </div>
      </div>
    );
  }

  const cash = tx.cash?.[0];
  const asset = tx.assets?.[0];
  return (
    <div className="flex flex-col gap-2">
      {cash && (
        <div className="flex items-baseline justify-between gap-3">
          <div
            className="text-base font-semibold leading-tight min-w-0"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            <span>{nameOf(room, cash.fromPlayerId)}</span>
            <span className="text-muted-foreground font-normal"> → </span>
            <span>{nameOf(room, cash.toPlayerId)}</span>
          </div>
          <span className="text-2xl font-black tracking-tight tabular-nums leading-none shrink-0">
            {formatMoney(cash.amount)}
          </span>
        </div>
      )}
      {asset && (
        <div className="text-[12px] text-muted-foreground">
          {getAssetDef(asset.defId)?.name ?? asset.defId}
          <span className="opacity-60">
            {" "}
            · {nameOf(room, asset.fromPlayerId)} → {nameOf(room, asset.toPlayerId)}
          </span>
        </div>
      )}
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/80">
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
      initial={{ opacity: 0, y: -12, scale: 0.96 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: [1, 1.015, 1],
      }}
      transition={{
        opacity: { duration: 0.2 },
        y: { type: "spring", stiffness: 300, damping: 25 },
        scale: { duration: 0.55, times: [0, 0.55, 1] },
      }}
      className={cn(
        "border border-border/60 rounded-2xl bg-card flex flex-col relative overflow-hidden",
        "shadow-[0_2px_0_rgba(0,0,0,0.04),0_18px_36px_-22px_rgba(20,80,50,0.30)]",
      )}
    >
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="min-w-0 flex-1">{summarize(room, tx)}</div>
        {isRequestBank && tx.objectionDeadline && (
          <div className="text-right shrink-0">
            <div
              className="text-2xl font-black tabular-nums leading-none"
              style={{ color: barColor }}
            >
              {remainingSec}
              <span className="text-xs font-bold align-baseline ml-0.5">s</span>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
              auto-confirms
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 px-4 pb-4">
        {isRequestBank ? (
          <Button
            size="lg"
            variant="destructive"
            disabled={busy !== null}
            onClick={() => decide("object")}
            className="flex-1 h-11 rounded-xl text-sm font-semibold"
          >
            Object
          </Button>
        ) : (
          <>
            <Button
              size="lg"
              variant="destructive"
              disabled={busy !== null}
              onClick={() => decide("reject")}
              className="flex-1 h-11 rounded-xl text-sm font-semibold"
            >
              Reject
            </Button>
            <Button
              size="lg"
              disabled={busy !== null || !canConfirm}
              onClick={() => decide("confirm")}
              className="flex-1 h-11 rounded-xl text-sm font-semibold"
            >
              Confirm
            </Button>
          </>
        )}
      </div>

      {/* Full-card-width countdown bar */}
      {isRequestBank && tx.objectionDeadline && (
        <div className="h-1 bg-muted/60" aria-hidden>
          <motion.div
            initial={false}
            animate={{ width: `${fraction * 100}%` }}
            transition={{ ease: "linear", duration: 0.1 }}
            style={{ background: barColor }}
            className="h-full"
          />
        </div>
      )}
    </motion.div>
  );
}
