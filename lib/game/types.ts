export type Mode = "official" | "house";

export type AssetKind = "property" | "railroad" | "utility" | "house" | "hotel" | "goojf";

export interface AssetDef {
  id: string;
  kind: AssetKind;
  name: string;
  group?: string;
  price?: number;
  mortgage?: number;
  houseCost?: number;
  rent?: number[];
  position?: number;
}

export interface PlayerAsset {
  defId: string;
  mortgaged?: boolean;
  houses?: number;
}

export interface Player {
  id: string;
  name: string;
  color: string;
  cash: number;
  assets: PlayerAsset[];
  isAdmin: boolean;
  joinedAt: number;
  online: boolean;
}

export type ReasonPreset =
  | "pass-go"
  | "income-tax"
  | "luxury-tax"
  | "chance"
  | "community-chest"
  | "jail-fine"
  | "buy-property"
  | "mortgage"
  | "unmortgage"
  | "build"
  | "sell-building"
  | "rent"
  | "gift"
  | "loan"
  | "other";

export type TxKind = "p2p" | "pay-bank" | "request-bank" | "asset-move" | "split";

export type TxStatus = "pending" | "confirmed" | "rejected";

export interface AssetMovement {
  defId: string;
  fromPlayerId: string | "bank";
  toPlayerId: string | "bank";
  mortgaged?: boolean;
}

export interface CashMovement {
  fromPlayerId: string | "bank";
  toPlayerId: string | "bank";
  amount: number;
}

export interface SplitChild {
  toPlayerId: string;
  amount: number;
}

export interface Transaction {
  id: string;
  /** Client-supplied idempotency key. If a propose retries with the same
   *  key, the server returns the original tx instead of creating a duplicate. */
  clientTxId?: string;
  kind: TxKind;
  reason: ReasonPreset;
  reasonNote?: string;
  cash?: CashMovement[];
  assets?: AssetMovement[];
  splitChildren?: SplitChild[];
  proposedBy: string;
  proposedAt: number;
  requiresConfirmFrom: string[];
  confirmedBy: string[];
  rejectedBy?: string;
  objectionDeadline?: number;
  /** Player ids who hit "Object" within the window. Auto-confirm sweep
   *  treats a non-empty list as a forced rejection. */
  objections?: string[];
  status: TxStatus;
}

export interface Partnership {
  id: string;
  memberIds: string[];
  notes: string;
  createdAt: number;
}

export interface Room {
  code: string;
  /** Optional on the wire — `publicRoom()` strips it before publish/return. */
  passcodeHash?: string;
  mode: Mode;
  preset: "monopoly-us";
  startingBalance: number;
  bankCash: number;
  bankAssets: PlayerAsset[];
  scarcity: { houses?: number; hotels?: number };
  players: Player[];
  partnerships: Partnership[];
  transactions: Transaction[];
  createdAt: number;
  /** Monotonic version, bumped on every saveRoom — clients use this to
   *  ignore stale poll responses that arrive after a fresher SSE state. */
  version?: number;
}

export type RoomEvent =
  | { type: "state"; room: Room }
  | { type: "tx"; tx: Transaction }
  | { type: "player-online"; playerId: string; online: boolean };
