import { Redis } from "ioredis";
import type { Store } from "./types";
import type { Room, RoomEvent } from "@/lib/game/types";

/**
 * RedisStore — implements the Store interface against a Redis 7+ server.
 *
 * Connections:
 *   - One "command" client used for GET/SET/PUBLISH.
 *   - One dedicated "subscriber" client. Once a Redis connection enters
 *     subscribe mode it can no longer issue regular commands, so we keep a
 *     second connection just for SUBSCRIBE/UNSUBSCRIBE.
 *
 * Pub/Sub fan-out:
 *   We multiplex all in-process subscribers across a single subscriber
 *   connection by attaching one global 'message' handler that routes by
 *   channel name. We reference-count per-channel listeners, calling
 *   SUBSCRIBE on first listener and UNSUBSCRIBE when the last one detaches.
 *
 * Persistence:
 *   Rooms are SET as JSON strings under key `room:<CODE>` with no TTL.
 *
 * Reconnection:
 *   ioredis auto-reconnects by default (lazy retry strategy). We log
 *   connection-level errors so they're visible in the deployment console
 *   but never throw or crash the process.
 */

const ROOM_KEY = (code: string) => `room:${code}`;
const CHAN = (code: string) => `room:${code}:events`;

type Listener = (e: RoomEvent) => void;

export class RedisStore implements Store {
  private client: Redis;
  private subscriber: Redis;
  private listeners = new Map<string, Set<Listener>>();
  private subscriberReady = false;
  private subscriberInit?: Promise<void>;

  constructor(url: string) {
    // lazyConnect:false (default) — connection happens immediately so the
    // first command doesn't pay the connect latency. ioredis handles
    // backoff and reconnection automatically.
    this.client = new Redis(url, { maxRetriesPerRequest: null });
    this.subscriber = new Redis(url, { maxRetriesPerRequest: null });

    this.client.on("error", (err) => {
      console.error("[redis] client error:", err.message);
    });
    this.subscriber.on("error", (err) => {
      console.error("[redis] subscriber error:", err.message);
    });

    this.subscriber.on("message", (channel: string, payload: string) => {
      const set = this.listeners.get(channel);
      if (!set || set.size === 0) return;
      let event: RoomEvent;
      try {
        event = JSON.parse(payload) as RoomEvent;
      } catch (err) {
        console.error("[redis] bad payload on", channel, err);
        return;
      }
      // Snapshot to avoid mutation during iteration.
      for (const fn of [...set]) {
        try {
          fn(event);
        } catch (err) {
          console.error("[redis] listener threw:", err);
        }
      }
    });
  }

  async getRoom(code: string): Promise<Room | null> {
    const raw = await this.client.get(ROOM_KEY(code));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Room;
    } catch (err) {
      console.error("[redis] failed to parse room", code, err);
      return null;
    }
  }

  async saveRoom(room: Room): Promise<void> {
    await this.client.set(ROOM_KEY(room.code), JSON.stringify(room));
  }

  async publish(code: string, event: RoomEvent): Promise<void> {
    await this.client.publish(CHAN(code), JSON.stringify(event));
  }

  subscribe(code: string, fn: (e: RoomEvent) => void): () => void {
    const channel = CHAN(code);
    let set = this.listeners.get(channel);
    if (!set) {
      set = new Set();
      this.listeners.set(channel, set);
      // First listener for this channel — issue SUBSCRIBE. Fire-and-forget;
      // if it races with an immediate PUBLISH from this same process the
      // event still propagates because publish goes via the command client
      // and is delivered to all subscribers including our own once the
      // subscribe completes.
      void this.subscriber.subscribe(channel).catch((err) => {
        console.error("[redis] subscribe failed for", channel, err);
      });
    }
    set.add(fn);

    let unsubscribed = false;
    return () => {
      if (unsubscribed) return;
      unsubscribed = true;
      const cur = this.listeners.get(channel);
      if (!cur) return;
      cur.delete(fn);
      if (cur.size === 0) {
        this.listeners.delete(channel);
        void this.subscriber.unsubscribe(channel).catch((err) => {
          console.error("[redis] unsubscribe failed for", channel, err);
        });
      }
    };
  }

  /** For tests / graceful shutdown. */
  async disconnect(): Promise<void> {
    this.listeners.clear();
    await Promise.allSettled([this.client.quit(), this.subscriber.quit()]);
  }

  // Reserved for tests: ensure the subscriber connection is ready before
  // expecting messages. Currently unused since ioredis queues subscribe
  // commands until the connection is up.
  private async ensureSubscriberReady(): Promise<void> {
    if (this.subscriberReady) return;
    if (!this.subscriberInit) {
      this.subscriberInit = new Promise<void>((resolve) => {
        if (this.subscriber.status === "ready") {
          this.subscriberReady = true;
          resolve();
          return;
        }
        this.subscriber.once("ready", () => {
          this.subscriberReady = true;
          resolve();
        });
      });
    }
    return this.subscriberInit;
  }
}
