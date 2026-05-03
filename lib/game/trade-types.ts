import type { AssetMovement, CashMovement, ReasonPreset } from "./types";

export type { AssetMovement, CashMovement };

export interface ProposeTradeBody {
  kind: "asset-move";
  reason: ReasonPreset;
  reasonNote?: string;
  cash?: CashMovement[];
  assets?: AssetMovement[];
}
