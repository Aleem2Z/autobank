import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { withCodeLock } from "@/lib/store/locks";
import { isValidCode } from "@/lib/game/codes";
import { getSession } from "@/lib/session";
import { sweepExpired } from "@/lib/game/sweep";
import { publicRoom } from "@/lib/game/serialize";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  if (!isValidCode(code))
    return NextResponse.json({ error: "Bad code" }, { status: 400 });

  const session = await getSession();
  if (!session || session.roomCode !== code) {
    return NextResponse.json({ error: "Not in room" }, { status: 401 });
  }

  const room = await store.getRoom(code);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  // If anything was eligible for sweep, take the lock and persist + publish.
  // Skip the lock for the common case where sweep is a no-op.
  const dryRun = sweepExpired(room);
  if (dryRun.promoted.length === 0 && dryRun.rejected.length === 0) {
    return NextResponse.json({
      room: publicRoom(room),
      you: session.playerId,
    });
  }

  const swept = await withCodeLock(code, async () => {
    const fresh = await store.getRoom(code);
    if (!fresh) return null;
    const result = sweepExpired(fresh);
    if (result.promoted.length || result.rejected.length) {
      const versioned = { ...result.room, version: (fresh.version ?? 0) + 1 };
      await store.saveRoom(versioned);
      await store.publish(code, { type: "state", room: publicRoom(versioned) });
      return versioned;
    }
    return fresh;
  });

  if (!swept) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  return NextResponse.json({
    room: publicRoom(swept),
    you: session.playerId,
  });
}
