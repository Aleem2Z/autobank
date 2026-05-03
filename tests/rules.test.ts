import { describe, it, expect } from "vitest";
import { canConfirm, applyTransaction, validateProposal, reverseTransaction } from "@/lib/game/rules";
import type { Room, Transaction, Player } from "@/lib/game/types";

function newPlayer(id: string, cash = 1500, isAdmin = false): Player {
  return { id, name: id, color: "#000", cash, assets: [], isAdmin, joinedAt: 0, online: true };
}

function newRoom(players: Player[]): Room {
  return {
    code: "ABCD",
    passcodeHash: "x",
    mode: "house",
    preset: "monopoly-us",
    startingBalance: 1500,
    bankCash: 0,
    bankAssets: [],
    scarcity: {},
    players,
    partnerships: [],
    transactions: [],
    createdAt: 0,
  };
}

describe("rules.validateProposal", () => {
  it("rejects negative amounts", () => {
    const room = newRoom([newPlayer("a"), newPlayer("b")]);
    const tx: Transaction = {
      id: "t1",
      kind: "p2p",
      reason: "gift",
      cash: [{ fromPlayerId: "a", toPlayerId: "b", amount: -10 }],
      proposedBy: "a",
      proposedAt: 0,
      requiresConfirmFrom: ["b"],
      confirmedBy: [],
      status: "pending",
    };
    expect(validateProposal(room, tx)).toMatch(/positive/i);
  });

  it("blocks gift/loan in official mode", () => {
    const room = { ...newRoom([newPlayer("a"), newPlayer("b")]), mode: "official" as const };
    const tx: Transaction = {
      id: "t1",
      kind: "p2p",
      reason: "gift",
      cash: [{ fromPlayerId: "a", toPlayerId: "b", amount: 50 }],
      proposedBy: "a",
      proposedAt: 0,
      requiresConfirmFrom: ["b"],
      confirmedBy: [],
      status: "pending",
    };
    expect(validateProposal(room, tx)).toMatch(/official/i);
  });

  it("blocks splits in official mode", () => {
    const room = { ...newRoom([newPlayer("a"), newPlayer("b"), newPlayer("c")]), mode: "official" as const };
    const tx: Transaction = {
      id: "t1",
      kind: "split",
      reason: "other",
      splitChildren: [{ toPlayerId: "b", amount: 50 }],
      proposedBy: "a",
      proposedAt: 0,
      requiresConfirmFrom: ["b"],
      confirmedBy: [],
      status: "pending",
    };
    expect(validateProposal(room, tx)).toMatch(/official/i);
  });

  it("split must have 1-3 children", () => {
    const room = newRoom([newPlayer("a"), newPlayer("b"), newPlayer("c"), newPlayer("d"), newPlayer("e")]);
    const tooMany: Transaction = {
      id: "t1",
      kind: "split",
      reason: "other",
      splitChildren: [
        { toPlayerId: "b", amount: 10 },
        { toPlayerId: "c", amount: 10 },
        { toPlayerId: "d", amount: 10 },
        { toPlayerId: "e", amount: 10 },
      ],
      proposedBy: "a",
      proposedAt: 0,
      requiresConfirmFrom: ["b", "c", "d", "e"],
      confirmedBy: [],
      status: "pending",
    };
    expect(validateProposal(room, tooMany)).toMatch(/1 to 3/);
  });

  it("accepts a valid 3-way split", () => {
    const room = newRoom([newPlayer("a"), newPlayer("b"), newPlayer("c"), newPlayer("d")]);
    const ok: Transaction = {
      id: "t1",
      kind: "split",
      reason: "other",
      splitChildren: [
        { toPlayerId: "b", amount: 50 },
        { toPlayerId: "c", amount: 50 },
        { toPlayerId: "d", amount: 50 },
      ],
      proposedBy: "a",
      proposedAt: 0,
      requiresConfirmFrom: ["b", "c", "d"],
      confirmedBy: [],
      status: "pending",
    };
    expect(validateProposal(room, ok)).toBeNull();
  });
});

