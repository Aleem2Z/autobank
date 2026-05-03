import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { store } from "@/lib/store";
import { isValidCode } from "@/lib/game/codes";
import { getSession } from "@/lib/session";
import { validateProposal, applyTransaction } from "@/lib/game/rules";
import { sweepExpired } from "@/lib/game/sweep";
import type { Transaction, TxKind, ReasonPreset } from "@/lib/game/types";

export const runtime = "nodejs";

const Cash = z.object({
  fromPlayerId: z.string(),
  toPlayerId: z.string(),
  amount: z.number().int().positive(),
});

const Asset = z.object({
  defId: z.string(),
  fromPlayerId: z.string(),
  toPlayerId: z.string(),
  mortgaged: z.boolean().optional(),
});

const SplitChild = z.object({ toPlayerId: z.string(), amount: z.number().int().positive() });

const Body = z.object({
  kind: z.enum(["p2p", "pay-bank", "request-bank", "asset-move", "split"]),
  reason: z.enum([
    "pass-go", "income-tax", "luxury-tax", "chance", "community-chest", "jail-fine",
    "buy-property", "mortgage", "unmortgage", "build", "sell-building", "rent",
    "gift", "loan", "other",
  ]),
  reasonNote: z.string().max(120).optional(),
  cash: z.array(Cash).optional(),
  assets: z.array(Asset).optional(),
  splitChildren: z.array(SplitChild).max(3).optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  if (!isValidCode(code)) return NextResponse.json({ error: "Bad code" }, { status: 400 });

  const session = await getSession();
  if (!session || session.roomCode !== code) {
    return NextResponse.json({ error: "Forbidden" }, { status: 401 });
  }

  let room = await store.getRoom(code);
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Sweep expired request-bank txs first so a stale one doesn't conflict
  const swept = sweepExpired(room);
  if (swept.promoted.length) {
    room = swept.room;
    await store.saveRoom(room);
    await store.publish(code, { type: "state", room });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const requires = computeConfirmers(
    parsed.data,
    session.playerId,
    room.players.map((p) => p.id),
  );

  // Pay-bank with an asset transfer (e.g. buying a property) gets a 10s
  // objection window like request-bank — anyone can object if they
  // think the buyer is grabbing a property someone else was about to take.
  // Plain pay-bank (just cash) auto-confirms.
  const isBuyFromBank =
    parsed.data.kind === "pay-bank" && (parsed.data.assets?.length ?? 0) > 0;
  const usesObjectionWindow =
    parsed.data.kind === "request-bank" || isBuyFromBank;

  const tx: Transaction = {
    id: nanoid(10),
    kind: parsed.data.kind as TxKind,
    reason: parsed.data.reason as ReasonPreset,
    reasonNote: parsed.data.reasonNote,
    cash: parsed.data.cash,
    assets: parsed.data.assets,
    splitChildren: parsed.data.splitChildren,
    proposedBy: session.playerId,
    proposedAt: Date.now(),
    requiresConfirmFrom: requires,
    confirmedBy: [],
    status: "pending",
    objectionDeadline: usesObjectionWindow ? Date.now() + 10_000 : undefined,
  };

  const err = validateProposal(room, tx);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  if (requires.length === 0 && !usesObjectionWindow) {
    tx.status = "confirmed";
    const next = applyTransaction(room, tx);
    next.transactions = [...next.transactions, tx];
    await store.saveRoom(next);
    await store.publish(code, { type: "state", room: next });
  } else {
    room.transactions = [...room.transactions, tx];
    await store.saveRoom(room);
    await store.publish(code, { type: "state", room });
  }

  return NextResponse.json({ tx });
}

function computeConfirmers(
  body: z.infer<typeof Body>,
  proposer: string,
  allPlayerIds: string[],
): string[] {
  const set = new Set<string>();

  // P2P and Split: NO confirmation. You're giving away your own money,
  // there's nothing to cheat (the recipient can only gain). Auto-applies.
  // Plain Pay Bank: same — no confirmation. Auto-applies.

  if (body.kind === "asset-move") {
    // Trades: BOTH parties must confirm because both sides are exchanging
    // things — without dual confirm, anyone could unilaterally take
    // someone else's property.
    for (const m of body.cash ?? []) {
      if (m.fromPlayerId !== proposer && m.fromPlayerId !== "bank") set.add(m.fromPlayerId);
      if (m.toPlayerId !== proposer && m.toPlayerId !== "bank") set.add(m.toPlayerId);
    }
    for (const a of body.assets ?? []) {
      if (a.fromPlayerId !== proposer && a.fromPlayerId !== "bank") set.add(a.fromPlayerId);
      if (a.toPlayerId !== proposer && a.toPlayerId !== "bank") set.add(a.toPlayerId);
    }
  } else if (body.kind === "request-bank") {
    // Pull from bank: every other player can OBJECT during the
    // 10s window. requiresConfirmFrom is empty — confirmation
    // happens via timeout (sweepExpired) unless someone hits Object.
    void allPlayerIds;
  }
  // p2p, pay-bank, split: empty set → auto-applies
  // (pay-bank with asset is handled separately via the objection window
  //  in the route — same flow as request-bank, no confirmers list)
  return [...set];
}
