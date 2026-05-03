import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { isValidCode } from "@/lib/game/codes";
import { getSession } from "@/lib/session";
import { applyTransaction, reverseTransaction } from "@/lib/game/rules";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
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
  if (!tx || tx.status !== "confirmed" || tx.reversedBy) {
    return NextResponse.json({ error: "Not undoable" }, { status: 409 });
  }

  const involved = new Set<string>([tx.proposedBy, ...tx.requiresConfirmFrom]);
  if (!involved.has(session.playerId)) {
    return NextResponse.json({ error: "Not your tx" }, { status: 403 });
  }

  const reverse = reverseTransaction(tx);
  tx.reversedBy = reverse.id;
  tx.status = "reversed";
  const next = applyTransaction(room, reverse);
  next.transactions = [...next.transactions.map((t) => (t.id === tx.id ? tx : t)), reverse];
  await store.saveRoom(next);
  await store.publish(code, { type: "state", room: next });
  return NextResponse.json({ tx: reverse });
}
