import type {
  AssetMovement,
  CashMovement,
  ProposeTradeBody,
} from "./trade-types";

export interface TradeSide {
  cash: number;
  assetIds: string[];
}

export interface TradeDraft {
  youId: string;
  partnerId: string;
  give: TradeSide;
  get: TradeSide;
}

export interface TradeBuildResult {
  ok: boolean;
  reason?: string;
  body?: ProposeTradeBody;
}

/**
 * Pure builder: turns the trade picker state into a propose body
 * (`kind: "asset-move"`). Returns `{ ok: false, reason }` when the trade
 * is invalid, otherwise `{ ok: true, body }`.
 *
 * Rules:
 *  - youId !== partnerId
 *  - cash on either side is non-negative integer
 *  - at least one of (give.cash, get.cash, give.assets, get.assets) must be > 0
 *  - the same asset cannot appear on both sides
 *  - asset ids on each side must be unique
 */
export function buildTradeBody(draft: TradeDraft): TradeBuildResult {
  if (!draft.youId || !draft.partnerId) {
    return { ok: false, reason: "Pick a trade partner." };
  }
  if (draft.youId === draft.partnerId) {
    return { ok: false, reason: "Cannot trade with yourself." };
  }

  const giveCash = Math.floor(draft.give.cash || 0);
  const getCash = Math.floor(draft.get.cash || 0);

  if (giveCash < 0 || getCash < 0 || !Number.isFinite(giveCash) || !Number.isFinite(getCash)) {
    return { ok: false, reason: "Cash amounts must be ≥ 0." };
  }

  const giveAssets = Array.from(new Set(draft.give.assetIds.filter(Boolean)));
  const getAssets = Array.from(new Set(draft.get.assetIds.filter(Boolean)));

  for (const id of giveAssets) {
    if (getAssets.includes(id)) {
      return { ok: false, reason: "Same property cannot appear on both sides." };
    }
  }

  if (giveCash === 0 && getCash === 0 && giveAssets.length === 0 && getAssets.length === 0) {
    return { ok: false, reason: "Add cash or properties to trade." };
  }

  const cash: CashMovement[] = [];
  if (giveCash > 0) {
    cash.push({ fromPlayerId: draft.youId, toPlayerId: draft.partnerId, amount: giveCash });
  }
  if (getCash > 0) {
    cash.push({ fromPlayerId: draft.partnerId, toPlayerId: draft.youId, amount: getCash });
  }

  const assets: AssetMovement[] = [
    ...giveAssets.map((defId) => ({
      defId,
      fromPlayerId: draft.youId,
      toPlayerId: draft.partnerId,
    })),
    ...getAssets.map((defId) => ({
      defId,
      fromPlayerId: draft.partnerId,
      toPlayerId: draft.youId,
    })),
  ];

  return {
    ok: true,
    body: {
      kind: "asset-move",
      reason: "other",
      cash: cash.length ? cash : undefined,
      assets: assets.length ? assets : undefined,
    },
  };
}
