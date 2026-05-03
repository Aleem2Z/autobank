import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { store } from "@/lib/store";
import { withCodeLock } from "@/lib/store/locks";
import { isValidCode } from "@/lib/game/codes";
import { getSession } from "@/lib/session";
import { applyTransaction, canConfirm, validateProposal } from "@/lib/game/rules";
import { publicRoom } from "@/lib/game/serialize";
import type { Transaction } from "@/lib/game/types";

export const runtime = "nodejs";

const Body = z.object({ decision: z.enum(["confirm", "reject", "object"]) });

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ code: string; id: string }> },
) {
  const { code, id } = await ctx.params;
  if (!isValidCode(code))
    return NextResponse.json({ error: "Bad code" }, { status: 400 });

  const session = await getSession();
  if (!session || session.roomCode !== code) {
    return NextResponse.json({ error: "Forbidden" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const { decision } = parsed.data;

  const result = await withCodeLock(code, async () => {
    const room = await store.getRoom(code);
    if (!room) return { status: 404, body: { error: "Not found" } };

    const idx = room.transactions.findIndex((t) => t.id === id);
    if (idx === -1) return { status: 404, body: { error: "No tx" } };
    const tx = room.transactions[idx];
    if (tx.status !== "pending") {
      // Idempotent: a retry after a successful decide just returns the
      // current state. Client sees this and refreshes.
      return { status: 409, body: { error: "Already decided", tx } };
    }

    let updatedTx: Transaction = tx;
    let nextRoom = room;

    if (decision === "reject") {
      // Only confirmers may reject (a non-participant griefer can't
      // cancel someone else's trade). For objection-window txs there
      // are no confirmers — those use "object" instead.
      if (!tx.requiresConfirmFrom.includes(session.playerId)) {
        return { status: 403, body: { error: "Not your call" } };
      }
      updatedTx = {
        ...tx,
        status: "rejected",
        rejectedBy: session.playerId,
      };
    } else if (decision === "object") {
      // Only valid during an active objection window. Proposer can't
      // object to their own tx. Anyone else in the room may object.
      if (!tx.objectionDeadline || tx.objectionDeadline <= Date.now()) {
        return { status: 400, body: { error: "Objection window closed" } };
      }
      if (tx.proposedBy === session.playerId) {
        return { status: 400, body: { error: "Cannot object to your own tx" } };
      }
      updatedTx = {
        ...tx,
        status: "rejected",
        rejectedBy: session.playerId,
        objections: [...(tx.objections ?? []), session.playerId],
      };
    } else {
      // confirm
      if (!tx.requiresConfirmFrom.includes(session.playerId)) {
        return { status: 403, body: { error: "Not your call" } };
      }
      const confirmedBy = tx.confirmedBy.includes(session.playerId)
        ? tx.confirmedBy
        : [...tx.confirmedBy, session.playerId];
      const partial: Transaction = { ...tx, confirmedBy };
      if (canConfirm(partial)) {
        // Re-validate at commit time. The snapshot may have changed
        // since propose — payer might be insolvent now.
        const validationError = validateProposal(room, partial);
        if (validationError) {
          updatedTx = {
            ...partial,
            status: "rejected",
            rejectedBy: tx.proposedBy,
            reasonNote: partial.reasonNote
              ? `${partial.reasonNote} (auto-rejected: ${validationError})`
              : `auto-rejected: ${validationError}`,
          };
        } else {
          updatedTx = { ...partial, status: "confirmed" };
          nextRoom = applyTransaction(room, updatedTx);
        }
      } else {
        updatedTx = partial;
      }
    }

    const updatedTxs = nextRoom.transactions.map((t, i) =>
      i === idx ? updatedTx : t,
    );
    // If applyTransaction ran above, nextRoom.transactions is the same
    // identity as room.transactions because applyTransaction doesn't
    // touch it — so the patch above is correct in either branch.
    const finalRoom = bumpVersion({ ...nextRoom, transactions: updatedTxs });

    await store.saveRoom(finalRoom);
    await store.publish(code, { type: "state", room: publicRoom(finalRoom) });
    return { status: 200, body: { tx: updatedTx } };
  });

  return NextResponse.json(result.body, { status: result.status });
}

function bumpVersion<T extends { version?: number }>(room: T): T {
  return { ...room, version: (room.version ?? 0) + 1 };
}
