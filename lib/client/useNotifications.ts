"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Room, Transaction } from "@/lib/game/types";
import { REASON_LABELS } from "@/lib/game/monopoly";
import { formatMoney } from "@/lib/utils";
import { playSound } from "./sound";

/**
 * Diff-based notification engine. Sits on top of `useRoom`.
 *
 * Fires one toast + one sound per *new* event since the previous snapshot.
 * Crucially:
 *   - Never fires on the very first render (when prev snapshot is null) —
 *     otherwise opening a room would flood the user with stale toasts.
 *   - Tracks already-notified tx ids in a ref so SSE replay / duplicate
 *     deliveries don't double-fire.
 *   - Does not duplicate the local-action toasts that components fire
 *     themselves (e.g. "Trade proposed."). It only notifies on:
 *       - inbound events for txs where you didn't initiate, AND
 *       - confirmations / rejections of txs you DID propose.
 */

type NotifiedKey = string; // `${tx.id}:${notificationType}`

function nameOf(room: Room, id: string): string {
  if (id === "bank") return "Bank";
  return room.players.find((p) => p.id === id)?.name ?? "Someone";
}

function reasonLabel(tx: Transaction): string {
  return REASON_LABELS[tx.reason]?.label ?? tx.reason;
}

function youReceiveAmount(tx: Transaction, you: string): number {
  let total = 0;
  for (const c of tx.cash ?? []) {
    if (c.toPlayerId === you && c.fromPlayerId !== you) total += c.amount;
  }
  for (const c of tx.splitChildren ?? []) {
    if (c.toPlayerId === you) total += c.amount;
  }
  return total;
}

function describeForConfirm(tx: Transaction, room: Room, you: string): string {
  const proposerName = nameOf(room, tx.proposedBy);
  const reason = reasonLabel(tx);

  if (tx.kind === "split") {
    const myShare = (tx.splitChildren ?? [])
      .filter((c) => c.toPlayerId === you)
      .reduce((s, c) => s + c.amount, 0);
    if (myShare > 0) {
      return `${proposerName} wants to send you ${formatMoney(myShare)} (${reason})`;
    }
    return `${proposerName} proposed a split (${reason})`;
  }

  if (tx.kind === "asset-move") {
    return `${proposerName} proposed a trade (${reason})`;
  }

  // p2p / pay-bank: there's a primary cash leg
  const cash = tx.cash?.[0];
  if (cash) {
    if (cash.toPlayerId === you) {
      return `${proposerName} wants to pay you ${formatMoney(cash.amount)} (${reason})`;
    }
    if (cash.fromPlayerId === you) {
      return `${proposerName} wants you to pay ${formatMoney(cash.amount)} (${reason})`;
    }
  }
  return `${proposerName} needs your confirmation (${reason})`;
}

function describeForObject(tx: Transaction, room: Room): string {
  const proposerName = nameOf(room, tx.proposedBy);
  const reason = reasonLabel(tx);

  // Buy from bank: "X is buying Boardwalk for $400 — tap to object"
  if (tx.kind === "pay-bank" && (tx.assets?.length ?? 0) > 0) {
    const assetIds = (tx.assets ?? [])
      .filter((a) => a.toPlayerId === tx.proposedBy)
      .map((a) => a.defId);
    const names = assetIds
      .map((id) => REASON_LABELS[id as never] ? id : id) // fall back to id
      .join(", ");
    const cash = (tx.cash ?? [])
      .filter((c) => c.fromPlayerId === tx.proposedBy && c.toPlayerId === "bank")
      .reduce((s, c) => s + c.amount, 0);
    const cashStr = cash > 0 ? ` for ${formatMoney(cash)}` : "";
    return `${proposerName} is buying ${names || "a property"}${cashStr} — tap to object (${reason})`;
  }

  // Request from bank: "X is requesting $200 from the Bank"
  const amount = (tx.cash ?? [])
    .filter((c) => c.fromPlayerId === "bank" && c.toPlayerId === tx.proposedBy)
    .reduce((s, c) => s + c.amount, 0);
  const amountStr = amount > 0 ? formatMoney(amount) : "money";
  return `${proposerName} is requesting ${amountStr} from the Bank — tap to object (${reason})`;
}

function describeReceive(tx: Transaction, room: Room, you: string): string {
  const amount = youReceiveAmount(tx, you);
  const reason = reasonLabel(tx);
  // Find a meaningful "from" — prefer a non-bank, non-you sender.
  const fromId =
    tx.cash?.find((c) => c.toPlayerId === you && c.fromPlayerId !== you)
      ?.fromPlayerId ?? tx.proposedBy;
  return `+${formatMoney(amount)} from ${nameOf(room, fromId)} (${reason})`;
}

