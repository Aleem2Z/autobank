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

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "same-origin",
    headers: init?.body ? { "content-type": "application/json" } : undefined,
    ...init,
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
  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : null) ?? `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export interface CreateRoomInput {
  passcode: string;
  adminName: string;
  startingBalance?: number;
  mode?: Mode;
  scarcityHouses?: number;
  scarcityHotels?: number;
}

export interface JoinRoomInput {
  passcode: string;
  name: string;
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
    return request<{ code: string; playerId: string }>("/api/rooms", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  joinRoom(code: string, input: JoinRoomInput) {
    return request<{ code: string; playerId: string }>(`/api/rooms/${code}/join`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  getRoom(code: string) {
    return request<RoomState>(`/api/rooms/${code}`);
  },
  propose(code: string, input: ProposeInput) {
    return request<{ tx: Transaction }>(`/api/rooms/${code}/transactions`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  decide(code: string, txId: string, decision: "confirm" | "reject" | "object") {
    return request<{ tx: Transaction }>(`/api/rooms/${code}/transactions/${txId}/decide`, {
      method: "POST",
      body: JSON.stringify({ decision }),
    });
  },
  undo(code: string, txId: string) {
    return request<{ tx: Transaction }>(`/api/rooms/${code}/transactions/${txId}/undo`, {
      method: "POST",
    });
  },
};
