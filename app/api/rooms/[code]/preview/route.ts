import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { isValidCode } from "@/lib/game/codes";
import { getAdminClaim } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Lightweight, unauthenticated preview of a room used by the join overlay
 * to render a name + color picker that knows what's already taken — without
 * exposing balances, transactions, or any private state.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  if (!isValidCode(code))
    return NextResponse.json({ error: "Bad code" }, { status: 400 });

  const room = await store.getRoom(code);
  if (!room)
    return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const claim = await getAdminClaim();
  const canClaimAdmin =
    claim?.roomCode === code && !room.players.some((p) => p.isAdmin);

  return NextResponse.json({
    exists: true,
    code: room.code,
    mode: room.mode,
    startingBalance: room.startingBalance,
    playerCount: room.players.length,
    usedColors: room.players.map((p) => p.color.toLowerCase()),
    usedNames: room.players.map((p) => p.name),
    canClaimAdmin,
  });
}
