import type { ReasonPreset, Room, Transaction, TxKind } from "./types";
import { MONOPOLY_US } from "./monopoly";

const VALID_DEF_IDS = new Set(MONOPOLY_US.map((a) => a.id));

/**
 * The bank only pays out for these three reasons. Real Monopoly: GO, plus
 * Chance / Community Chest cards that read "Bank pays you …". Mortgaging
 * and selling buildings also pay the player but they go through their
 * own asset-bound flow (MortgageSheet), not the generic Request-Bank UI.
 *
 * Locked down server-side so that even a manually-crafted API request
 * can't open the bank for "loan" or "gift".
 */
export const REQUEST_BANK_ALLOWED_REASONS: ReasonPreset[] = [
  "pass-go",
  "chance",
  "community-chest",
];

/**
 * Server-side data validation for a proposed transaction.
 *
 * Two layers of checks:
 *   1. Structural: amounts are positive integers, kind/payload coherence,
 *      asset def exists, official-mode rules.
 *   2. Authority: the proposer can only debit themselves and direct bank
 *      flows toward themselves. This kills the "wire money out of someone
 *      else's wallet" cheat where the body claims fromPlayerId=victim.
 *   3. Solvency: every non-bank payer has the cash to cover their outgoing
 *      legs in this single tx. Re-checked at apply time too because the
 *      snapshot can be stale by the time a dual-confirm trade commits.
 *   4. Ownership: every asset move's `fromPlayerId` must currently own the
 *      def (`bank` owns whatever isn't held by a player + present in
 *      `bankAssets`). Closes the "trade Boardwalk you don't own" forgery.
 */
export function validateProposal(
  room: Room,
  tx: Transaction,
): string | null {
  // ---- structural ----
  for (const m of tx.cash ?? []) {
    if (!Number.isFinite(m.amount) || m.amount <= 0)
      return "Amount must be positive.";
  }
  for (const c of tx.splitChildren ?? []) {
    if (!Number.isFinite(c.amount) || c.amount <= 0)
      return "Amount must be positive.";
  }

  const coherenceError = checkPayloadCoherence(tx);
  if (coherenceError) return coherenceError;

  if (
    tx.kind === "request-bank" &&
    !REQUEST_BANK_ALLOWED_REASONS.includes(tx.reason)
  ) {
    return "Bank only pays for Pass GO, Chance, or Community Chest.";
  }

  if (room.mode === "official") {
    // "Trades only" mode: free p2p transfers and splits are blocked
    // regardless of the label, because `reason: "other"` was the obvious
    // bypass for the original gift/loan check.
    if (tx.kind === "p2p" && ["gift", "loan", "other"].includes(tx.reason)) {
      return "Free transfers are not allowed in official mode.";
    }
    if (tx.kind === "split") {
      return "Splits are not allowed in official mode.";
    }
  }

  if (tx.kind === "split") {
    const n = tx.splitChildren?.length ?? 0;
    if (n < 1 || n > 3) return "Split must have 1 to 3 recipients.";
    const seen = new Set<string>();
    for (const c of tx.splitChildren!) {
      if (c.toPlayerId === tx.proposedBy)
        return "Cannot split to yourself.";
      if (!room.players.some((p) => p.id === c.toPlayerId))
        return "Unknown recipient.";
      if (seen.has(c.toPlayerId))
        return "Duplicate recipient in split.";
      seen.add(c.toPlayerId);
    }
  }

  for (const m of tx.cash ?? []) {
    if (m.fromPlayerId !== "bank" && !room.players.some((p) => p.id === m.fromPlayerId))
      return "Unknown sender.";
    if (m.toPlayerId !== "bank" && !room.players.some((p) => p.id === m.toPlayerId))
      return "Unknown recipient.";
    if (m.fromPlayerId === m.toPlayerId)
      return "Cannot transfer to the same party.";
  }

  for (const a of tx.assets ?? []) {
    if (!VALID_DEF_IDS.has(a.defId))
      return `Unknown property: ${a.defId}`;
    if (a.fromPlayerId !== "bank" && !room.players.some((p) => p.id === a.fromPlayerId))
      return "Unknown asset sender.";
    if (a.toPlayerId !== "bank" && !room.players.some((p) => p.id === a.toPlayerId))
      return "Unknown asset recipient.";
    if (a.fromPlayerId === a.toPlayerId)
      return "Asset must change hands.";
  }

  // ---- ownership ----
  for (const a of tx.assets ?? []) {
    const ownsIt = currentOwner(room, a.defId);
    if (a.fromPlayerId !== ownsIt) {
      return `Property ${a.defId} is not held by ${a.fromPlayerId === "bank" ? "the bank" : "that player"}.`;
    }
  }

  // ---- solvency ----
  const debits = new Map<string, number>();
  const bump = (id: string, amt: number) =>
    debits.set(id, (debits.get(id) ?? 0) + amt);
  for (const m of tx.cash ?? []) {
    if (m.fromPlayerId !== "bank") bump(m.fromPlayerId, m.amount);
  }
  for (const c of tx.splitChildren ?? []) {
    bump(tx.proposedBy, c.amount);
  }
  for (const [pid, amt] of debits) {
    const p = room.players.find((x) => x.id === pid);
    if (!p) return "Unknown sender.";
    if (p.cash < amt) {
      return `${p.name} doesn't have enough cash for this.`;
    }
  }

  return null;
}

