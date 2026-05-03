import { NextRequest } from "next/server";
import { store } from "@/lib/store";
import { isValidCode } from "@/lib/game/codes";
import { getSession } from "@/lib/session";
import type { RoomEvent } from "@/lib/game/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  if (!isValidCode(code)) return new Response("bad code", { status: 400 });

  const session = await getSession();
  if (!session || session.roomCode !== code) return new Response("forbidden", { status: 401 });

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: RoomEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          /* closed */
        }
      };

      const room = await store.getRoom(code);
      if (room) send({ type: "state", room });

      unsubscribe = store.subscribe(code, send);

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          if (heartbeat) clearInterval(heartbeat);
        }
      }, 25_000);

      req.signal.addEventListener("abort", () => {
        unsubscribe?.();
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
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