describe("rules.canConfirm", () => {
  it("only when all required parties have approved", () => {
    const tx: Transaction = {
      id: "t1",
      kind: "p2p",
      reason: "rent",
      cash: [{ fromPlayerId: "b", toPlayerId: "a", amount: 50 }],
      proposedBy: "a",
      proposedAt: 0,
      requiresConfirmFrom: ["b"],
      confirmedBy: [],
      status: "pending",
    };
    expect(canConfirm(tx)).toBe(false);
    tx.confirmedBy = ["b"];
    expect(canConfirm(tx)).toBe(true);
  });
});

describe("rules.applyTransaction", () => {
  it("moves cash player to player", () => {
    const room = newRoom([newPlayer("a", 1000), newPlayer("b", 500)]);
    const tx: Transaction = {
      id: "t1",
      kind: "p2p",
      reason: "rent",
      cash: [{ fromPlayerId: "b", toPlayerId: "a", amount: 200 }],
      proposedBy: "a",
      proposedAt: 0,
      requiresConfirmFrom: ["b"],
      confirmedBy: ["b"],
      status: "pending",
    };
    const next = applyTransaction(room, tx);
    expect(next.players.find((p) => p.id === "a")!.cash).toBe(1200);
    expect(next.players.find((p) => p.id === "b")!.cash).toBe(300);
  });

  it("bank → player credits without affecting any player balance", () => {
    const room = newRoom([newPlayer("a", 100)]);
    const tx: Transaction = {
      id: "t1",
      kind: "request-bank",
      reason: "pass-go",
      cash: [{ fromPlayerId: "bank", toPlayerId: "a", amount: 200 }],
      proposedBy: "a",
      proposedAt: 0,
      requiresConfirmFrom: [],
      confirmedBy: [],
      status: "pending",
    };
    const next = applyTransaction(room, tx);
    expect(next.players.find((p) => p.id === "a")!.cash).toBe(300);
  });

  it("buy-property moves cash to bank and asset to player", () => {
    const room = newRoom([newPlayer("a", 1000)]);
    const tx: Transaction = {
      id: "t1",
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
    const a = next.players.find((p) => p.id === "a")!;
    expect(a.cash).toBe(600);
    expect(a.assets.find((x) => x.defId === "boardwalk")).toBeTruthy();
  });

  it("split fans cash out to up to 3 recipients", () => {
    const room = newRoom([newPlayer("a", 300), newPlayer("b", 0), newPlayer("c", 0), newPlayer("d", 0)]);
    const tx: Transaction = {
      id: "t1",
      kind: "split",
      reason: "other",
      splitChildren: [
        { toPlayerId: "b", amount: 100 },
        { toPlayerId: "c", amount: 100 },
        { toPlayerId: "d", amount: 100 },
      ],
      proposedBy: "a",
      proposedAt: 0,
      requiresConfirmFrom: ["b", "c", "d"],
      confirmedBy: ["b", "c", "d"],
      status: "pending",
    };
    const next = applyTransaction(room, tx);
    expect(next.players.find((p) => p.id === "a")!.cash).toBe(0);
    expect(next.players.find((p) => p.id === "b")!.cash).toBe(100);
    expect(next.players.find((p) => p.id === "c")!.cash).toBe(100);
    expect(next.players.find((p) => p.id === "d")!.cash).toBe(100);
  });
});

describe("rules.reverseTransaction", () => {
  it("flips cash directions", () => {
    const tx: Transaction = {
      id: "t1",
      kind: "p2p",
      reason: "rent",
      cash: [{ fromPlayerId: "b", toPlayerId: "a", amount: 200 }],
      proposedBy: "a",
      proposedAt: 0,
      requiresConfirmFrom: ["b"],
      confirmedBy: ["b"],
      status: "confirmed",
    };
    const r = reverseTransaction(tx);
    expect(r.cash?.[0]).toEqual({ fromPlayerId: "a", toPlayerId: "b", amount: 200 });
    expect(r.id).toBe("t1-undo");
  });
});
