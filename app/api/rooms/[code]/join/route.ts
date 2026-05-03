import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { store } from "@/lib/store";
import { isValidCode } from "@/lib/game/codes";
import { hashPasscode, setSessionCookie } from "@/lib/session";
import { PLAYER_COLORS, isValidPlayerColor } from "@/lib/game/monopoly";

export const runtime = "nodejs";

const JoinBody = z.object({
  passcode: z.string().min(1),
  name: z.string().min(1).max(40),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
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
  const usedColors = new Set(
    room.players.map((p) => p.color.toLowerCase()),
  );

  // If client requested a color, validate it: must be a known palette member
  // and not already taken in this room. Otherwise auto-assign the next
  // available palette color.
  let color: string;
  const requested = body.data.color?.toLowerCase();
  if (requested) {
    if (!isValidPlayerColor(requested)) {
      return NextResponse.json(
        { error: "That color isn't part of the palette." },
        { status: 400 },
      );
    }
    if (usedColors.has(requested)) {
      return NextResponse.json(
        { error: "Another player already grabbed that color." },
        { status: 409 },
      );
    }
    color = requested;
  } else {
    color =
      PLAYER_COLORS.find((c) => !usedColors.has(c.toLowerCase())) ??
      PLAYER_COLORS[room.players.length % PLAYER_COLORS.length];
  }

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
