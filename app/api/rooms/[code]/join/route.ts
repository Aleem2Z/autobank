import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { store } from "@/lib/store";
import { withCodeLock } from "@/lib/store/locks";
import { isValidCode } from "@/lib/game/codes";
import {
  clearAdminClaim,
  getAdminClaim,
  setSessionCookie,
} from "@/lib/session";
import { PLAYER_COLORS, isValidPlayerColor } from "@/lib/game/monopoly";
import { publicRoom } from "@/lib/game/serialize";

export const runtime = "nodejs";

const JoinBody = z.object({
  name: z.string().min(1).max(40),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  if (!isValidCode(code))
    return NextResponse.json({ error: "Bad code" }, { status: 400 });

  const body = JoinBody.safeParse(await req.json());
  if (!body.success)
    return NextResponse.json({ error: body.error.message }, { status: 400 });

  const claim = await getAdminClaim();
  const claimMatches = claim?.roomCode === code;

  const result = await withCodeLock(code, async () => {
    const room = await store.getRoom(code);
    if (!room) return { status: 404, body: { error: "Room not found" } };

    if (
      room.players.some(
        (p) => p.name.toLowerCase() === body.data.name.toLowerCase(),
      )
    ) {
      return {
        status: 409,
        body: { error: "Name already taken in this room" },
      };
    }

    const usedColors = new Set(
      room.players.map((p) => p.color.toLowerCase()),
    );

    let color: string;
    const requested = body.data.color?.toLowerCase();
    if (requested) {
      if (!isValidPlayerColor(requested)) {
        return {
          status: 400,
          body: { error: "That color isn't part of the palette." },
        };
      }
      if (usedColors.has(requested)) {
        return {
          status: 409,
          body: { error: "Another player already grabbed that color." },
        };
      }
      color = requested;
    } else {
      color =
        PLAYER_COLORS.find((c) => !usedColors.has(c.toLowerCase())) ??
        PLAYER_COLORS[room.players.length % PLAYER_COLORS.length];
    }

    const roomHasAdmin = room.players.some((p) => p.isAdmin);
    const isAdmin = claimMatches && !roomHasAdmin;

    const playerId = nanoid(12);
    const next = {
      ...room,
      players: [
        ...room.players,
        {
          id: playerId,
          name: body.data.name,
          color,
          cash: room.startingBalance,
          assets: [],
          isAdmin,
          joinedAt: Date.now(),
          online: true,
        },
      ],
      version: (room.version ?? 0) + 1,
    };

    await store.saveRoom(next);
    await store.publish(code, { type: "state", room: publicRoom(next) });
    return {
      status: 200,
      body: { code, playerId, isAdmin },
      sideEffects: { setSession: { roomCode: code, playerId } as const },
    };
  });

  if (result.status === 200 && "sideEffects" in result && result.sideEffects) {
    await setSessionCookie(result.sideEffects.setSession);
    if (claimMatches) await clearAdminClaim();
  }
  return NextResponse.json(result.body, { status: result.status });
}
