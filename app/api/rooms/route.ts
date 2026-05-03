import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { store } from "@/lib/store";
import { generateRoomCode } from "@/lib/game/codes";
import { hashPasscode, setSessionCookie } from "@/lib/session";
import { MONOPOLY_US, PLAYER_COLORS, STARTING_BALANCE_DEFAULT } from "@/lib/game/monopoly";
import type { Room } from "@/lib/game/types";

export const runtime = "nodejs";

const CreateBody = z.object({
  passcode: z.string().min(1).max(64),
  adminName: z.string().min(1).max(40),
  startingBalance: z.number().int().positive().optional(),
  mode: z.enum(["official", "house"]).optional(),
  scarcityHouses: z.number().int().min(0).max(64).optional(),
  scarcityHotels: z.number().int().min(0).max(32).optional(),
});

export async function POST(req: NextRequest) {
  const body = CreateBody.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: body.error.message }, { status: 400 });

  let code = generateRoomCode();
  while (await store.getRoom(code)) code = generateRoomCode();

  const adminId = nanoid(8);
  const room: Room = {
    code,
    passcodeHash: hashPasscode(body.data.passcode),
    mode: body.data.mode ?? "house",
    preset: "monopoly-us",
    startingBalance: body.data.startingBalance ?? STARTING_BALANCE_DEFAULT,
    bankCash: 0,
    bankAssets: MONOPOLY_US.map((a) => ({ defId: a.id })),
    scarcity: { houses: body.data.scarcityHouses, hotels: body.data.scarcityHotels },
    players: [
      {
        id: adminId,
        name: body.data.adminName,
        color: PLAYER_COLORS[0],
        cash: body.data.startingBalance ?? STARTING_BALANCE_DEFAULT,
        assets: [],
        isAdmin: true,
        joinedAt: Date.now(),
        online: true,
      },
    ],
    partnerships: [],
    transactions: [],
    createdAt: Date.now(),
  };

  await store.saveRoom(room);
  await setSessionCookie({ roomCode: code, playerId: adminId });
  await store.publish(code, { type: "state", room });

  return NextResponse.json({ code, playerId: adminId });
}
