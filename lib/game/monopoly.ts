import type { AssetDef, ReasonPreset } from "./types";

export const MONOPOLY_US: AssetDef[] = [
  // Browns
  { id: "mediterranean", kind: "property", name: "Mediterranean Avenue", group: "brown", price: 60, mortgage: 30, houseCost: 50, rent: [2, 10, 30, 90, 160, 250], position: 1 },
  { id: "baltic", kind: "property", name: "Baltic Avenue", group: "brown", price: 60, mortgage: 30, houseCost: 50, rent: [4, 20, 60, 180, 320, 450], position: 3 },
  // Light blues
  { id: "oriental", kind: "property", name: "Oriental Avenue", group: "lightblue", price: 100, mortgage: 50, houseCost: 50, rent: [6, 30, 90, 270, 400, 550], position: 6 },
  { id: "vermont", kind: "property", name: "Vermont Avenue", group: "lightblue", price: 100, mortgage: 50, houseCost: 50, rent: [6, 30, 90, 270, 400, 550], position: 8 },
  { id: "connecticut", kind: "property", name: "Connecticut Avenue", group: "lightblue", price: 120, mortgage: 60, houseCost: 50, rent: [8, 40, 100, 300, 450, 600], position: 9 },
  // Pinks
  { id: "st-charles", kind: "property", name: "St. Charles Place", group: "pink", price: 140, mortgage: 70, houseCost: 100, rent: [10, 50, 150, 450, 625, 750], position: 11 },
  { id: "states", kind: "property", name: "States Avenue", group: "pink", price: 140, mortgage: 70, houseCost: 100, rent: [10, 50, 150, 450, 625, 750], position: 13 },
  { id: "virginia", kind: "property", name: "Virginia Avenue", group: "pink", price: 160, mortgage: 80, houseCost: 100, rent: [12, 60, 180, 500, 700, 900], position: 14 },
  // Oranges
  { id: "st-james", kind: "property", name: "St. James Place", group: "orange", price: 180, mortgage: 90, houseCost: 100, rent: [14, 70, 200, 550, 750, 950], position: 16 },
  { id: "tennessee", kind: "property", name: "Tennessee Avenue", group: "orange", price: 180, mortgage: 90, houseCost: 100, rent: [14, 70, 200, 550, 750, 950], position: 18 },
  { id: "new-york", kind: "property", name: "New York Avenue", group: "orange", price: 200, mortgage: 100, houseCost: 100, rent: [16, 80, 220, 600, 800, 1000], position: 19 },
  // Reds
  { id: "kentucky", kind: "property", name: "Kentucky Avenue", group: "red", price: 220, mortgage: 110, houseCost: 150, rent: [18, 90, 250, 700, 875, 1050], position: 21 },
  { id: "indiana", kind: "property", name: "Indiana Avenue", group: "red", price: 220, mortgage: 110, houseCost: 150, rent: [18, 90, 250, 700, 875, 1050], position: 23 },
  { id: "illinois", kind: "property", name: "Illinois Avenue", group: "red", price: 240, mortgage: 120, houseCost: 150, rent: [20, 100, 300, 750, 925, 1100], position: 24 },
  // Yellows
  { id: "atlantic", kind: "property", name: "Atlantic Avenue", group: "yellow", price: 260, mortgage: 130, houseCost: 150, rent: [22, 110, 330, 800, 975, 1150], position: 26 },
  { id: "ventnor", kind: "property", name: "Ventnor Avenue", group: "yellow", price: 260, mortgage: 130, houseCost: 150, rent: [22, 110, 330, 800, 975, 1150], position: 27 },
  { id: "marvin-gardens", kind: "property", name: "Marvin Gardens", group: "yellow", price: 280, mortgage: 140, houseCost: 150, rent: [24, 120, 360, 850, 1025, 1200], position: 29 },
  // Greens
  { id: "pacific", kind: "property", name: "Pacific Avenue", group: "green", price: 300, mortgage: 150, houseCost: 200, rent: [26, 130, 390, 900, 1100, 1275], position: 31 },
  { id: "north-carolina", kind: "property", name: "North Carolina Avenue", group: "green", price: 300, mortgage: 150, houseCost: 200, rent: [26, 130, 390, 900, 1100, 1275], position: 32 },
  { id: "pennsylvania", kind: "property", name: "Pennsylvania Avenue", group: "green", price: 320, mortgage: 160, houseCost: 200, rent: [28, 150, 450, 1000, 1200, 1400], position: 34 },
  // Dark blues
  { id: "park-place", kind: "property", name: "Park Place", group: "darkblue", price: 350, mortgage: 175, houseCost: 200, rent: [35, 175, 500, 1100, 1300, 1500], position: 37 },
  { id: "boardwalk", kind: "property", name: "Boardwalk", group: "darkblue", price: 400, mortgage: 200, houseCost: 200, rent: [50, 200, 600, 1400, 1700, 2000], position: 39 },
  // Railroads
  { id: "reading-rr", kind: "railroad", name: "Reading Railroad", group: "rail", price: 200, mortgage: 100, rent: [25, 50, 100, 200], position: 5 },
  { id: "pennsylvania-rr", kind: "railroad", name: "Pennsylvania Railroad", group: "rail", price: 200, mortgage: 100, rent: [25, 50, 100, 200], position: 15 },
  { id: "b-and-o-rr", kind: "railroad", name: "B. & O. Railroad", group: "rail", price: 200, mortgage: 100, rent: [25, 50, 100, 200], position: 25 },
  { id: "short-line", kind: "railroad", name: "Short Line", group: "rail", price: 200, mortgage: 100, rent: [25, 50, 100, 200], position: 35 },
  // Utilities
  { id: "electric", kind: "utility", name: "Electric Company", group: "utility", price: 150, mortgage: 75, position: 12 },
  { id: "water", kind: "utility", name: "Water Works", group: "utility", price: 150, mortgage: 75, position: 28 },
];

