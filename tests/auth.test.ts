import { describe, it, expect } from "vitest";
import {
  applyTransaction,
  authorizeActor,
  validateProposal,
} from "@/lib/game/rules";
import type { Player, Room, Transaction } from "@/lib/game/types";

function newPlayer(id: string, cash = 1500): Player {
  return {
    id,
    name: id,
    color: "#000",
    cash,
    assets: [],
    isAdmin: false,
    joinedAt: 0,
    online: true,
  };
}

function newRoom(players: Player[]): Room {
  return {
    code: "ABCD",
    mode: "house",
    preset: "monopoly-us",
    startingBalance: 1500,
    bankCash: 0,
    bankAssets: [{ defId: "boardwalk" }],
    scarcity: {},
    players,
    partnerships: [],
    transactions: [],
    createdAt: 0,
    version: 1,
  };
}

describe("authorizeActor — actor binding (cheat prevention)", () => {
  it("rejects p2p where the proposer tries to debit a victim", () => {
    const tx: Transaction = {
      id: "t",
      kind: "p2p",
      reason: "other",
      cash: [{ fromPlayerId: "victim", toPlayerId: "attacker", amount: 9999 }],
      proposedBy: "attacker",
      proposedAt: 0,
      requiresConfirmFrom: [],
      confirmedBy: [],
      status: "pending",
    };
    expect(authorizeActor(tx, "attacker")).toMatch(/your own money/i);
  });

  it("rejects p2p sent to the bank (must use pay-bank)", () => {
    const tx: Transaction = {
      id: "t",
      kind: "p2p",
      reason: "other",
      cash: [{ fromPlayerId: "a", toPlayerId: "bank", amount: 50 }],
      proposedBy: "a",
      proposedAt: 0,
      requiresConfirmFrom: [],
      confirmedBy: [],
      status: "pending",
    };
    expect(authorizeActor(tx, "a")).toMatch(/pay bank/i);
  });

  it("rejects pay-bank that's actually a bank-to-me free credit", () => {
    const tx: Transaction = {
      id: "t",
      kind: "pay-bank",
      reason: "other",
      cash: [{ fromPlayerId: "bank", toPlayerId: "attacker", amount: 1000 }],
      proposedBy: "attacker",
      proposedAt: 0,
      requiresConfirmFrom: [],
      confirmedBy: [],
      status: "pending",
    };
    expect(authorizeActor(tx, "attacker")).toMatch(/from your own wallet/i);
  });

  it("rejects request-bank that credits someone else", () => {
    const tx: Transaction = {
      id: "t",
      kind: "request-bank",
      reason: "pass-go",
      cash: [{ fromPlayerId: "bank", toPlayerId: "victim", amount: 200 }],
      proposedBy: "attacker",
      proposedAt: 0,
      requiresConfirmFrom: [],
      confirmedBy: [],
      status: "pending",
    };
    expect(authorizeActor(tx, "attacker")).toMatch(/credit you/i);
  });

  it("rejects asset-move where the proposer isn't a party", () => {
    const tx: Transaction = {
      id: "t",
      kind: "asset-move",
      reason: "other",
      assets: [{ defId: "boardwalk", fromPlayerId: "alice", toPlayerId: "bob" }],
      proposedBy: "eve",
      proposedAt: 0,
      requiresConfirmFrom: ["alice", "bob"],
      confirmedBy: [],
      status: "pending",
    };
    expect(authorizeActor(tx, "eve")).toMatch(/party to the trade/i);
  });

  it("rejects trade with the bank (use buy-property instead)", () => {
    const tx: Transaction = {
      id: "t",
      kind: "asset-move",
      reason: "other",
      cash: [{ fromPlayerId: "alice", toPlayerId: "bank", amount: 100 }],
      assets: [{ defId: "boardwalk", fromPlayerId: "bank", toPlayerId: "alice" }],
      proposedBy: "alice",
      proposedAt: 0,
      requiresConfirmFrom: [],
      confirmedBy: [],
      status: "pending",
    };
    expect(authorizeActor(tx, "alice")).toMatch(/cannot include the bank/i);
  });

  it("accepts a valid p2p where the actor is the payer", () => {
    const tx: Transaction = {
      id: "t",
      kind: "p2p",
      reason: "rent",
      cash: [{ fromPlayerId: "a", toPlayerId: "b", amount: 50 }],
      proposedBy: "a",
      proposedAt: 0,
      requiresConfirmFrom: [],
      confirmedBy: [],
      status: "pending",
    };
    expect(authorizeActor(tx, "a")).toBeNull();
  });
});

