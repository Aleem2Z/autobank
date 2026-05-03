import type {
  AssetMovement,
  CashMovement,
  Mode,
  ReasonPreset,
  Room,
  SplitChild,
  Transaction,
  TxKind,
} from "@/lib/game/types";

/**
 * HTTP client with idempotency + retry. Designed for phone-at-the-table
 * conditions:
 *   - propose() carries a `clientTxId` so a network retry can't double-
 *     apply a payment. The server folds duplicate clientTxIds.
 *   - decide() is naturally idempotent server-side (already-decided
 *     returns 409, which we treat as success).
 *   - Idempotent calls retry with exponential backoff on transport
 *     errors and 5xx responses; 4xx responses surface immediately.
 */

interface RequestOptions extends RequestInit {
  /** When true, retry transport errors / 5xx with exponential backoff. */
  retry?: boolean;
  /** Status codes that, if returned, should resolve normally (not throw). */
  okStatuses?: number[];
}

// 6 attempts with capped exponential backoff: 300, 600, 1200, 2400, 4000, 4000ms
// → ~12.5s total budget. Long enough to ride out a typical phone-network
// hiccup, short enough that the user notices something is wrong if it
// persists past that.
const RETRY_MAX_ATTEMPTS = 6;
const RETRY_BASE_DELAY_MS = 300;
const RETRY_MAX_DELAY_MS = 4_000;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Resolves either when `window` fires the `online` event or when the
 * timeout elapses, whichever comes first. No-op (immediate resolve) on
 * the server.
 */
function waitUntilOnlineOrTimeout(timeoutMs: number): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    const cleanup = () => {
      window.removeEventListener("online", onOnline);
      clearTimeout(timer);
      resolve();
    };
    const onOnline = () => cleanup();
    const timer = setTimeout(cleanup, timeoutMs);
    window.addEventListener("online", onOnline);
  });
}

async function request<T>(url: string, opts: RequestOptions = {}): Promise<T> {
  const { retry, okStatuses, ...init } = opts;
  const headers: Record<string, string> = {};
  if (init.body) headers["content-type"] = "application/json";
  if (init.headers) Object.assign(headers, init.headers as Record<string, string>);

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= (retry ? RETRY_MAX_ATTEMPTS : 1); attempt++) {
    try {
      const res = await fetch(url, {
        credentials: "same-origin",
        ...init,
        headers,
      });
      let data: unknown = null;
      const text = await res.text();
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }

      if (res.ok || okStatuses?.includes(res.status)) {
        return data as T;
      }

      // Retryable server-side: 408, 429, 5xx
      const retryable =
        retry && (res.status === 408 || res.status === 429 || res.status >= 500);
      if (!retryable) {
        const message =
          (data && typeof data === "object" && "error" in data &&
          typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : null) ?? `Request failed (${res.status})`;
        const err = new Error(message) as Error & { status?: number };
        err.status = res.status;
        throw err;
      }
      lastError = new Error(`Server ${res.status}`);
    } catch (err) {
      // Transport error (offline, DNS, fetch abort) is retryable.
      if (!retry) throw err;
      lastError = err;
    }
    // Capped exponential backoff with jitter.
    const delay = Math.min(
      RETRY_BASE_DELAY_MS * 2 ** (attempt - 1) + Math.random() * 150,
      RETRY_MAX_DELAY_MS,
    );
    // If the browser knows we're offline, don't burn retries — wait for
    // the `online` event and then resume. Caps the wait at 30s so a
    // disconnected user still gets a final attempt and a clear error.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      await waitUntilOnlineOrTimeout(30_000);
    }
    await sleep(delay);
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Network request failed");
}

function makeClientTxId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (older Safari).
  return `cli-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface CreateRoomInput {
  startingBalance?: number;
  mode?: Mode;
  scarcityHouses?: number;
  scarcityHotels?: number;
  /** Admin passcode for the deployed instance (set via INSTANCE_PASSCODE env var). */
  instancePasscode?: string;
}

export interface JoinRoomInput {
  name: string;
  /** Optional hex color from `PLAYER_COLORS`. Server falls back to auto-assignment. */
  color?: string;
}

export interface RoomPreview {
  exists: true;
  code: string;
  mode: Mode;
  startingBalance: number;
  playerCount: number;
  usedColors: string[];
  usedNames: string[];
  canClaimAdmin: boolean;
}

export interface ProposeInput {
  kind: TxKind;
  reason: ReasonPreset;
  reasonNote?: string;
  cash?: CashMovement[];
  assets?: AssetMovement[];
  splitChildren?: SplitChild[];
}

export interface RoomState {
  room: Room;
  you: string;
}

export const api = {
  createRoom(input: CreateRoomInput) {
    return request<{ code: string }>("/api/rooms", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  joinRoom(code: string, input: JoinRoomInput) {
    return request<{ code: string; playerId: string; isAdmin: boolean }>(
      `/api/rooms/${code}/join`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },
  previewRoom(code: string) {
    return request<RoomPreview>(`/api/rooms/${code}/preview`, { retry: true });
  },
  getRoom(code: string) {
    return request<RoomState>(`/api/rooms/${code}`, { retry: true });
  },
  propose(code: string, input: ProposeInput) {
    // Idempotency: clientTxId folds retries server-side. Safe to retry
    // transport errors because the server returns the original tx if it
    // already saw this id.
    const clientTxId = makeClientTxId();
    return request<{ tx: Transaction }>(`/api/rooms/${code}/transactions`, {
      method: "POST",
      retry: true,
      body: JSON.stringify({ ...input, clientTxId }),
    });
  },
  /**
   * Decide is server-side idempotent: a second call after a successful
   * decide returns 409 with the current tx. We treat 409 as "already
   * applied" and resolve normally so the caller doesn't see a spurious
   * error after a flaky network retry.
   */
  decide(code: string, txId: string, decision: "confirm" | "reject" | "object") {
    return request<{ tx: Transaction; error?: string }>(
      `/api/rooms/${code}/transactions/${txId}/decide`,
      {
        method: "POST",
        retry: true,
        okStatuses: [409],
        body: JSON.stringify({ decision }),
      },
    );
  },
};
