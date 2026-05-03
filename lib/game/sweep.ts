import type { Room, Transaction } from "./types";
import { applyTransaction, validateProposal } from "./rules";

export interface SweepResult {
  room: Room;
  promoted: string[];
  rejected: string[];
}

/**
 * Auto-confirms any pending tx whose objection window has passed.
 *
 * Two ways a sweep can resolve a tx:
 *   1. Promote to confirmed — applied to the room.
 *   2. Force reject — if any player objected, OR if revalidation fails
 *      (e.g. the buyer spent the money in the meantime).
 *
 * Pure: never mutates `room` or its tx objects. Returns a fresh array
 * with new tx instances so the in-memory store can't observe a half-
 * applied state before saveRoom lands.
 */
export function sweepExpired(
  room: Room,
  now = Date.now(),
): SweepResult {
  let next: Room = room;
  const promoted: string[] = [];
  const rejected: string[] = [];
  const updated: Transaction[] = [];

  for (const tx of next.transactions) {
    if (
      tx.status !== "pending" ||
      !tx.objectionDeadline ||
      tx.objectionDeadline > now
    ) {
      updated.push(tx);
      continue;
    }

    // Window has expired.
    const wasObjected = (tx.objections?.length ?? 0) > 0;
    if (wasObjected) {
      rejected.push(tx.id);
      updated.push({
        ...tx,
        status: "rejected",
        rejectedBy: tx.objections![0],
      });
      continue;
    }

    // Re-validate against the current (possibly stale) snapshot — the
    // payer may have spent the money or the property may now belong to
    // someone else. If revalidation fails, force-reject rather than
    // silently corrupting the ledger.
    const validationError = validateProposal(next, tx);
    if (validationError) {
      rejected.push(tx.id);
      updated.push({
        ...tx,
        status: "rejected",
        rejectedBy: tx.proposedBy,
        reasonNote: tx.reasonNote
          ? `${tx.reasonNote} (auto-rejected: ${validationError})`
          : `auto-rejected: ${validationError}`,
      });
      continue;
    }

    const confirmed: Transaction = { ...tx, status: "confirmed" };
    next = applyTransaction(
      { ...next, transactions: updated },
      confirmed,
    );
    updated.push(confirmed);
    promoted.push(tx.id);
  }

  next = { ...next, transactions: updated };
  return { room: next, promoted, rejected };
}
