import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { store } from "@/lib/store";
import { generateRoomCode } from "@/lib/game/codes";
import { setAdminClaimCookie } from "@/lib/session";
import { MONOPOLY_US, STARTING_BALANCE_DEFAULT } from "@/lib/game/monopoly";
import type { Room } from "@/lib/game/types";

export const runtime = "nodejs";

const CreateBody = z.object({
  startingBalance: z.number().int().positive().optional(),
  mode: z.enum(["official", "house"]).optional(),
  scarcityHouses: z.number().int().min(0).max(64).optional(),
  scarcityHotels: z.number().int().min(0).max(32).optional(),
  /** Instance-level admin passcode that gates room creation. */
  instancePasscode: z.string().max(128).optional(),
});

let warnedNoInstancePasscode = false;

/**
 * Returns true if the supplied admin passcode satisfies the
 * INSTANCE_PASSCODE gate. Uses a constant-time comparison so callers
 * can't time-side-channel the secret.
 *
 * If INSTANCE_PASSCODE is unset we allow creation but log a one-time
 * warning so dev-mode is frictionless yet visible.
 */
function instancePasscodeOk(supplied: string | undefined): boolean {
  const expected = process.env.INSTANCE_PASSCODE ?? "";
  if (!expected) {
    if (!warnedNoInstancePasscode) {
      warnedNoInstancePasscode = true;
      console.warn(
        "[autobank] INSTANCE_PASSCODE is not set — anyone who can reach this server can create rooms. Set INSTANCE_PASSCODE in production.",
      );
    }
    return true;
  }
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(supplied ?? "", "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const body = CreateBody.safeParse(await req.json());
  if (!body.success)
    return NextResponse.json({ error: body.error.message }, { status: 400 });

  if (!instancePasscodeOk(body.data.instancePasscode)) {
    return NextResponse.json(
      { error: "Invalid admin passcode" },
      { status: 401 },
    );
  }

  let code = generateRoomCode();
  while (await store.getRoom(code)) code = generateRoomCode();

  // Empty room — the creator becomes the admin when they complete the
  // join overlay (name + color) on the room page itself. The admin-claim
  // cookie below tells that join request "you may claim admin status".
  const room: Room = {
    code,
    passcodeHash: "",
    mode: body.data.mode ?? "house",
    preset: "monopoly-us",
    startingBalance: body.data.startingBalance ?? STARTING_BALANCE_DEFAULT,
    bankCash: 0,
    bankAssets: MONOPOLY_US.map((a) => ({ defId: a.id })),
    scarcity: {
      houses: body.data.scarcityHouses,
      hotels: body.data.scarcityHotels,
    },
    players: [],
    partnerships: [],
    transactions: [],
    createdAt: Date.now(),
  };

  await store.saveRoom(room);
  await setAdminClaimCookie(code);

  return NextResponse.json({ code });
}