function scrollToPending(): void {
  if (typeof document === "undefined") return;
  // Pending section uses h2 "Pending action"; we fall back to the first
  // pending card if we can't find the heading.
  const heading = Array.from(document.querySelectorAll("h2")).find((el) =>
    el.textContent?.trim().startsWith("Pending action"),
  );
  const target = heading ?? document.querySelector("[data-pending-tx]");
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function useNotifications(room: Room | null, you: string | null): void {
  const prevRoomRef = useRef<Room | null>(null);
  const notifiedRef = useRef<Set<NotifiedKey>>(new Set());
  const prevPlayerIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!room || !you) return;

    const prev = prevRoomRef.current;
    const isFirstSnapshot = prev === null;
    const notified = notifiedRef.current;

    // ---- player join detection ----
    const currentIds = new Set(room.players.map((p) => p.id));
    if (!isFirstSnapshot && prevPlayerIdsRef.current) {
      for (const p of room.players) {
        if (!prevPlayerIdsRef.current.has(p.id) && p.id !== you) {
          const key = `join:${p.id}` as NotifiedKey;
          if (!notified.has(key)) {
            notified.add(key);
            toast(`${p.name} joined the room`);
            playSound("join");
          }
        }
      }
    }
    prevPlayerIdsRef.current = currentIds;

    // ---- transaction event detection ----
    if (!isFirstSnapshot) {
      const prevTxById = new Map<string, Transaction>(
        prev!.transactions.map((t) => [t.id, t]),
      );

      for (const tx of room.transactions) {
        const before = prevTxById.get(tx.id);
        const youProposed = tx.proposedBy === you;

        // 1) NEW pending tx (didn't exist before, or transitioned to pending)
        const becamePending =
          tx.status === "pending" && (!before || before.status !== "pending");

        if (becamePending && !youProposed) {
          // You can object (any tx with an objection window)
          if (tx.objectionDeadline) {
            const key = `${tx.id}:object` as NotifiedKey;
            if (!notified.has(key)) {
              notified.add(key);
              toast.warning(describeForObject(tx, room), {
                action: { label: "Open", onClick: scrollToPending },
              });
              playSound("prompt");
            }
          } else if (
            tx.requiresConfirmFrom.includes(you) &&
            !tx.confirmedBy.includes(you)
          ) {
            // You must confirm
            const key = `${tx.id}:confirm` as NotifiedKey;
            if (!notified.has(key)) {
              notified.add(key);
              toast.info(describeForConfirm(tx, room, you), {
                action: { label: "Open", onClick: scrollToPending },
              });
              playSound("prompt");
            }
          }
        }

        // 2) Status transition: pending -> confirmed / rejected / reversed
        const statusChanged = before && before.status !== tx.status;

        if (statusChanged) {
          if (tx.status === "confirmed") {
            // (a) Your proposal was confirmed
            if (youProposed) {
              const key = `${tx.id}:proposer-confirmed` as NotifiedKey;
              if (!notified.has(key)) {
                notified.add(key);
                const partner =
                  tx.cash?.find((c) => c.toPlayerId !== you && c.toPlayerId !== "bank")
                    ?.toPlayerId ??
                  tx.requiresConfirmFrom.find((id) => id !== you);
                if (tx.kind === "asset-move" && partner) {
                  toast.success(`Trade with ${nameOf(room, partner)} completed`);
                } else if (tx.cash?.[0]) {
                  const c = tx.cash[0];
                  toast.success(
                    `Your ${formatMoney(c.amount)} to ${nameOf(room, c.toPlayerId)} was confirmed`,
                  );
                } else {
                  toast.success("Your proposal was confirmed");
                }
                playSound("success");
              }
            }

            // (b) You receive money on a confirmed tx (and didn't propose it).
            //     Skip if you already got the proposer-confirmed toast above
            //     (i.e. you're both proposer and recipient — shouldn't happen,
            //     but guard anyway).
            if (!youProposed && youReceiveAmount(tx, you) > 0) {
              const key = `${tx.id}:received` as NotifiedKey;
              if (!notified.has(key)) {
                notified.add(key);
                toast.success(describeReceive(tx, room, you));
                playSound("coins");
              }
            }
          } else if (tx.status === "rejected") {
            if (youProposed) {
              const key = `${tx.id}:rejected` as NotifiedKey;
              if (!notified.has(key)) {
                notified.add(key);
                const rejecterId = tx.rejectedBy ?? "";
                const rejecter = rejecterId ? nameOf(room, rejecterId) : "Recipient";
                const cash = tx.cash?.[0];
                const what = cash
                  ? `${formatMoney(cash.amount)} transfer`
                  : tx.kind === "asset-move"
                    ? "trade"
                    : "proposal";
                toast.error(`${rejecter} rejected your ${what}`);
                playSound("error");
              }
            }
          } else if (tx.status === "reversed") {
            // Notify everyone involved (except whoever did the reversal).
            const involved =
              tx.cash?.some(
                (c) => c.fromPlayerId === you || c.toPlayerId === you,
              ) ||
              tx.splitChildren?.some((c) => c.toPlayerId === you) ||
              tx.assets?.some(
                (a) => a.fromPlayerId === you || a.toPlayerId === you,
              ) ||
              tx.proposedBy === you;
            const reverser = tx.reversedBy ?? "";
            if (involved && reverser && reverser !== you) {
              const key = `${tx.id}:reversed` as NotifiedKey;
              if (!notified.has(key)) {
                notified.add(key);
                const cash = tx.cash?.[0];
                const what = cash
                  ? `the ${formatMoney(cash.amount)} transfer`
                  : "a transaction";
                toast(`${nameOf(room, reverser)} undid ${what}`);
                playSound("revert");
              }
            }
          }
        }
      }
    }

    prevRoomRef.current = room;
  }, [room, you]);
}
