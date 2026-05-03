import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { store } from "@/lib/store";
import { withCodeLock } from "@/lib/store/locks";
import { isValidCode } from "@/lib/game/codes";
import { getSession } from "@/lib/session";
import {
  applyTransaction,
  authorizeActor,
  validateProposal,
} from "@/lib/game/rules";
import { sweepExpired } from "@/lib/game/sweep";
import { publicRoom } from "@/lib/game/serialize";
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

const SplitChild = z.object({
  toPlayerId: z.string(),
  amount: z.number().int().positive(),
});

const Body = z.object({
  /** Optional client idempotency key — retrying with the same key returns
   *  the original tx instead of double-applying the deduction. */
  clientTxId: z.string().min(8).max(64).optional(),
  kind: z.enum(["p2p", "pay-bank", "request-bank", "asset-move", "split"]),
  reason: z.enum([
    "pass-go", "income-tax", "luxury-tax", "chance", "community-chest",
    "jail-fine", "buy-property", "mortgage", "unmortgage", "build",
    "sell-building", "rent", "gift", "loan", "other",
  ]),
  reasonNote: z.string().max(120).optional(),
  cash: z.array(Cash).optional(),
  assets: z.array(Asset).optional(),
  splitChildren: z.array(SplitChild).max(3).optional(),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  if (!isValidCode(code))
    return NextResponse.json({ error: "Bad code" }, { status: 400 });

  const session = await getSession();
  if (!session || session.roomCode !== code) {
    return NextResponse.json({ error: "Forbidden" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const result = await withCodeLock(code, async () => {
    let room = await store.getRoom(code);
    if (!room) return { status: 404, body: { error: "Not found" } };

    // Lazy sweep: any expired objection-window txs get resolved before we
    // read state for this propose.
    const swept = sweepExpired(room);
    if (swept.promoted.length || swept.rejected.length) {
      room = swept.room;
    }

    // Idempotency: if this clientTxId already produced a tx, return that one.
    if (parsed.data.clientTxId) {
      const dup = room.transactions.find(
        (t) => t.clientTxId === parsed.data.clientTxId,
      );
      if (dup) {
        if (swept.promoted.length || swept.rejected.length) {
          await store.saveRoom(bumpVersion(room));
          await store.publish(code, { type: "state", room: publicRoom(room) });
        }
        return { status: 200, body: { tx: dup } };
      }
    }

    const isBuyFromBank =
      parsed.data.kind === "pay-bank" && (parsed.data.assets?.length ?? 0) > 0;
    const usesObjectionWindow =
      parsed.data.kind === "request-bank" || isBuyFromBank;

    const requires = computeConfirmers(
      parsed.data,
      session.playerId,
    );

    const tx: Transaction = {
      id: nanoid(16),
      clientTxId: parsed.data.clientTxId,
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
      objections: usesObjectionWindow ? [] : undefined,
      status: "pending",
      objectionDeadline: usesObjectionWindow ? Date.now() + 10_000 : undefined,
    };

    // Authorization: actor binding — server-derived actor must match the
    // structural role of the tx. Catches "debit a victim" cheats.
    const authError = authorizeActor(tx, session.playerId);
    if (authError) return { status: 400, body: { error: authError } };

    // Data validation: solvency, ownership, def existence, mode rules.
    const dataError = validateProposal(room, tx);
    if (dataError) return { status: 400, body: { error: dataError } };

    let nextRoom = room;
    if (requires.length === 0 && !usesObjectionWindow) {
      const confirmed = { ...tx, status: "confirmed" as const };
      nextRoom = applyTransaction(room, confirmed);
      nextRoom = {
        ...nextRoom,
        transactions: [...nextRoom.transactions, confirmed],
      };
      await store.saveRoom(bumpVersion(nextRoom));
      await store.publish(code, { type: "state", room: publicRoom(nextRoom) });
      return { status: 200, body: { tx: confirmed } };
    }

    nextRoom = {
      ...room,
      transactions: [...room.transactions, tx],
    };
    await store.saveRoom(bumpVersion(nextRoom));
    await store.publish(code, { type: "state", room: publicRoom(nextRoom) });
    return { status: 200, body: { tx } };
  });

  return NextResponse.json(result.body, { status: result.status });
}

function bumpVersion<T extends { version?: number }>(room: T): T {
  return { ...room, version: (room.version ?? 0) + 1 };
}

/**
 * Decides who must confirm before the tx can apply. Asset-move (trade)
 * is the only kind that needs counterparty confirmation; everything else
 * either auto-applies (you're moving your own money) or uses an objection
 * window (request-bank, buy-property — credibly visible to the table).
 */
function computeConfirmers(
  body: z.infer<typeof Body>,
  proposer: string,
): string[] {
  const set = new Set<string>();
  if (body.kind === "asset-move") {
    for (const m of body.cash ?? []) {
      if (m.fromPlayerId !== proposer && m.fromPlayerId !== "bank")
        set.add(m.fromPlayerId);
      if (m.toPlayerId !== proposer && m.toPlayerId !== "bank")
        set.add(m.toPlayerId);
    }
    for (const a of body.assets ?? []) {
      if (a.fromPlayerId !== proposer && a.fromPlayerId !== "bank")
        set.add(a.fromPlayerId);
      if (a.toPlayerId !== proposer && a.toPlayerId !== "bank")
        set.add(a.toPlayerId);
    }
  }
  return [...set];
}