/**
 * Checks that the body's payload matches its declared `kind`. Without
 * this, a client could submit `kind: "p2p"` with an `assets` array and
 * sneak a property transfer through the auto-apply path that's only
 * supposed to move cash.
 */
function checkPayloadCoherence(tx: Transaction): string | null {
  const hasCash = (tx.cash?.length ?? 0) > 0;
  const hasAssets = (tx.assets?.length ?? 0) > 0;
  const hasSplit = (tx.splitChildren?.length ?? 0) > 0;
  switch (tx.kind) {
    case "p2p":
      if (!hasCash || hasAssets || hasSplit)
        return "p2p must have cash only.";
      return null;
    case "pay-bank":
      if (!hasCash || hasSplit) return "pay-bank must have cash.";
      return null;
    case "request-bank":
      if (!hasCash || hasAssets || hasSplit)
        return "request-bank must have cash only.";
      return null;
    case "split":
      if (!hasSplit || hasCash || hasAssets)
        return "split must have splitChildren only.";
      return null;
    case "asset-move":
      if (!hasAssets && !hasCash)
        return "trade must move cash or assets.";
      if (hasSplit) return "trade cannot include splitChildren.";
      return null;
  }
}

/**
 * Returns the current owner of a property def: a player id, or "bank" if
 * the bank holds it (per `room.bankAssets`), or null if nobody has it.
 */
function currentOwner(room: Room, defId: string): string | null {
  for (const p of room.players) {
    if (p.assets.some((x) => x.defId === defId)) return p.id;
  }
  if (room.bankAssets.some((x) => x.defId === defId)) return "bank";
  return null;
}

/**
 * Per-kind authorization: the actor (server-derived from the session)
 * must match the structural role of the tx. This is the SECOND line of
 * defense (validateProposal handles solvency/ownership). It catches:
 *   - p2p where the attacker tries to debit a victim
 *   - pay-bank that's actually a free credit (from=bank, to=me)
 *   - request-bank that credits someone else
 *   - split where the proposer isn't the source
 *   - trades the actor isn't a party to
 *
 * Returns null on success or an error string describing the violation.
 */