describe("validateProposal — solvency + ownership", () => {
  it("rejects p2p where the sender lacks the cash", () => {
    const room = newRoom([newPlayer("a", 100), newPlayer("b", 0)]);
    const tx: Transaction = {
      id: "t",
      kind: "p2p",
      reason: "rent",
      cash: [{ fromPlayerId: "a", toPlayerId: "b", amount: 200 }],
      proposedBy: "a",
      proposedAt: 0,
      requiresConfirmFrom: [],
      confirmedBy: [],
      status: "pending",
    };
    expect(validateProposal(room, tx)).toMatch(/enough cash/i);
  });

  it("rejects split whose total exceeds the source's cash", () => {
    const room = newRoom([
      newPlayer("a", 100),
      newPlayer("b"),
      newPlayer("c"),
    ]);
    const tx: Transaction = {
      id: "t",
      kind: "split",
      reason: "other",
      splitChildren: [
        { toPlayerId: "b", amount: 80 },
        { toPlayerId: "c", amount: 80 },
      ],
      proposedBy: "a",
      proposedAt: 0,
      requiresConfirmFrom: [],
      confirmedBy: [],
      status: "pending",
    };
    expect(validateProposal(room, tx)).toMatch(/enough cash/i);
  });

  it("rejects asset-move where the sender doesn't own the property", () => {
    const room = newRoom([newPlayer("alice"), newPlayer("bob")]);
    // alice has no assets; tries to "trade" boardwalk to bob.
    const tx: Transaction = {
      id: "t",
      kind: "asset-move",
      reason: "other",
      assets: [{ defId: "boardwalk", fromPlayerId: "alice", toPlayerId: "bob" }],
      proposedBy: "alice",
      proposedAt: 0,
      requiresConfirmFrom: ["bob"],
      confirmedBy: [],
      status: "pending",
    };
    expect(validateProposal(room, tx)).toMatch(/not held by/i);
  });

  it("rejects buy-property when the bank no longer holds the deed", () => {
    const room = {
      ...newRoom([newPlayer("a", 1000)]),
      bankAssets: [], // someone already bought it
    };
    const tx: Transaction = {
      id: "t",
      kind: "pay-bank",
      reason: "buy-property",
      cash: [{ fromPlayerId: "a", toPlayerId: "bank", amount: 400 }],
      assets: [{ defId: "boardwalk", fromPlayerId: "bank", toPlayerId: "a" }],
      proposedBy: "a",
      proposedAt: 0,
      requiresConfirmFrom: [],
      confirmedBy: [],
      status: "pending",
    };
    expect(validateProposal(room, tx)).toMatch(/not held by the bank/i);
  });

  it("rejects an unknown property def", () => {
    const room = newRoom([newPlayer("a", 1000)]);
    const tx: Transaction = {
      id: "t",
      kind: "asset-move",
      reason: "other",
      assets: [{ defId: "ghost-property", fromPlayerId: "a", toPlayerId: "a" }],
      proposedBy: "a",
      proposedAt: 0,
      requiresConfirmFrom: [],
      confirmedBy: [],
      status: "pending",
    };
    expect(validateProposal(room, tx)).toMatch(/unknown property/i);
  });

  it("rejects p2p mislabeled with assets (kind/payload coherence)", () => {
    const room = newRoom([newPlayer("a", 1000), newPlayer("b")]);
    const tx: Transaction = {
      id: "t",
      kind: "p2p",
      reason: "rent",
      cash: [{ fromPlayerId: "a", toPlayerId: "b", amount: 50 }],
      assets: [{ defId: "boardwalk", fromPlayerId: "a", toPlayerId: "b" }],
      proposedBy: "a",
      proposedAt: 0,
      requiresConfirmFrom: [],
      confirmedBy: [],
      status: "pending",
    };
    expect(validateProposal(room, tx)).toMatch(/p2p must have cash only/i);
  });

  it("rejects request-bank with non-bank-payable reason", () => {
    const room = newRoom([newPlayer("a", 1000)]);
    const tx: Transaction = {
      id: "t",
      kind: "request-bank",
      reason: "loan",
      cash: [{ fromPlayerId: "bank", toPlayerId: "a", amount: 9999 }],
      proposedBy: "a",
      proposedAt: 0,
      requiresConfirmFrom: [],
      confirmedBy: [],
      objectionDeadline: Date.now() + 10_000,
      status: "pending",
    };
    expect(validateProposal(room, tx)).toMatch(
      /pass go.*chance.*community chest/i,
    );
  });

  it("accepts request-bank for pass-go", () => {
    const room = newRoom([newPlayer("a", 1000)]);
    const tx: Transaction = {
      id: "t",
      kind: "request-bank",
      reason: "pass-go",
      cash: [{ fromPlayerId: "bank", toPlayerId: "a", amount: 200 }],
      proposedBy: "a",
      proposedAt: 0,
      requiresConfirmFrom: [],
      confirmedBy: [],
      objectionDeadline: Date.now() + 10_000,
      status: "pending",
    };
    expect(validateProposal(room, tx)).toBeNull();
  });

  it("blocks 'reason: other' p2p in official mode (closes the gift bypass)", () => {
    const room = {
      ...newRoom([newPlayer("a", 1000), newPlayer("b")]),
      mode: "official" as const,
    };
    const tx: Transaction = {
      id: "t",
      kind: "p2p",
      reason: "other",
      cash: [{ fromPlayerId: "a", toPlayerId: "b", amount: 100 }],
      proposedBy: "a",
      proposedAt: 0,
      requiresConfirmFrom: [],
      confirmedBy: [],
      status: "pending",
    };
    expect(validateProposal(room, tx)).toMatch(/official/i);
  });
});

