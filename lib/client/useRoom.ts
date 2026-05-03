"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Room } from "@/lib/game/types";
import { api } from "./api";

export type RoomStatus = "loading" | "ready" | "needs-join" | "error";

export interface UseRoomResult {
  room: Room | null;
  you: string | null;
  status: RoomStatus;
  error: string | null;
  /** Re-fetch state — call after the user completes the join overlay. */
  refresh: () => void;
}

/**
 * Subscribes to a room: pulls initial state, then opens an SSE stream.
 * Also polls `/api/rooms/[code]` every 1500ms so server-side lazy sweeps
 * (request-bank objection-window expirations) get reflected even when
 * no other player acts.
 */
export function useRoom(code: string): UseRoomResult {
  const [room, setRoom] = useState<Room | null>(null);
  const [you, setYou] = useState<string | null>(null);
  const [status, setStatus] = useState<RoomStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const cancelledRef = useRef(false);

  const refresh = useCallback(() => setReloadKey((n) => n + 1), []);

  useEffect(() => {
    cancelledRef.current = false;
    let es: EventSource | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    (async () => {
      try {
        const initial = await api.getRoom(code);
        if (cancelledRef.current) return;
        setRoom(initial.room);
        setYou(initial.you);
        setStatus("ready");
        setError(null);
      } catch (err) {
        if (cancelledRef.current) return;
        const message = err instanceof Error ? err.message : String(err);
        // Distinguish "you don't have a session for this room yet" from
        // genuinely broken state. The Not-in-room signal lets RoomClient
        // render the join overlay instead of an error panel.
        if (/not in room/i.test(message)) {
          setStatus("needs-join");
          setError(null);
        } else {
          setError(message);
          setStatus("error");
        }
        return;
      }

      es = new EventSource(`/api/rooms/${code}/events`);
      es.onmessage = (ev) => {
        if (!ev.data) return;
        try {
          const parsed = JSON.parse(ev.data) as { type: string; room?: Room };
          if (parsed.type === "state" && parsed.room) {
            setRoom(parsed.room);
          }
        } catch {
          /* ignore parse errors */
        }
      };
      es.onerror = () => {
        // Browser will auto-reconnect; nothing to do.
      };

      interval = setInterval(() => {
        api
          .getRoom(code)
          .then(({ room: fresh }) => {
            if (!cancelledRef.current) setRoom(fresh);
          })
          .catch(() => {
            /* ignore transient polling failures */
          });
      }, 1500);
    })();

    return () => {
      cancelledRef.current = true;
      es?.close();
      if (interval) clearInterval(interval);
    };
  }, [code, reloadKey]);

  return { room, you, status, error, refresh };
}
