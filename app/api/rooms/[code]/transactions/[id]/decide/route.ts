import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { store } from "@/lib/store";
import { isValidCode } from "@/lib/game/codes";
import { getSession } from "@/lib/session";
import { applyTransaction, canConfirm } from "@/lib/game/rules";

export const runtime = "nodejs";

const Body = z.object({ decision: z.enum(["confirm", "reject", "object"]) });

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ code: string; id: string }> },
) {
  const { code, id } = await ctx.params;
  if (!isValidCode(code)) return NextResponse.json({ error: "Bad code" }, { status: 400 });

  const session = await getSession();
  if (!session || session.roomCode !== code) {
    return NextResponse.json({ error: "Forbidden" }, { status: 401 });
  }

  const room = await store.getRoom(code);
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tx = room.transactions.find((t) => t.id === id);
  if (!tx) return NextResponse.json({ error: "No tx" }, { status: 404 });
  if (tx.status !== "pending") {
    return NextResponse.json({ error: "Already decided" }, { status: 409 });
  }

  const { decision } = Body.parse(await req.json());

  if (decision === "reject" || decision === "object") {
    tx.status = "rejected";
    tx.rejectedBy = session.playerId;
  } else {
    if (!tx.requiresConfirmFrom.includes(session.playerId)) {
      return NextResponse.json({ error: "Not your call" }, { status: 403 });
    }
    if (!tx.confirmedBy.includes(session.playerId)) {
      tx.confirmedBy.push(session.playerId);
    }
    if (canConfirm(tx)) {
      tx.status = "confirmed";
      const next = applyTransaction(room, tx);
      next.transactions = next.transactions.map((t) => (t.id === tx.id ? tx : t));
      await store.saveRoom(next);
      await store.publish(code, { type: "state", room: next });
      return NextResponse.json({ tx });
    }
  }

  await store.saveRoom(room);
  await store.publish(code, { type: "state", room });
  return NextResponse.json({ tx });
}
