"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Room } from "@/lib/game/types";
import { api } from "./api";

export type RoomStatus = "loading" | "ready" | "needs-join" | "error";
export type ConnectionStatus = "online" | "reconnecting" | "offline";

export interface UseRoomResult {
  room: Room | null;
  you: string | null;
  status: RoomStatus;
  /** Live SSE health — drives the small "Reconnecting…" chip in the header. */
  connection: ConnectionStatus;
  error: string | null;
  /** Re-fetch state — call after the user completes the join overlay. */
  refresh: () => void;
}

// Cadences:
//   FAST_POLL  — used while SSE is degraded so a missed event surfaces
//                within a couple seconds.
//   SLOW_POLL  — used while SSE is healthy. Just a backstop for the
//                server-side lazy sweep; SSE carries the real updates.
//   STALL_MS   — if SSE has been silent (no event, no heartbeat) for this
//                long while the connection thinks it's open, force-close
//                and reconnect. Hung proxies / NAT timeouts cause this.
const FAST_POLL_MS = 1_500;
const SLOW_POLL_MS = 4_000;
const STALL_MS = 30_000;

/**
 * Subscribes to a room: pulls initial state, then opens an SSE stream.
 * Tolerant to flaky networks:
 *   - listens to navigator online/offline events,
 *   - watchdog-detects stalled SSE and force-reconnects,
 *   - falls back to a faster poll while SSE is degraded.
 */
export function useRoom(code: string): UseRoomResult {
  const [room, setRoom] = useState<Room | null>(null);
  const [you, setYou] = useState<string | null>(null);
  const [status, setStatus] = useState<RoomStatus>("loading");
  const [connection, setConnection] = useState<ConnectionStatus>("online");
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const cancelledRef = useRef(false);
  const versionRef = useRef<number>(0);

  const refresh = useCallback(() => setReloadKey((n) => n + 1), []);

  const applyFresh = useCallback((fresh: Room) => {
    const v = fresh.version ?? 0;
    if (v < versionRef.current) return;
    versionRef.current = v;
    setRoom(fresh);
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    let es: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let watchdog: ReturnType<typeof setInterval> | null = null;
    let lastActivityAt = Date.now();
    let pollIntervalMs = SLOW_POLL_MS;

    const isBrowserOnline = () =>
      typeof navigator === "undefined" ? true : navigator.onLine !== false;

    const setConnSafe = (next: ConnectionStatus) => {
      if (!cancelledRef.current) setConnection(next);
    };

    const startPoll = (intervalMs: number) => {
      if (pollTimer) clearInterval(pollTimer);
      pollIntervalMs = intervalMs;
      pollTimer = setInterval(() => {
        api
          .getRoom(code)
          .then(({ room: fresh }) => {
            if (cancelledRef.current) return;
            applyFresh(fresh);
            // Successful poll = transport is alive. SSE may still be
            // reconnecting; honour that, but at least the data is fresh.
            if (es && es.readyState === EventSource.OPEN) setConnSafe("online");
          })
          .catch(() => {
            // Transient — useRoom tolerates failed polls. Connection
            // status is driven by SSE state and navigator.onLine.
          });
      }, intervalMs);
    };

    const onActivity = () => {
      lastActivityAt = Date.now();
      if (isBrowserOnline()) setConnSafe("online");
      // Slow the polls back down once SSE is healthy.
      if (pollIntervalMs !== SLOW_POLL_MS) startPoll(SLOW_POLL_MS);
    };

    const openStream = () => {
      if (cancelledRef.current) return;
      try {
        es?.close();
      } catch {}
      es = new EventSource(`/api/rooms/${code}/events`);
      es.onopen = () => onActivity();
      es.onmessage = (ev) => {
        onActivity();
        if (!ev.data) return;
        try {
          const parsed = JSON.parse(ev.data) as { type: string; room?: Room };
          if (parsed.type === "state" && parsed.room) {
            applyFresh(parsed.room);
          }
        } catch {
          /* ignore parse errors */
        }
      };
      es.onerror = () => {
        if (cancelledRef.current || !es) return;
        if (!isBrowserOnline()) {
          setConnSafe("offline");
        } else if (es.readyState === EventSource.CLOSED) {
          setConnSafe("offline");
        } else {
          setConnSafe("reconnecting");
        }
        // While SSE is unhealthy, poll faster so state stays fresh.
        if (pollIntervalMs !== FAST_POLL_MS) startPoll(FAST_POLL_MS);
      };
    };

    (async () => {
      try {
        const initial = await api.getRoom(code);
        if (cancelledRef.current) return;
        applyFresh(initial.room);
        setYou(initial.you);
        setStatus("ready");
        setError(null);
      } catch (err) {
        if (cancelledRef.current) return;
        const message = err instanceof Error ? err.message : String(err);
        if (/not in room/i.test(message)) {
          setStatus("needs-join");
          setError(null);
        } else {
          setError(message);
          setStatus("error");
        }
        return;
      }

      openStream();
      startPoll(SLOW_POLL_MS);

      // Watchdog: silent EventSource. Some carriers / NATs hold a
      // half-open TCP connection where the browser never fires onerror
      // but no data arrives either. If we go STALL_MS without an event
      // OR a heartbeat, force a reconnect.
      watchdog = setInterval(() => {
        if (cancelledRef.current || !es) return;
        const silence = Date.now() - lastActivityAt;
        if (
          silence > STALL_MS &&
          es.readyState === EventSource.OPEN &&
          isBrowserOnline()
        ) {
          setConnSafe("reconnecting");
          openStream();
          lastActivityAt = Date.now();
        }
      }, 5_000);
    })();

    const onOnline = () => {
      // Network came back: resync immediately and re-establish SSE
      // (browser auto-reconnect uses 3s + jittered backoff and may have
      // given up by now).
      setConnSafe("reconnecting");
      openStream();
      api
        .getRoom(code)
        .then(({ room: fresh }) => {
          if (!cancelledRef.current) applyFresh(fresh);
          setConnSafe("online");
        })
        .catch(() => {});
    };
    const onOffline = () => setConnSafe("offline");

    if (typeof window !== "undefined") {
      window.addEventListener("online", onOnline);
      window.addEventListener("offline", onOffline);
      if (!isBrowserOnline()) setConnSafe("offline");
    }

    return () => {
      cancelledRef.current = true;
      try {
        es?.close();
      } catch {}
      if (pollTimer) clearInterval(pollTimer);
      if (watchdog) clearInterval(watchdog);
      if (typeof window !== "undefined") {
        window.removeEventListener("online", onOnline);
        window.removeEventListener("offline", onOffline);
      }
    };
  }, [code, reloadKey, applyFresh]);

  return { room, you, status, connection, error, refresh };
}
