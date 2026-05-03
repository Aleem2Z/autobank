import type { Room, Transaction } from "./types";

export function validateProposal(room: Room, tx: Transaction): string | null {
  for (const m of tx.cash ?? []) {
    if (!Number.isFinite(m.amount) || m.amount <= 0) return "Amount must be positive.";
  }
  for (const c of tx.splitChildren ?? []) {
    if (!Number.isFinite(c.amount) || c.amount <= 0) return "Amount must be positive.";
  }

  if (room.mode === "official") {
    if (tx.kind === "p2p" && (tx.reason === "gift" || tx.reason === "loan")) {
      return "Gifts and loans are not allowed in official mode.";
    }
    if (tx.kind === "split") {
      return "Splits are not allowed in official mode.";
    }
  }

  if (tx.kind === "split") {
    const n = tx.splitChildren?.length ?? 0;
    if (n < 1 || n > 3) return "Split must have 1 to 3 recipients.";
    for (const c of tx.splitChildren!) {
      if (!room.players.some((p) => p.id === c.toPlayerId)) return "Unknown recipient.";
    }
  }

  for (const m of tx.cash ?? []) {
    if (m.fromPlayerId !== "bank" && !room.players.some((p) => p.id === m.fromPlayerId)) return "Unknown sender.";
    if (m.toPlayerId !== "bank" && !room.players.some((p) => p.id === m.toPlayerId)) return "Unknown recipient.";
  }

  return null;
}

export function canConfirm(tx: Transaction): boolean {
  return tx.requiresConfirmFrom.every((id) => tx.confirmedBy.includes(id));
}

export function applyTransaction(room: Room, tx: Transaction): Room {
  const players = room.players.map((p) => ({ ...p, assets: [...p.assets] }));
  const findPlayer = (id: string) => players.find((p) => p.id === id);

  for (const m of tx.cash ?? []) {
    if (m.fromPlayerId !== "bank") {
      const p = findPlayer(m.fromPlayerId);
      if (p) p.cash -= m.amount;
    }
    if (m.toPlayerId !== "bank") {
      const p = findPlayer(m.toPlayerId);
      if (p) p.cash += m.amount;
    }
  }

  for (const c of tx.splitChildren ?? []) {
    const sender = findPlayer(tx.proposedBy);
    const recipient = findPlayer(c.toPlayerId);
    if (sender) sender.cash -= c.amount;
    if (recipient) recipient.cash += c.amount;
  }

  for (const a of tx.assets ?? []) {
    if (a.fromPlayerId !== "bank") {
      const from = findPlayer(a.fromPlayerId);
      if (from) from.assets = from.assets.filter((x) => x.defId !== a.defId);
    }
    if (a.toPlayerId !== "bank") {
      const to = findPlayer(a.toPlayerId);
      if (to) to.assets.push({ defId: a.defId, mortgaged: a.mortgaged });
    }
  }

  return { ...room, players };
}

export function reverseTransaction(tx: Transaction): Transaction {
  const reverse = (m: { fromPlayerId: string; toPlayerId: string; amount: number }) => ({
    fromPlayerId: m.toPlayerId,
    toPlayerId: m.fromPlayerId,
    amount: m.amount,
  });
  return {
    ...tx,
    id: `${tx.id}-undo`,
    cash: tx.cash?.map(reverse),
    splitChildren: tx.splitChildren?.map((c) => ({ toPlayerId: tx.proposedBy, amount: c.amount })),
    assets: tx.assets?.map((a) => ({ ...a, fromPlayerId: a.toPlayerId, toPlayerId: a.fromPlayerId })),
    status: "confirmed",
    proposedAt: Date.now(),
  };
}
