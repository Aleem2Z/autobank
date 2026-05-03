import { MemoryStore } from "./memory";
import type { Store } from "./types";

declare global {

  var __autobankStore: Store | undefined;
}

function pickStore(): Store {
  // Future: if (process.env.UPSTASH_REDIS_REST_URL) return new RedisStore();
  return new MemoryStore();
}

export const store: Store = (globalThis.__autobankStore ??= pickStore());