describe("applyTransaction — idempotency + bank inventory", () => {
  it("does not double-apply when the same confirmed tx is replayed", () => {
    const tx: Transaction = {
      id: "t",
      kind: "p2p",
      reason: "rent",
      cash: [{ fromPlayerId: "b", toPlayerId: "a", amount: 200 }],
      proposedBy: "b",
      proposedAt: 0,
      requiresConfirmFrom: [],
      confirmedBy: [],
      status: "confirmed",
    };
    const baseRoom = newRoom([newPlayer("a", 100), newPlayer("b", 500)]);
    const after = applyTransaction(baseRoom, tx);
    // Now record it as already confirmed in transactions[] and replay.
    const settled = { ...after, transactions: [...after.transactions, tx] };
    const replayed = applyTransaction(settled, tx);
    expect(replayed.players.find((p) => p.id === "a")!.cash).toBe(300);
    expect(replayed.players.find((p) => p.id === "b")!.cash).toBe(300);
  });

  it("removes from bankAssets when bank sells a property", () => {
    const room = newRoom([newPlayer("a", 1000)]);
    expect(room.bankAssets.some((x) => x.defId === "boardwalk")).toBe(true);
    const tx: Transaction = {
      id: "t",
      kind: "pay-bank",
      reason: "buy-property",
      cash: [{ fromPlayerId: "a", toPlayerId: "bank", amount: 400 }],
      assets: [{ defId: "boardwalk", fromPlayerId: "bank", toPlayerId: "a" }],
      proposedBy: "a",
      proposedAt: 0,
      requiresConfirmFrom: [],
      confirmedBy: [],
      status: "pending",
    };
    const next = applyTransaction(room, tx);
    expect(next.bankAssets.some((x) => x.defId === "boardwalk")).toBe(false);
    expect(
      next.players.find((p) => p.id === "a")!.assets.some((x) => x.defId === "boardwalk"),
    ).toBe(true);
  });

  it("tracks bankCash bookkeeping symmetrically", () => {
    const room = newRoom([newPlayer("a", 1000)]);
    const tx: Transaction = {
      id: "t",
      kind: "pay-bank",
      reason: "income-tax",
      cash: [{ fromPlayerId: "a", toPlayerId: "bank", amount: 200 }],
      proposedBy: "a",
      proposedAt: 0,
      requiresConfirmFrom: [],
      confirmedBy: [],
      status: "pending",
    };
    const next = applyTransaction(room, tx);
    expect(next.bankCash).toBe(200);
    expect(next.players.find((p) => p.id === "a")!.cash).toBe(800);
  });
});
