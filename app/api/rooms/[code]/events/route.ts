import { NextRequest } from "next/server";
import { store } from "@/lib/store";
import { isValidCode } from "@/lib/game/codes";
import { getSession } from "@/lib/session";
import { publicRoom } from "@/lib/game/serialize";
import type { RoomEvent } from "@/lib/game/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  if (!isValidCode(code)) return new Response("bad code", { status: 400 });

  const session = await getSession();
  if (!session || session.roomCode !== code)
    return new Response("forbidden", { status: 401 });

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let cleaned = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: RoomEvent) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(e)}\n\n`),
          );
        } catch {
          // Closed — clean up so we don't leak listeners.
          cleanup();
        }
      };

      // Subscribe BEFORE reading the snapshot. If a publish lands in the
      // race window, the subscriber will receive it; since every publish
      // carries a complete state snapshot, the slightly-older getRoom
      // result that follows is fine — the next event self-heals.
      unsubscribe = store.subscribe(code, send);

      const room = await store.getRoom(code);
      if (room) send({ type: "state", room: publicRoom(room) });

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          cleanup();
        }
      }, 25_000);

      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        unsubscribe?.();
        unsubscribe = null;
        if (heartbeat) clearInterval(heartbeat);
        heartbeat = null;
        try {
          controller.close();
        } catch {}
      };

      req.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      if (cleaned) return;
      cleaned = true;
      unsubscribe?.();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
