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

export type TxStatus = "pending" | "confirmed" | "rejected" | "reversed";

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
  status: TxStatus;
  reversedBy?: string;
}

export interface Partnership {
  id: string;
  memberIds: string[];
  notes: string;
  createdAt: number;
}

export interface Room {
  code: string;
  passcodeHash: string;
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
}

export type RoomEvent =
  | { type: "state"; room: Room }
  | { type: "tx"; tx: Transaction }
  | { type: "player-online"; playerId: string; online: boolean };
