import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { isValidCode } from "@/lib/game/codes";
import { getSession } from "@/lib/session";
import { sweepExpired } from "@/lib/game/sweep";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  if (!isValidCode(code)) return NextResponse.json({ error: "Bad code" }, { status: 400 });

  const session = await getSession();
  if (!session || session.roomCode !== code) {
    return NextResponse.json({ error: "Not in room" }, { status: 401 });
  }

  const room = await store.getRoom(code);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const { room: swept, promoted } = sweepExpired(room);
  if (promoted.length) {
    await store.saveRoom(swept);
    await store.publish(code, { type: "state", room: swept });
  }

  const { passcodeHash: _passcodeHash, ...safe } = swept;
  void _passcodeHash;
  return NextResponse.json({ room: safe, you: session.playerId });
}
