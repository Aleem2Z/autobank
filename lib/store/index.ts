import { MemoryStore } from "./memory";
import type { Store } from "./types";

declare global {

  var __autobankStore: Store | undefined;
}

function pickStore(): Store {
  if (process.env.REDIS_URL) {
    // Lazy-require so the ioredis module isn't pulled in for in-memory
    // dev sessions (and so tests that don't set REDIS_URL never connect).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { RedisStore } = require("./redis") as typeof import("./redis");
    console.log("[store] using RedisStore");
    return new RedisStore(process.env.REDIS_URL);
  }
  console.log("[store] using MemoryStore (no REDIS_URL set)");
  return new MemoryStore();
}

export const store: Store = (globalThis.__autobankStore ??= pickStore());