export function authorizeActor(
  tx: Pick<Transaction, "kind" | "cash" | "assets" | "splitChildren" | "proposedBy">,
  actor: string,
): string | null {
  if (tx.proposedBy !== actor) return "Actor mismatch.";

  switch (tx.kind) {
    case "p2p":
      for (const m of tx.cash ?? []) {
        if (m.fromPlayerId !== actor)
          return "You can only send your own money.";
        if (m.toPlayerId === "bank")
          return "Use Pay Bank for the bank.";
      }
      return null;

    case "pay-bank":
      for (const m of tx.cash ?? []) {
        if (m.fromPlayerId !== actor)
          return "You can only pay the bank from your own wallet.";
        if (m.toPlayerId !== "bank")
          return "Pay Bank must send to the bank.";
      }
      for (const a of tx.assets ?? []) {
        if (a.toPlayerId !== actor)
          return "Bought property must come to you.";
        if (a.fromPlayerId !== "bank")
          return "Bought property must come from the bank.";
      }
      return null;

    case "request-bank":
      for (const m of tx.cash ?? []) {
        if (m.fromPlayerId !== "bank")
          return "Request must come from the bank.";
        if (m.toPlayerId !== actor)
          return "Bank request must credit you.";
      }
      return null;

    case "split":
      for (const c of tx.splitChildren ?? []) {
        if (c.toPlayerId === actor)
          return "Cannot split to yourself.";
      }
      return null;

    case "asset-move": {
      // The proposer must be a participant on at least one leg, and no
      // leg may move money/assets between two parties when the proposer
      // isn't one of them.
      const parties = new Set<string>();
      for (const m of tx.cash ?? []) {
        if (m.fromPlayerId !== "bank") parties.add(m.fromPlayerId);
        if (m.toPlayerId !== "bank") parties.add(m.toPlayerId);
      }
      for (const a of tx.assets ?? []) {
        if (a.fromPlayerId !== "bank") parties.add(a.fromPlayerId);
        if (a.toPlayerId !== "bank") parties.add(a.toPlayerId);
      }
      if (!parties.has(actor)) return "You must be a party to the trade.";
      // Trades with the bank aren't supported (use buy-property instead).
      for (const m of tx.cash ?? []) {
        if (m.fromPlayerId === "bank" || m.toPlayerId === "bank")
          return "Trades cannot include the bank.";
      }
      for (const a of tx.assets ?? []) {
        if (a.fromPlayerId === "bank" || a.toPlayerId === "bank")
          return "Trades cannot include the bank.";
      }
      return null;
    }
  }
}

export function canConfirm(tx: Transaction): boolean {
  return tx.requiresConfirmFrom.every((id) => tx.confirmedBy.includes(id));
}

/**
 * Apply a confirmed transaction to the room. Pure: returns a new Room
 * with deep-copied players. Idempotent on `tx.id` — calling twice with
 * the same already-confirmed tx returns the input unchanged so a race
 * between sweep + manual confirm can't double-debit.
 *
 * Bank inventory (`bankAssets`) and bookkeeping (`bankCash`) are kept in
 * sync so future validations can rely on them.
 */
export function applyTransaction(room: Room, tx: Transaction): Room {
  // Idempotency guard: if the tx is already recorded as confirmed in
  // room.transactions, there's nothing to do.
  const existing = room.transactions.find((t) => t.id === tx.id);
  if (existing && existing.status === "confirmed") {
    return room;
  }

  const players = room.players.map((p) => ({ ...p, assets: [...p.assets] }));
  const findPlayer = (id: string) => players.find((p) => p.id === id);
  let bankCash = room.bankCash;
  let bankAssets = [...room.bankAssets];

  for (const m of tx.cash ?? []) {
    if (m.fromPlayerId === "bank") bankCash -= m.amount;
    else {
      const p = findPlayer(m.fromPlayerId);
      if (p) p.cash -= m.amount;
    }
    if (m.toPlayerId === "bank") bankCash += m.amount;
    else {
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
    if (a.fromPlayerId === "bank") {
      bankAssets = bankAssets.filter((x) => x.defId !== a.defId);
    } else {
      const from = findPlayer(a.fromPlayerId);
      if (from) from.assets = from.assets.filter((x) => x.defId !== a.defId);
    }
    if (a.toPlayerId === "bank") {
      bankAssets.push({ defId: a.defId, mortgaged: a.mortgaged });
    } else {
      const to = findPlayer(a.toPlayerId);
      if (to) to.assets.push({ defId: a.defId, mortgaged: a.mortgaged });
    }
  }

  return { ...room, players, bankCash, bankAssets };
}

/** Re-export for callers that want the kind enum without importing types. */
export type { TxKind };
