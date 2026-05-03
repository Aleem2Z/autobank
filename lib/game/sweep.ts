import type { Room } from "./types";
import { applyTransaction } from "./rules";

export function sweepExpired(room: Room, now = Date.now()): { room: Room; promoted: string[] } {
  let next = room;
  const promoted: string[] = [];
  const txs = [...next.transactions];
  for (const tx of txs) {
    if (
      tx.status === "pending" &&
      tx.kind === "request-bank" &&
      tx.objectionDeadline &&
      tx.objectionDeadline <= now
    ) {
      tx.status = "confirmed";
      next = applyTransaction(next, tx);
      next.transactions = next.transactions.map((t) => (t.id === tx.id ? tx : t));
      promoted.push(tx.id);
    }
  }
  return { room: next, promoted };
}
