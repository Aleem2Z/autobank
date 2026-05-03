import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { store } from "@/lib/store";
import { isValidCode } from "@/lib/game/codes";
import { hashPasscode, setSessionCookie } from "@/lib/session";
import { PLAYER_COLORS } from "@/lib/game/monopoly";

export const runtime = "nodejs";

const JoinBody = z.object({
  passcode: z.string().min(1),
  name: z.string().min(1).max(40),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  if (!isValidCode(code)) return NextResponse.json({ error: "Bad code" }, { status: 400 });

  const body = JoinBody.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: body.error.message }, { status: 400 });

  const room = await store.getRoom(code);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  if (room.passcodeHash !== hashPasscode(body.data.passcode)) {
    return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  }

  if (room.players.some((p) => p.name.toLowerCase() === body.data.name.toLowerCase())) {
    return NextResponse.json({ error: "Name already taken in this room" }, { status: 409 });
  }

  const playerId = nanoid(8);
  const usedColors = new Set(room.players.map((p) => p.color));
  const color =
    PLAYER_COLORS.find((c) => !usedColors.has(c)) ??
    PLAYER_COLORS[room.players.length % PLAYER_COLORS.length];

  room.players.push({
    id: playerId,
    name: body.data.name,
    color,
    cash: room.startingBalance,
    assets: [],
    isAdmin: false,
    joinedAt: Date.now(),
    online: true,
  });

  await store.saveRoom(room);
  await setSessionCookie({ roomCode: code, playerId });
  await store.publish(code, { type: "state", room });

  return NextResponse.json({ code, playerId });
}
