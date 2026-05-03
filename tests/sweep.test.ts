import { describe, it, expect } from "vitest";
import { sweepExpired } from "@/lib/game/sweep";
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

function newRoom(transactions: Transaction[], players?: Player[]): Room {
  return {
    code: "ABCD",
    mode: "house",
    preset: "monopoly-us",
    startingBalance: 1500,
    bankCash: 0,
    bankAssets: [{ defId: "boardwalk" }],
    scarcity: {},
    players: players ?? [newPlayer("a")],
    partnerships: [],
    transactions,
    createdAt: 0,
    version: 1,
  };
}

describe("sweepExpired", () => {
  it("does not mutate the input transactions array or items", () => {
    const tx: Transaction = {
      id: "t1",
      kind: "request-bank",
      reason: "pass-go",
      cash: [{ fromPlayerId: "bank", toPlayerId: "a", amount: 200 }],
      proposedBy: "a",
      proposedAt: 0,
      requiresConfirmFrom: [],
      confirmedBy: [],
      objectionDeadline: 100,
      status: "pending",
    };
    const room = newRoom([tx]);
    const snapshot = JSON.parse(JSON.stringify(room));
    sweepExpired(room, 1000);
    // input untouched
    expect(room).toEqual(snapshot);
  });

  it("auto-confirms an expired request-bank when no objections", () => {
    const tx: Transaction = {
      id: "t1",
      kind: "request-bank",
      reason: "pass-go",
      cash: [{ fromPlayerId: "bank", toPlayerId: "a", amount: 200 }],
      proposedBy: "a",
      proposedAt: 0,
      requiresConfirmFrom: [],
      confirmedBy: [],
      objectionDeadline: 100,
      status: "pending",
    };
    const room = newRoom([tx], [newPlayer("a", 1000)]);
    const result = sweepExpired(room, 1000);
    expect(result.promoted).toEqual(["t1"]);
    expect(result.rejected).toEqual([]);
    expect(result.room.players.find((p) => p.id === "a")!.cash).toBe(1200);
    expect(result.room.transactions[0].status).toBe("confirmed");
  });

  it("force-rejects an expired tx that has any objections recorded", () => {
    const tx: Transaction = {
      id: "t1",
      kind: "request-bank",
      reason: "pass-go",
      cash: [{ fromPlayerId: "bank", toPlayerId: "a", amount: 200 }],
      proposedBy: "a",
      proposedAt: 0,
      requiresConfirmFrom: [],
      confirmedBy: [],
      objections: ["b"],
      objectionDeadline: 100,
      status: "pending",
    };
    const room = newRoom([tx], [newPlayer("a", 1000), newPlayer("b")]);
    const result = sweepExpired(room, 1000);
    expect(result.rejected).toEqual(["t1"]);
    expect(result.promoted).toEqual([]);
    expect(result.room.transactions[0].status).toBe("rejected");
    expect(result.room.transactions[0].rejectedBy).toBe("b");
    expect(result.room.players.find((p) => p.id === "a")!.cash).toBe(1000);
  });

  it("force-rejects buy-property when the buyer is now insolvent", () => {
    // Buyer proposed at $400 but in the meantime burned cash on a p2p
    // that auto-applied. By sweep time they have $50.
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
      objectionDeadline: 100,
      status: "pending",
    };
    const room = newRoom([tx], [newPlayer("a", 50)]);
    const result = sweepExpired(room, 1000);
    expect(result.rejected).toEqual(["t1"]);
    expect(result.room.transactions[0].status).toBe("rejected");
    // Bank still has the deed.
    expect(result.room.bankAssets.some((x) => x.defId === "boardwalk")).toBe(true);
  });

  it("leaves still-pending txs alone", () => {
    const tx: Transaction = {
      id: "t1",
      kind: "request-bank",
      reason: "pass-go",
      cash: [{ fromPlayerId: "bank", toPlayerId: "a", amount: 200 }],
      proposedBy: "a",
      proposedAt: 0,
      requiresConfirmFrom: [],
      confirmedBy: [],
      objectionDeadline: 5000,
      status: "pending",
    };
    const room = newRoom([tx]);
    const result = sweepExpired(room, 1000);
    expect(result.promoted).toEqual([]);
    expect(result.rejected).toEqual([]);
    expect(result.room.transactions[0].status).toBe("pending");
  });
});