export const REASON_LABELS: Record<ReasonPreset, { label: string; default?: number; sign: "pay" | "collect" | "either" }> = {
  "pass-go":         { label: "Pass GO",         default: 200, sign: "collect" },
  "income-tax":      { label: "Income Tax",      default: 200, sign: "pay" },
  "luxury-tax":      { label: "Luxury Tax",      default: 100, sign: "pay" },
  "chance":          { label: "Chance",                       sign: "either" },
  "community-chest": { label: "Community Chest",              sign: "either" },
  "jail-fine":       { label: "Jail Fine",       default: 50, sign: "pay" },
  "buy-property":    { label: "Buy Property",                 sign: "pay" },
  "mortgage":        { label: "Mortgage",                     sign: "collect" },
  "unmortgage":      { label: "Unmortgage",                   sign: "pay" },
  "build":           { label: "Build",                        sign: "pay" },
  "sell-building":   { label: "Sell Building",                sign: "collect" },
  "rent":            { label: "Rent",                         sign: "either" },
  "gift":            { label: "Gift",                         sign: "either" },
  "loan":            { label: "Loan",                         sign: "either" },
  "other":           { label: "Other",                        sign: "either" },
};

export const GROUP_TOKENS: Record<string, string> = {
  brown:     "var(--mono-brown)",
  lightblue: "var(--mono-lightblue)",
  pink:      "var(--mono-pink)",
  orange:    "var(--mono-orange)",
  red:       "var(--mono-red)",
  yellow:    "var(--mono-yellow)",
  green:     "var(--mono-green)",
  darkblue:  "var(--mono-darkblue)",
  rail:      "var(--mono-rail)",
  utility:   "var(--mono-utility)",
};

export function getAssetDef(id: string): AssetDef | undefined {
  return MONOPOLY_US.find((a) => a.id === id);
}

export const STARTING_BALANCE_DEFAULT = 1500;

export const PLAYER_COLORS = [
  "#dc2626", // red
  "#2563eb", // blue
  "#16a34a", // green
  "#f59e0b", // amber
  "#9333ea", // purple
  "#ec4899", // pink
  "#0891b2", // cyan
  "#71717a", // gray
] as const;

const PLAYER_COLOR_SET = new Set<string>(
  PLAYER_COLORS.map((c) => c.toLowerCase()),
);

/**
 * True iff `value` is a valid 6-digit hex color *and* belongs to the
 * canonical PLAYER_COLORS palette. Comparison is case-insensitive so
 * `"#DC2626"` and `"#dc2626"` both pass.
 */
export function isValidPlayerColor(value: string): boolean {
  if (typeof value !== "string") return false;
  if (!/^#[0-9a-fA-F]{6}$/.test(value)) return false;
  return PLAYER_COLOR_SET.has(value.toLowerCase());
}
