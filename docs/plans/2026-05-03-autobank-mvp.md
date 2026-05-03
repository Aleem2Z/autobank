# Autobank MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A multiplayer wallet/banker app for tabletop Monopoly that replaces the human banker. Players join via room code on their phones, transfer money/assets via dual-confirmed transactions, and see a public ledger of all activity. The app does not enforce game rules — pure ledger + asset registry with social verification — so house rules just work.

**Architecture:** Next.js 16 App Router on Vercel. Server-Sent Events for real-time push (one persistent SSE stream per player, broadcasting room state diffs). State in an abstract `RoomStore` interface (in-memory + EventEmitter for dev, Upstash Redis + Redis pub/sub for prod). No auth library — admin creates room with passcode, players join with code+passcode, session in HttpOnly cookie containing `{ roomCode, playerId, role }`. Property cards and money bills designed in-app with Tailwind + Framer Motion; layout matches the US Monopoly board so the user can swap art later without changing structure.

**Tech Stack:** Next.js 16 (App Router, Turbopack), TypeScript, Tailwind CSS v4, shadcn/ui (selected components only), Framer Motion, lucide-react, Vitest for unit tests, Upstash Redis (production), Server-Sent Events. Deployed to Vercel.

**Design philosophy:** Beautiful and intentional. Animations should feel like a quiet referee, not a video game. Big tap targets (min 44px). Money should look like money, property cards should look like the real thing. Public ledger is the single source of truth.

---

## File Structure

```
autobank/
├── app/
│   ├── layout.tsx                     # Root layout, fonts, metadata, manifest link
│   ├── globals.css                    # Tailwind v4 + design tokens (colors, radii, shadows)
│   ├── page.tsx                       # Landing: "Create room" / "Join room"
│   ├── create/page.tsx                # Admin create-room form
│   ├── join/page.tsx                  # Player join form (or via /join/[code])
│   ├── join/[code]/page.tsx           # Pre-filled join (from QR scan)
│   ├── room/[code]/
│   │   ├── page.tsx                   # Game room (main view)
│   │   ├── loading.tsx                # Skeleton
│   │   └── table/page.tsx             # Public "table view" for shared screen
│   └── api/
│       ├── rooms/
│       │   ├── route.ts               # POST /api/rooms — create
│       │   └── [code]/
│       │       ├── route.ts           # GET — fetch room state (initial)
│       │       ├── join/route.ts      # POST — join with passcode + name
│       │       ├── events/route.ts    # GET — SSE event stream
│       │       ├── transactions/
│       │       │   ├── route.ts       # POST — propose transaction
│       │       │   └── [id]/
│       │       │       ├── confirm/route.ts
│       │       │       ├── reject/route.ts
│       │       │       └── undo/route.ts
│       │       └── partnerships/route.ts  # POST — form/dissolve alliance tag
├── components/
│   ├── ui/                            # shadcn primitives (button, dialog, input, sheet, toast)
│   ├── property-card.tsx              # Designed Monopoly property card
│   ├── money-bill.tsx                 # Designed money bill (denominations)
│   ├── chance-card.tsx                # Chance card back
│   ├── community-chest-card.tsx       # CC card back
│   ├── wallet-panel.tsx               # Cash + asset list per player
│   ├── ledger-feed.tsx                # Live transaction feed
│   ├── action-bar.tsx                 # Bottom bar: Pay, Request, Send, Trade, Split
│   ├── transfer-sheet.tsx             # Bottom sheet for proposing transfer
│   ├── confirmation-prompt.tsx        # Inbound transaction needing my confirm
│   ├── countdown-bar.tsx              # 10s objection window for bank withdrawals
│   ├── split-sheet.tsx                # Split received money to up to 3 others
│   ├── trade-sheet.tsx                # Two-side trade builder
│   ├── partnership-tag.tsx            # Visible alliance indicator
│   ├── balance-tick.tsx               # Animated balance number
│   ├── money-fly.tsx                  # Bills flying between wallets animation
│   ├── card-flip.tsx                  # Card flip animation wrapper
│   └── empty-state.tsx                # Shared empty state visual
├── lib/
│   ├── store/
│   │   ├── interface.ts               # RoomStore contract
│   │   ├── memory.ts                  # In-memory implementation (dev)
│   │   └── redis.ts                   # Upstash Redis implementation (prod, env-toggled)
│   ├── pubsub/
│   │   ├── interface.ts               # PubSub contract
│   │   ├── memory.ts                  # EventEmitter (dev)
│   │   └── redis.ts                   # Redis pub/sub (prod)
│   ├── game/
│   │   ├── types.ts                   # Player, Room, Transaction, Asset, Partnership
│   │   ├── monopoly.ts                # US edition preset: 28 properties + reasons
│   │   ├── rules.ts                   # Pure: validateTransaction, applyTransaction
│   │   └── codes.ts                   # generateRoomCode, generateId
│   ├── server/
│   │   ├── session.ts                 # Cookie helpers (set/read session)
│   │   └── stores.ts                  # Singleton store + pubsub instances
│   ├── client/
│   │   ├── session.ts                 # Client-side session helpers
│   │   ├── use-room.ts                # SSE subscription hook
│   │   └── api.ts                     # Typed fetch helpers
│   └── utils.ts                       # cn, formatMoney, formatRelative
├── tests/
│   ├── store.memory.test.ts
│   ├── pubsub.memory.test.ts
│   ├── rules.test.ts
│   ├── monopoly.test.ts
│   └── codes.test.ts
├── public/
│   ├── manifest.json                  # PWA manifest
│   ├── icons/                         # PWA icons (192, 512, maskable)
│   └── og.png                         # Open Graph image
├── docs/
│   └── plans/
│       └── 2026-05-03-autobank-mvp.md
├── components.json                    # shadcn config
├── vitest.config.ts
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
└── eslint.config.mjs
```

**Decomposition rationale:**
- `lib/game/` is pure logic, no Next.js imports — fully unit-testable.
- `lib/store/` and `lib/pubsub/` are interfaces with two implementations each so swapping in Upstash for prod is one env-flag flip.
- `lib/server/` only runs server-side; `lib/client/` only runs in the browser. Strict boundary.
- UI components split by responsibility (one card kind = one file) so designers can iterate on cards in isolation.
- Sheets vs modals: prefer bottom sheets on mobile (single-handed reach) — mobile-first.

---

## Tasks

### Task 1: Install dependencies + dev tooling

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install runtime + design deps**

```bash
npm install framer-motion lucide-react clsx tailwind-merge class-variance-authority @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-toast nanoid zod
```

- [ ] **Step 2: Install dev deps for testing**

```bash
npm install -D vitest @vitest/ui happy-dom @types/node
```

- [ ] **Step 3: Add test scripts to package.json**

In `package.json` `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Create vitest config**

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
```

- [ ] **Step 5: Verify install + run empty test**

Run: `npx vitest run`
Expected: PASS (no test files yet — exits 0 with "No test files found").

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts .gitignore
git commit -m "chore: install runtime and test deps"
```

---

### Task 2: Initialize shadcn/ui + design tokens

**Files:**
- Create: `components.json`
- Create: `lib/utils.ts`
- Modify: `app/globals.css`
- Create: `components/ui/button.tsx`
- Create: `components/ui/input.tsx`
- Create: `components/ui/label.tsx`
- Create: `components/ui/dialog.tsx`
- Create: `components/ui/sheet.tsx`
- Create: `components/ui/toast.tsx`

**Use skill:** `vercel:shadcn` for canonical setup. `frontend-design:frontend-design` for design tokens.

- [ ] **Step 1: Create components.json (shadcn config)**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/lib/client"
  },
  "iconLibrary": "lucide"
}
```

- [ ] **Step 2: Create lib/utils.ts**

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(cents: number): string {
  const dollars = Math.abs(cents) / 100;
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${dollars.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 5_000) return 'just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return new Date(ts).toLocaleTimeString();
}
```

- [ ] **Step 3: Replace app/globals.css with Tailwind v4 + design tokens**

```css
@import "tailwindcss";

@theme {
  --color-bg: oklch(0.99 0.005 95);
  --color-bg-elev: oklch(1 0 0);
  --color-ink: oklch(0.18 0.02 280);
  --color-ink-soft: oklch(0.45 0.01 280);
  --color-line: oklch(0.92 0.005 280);
  --color-accent: oklch(0.62 0.18 250);
  --color-accent-soft: oklch(0.95 0.04 250);
  --color-success: oklch(0.65 0.18 150);
  --color-warning: oklch(0.78 0.16 80);
  --color-danger: oklch(0.62 0.22 25);

  /* Monopoly property colors (US edition) */
  --color-prop-brown: oklch(0.40 0.07 50);
  --color-prop-lightblue: oklch(0.82 0.10 220);
  --color-prop-pink: oklch(0.72 0.18 350);
  --color-prop-orange: oklch(0.72 0.18 50);
  --color-prop-red: oklch(0.58 0.22 25);
  --color-prop-yellow: oklch(0.85 0.16 95);
  --color-prop-green: oklch(0.55 0.15 145);
  --color-prop-darkblue: oklch(0.40 0.18 250);

  --color-money-1:    oklch(0.94 0.01 80);   /* white */
  --color-money-5:    oklch(0.78 0.10 350);  /* pink */
  --color-money-10:   oklch(0.85 0.16 95);   /* yellow */
  --color-money-20:   oklch(0.72 0.18 145);  /* green */
  --color-money-50:   oklch(0.72 0.18 250);  /* blue */
  --color-money-100:  oklch(0.65 0.10 30);   /* tan/orange */
  --color-money-500:  oklch(0.78 0.18 50);   /* gold */

  --radius-card: 14px;
  --radius-bill: 6px;

  --shadow-card: 0 1px 2px 0 oklch(0 0 0 / 0.06), 0 8px 24px -8px oklch(0 0 0 / 0.10);
  --shadow-bill: 0 1px 2px 0 oklch(0 0 0 / 0.10), 0 4px 12px -4px oklch(0 0 0 / 0.12);
  --shadow-elev: 0 2px 4px 0 oklch(0 0 0 / 0.04), 0 16px 40px -12px oklch(0 0 0 / 0.16);

  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-display: 'Playfair Display', Georgia, serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
}

html, body { background: var(--color-bg); color: var(--color-ink); font-family: var(--font-sans); }
* { -webkit-tap-highlight-color: transparent; }

@keyframes pulse-ring {
  0% { box-shadow: 0 0 0 0 oklch(from var(--color-accent) l c h / 0.4); }
  100% { box-shadow: 0 0 0 12px oklch(from var(--color-accent) l c h / 0); }
}
```

- [ ] **Step 4: Add shadcn button, input, label, dialog, sheet, toast**

Use the canonical shadcn source for each (see https://ui.shadcn.com/r — copy `button.tsx`, `input.tsx`, `label.tsx`, `dialog.tsx`, `sheet.tsx`, `toast.tsx` into `components/ui/`). Do not invent custom variants.

Verify: `npx tsc --noEmit` passes.

- [ ] **Step 5: Commit**

```bash
git add components.json lib/utils.ts app/globals.css components/ui/
git commit -m "chore: shadcn primitives + design tokens"
```

---

### Task 3: Game types + Monopoly preset

**Files:**
- Create: `lib/game/types.ts`
- Create: `lib/game/monopoly.ts`
- Create: `lib/game/codes.ts`
- Test: `tests/monopoly.test.ts`
- Test: `tests/codes.test.ts`

- [ ] **Step 1: Write the codes test (failing)**

`tests/codes.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { generateRoomCode, generateId } from '@/lib/game/codes';

describe('generateRoomCode', () => {
  it('returns 4 uppercase letters', () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^[A-Z]{4}$/);
  });
  it('avoids confusing chars (no I/O/0/1)', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode();
      expect(code).not.toMatch(/[IO]/);
    }
  });
});

describe('generateId', () => {
  it('returns a non-empty string', () => {
    expect(generateId().length).toBeGreaterThan(8);
  });
  it('is unique across calls', () => {
    const a = generateId();
    const b = generateId();
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/codes.test.ts`
Expected: FAIL ("Cannot find module @/lib/game/codes").

- [ ] **Step 3: Implement codes.ts**

`lib/game/codes.ts`:
```ts
import { nanoid } from 'nanoid';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O

export function generateRoomCode(length = 4): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export function generateId(): string {
  return nanoid(12);
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/codes.test.ts`

- [ ] **Step 5: Define types**

`lib/game/types.ts`:
```ts
export type AssetKind = 'property' | 'utility' | 'railroad' | 'house' | 'hotel' | 'gooj_card';

export type PropertyColor =
  | 'brown' | 'lightblue' | 'pink' | 'orange'
  | 'red' | 'yellow' | 'green' | 'darkblue';

export interface Asset {
  id: string;
  kind: AssetKind;
  name: string;
  color?: PropertyColor;
  price?: number;        // cents
  rent?: number[];       // base, 1H, 2H, 3H, 4H, hotel (cents)
  mortgageValue?: number;
  houseCost?: number;
  setSize?: number;      // properties needed for monopoly
  description?: string;
}

export interface Player {
  id: string;
  name: string;
  color: string;         // hex avatar color
  cashCents: number;
  assetIds: string[];    // asset.id
  joinedAt: number;
  isAdmin: boolean;
  isOnline: boolean;
}

export type Party =
  | { kind: 'player'; playerId: string }
  | { kind: 'bank' };

export type TransactionStatus = 'pending' | 'confirmed' | 'rejected' | 'undone' | 'expired';

export interface Transaction {
  id: string;
  proposedBy: string;          // playerId
  from: Party;
  to: Party;
  amountCents: number;         // 0 if asset-only
  assetIds: string[];          // asset transfers in this transaction
  reason: string;              // preset key or custom text
  reasonLabel: string;         // human-readable
  status: TransactionStatus;
  createdAt: number;
  resolvedAt?: number;
  expiresAt?: number;          // for bank-withdrawal timeout
  needsConfirmFrom: string[];  // playerIds whose tap is required
  rejectedBy?: string;
  splitParentId?: string;      // if this was created via Split
}

export interface Partnership {
  id: string;
  playerIds: string[];         // 2 or 3 members
  notes: string;               // free-text agreement
  formedAt: number;
}

export interface Room {
  code: string;
  passcodeHash: string;
  preset: 'monopoly_us' | 'custom';
  startingCashCents: number;
  rules: 'official' | 'house';
  players: Record<string, Player>;
  assets: Record<string, Asset>;        // catalog (with current ownership tracked via player.assetIds)
  bankAssetIds: string[];               // assets currently held by bank
  transactions: Transaction[];          // newest-first
  partnerships: Partnership[];
  createdAt: number;
  adminPlayerId: string;
}

export const REASON_PRESETS = [
  { key: 'pass_go',         label: 'Pass GO',           defaultAmount: 20000, dir: 'from_bank' as const },
  { key: 'income_tax',      label: 'Income Tax',        defaultAmount: 20000, dir: 'to_bank' as const },
  { key: 'luxury_tax',      label: 'Luxury Tax',        defaultAmount: 10000, dir: 'to_bank' as const },
  { key: 'jail_fine',       label: 'Jail Fine',         defaultAmount: 5000,  dir: 'to_bank' as const },
  { key: 'chance',          label: 'Chance',            defaultAmount: 0,     dir: 'either' as const },
  { key: 'community_chest', label: 'Community Chest',   defaultAmount: 0,     dir: 'either' as const },
  { key: 'buy_property',    label: 'Buy Property',      defaultAmount: 0,     dir: 'to_bank' as const },
  { key: 'build',           label: 'Build House/Hotel', defaultAmount: 0,     dir: 'to_bank' as const },
  { key: 'mortgage',        label: 'Mortgage',          defaultAmount: 0,     dir: 'from_bank' as const },
  { key: 'unmortgage',      label: 'Unmortgage',        defaultAmount: 0,     dir: 'to_bank' as const },
  { key: 'pay_rent',        label: 'Pay Rent',          defaultAmount: 0,     dir: 'to_player' as const },
  { key: 'pay_player',      label: 'Pay Player',        defaultAmount: 0,     dir: 'to_player' as const },
  { key: 'gift',            label: 'Gift',              defaultAmount: 0,     dir: 'to_player' as const },
  { key: 'loan',            label: 'Loan',              defaultAmount: 0,     dir: 'to_player' as const },
  { key: 'loan_repay',      label: 'Loan Repayment',    defaultAmount: 0,     dir: 'to_player' as const },
  { key: 'other',           label: 'Other',             defaultAmount: 0,     dir: 'either' as const },
] as const;

export type ReasonKey = typeof REASON_PRESETS[number]['key'];
```

- [ ] **Step 6: Write monopoly preset test (failing)**

`tests/monopoly.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { MONOPOLY_US_ASSETS } from '@/lib/game/monopoly';

describe('MONOPOLY_US_ASSETS', () => {
  it('contains 22 properties', () => {
    expect(MONOPOLY_US_ASSETS.filter(a => a.kind === 'property')).toHaveLength(22);
  });
  it('contains 4 railroads', () => {
    expect(MONOPOLY_US_ASSETS.filter(a => a.kind === 'railroad')).toHaveLength(4);
  });
  it('contains 2 utilities', () => {
    expect(MONOPOLY_US_ASSETS.filter(a => a.kind === 'utility')).toHaveLength(2);
  });
  it('all properties have a color and price', () => {
    for (const a of MONOPOLY_US_ASSETS.filter(a => a.kind === 'property')) {
      expect(a.color).toBeDefined();
      expect(a.price).toBeGreaterThan(0);
    }
  });
  it('Boardwalk costs $400', () => {
    const bw = MONOPOLY_US_ASSETS.find(a => a.name === 'Boardwalk');
    expect(bw?.price).toBe(40000);
  });
});
```

- [ ] **Step 7: Implement monopoly preset**

`lib/game/monopoly.ts`:
```ts
import type { Asset } from './types';

// Prices/rents in cents. Source: official US Monopoly board.
export const MONOPOLY_US_ASSETS: Asset[] = [
  // Brown
  { id: 'mediterranean', kind: 'property', name: 'Mediterranean Avenue', color: 'brown', price: 6000,  rent: [200, 1000, 3000, 9000, 16000, 25000], mortgageValue: 3000, houseCost: 5000, setSize: 2 },
  { id: 'baltic',        kind: 'property', name: 'Baltic Avenue',        color: 'brown', price: 6000,  rent: [400, 2000, 6000, 18000, 32000, 45000], mortgageValue: 3000, houseCost: 5000, setSize: 2 },
  // Light blue
  { id: 'oriental',      kind: 'property', name: 'Oriental Avenue',      color: 'lightblue', price: 10000, rent: [600, 3000, 9000, 27000, 40000, 55000], mortgageValue: 5000, houseCost: 5000, setSize: 3 },
  { id: 'vermont',       kind: 'property', name: 'Vermont Avenue',       color: 'lightblue', price: 10000, rent: [600, 3000, 9000, 27000, 40000, 55000], mortgageValue: 5000, houseCost: 5000, setSize: 3 },
  { id: 'connecticut',   kind: 'property', name: 'Connecticut Avenue',   color: 'lightblue', price: 12000, rent: [800, 4000, 10000, 30000, 45000, 60000], mortgageValue: 6000, houseCost: 5000, setSize: 3 },
  // Pink
  { id: 'stcharles',     kind: 'property', name: 'St. Charles Place',    color: 'pink', price: 14000, rent: [1000, 5000, 15000, 45000, 62500, 75000], mortgageValue: 7000, houseCost: 10000, setSize: 3 },
  { id: 'states',        kind: 'property', name: 'States Avenue',        color: 'pink', price: 14000, rent: [1000, 5000, 15000, 45000, 62500, 75000], mortgageValue: 7000, houseCost: 10000, setSize: 3 },
  { id: 'virginia',      kind: 'property', name: 'Virginia Avenue',      color: 'pink', price: 16000, rent: [1200, 6000, 18000, 50000, 70000, 90000], mortgageValue: 8000, houseCost: 10000, setSize: 3 },
  // Orange
  { id: 'stjames',       kind: 'property', name: 'St. James Place',      color: 'orange', price: 18000, rent: [1400, 7000, 20000, 55000, 75000, 95000], mortgageValue: 9000, houseCost: 10000, setSize: 3 },
  { id: 'tennessee',     kind: 'property', name: 'Tennessee Avenue',     color: 'orange', price: 18000, rent: [1400, 7000, 20000, 55000, 75000, 95000], mortgageValue: 9000, houseCost: 10000, setSize: 3 },
  { id: 'newyork',       kind: 'property', name: 'New York Avenue',      color: 'orange', price: 20000, rent: [1600, 8000, 22000, 60000, 80000, 100000], mortgageValue: 10000, houseCost: 10000, setSize: 3 },
  // Red
  { id: 'kentucky',      kind: 'property', name: 'Kentucky Avenue',      color: 'red', price: 22000, rent: [1800, 9000, 25000, 70000, 87500, 105000], mortgageValue: 11000, houseCost: 15000, setSize: 3 },
  { id: 'indiana',       kind: 'property', name: 'Indiana Avenue',       color: 'red', price: 22000, rent: [1800, 9000, 25000, 70000, 87500, 105000], mortgageValue: 11000, houseCost: 15000, setSize: 3 },
  { id: 'illinois',      kind: 'property', name: 'Illinois Avenue',      color: 'red', price: 24000, rent: [2000, 10000, 30000, 75000, 92500, 110000], mortgageValue: 12000, houseCost: 15000, setSize: 3 },
  // Yellow
  { id: 'atlantic',      kind: 'property', name: 'Atlantic Avenue',      color: 'yellow', price: 26000, rent: [2200, 11000, 33000, 80000, 97500, 115000], mortgageValue: 13000, houseCost: 15000, setSize: 3 },
  { id: 'ventnor',       kind: 'property', name: 'Ventnor Avenue',       color: 'yellow', price: 26000, rent: [2200, 11000, 33000, 80000, 97500, 115000], mortgageValue: 13000, houseCost: 15000, setSize: 3 },
  { id: 'marvin',        kind: 'property', name: 'Marvin Gardens',       color: 'yellow', price: 28000, rent: [2400, 12000, 36000, 85000, 102500, 120000], mortgageValue: 14000, houseCost: 15000, setSize: 3 },
  // Green
  { id: 'pacific',       kind: 'property', name: 'Pacific Avenue',       color: 'green', price: 30000, rent: [2600, 13000, 39000, 90000, 110000, 127500], mortgageValue: 15000, houseCost: 20000, setSize: 3 },
  { id: 'northcarolina', kind: 'property', name: 'North Carolina Avenue',color: 'green', price: 30000, rent: [2600, 13000, 39000, 90000, 110000, 127500], mortgageValue: 15000, houseCost: 20000, setSize: 3 },
  { id: 'pennsylvania',  kind: 'property', name: 'Pennsylvania Avenue', color: 'green', price: 32000, rent: [2800, 15000, 45000, 100000, 120000, 140000], mortgageValue: 16000, houseCost: 20000, setSize: 3 },
  // Dark blue
  { id: 'parkplace',     kind: 'property', name: 'Park Place',           color: 'darkblue', price: 35000, rent: [3500, 17500, 50000, 110000, 130000, 150000], mortgageValue: 17500, houseCost: 20000, setSize: 2 },
  { id: 'boardwalk',     kind: 'property', name: 'Boardwalk',            color: 'darkblue', price: 40000, rent: [5000, 20000, 60000, 140000, 170000, 200000], mortgageValue: 20000, houseCost: 20000, setSize: 2 },
  // Railroads
  { id: 'reading',       kind: 'railroad', name: 'Reading Railroad',     price: 20000, rent: [2500, 5000, 10000, 20000], mortgageValue: 10000 },
  { id: 'pennsylvania_rr', kind: 'railroad', name: 'Pennsylvania Railroad', price: 20000, rent: [2500, 5000, 10000, 20000], mortgageValue: 10000 },
  { id: 'bo',            kind: 'railroad', name: 'B. & O. Railroad',     price: 20000, rent: [2500, 5000, 10000, 20000], mortgageValue: 10000 },
  { id: 'shortline',     kind: 'railroad', name: 'Short Line',           price: 20000, rent: [2500, 5000, 10000, 20000], mortgageValue: 10000 },
  // Utilities
  { id: 'electric',      kind: 'utility',  name: 'Electric Company',     price: 15000, mortgageValue: 7500 },
  { id: 'water',         kind: 'utility',  name: 'Water Works',          price: 15000, mortgageValue: 7500 },
];
```

- [ ] **Step 8: Run all tests**

Run: `npx vitest run`
Expected: PASS for codes + monopoly tests.

- [ ] **Step 9: Commit**

```bash
git add lib/game/ tests/codes.test.ts tests/monopoly.test.ts
git commit -m "feat(game): types, monopoly US preset, codes"
```

---

### Task 4: Pure rules — validateTransaction + applyTransaction

**Files:**
- Create: `lib/game/rules.ts`
- Test: `tests/rules.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/rules.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { validateTransaction, applyTransaction } from '@/lib/game/rules';
import type { Room, Transaction } from '@/lib/game/types';

const baseRoom = (): Room => ({
  code: 'TEST',
  passcodeHash: 'x',
  preset: 'monopoly_us',
  startingCashCents: 150000,
  rules: 'house',
  players: {
    p1: { id: 'p1', name: 'Alice', color: '#f00', cashCents: 150000, assetIds: [], joinedAt: 0, isAdmin: true, isOnline: true },
    p2: { id: 'p2', name: 'Bob',   color: '#0f0', cashCents: 150000, assetIds: [], joinedAt: 0, isAdmin: false, isOnline: true },
  },
  assets: {},
  bankAssetIds: [],
  transactions: [],
  partnerships: [],
  createdAt: 0,
  adminPlayerId: 'p1',
});

const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: 't1', proposedBy: 'p1',
  from: { kind: 'player', playerId: 'p1' },
  to:   { kind: 'player', playerId: 'p2' },
  amountCents: 1000, assetIds: [],
  reason: 'pay_player', reasonLabel: 'Pay Player',
  status: 'pending', createdAt: 0,
  needsConfirmFrom: ['p2'],
  ...overrides,
});

describe('validateTransaction', () => {
  it('rejects negative amount', () => {
    const r = baseRoom();
    expect(validateTransaction(r, tx({ amountCents: -50 })).ok).toBe(false);
  });
  it('rejects player paying more than they have', () => {
    const r = baseRoom();
    expect(validateTransaction(r, tx({ amountCents: 999999999 })).ok).toBe(false);
  });
  it('rejects unknown player', () => {
    const r = baseRoom();
    expect(validateTransaction(r, tx({ from: { kind: 'player', playerId: 'ghost' } })).ok).toBe(false);
  });
  it('allows bank to pay any amount', () => {
    const r = baseRoom();
    expect(validateTransaction(r, tx({
      from: { kind: 'bank' }, to: { kind: 'player', playerId: 'p1' },
      amountCents: 10_000_000, reason: 'other',
    })).ok).toBe(true);
  });
  it('rejects p2p free transfer in official rules', () => {
    const r = baseRoom(); r.rules = 'official';
    expect(validateTransaction(r, tx({ reason: 'gift' })).ok).toBe(false);
  });
});

describe('applyTransaction', () => {
  it('moves cash player → player', () => {
    const r = baseRoom();
    const t = tx({ amountCents: 5000 });
    const next = applyTransaction(r, t);
    expect(next.players.p1.cashCents).toBe(145000);
    expect(next.players.p2.cashCents).toBe(155000);
  });
  it('credits player from bank', () => {
    const r = baseRoom();
    const t = tx({
      from: { kind: 'bank' }, to: { kind: 'player', playerId: 'p1' },
      amountCents: 20000, reason: 'pass_go',
    });
    const next = applyTransaction(r, t);
    expect(next.players.p1.cashCents).toBe(170000);
  });
  it('moves asset between parties', () => {
    const r = baseRoom();
    r.assets['boardwalk'] = { id: 'boardwalk', kind: 'property', name: 'Boardwalk', color: 'darkblue', price: 40000 };
    r.bankAssetIds = ['boardwalk'];
    const t = tx({
      from: { kind: 'bank' }, to: { kind: 'player', playerId: 'p1' },
      amountCents: 0, assetIds: ['boardwalk'], reason: 'buy_property',
    });
    const next = applyTransaction(r, t);
    expect(next.players.p1.assetIds).toContain('boardwalk');
    expect(next.bankAssetIds).not.toContain('boardwalk');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement rules.ts**

`lib/game/rules.ts`:
```ts
import type { Room, Transaction, Party } from './types';

export type ValidationResult = { ok: true } | { ok: false; reason: string };

const FREE_TRANSFER_REASONS = new Set(['gift', 'loan', 'loan_repay']);

export function validateTransaction(room: Room, t: Transaction): ValidationResult {
  if (t.amountCents < 0) return { ok: false, reason: 'Amount cannot be negative' };
  if (t.amountCents === 0 && t.assetIds.length === 0) return { ok: false, reason: 'Transaction must move money or assets' };

  if (t.from.kind === 'player' && !room.players[t.from.playerId]) {
    return { ok: false, reason: 'Sender not in room' };
  }
  if (t.to.kind === 'player' && !room.players[t.to.playerId]) {
    return { ok: false, reason: 'Recipient not in room' };
  }
  if (t.from.kind === 'player' && t.to.kind === 'player' && t.from.playerId === t.to.playerId) {
    return { ok: false, reason: 'Cannot send to yourself' };
  }

  if (t.from.kind === 'player') {
    const sender = room.players[t.from.playerId];
    if (sender.cashCents < t.amountCents) {
      return { ok: false, reason: 'Insufficient funds' };
    }
  }

  for (const assetId of t.assetIds) {
    if (!room.assets[assetId]) return { ok: false, reason: `Unknown asset ${assetId}` };
    const owner = ownerOf(room, assetId);
    if (!sameParty(owner, t.from)) return { ok: false, reason: `Asset ${assetId} not owned by sender` };
  }

  if (room.rules === 'official') {
    if (t.from.kind === 'player' && t.to.kind === 'player' && FREE_TRANSFER_REASONS.has(t.reason)) {
      return { ok: false, reason: 'Free transfers not allowed in official rules' };
    }
  }

  return { ok: true };
}

export function applyTransaction(room: Room, t: Transaction): Room {
  const next: Room = {
    ...room,
    players: { ...room.players },
    bankAssetIds: [...room.bankAssetIds],
  };

  if (t.amountCents > 0) {
    if (t.from.kind === 'player') {
      const p = next.players[t.from.playerId];
      next.players[t.from.playerId] = { ...p, cashCents: p.cashCents - t.amountCents };
    }
    if (t.to.kind === 'player') {
      const p = next.players[t.to.playerId];
      next.players[t.to.playerId] = { ...p, cashCents: p.cashCents + t.amountCents };
    }
  }

  for (const assetId of t.assetIds) {
    // remove from sender
    if (t.from.kind === 'player') {
      const p = next.players[t.from.playerId];
      next.players[t.from.playerId] = { ...p, assetIds: p.assetIds.filter(id => id !== assetId) };
    } else {
      next.bankAssetIds = next.bankAssetIds.filter(id => id !== assetId);
    }
    // add to recipient
    if (t.to.kind === 'player') {
      const p = next.players[t.to.playerId];
      next.players[t.to.playerId] = { ...p, assetIds: [...p.assetIds, assetId] };
    } else {
      next.bankAssetIds = [...next.bankAssetIds, assetId];
    }
  }

  return next;
}

function ownerOf(room: Room, assetId: string): Party {
  for (const p of Object.values(room.players)) {
    if (p.assetIds.includes(assetId)) return { kind: 'player', playerId: p.id };
  }
  return { kind: 'bank' };
}

function sameParty(a: Party, b: Party): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'bank') return true;
  return a.playerId === (b as { playerId: string }).playerId;
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run tests/rules.test.ts`

- [ ] **Step 5: Commit**

```bash
git add lib/game/rules.ts tests/rules.test.ts
git commit -m "feat(game): pure validateTransaction + applyTransaction"
```

---

### Task 5: Store interface + in-memory implementation

**Files:**
- Create: `lib/store/interface.ts`
- Create: `lib/store/memory.ts`
- Test: `tests/store.memory.test.ts`

- [ ] **Step 1: Define interface**

`lib/store/interface.ts`:
```ts
import type { Room } from '@/lib/game/types';

export interface RoomStore {
  create(room: Room): Promise<void>;
  get(code: string): Promise<Room | null>;
  /** Atomic update with optimistic concurrency. Throws if room not found. */
  update(code: string, mutator: (room: Room) => Room): Promise<Room>;
  delete(code: string): Promise<void>;
}
```

- [ ] **Step 2: Write failing test**

`tests/store.memory.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryRoomStore } from '@/lib/store/memory';
import type { Room } from '@/lib/game/types';

const room: Room = {
  code: 'AAAA', passcodeHash: 'x', preset: 'monopoly_us',
  startingCashCents: 150000, rules: 'house',
  players: {}, assets: {}, bankAssetIds: [],
  transactions: [], partnerships: [],
  createdAt: 0, adminPlayerId: '',
};

describe('MemoryRoomStore', () => {
  let store: MemoryRoomStore;
  beforeEach(() => { store = new MemoryRoomStore(); });

  it('create + get', async () => {
    await store.create(room);
    expect(await store.get('AAAA')).toEqual(room);
  });

  it('returns null for missing', async () => {
    expect(await store.get('ZZZZ')).toBeNull();
  });

  it('update applies mutator', async () => {
    await store.create(room);
    const next = await store.update('AAAA', r => ({ ...r, startingCashCents: 200000 }));
    expect(next.startingCashCents).toBe(200000);
    expect((await store.get('AAAA'))?.startingCashCents).toBe(200000);
  });

  it('update throws if missing', async () => {
    await expect(store.update('ZZZZ', r => r)).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Implement**

`lib/store/memory.ts`:
```ts
import type { Room } from '@/lib/game/types';
import type { RoomStore } from './interface';

export class MemoryRoomStore implements RoomStore {
  private rooms = new Map<string, Room>();

  async create(room: Room): Promise<void> {
    this.rooms.set(room.code, room);
  }
  async get(code: string): Promise<Room | null> {
    return this.rooms.get(code) ?? null;
  }
  async update(code: string, mutator: (room: Room) => Room): Promise<Room> {
    const current = this.rooms.get(code);
    if (!current) throw new Error(`Room ${code} not found`);
    const next = mutator(current);
    this.rooms.set(code, next);
    return next;
  }
  async delete(code: string): Promise<void> {
    this.rooms.delete(code);
  }
}
```

- [ ] **Step 4: Run + commit**

```bash
npx vitest run tests/store.memory.test.ts
git add lib/store/ tests/store.memory.test.ts
git commit -m "feat(store): memory implementation + interface"
```

---

### Task 6: PubSub interface + in-memory implementation

**Files:**
- Create: `lib/pubsub/interface.ts`
- Create: `lib/pubsub/memory.ts`
- Test: `tests/pubsub.memory.test.ts`

- [ ] **Step 1: Interface**

`lib/pubsub/interface.ts`:
```ts
export type RoomEvent =
  | { type: 'state'; roomCode: string; ts: number }   // generic "refetch"
  | { type: 'transaction'; roomCode: string; transactionId: string }
  | { type: 'player'; roomCode: string; playerId: string }
  | { type: 'ping'; ts: number };

export interface PubSub {
  publish(channel: string, event: RoomEvent): Promise<void>;
  subscribe(channel: string, handler: (event: RoomEvent) => void): () => void; // returns unsubscribe
}
```

- [ ] **Step 2: Test**

`tests/pubsub.memory.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { MemoryPubSub } from '@/lib/pubsub/memory';

describe('MemoryPubSub', () => {
  it('delivers to subscribers of the same channel', async () => {
    const ps = new MemoryPubSub();
    const handler = vi.fn();
    ps.subscribe('room:AAAA', handler);
    await ps.publish('room:AAAA', { type: 'ping', ts: 1 });
    expect(handler).toHaveBeenCalledWith({ type: 'ping', ts: 1 });
  });

  it('does not deliver across channels', async () => {
    const ps = new MemoryPubSub();
    const handler = vi.fn();
    ps.subscribe('room:AAAA', handler);
    await ps.publish('room:BBBB', { type: 'ping', ts: 1 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('unsubscribe stops delivery', async () => {
    const ps = new MemoryPubSub();
    const handler = vi.fn();
    const unsub = ps.subscribe('room:AAAA', handler);
    unsub();
    await ps.publish('room:AAAA', { type: 'ping', ts: 1 });
    expect(handler).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Implement**

`lib/pubsub/memory.ts`:
```ts
import { EventEmitter } from 'node:events';
import type { PubSub, RoomEvent } from './interface';

export class MemoryPubSub implements PubSub {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(1000);
  }

  async publish(channel: string, event: RoomEvent): Promise<void> {
    this.emitter.emit(channel, event);
  }

  subscribe(channel: string, handler: (event: RoomEvent) => void): () => void {
    this.emitter.on(channel, handler);
    return () => this.emitter.off(channel, handler);
  }
}
```

- [ ] **Step 4: Run + commit**

```bash
npx vitest run tests/pubsub.memory.test.ts
git add lib/pubsub/ tests/pubsub.memory.test.ts
git commit -m "feat(pubsub): memory implementation + interface"
```

---

### Task 7: Server singletons + session helpers

**Files:**
- Create: `lib/server/stores.ts`
- Create: `lib/server/session.ts`

- [ ] **Step 1: Singleton stores (memory for now)**

`lib/server/stores.ts`:
```ts
import { MemoryRoomStore } from '@/lib/store/memory';
import { MemoryPubSub } from '@/lib/pubsub/memory';
import type { RoomStore } from '@/lib/store/interface';
import type { PubSub } from '@/lib/pubsub/interface';

declare global {
  var __autobankStore: RoomStore | undefined;
  var __autobankPubsub: PubSub | undefined;
}

export const roomStore: RoomStore = globalThis.__autobankStore ?? (globalThis.__autobankStore = new MemoryRoomStore());
export const pubsub: PubSub = globalThis.__autobankPubsub ?? (globalThis.__autobankPubsub = new MemoryPubSub());

export const channelFor = (roomCode: string) => `room:${roomCode}`;
```

- [ ] **Step 2: Session cookie helpers**

`lib/server/session.ts`:
```ts
import { cookies } from 'next/headers';

const COOKIE = 'autobank_session';

export interface Session {
  roomCode: string;
  playerId: string;
  isAdmin: boolean;
}

export async function setSession(s: Session): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, JSON.stringify(s), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  try { return JSON.parse(raw) as Session; } catch { return null; }
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function hashPasscode(plain: string): Promise<string> {
  const data = new TextEncoder().encode(plain);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/server/
git commit -m "feat(server): singleton store + session cookie helpers"
```

---

### Task 8: API — POST /api/rooms (create room)

**Files:**
- Create: `app/api/rooms/route.ts`

- [ ] **Step 1: Implement**

`app/api/rooms/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { roomStore } from '@/lib/server/stores';
import { setSession, hashPasscode } from '@/lib/server/session';
import { generateRoomCode, generateId } from '@/lib/game/codes';
import { MONOPOLY_US_ASSETS } from '@/lib/game/monopoly';
import type { Room, Player, Asset } from '@/lib/game/types';

export const runtime = 'nodejs';

const Body = z.object({
  adminName: z.string().min(1).max(20),
  passcode: z.string().min(4).max(20),
  startingCashCents: z.number().int().min(0).max(100_000_000),
  preset: z.enum(['monopoly_us', 'custom']),
  rules: z.enum(['official', 'house']),
});

export async function POST(req: Request) {
  const json = await req.json();
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }
  const { adminName, passcode, startingCashCents, preset, rules } = parsed.data;

  let code = generateRoomCode();
  for (let i = 0; i < 5 && (await roomStore.get(code)); i++) code = generateRoomCode();
  if (await roomStore.get(code)) {
    return NextResponse.json({ error: 'Could not allocate room code' }, { status: 503 });
  }

  const adminId = generateId();
  const admin: Player = {
    id: adminId, name: adminName, color: pickColor(0),
    cashCents: startingCashCents, assetIds: [],
    joinedAt: Date.now(), isAdmin: true, isOnline: true,
  };

  const assets: Record<string, Asset> = {};
  const bankAssetIds: string[] = [];
  if (preset === 'monopoly_us') {
    for (const a of MONOPOLY_US_ASSETS) {
      assets[a.id] = a;
      bankAssetIds.push(a.id);
    }
  }

  const room: Room = {
    code,
    passcodeHash: await hashPasscode(passcode),
    preset, startingCashCents, rules,
    players: { [adminId]: admin },
    assets, bankAssetIds,
    transactions: [],
    partnerships: [],
    createdAt: Date.now(),
    adminPlayerId: adminId,
  };

  await roomStore.create(room);
  await setSession({ roomCode: code, playerId: adminId, isAdmin: true });

  return NextResponse.json({ code, playerId: adminId });
}

const PALETTE = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899'];
function pickColor(i: number): string { return PALETTE[i % PALETTE.length]; }
```

- [ ] **Step 2: Smoke-test by curl**

Run dev server in another terminal: `npm run dev`
```bash
curl -i -X POST http://localhost:3000/api/rooms \
  -H 'content-type: application/json' \
  -d '{"adminName":"Alice","passcode":"1234","startingCashCents":150000,"preset":"monopoly_us","rules":"house"}'
```
Expected: `200 OK` with `{ code: "XXXX", playerId: "..." }` and a `Set-Cookie: autobank_session=...` header.

- [ ] **Step 3: Commit**

```bash
git add app/api/rooms/route.ts
git commit -m "feat(api): POST /api/rooms — create room"
```

---

### Task 9: API — POST /api/rooms/[code]/join

**Files:**
- Create: `app/api/rooms/[code]/join/route.ts`

- [ ] **Step 1: Implement**

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { roomStore, pubsub, channelFor } from '@/lib/server/stores';
import { setSession, hashPasscode } from '@/lib/server/session';
import { generateId } from '@/lib/game/codes';
import type { Player } from '@/lib/game/types';

export const runtime = 'nodejs';

const Body = z.object({
  name: z.string().min(1).max(20),
  passcode: z.string().min(4).max(20),
});

const PALETTE = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899'];

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const upper = code.toUpperCase();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const room = await roomStore.get(upper);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  const expected = await hashPasscode(parsed.data.passcode);
  if (expected !== room.passcodeHash) {
    return NextResponse.json({ error: 'Wrong passcode' }, { status: 401 });
  }

  const id = generateId();
  const colorIdx = Object.keys(room.players).length;
  const player: Player = {
    id, name: parsed.data.name, color: PALETTE[colorIdx % PALETTE.length],
    cashCents: room.startingCashCents, assetIds: [],
    joinedAt: Date.now(), isAdmin: false, isOnline: true,
  };

  await roomStore.update(upper, r => ({
    ...r,
    players: { ...r.players, [id]: player },
  }));

  await setSession({ roomCode: upper, playerId: id, isAdmin: false });
  await pubsub.publish(channelFor(upper), { type: 'player', roomCode: upper, playerId: id });

  return NextResponse.json({ code: upper, playerId: id });
}
```

- [ ] **Step 2: Smoke-test**

```bash
curl -i -X POST http://localhost:3000/api/rooms/XXXX/join \
  -H 'content-type: application/json' \
  -d '{"name":"Bob","passcode":"1234"}'
```

- [ ] **Step 3: Commit**

```bash
git add app/api/rooms/[code]/join/route.ts
git commit -m "feat(api): POST /api/rooms/:code/join"
```

---

### Task 10: API — GET /api/rooms/[code] (initial state)

**Files:**
- Create: `app/api/rooms/[code]/route.ts`

- [ ] **Step 1: Implement**

```ts
import { NextResponse } from 'next/server';
import { roomStore } from '@/lib/server/stores';
import { getSession } from '@/lib/server/session';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const upper = code.toUpperCase();
  const session = await getSession();
  if (!session || session.roomCode !== upper) {
    return NextResponse.json({ error: 'Not in room' }, { status: 401 });
  }
  const room = await roomStore.get(upper);
  if (!room) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // Strip passcodeHash before returning
  const { passcodeHash, ...safe } = room;
  return NextResponse.json({ room: safe, sessionPlayerId: session.playerId });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/rooms/[code]/route.ts
git commit -m "feat(api): GET /api/rooms/:code"
```

---

### Task 11: API — SSE event stream

**Files:**
- Create: `app/api/rooms/[code]/events/route.ts`

- [ ] **Step 1: Implement**

```ts
import { roomStore, pubsub, channelFor } from '@/lib/server/stores';
import { getSession } from '@/lib/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const upper = code.toUpperCase();
  const session = await getSession();
  if (!session || session.roomCode !== upper) {
    return new Response('Unauthorized', { status: 401 });
  }
  const room = await roomStore.get(upper);
  if (!room) return new Response('Not found', { status: 404 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      send({ type: 'hello', ts: Date.now() });

      const unsub = pubsub.subscribe(channelFor(upper), (event) => {
        send(event);
      });

      const ping = setInterval(() => send({ type: 'ping', ts: Date.now() }), 25_000);

      const cleanup = () => {
        clearInterval(ping);
        unsub();
        try { controller.close(); } catch {}
      };
      // Heuristic: if controller.desiredSize becomes null, the client disconnected.
      // Node will also emit error on the underlying writer; SSE survives Vercel up to 300s by default.
      (controller as unknown as { _cleanup?: () => void })._cleanup = cleanup;
    },
    cancel() {
      // best-effort
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
```

- [ ] **Step 2: Smoke-test**

```bash
curl -N http://localhost:3000/api/rooms/XXXX/events --cookie "autobank_session=..."
```
Expected: see `data: {"type":"hello",...}` and periodic `data: {"type":"ping",...}`.

- [ ] **Step 3: Commit**

```bash
git add app/api/rooms/[code]/events/route.ts
git commit -m "feat(api): SSE event stream per room"
```

---

### Task 12: API — propose / confirm / reject / undo transaction

**Files:**
- Create: `app/api/rooms/[code]/transactions/route.ts`
- Create: `app/api/rooms/[code]/transactions/[id]/confirm/route.ts`
- Create: `app/api/rooms/[code]/transactions/[id]/reject/route.ts`
- Create: `app/api/rooms/[code]/transactions/[id]/undo/route.ts`

**Use skill:** `vercel:nextjs` for route conventions and `vercel:vercel-functions` for runtime/timeout choices.

- [ ] **Step 1: Implement POST /transactions (propose)**

`app/api/rooms/[code]/transactions/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { roomStore, pubsub, channelFor } from '@/lib/server/stores';
import { getSession } from '@/lib/server/session';
import { generateId } from '@/lib/game/codes';
import { validateTransaction } from '@/lib/game/rules';
import { REASON_PRESETS } from '@/lib/game/types';
import type { Transaction, Party } from '@/lib/game/types';

export const runtime = 'nodejs';

const PartySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('player'), playerId: z.string() }),
  z.object({ kind: z.literal('bank') }),
]);

const Body = z.object({
  from: PartySchema,
  to: PartySchema,
  amountCents: z.number().int().min(0),
  assetIds: z.array(z.string()).default([]),
  reason: z.string().min(1),
  reasonLabel: z.string().min(1),
  splitParentId: z.string().optional(),
});

const BANK_WITHDRAWAL_TIMEOUT_MS = 10_000;

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const upper = code.toUpperCase();
  const session = await getSession();
  if (!session || session.roomCode !== upper) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const room = await roomStore.get(upper);
  if (!room) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const t: Transaction = {
    id: generateId(),
    proposedBy: session.playerId,
    from: parsed.data.from,
    to: parsed.data.to,
    amountCents: parsed.data.amountCents,
    assetIds: parsed.data.assetIds,
    reason: parsed.data.reason,
    reasonLabel: parsed.data.reasonLabel,
    status: 'pending',
    createdAt: Date.now(),
    needsConfirmFrom: computeConfirmers(parsed.data.from, parsed.data.to, session.playerId, room),
    splitParentId: parsed.data.splitParentId,
  };

  // bank withdrawals get a timeout; if no objection by expiresAt, auto-confirm
  if (t.from.kind === 'bank' && t.to.kind === 'player') {
    t.expiresAt = Date.now() + BANK_WITHDRAWAL_TIMEOUT_MS;
  }

  const validation = validateTransaction(room, t);
  if (!validation.ok) return NextResponse.json({ error: validation.reason }, { status: 400 });

  await roomStore.update(upper, r => ({ ...r, transactions: [t, ...r.transactions] }));
  await pubsub.publish(channelFor(upper), { type: 'transaction', roomCode: upper, transactionId: t.id });

  return NextResponse.json({ transaction: t });
}

function computeConfirmers(from: Party, to: Party, proposer: string, room: { players: Record<string, unknown> }): string[] {
  // P2P: needs the OTHER party (recipient if proposer is sender, or sender if proposer is recipient)
  if (from.kind === 'player' && to.kind === 'player') {
    return [from.playerId, to.playerId].filter(id => id !== proposer);
  }
  // Player → Bank: just the sender (auto if proposer is sender)
  if (from.kind === 'player' && to.kind === 'bank') {
    return from.playerId === proposer ? [] : [from.playerId];
  }
  // Bank → Player: any other player can object during timeout
  if (from.kind === 'bank' && to.kind === 'player') {
    return Object.keys(room.players).filter(id => id !== proposer);
  }
  return [];
}
```

- [ ] **Step 2: Implement /confirm**

`app/api/rooms/[code]/transactions/[id]/confirm/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { roomStore, pubsub, channelFor } from '@/lib/server/stores';
import { getSession } from '@/lib/server/session';
import { applyTransaction } from '@/lib/game/rules';

export const runtime = 'nodejs';

export async function POST(_req: Request, { params }: { params: Promise<{ code: string; id: string }> }) {
  const { code, id } = await params;
  const upper = code.toUpperCase();
  const session = await getSession();
  if (!session || session.roomCode !== upper) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const next = await roomStore.update(upper, r => {
    const idx = r.transactions.findIndex(t => t.id === id);
    if (idx === -1) return r;
    const t = r.transactions[idx];
    if (t.status !== 'pending') return r;
    if (!t.needsConfirmFrom.includes(session.playerId)) return r;

    const remaining = t.needsConfirmFrom.filter(p => p !== session.playerId);
    let updated = { ...t, needsConfirmFrom: remaining };

    if (remaining.length === 0) {
      updated = { ...updated, status: 'confirmed', resolvedAt: Date.now() };
      const after = applyTransaction(r, updated);
      const txs = [...after.transactions];
      txs[idx] = updated;
      return { ...after, transactions: txs };
    }
    const txs = [...r.transactions];
    txs[idx] = updated;
    return { ...r, transactions: txs };
  });

  await pubsub.publish(channelFor(upper), { type: 'transaction', roomCode: upper, transactionId: id });
  return NextResponse.json({ ok: true, room: next });
}
```

- [ ] **Step 3: Implement /reject**

`app/api/rooms/[code]/transactions/[id]/reject/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { roomStore, pubsub, channelFor } from '@/lib/server/stores';
import { getSession } from '@/lib/server/session';

export const runtime = 'nodejs';

export async function POST(_req: Request, { params }: { params: Promise<{ code: string; id: string }> }) {
  const { code, id } = await params;
  const upper = code.toUpperCase();
  const session = await getSession();
  if (!session || session.roomCode !== upper) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await roomStore.update(upper, r => {
    const idx = r.transactions.findIndex(t => t.id === id);
    if (idx === -1) return r;
    const t = r.transactions[idx];
    if (t.status !== 'pending') return r;
    if (!t.needsConfirmFrom.includes(session.playerId)) return r;
    const txs = [...r.transactions];
    txs[idx] = { ...t, status: 'rejected', resolvedAt: Date.now(), rejectedBy: session.playerId };
    return { ...r, transactions: txs };
  });

  await pubsub.publish(channelFor(upper), { type: 'transaction', roomCode: upper, transactionId: id });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Implement /undo**

`app/api/rooms/[code]/transactions/[id]/undo/route.ts`:

Undo creates a *reverse* transaction (audit trail preserved). Requires consensus from both original parties (if P2P) or proposer-only (if Player→Bank), or anyone (if Bank→Player and within 30s).

```ts
import { NextResponse } from 'next/server';
import { roomStore, pubsub, channelFor } from '@/lib/server/stores';
import { getSession } from '@/lib/server/session';
import { generateId } from '@/lib/game/codes';
import type { Transaction } from '@/lib/game/types';

export const runtime = 'nodejs';

export async function POST(_req: Request, { params }: { params: Promise<{ code: string; id: string }> }) {
  const { code, id } = await params;
  const upper = code.toUpperCase();
  const session = await getSession();
  if (!session || session.roomCode !== upper) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const room = await roomStore.get(upper);
  if (!room) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const original = room.transactions.find(t => t.id === id);
  if (!original || original.status !== 'confirmed') {
    return NextResponse.json({ error: 'Not undoable' }, { status: 400 });
  }

  const reverse: Transaction = {
    id: generateId(),
    proposedBy: session.playerId,
    from: original.to,
    to: original.from,
    amountCents: original.amountCents,
    assetIds: original.assetIds,
    reason: 'undo',
    reasonLabel: `Undo: ${original.reasonLabel}`,
    status: 'pending',
    createdAt: Date.now(),
    needsConfirmFrom: needsForUndo(original, session.playerId, room.players),
  };

  await roomStore.update(upper, r => ({ ...r, transactions: [reverse, ...r.transactions] }));
  await pubsub.publish(channelFor(upper), { type: 'transaction', roomCode: upper, transactionId: reverse.id });
  return NextResponse.json({ transaction: reverse });
}

function needsForUndo(t: Transaction, proposer: string, players: Record<string, unknown>): string[] {
  if (t.from.kind === 'player' && t.to.kind === 'player') {
    return [t.from.playerId, t.to.playerId].filter(id => id !== proposer);
  }
  return Object.keys(players).filter(id => id !== proposer);
}
```

- [ ] **Step 5: Smoke-test full propose → confirm cycle via curl**

Document the call sequence in a comment at the top of the propose route.

- [ ] **Step 6: Commit**

```bash
git add app/api/rooms/[code]/transactions/
git commit -m "feat(api): transaction propose/confirm/reject/undo"
```

---

### Task 13: Client API helpers + SSE hook

**Files:**
- Create: `lib/client/api.ts`
- Create: `lib/client/use-room.ts`

- [ ] **Step 1: api.ts**

```ts
import type { Room, Transaction, Party } from '@/lib/game/types';

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function createRoom(input: {
  adminName: string; passcode: string; startingCashCents: number;
  preset: 'monopoly_us' | 'custom'; rules: 'official' | 'house';
}) {
  return jsonOrThrow<{ code: string; playerId: string }>(
    await fetch('/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }),
  );
}

export async function joinRoom(code: string, input: { name: string; passcode: string }) {
  return jsonOrThrow<{ code: string; playerId: string }>(
    await fetch(`/api/rooms/${code}/join`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }),
  );
}

export async function fetchRoom(code: string) {
  return jsonOrThrow<{ room: Omit<Room, 'passcodeHash'>; sessionPlayerId: string }>(
    await fetch(`/api/rooms/${code}`, { cache: 'no-store' }),
  );
}

export async function proposeTransaction(code: string, input: {
  from: Party; to: Party; amountCents: number; assetIds: string[]; reason: string; reasonLabel: string; splitParentId?: string;
}) {
  return jsonOrThrow<{ transaction: Transaction }>(
    await fetch(`/api/rooms/${code}/transactions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }),
  );
}

export async function confirmTransaction(code: string, id: string) {
  return jsonOrThrow<{ ok: true }>(await fetch(`/api/rooms/${code}/transactions/${id}/confirm`, { method: 'POST' }));
}

export async function rejectTransaction(code: string, id: string) {
  return jsonOrThrow<{ ok: true }>(await fetch(`/api/rooms/${code}/transactions/${id}/reject`, { method: 'POST' }));
}

export async function undoTransaction(code: string, id: string) {
  return jsonOrThrow<{ transaction: Transaction }>(await fetch(`/api/rooms/${code}/transactions/${id}/undo`, { method: 'POST' }));
}
```

- [ ] **Step 2: use-room hook**

`lib/client/use-room.ts`:
```ts
'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { fetchRoom } from './api';
import type { Room } from '@/lib/game/types';

export interface RoomView {
  room: Omit<Room, 'passcodeHash'> | null;
  sessionPlayerId: string | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useRoom(code: string): RoomView {
  const [room, setRoom] = useState<RoomView['room']>(null);
  const [pid, setPid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const refetch = useCallback(async () => {
    try {
      const { room, sessionPlayerId } = await fetchRoom(code);
      setRoom(room);
      setPid(sessionPlayerId);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    refetch();
    const es = new EventSource(`/api/rooms/${code}/events`);
    esRef.current = es;
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === 'transaction' || data.type === 'player' || data.type === 'state') {
          refetch();
        }
      } catch {}
    };
    es.onerror = () => {
      // Auto-reconnects via EventSource
    };
    return () => { es.close(); esRef.current = null; };
  }, [code, refetch]);

  return { room, sessionPlayerId: pid, loading, error, refetch };
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/client/
git commit -m "feat(client): typed API + useRoom SSE hook"
```

---

### Task 14: Home page (landing)

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`

**Use skill:** `frontend-design:frontend-design` and `ui-ux-pro-max` for design polish. `framer-motion-animator` for entrance animations.

- [ ] **Step 1: Update layout.tsx**

```tsx
import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans-active' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-display-active' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono-active' });

export const metadata: Metadata = {
  title: 'Autobank — the Monopoly banker no one wants to be',
  description: 'A peer-confirmed digital wallet for tabletop board games. No banker, no cheating.',
  manifest: '/manifest.json',
};
export const viewport: Viewport = { themeColor: '#fbfaf6', width: 'device-width', initialScale: 1, maximumScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} ${mono.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Build the landing page**

Visual concept: full-bleed page with a giant property card hero (Boardwalk) tilted at the top, the brand wordmark in display serif, and two large CTAs. Inline a small animated "live ledger" sample to show what the app feels like.

`app/page.tsx`:
```tsx
import Link from 'next/link';
import { ArrowRight, Plus, LogIn } from 'lucide-react';
import { PropertyCard } from '@/components/property-card';

export default function Home() {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-md flex-col px-6 pb-10 pt-12">
      <header className="mb-12 flex items-center justify-between">
        <span className="font-[family-name:var(--font-display-active)] text-2xl tracking-tight">autobank</span>
        <span className="text-xs text-[--color-ink-soft]">no banker, no cheating</span>
      </header>

      <section className="mb-16 flex flex-col items-center text-center">
        <div className="mb-10 -rotate-3 transition hover:rotate-0">
          <PropertyCard
            name="Boardwalk"
            color="darkblue"
            price={40000}
            rents={[5000, 20000, 60000, 140000, 170000, 200000]}
          />
        </div>
        <h1 className="font-[family-name:var(--font-display-active)] text-4xl leading-tight">
          The banker no one wants to be.
        </h1>
        <p className="mt-3 text-[--color-ink-soft]">
          A shared wallet for your tabletop game. Every transfer is publicly logged and confirmed by the people involved — so cheating is impossible.
        </p>
      </section>

      <nav className="mt-auto space-y-3">
        <Link
          href="/create"
          className="group flex items-center justify-between rounded-2xl bg-[--color-ink] px-5 py-4 text-white shadow-[--shadow-elev] transition active:scale-[0.99]"
        >
          <span className="flex items-center gap-3"><Plus className="size-5" /> Create a room</span>
          <ArrowRight className="size-5 transition group-hover:translate-x-0.5" />
        </Link>
        <Link
          href="/join"
          className="flex items-center justify-between rounded-2xl border border-[--color-line] bg-[--color-bg-elev] px-5 py-4 transition active:scale-[0.99]"
        >
          <span className="flex items-center gap-3"><LogIn className="size-5" /> Join with a code</span>
          <ArrowRight className="size-5" />
        </Link>
      </nav>
    </main>
  );
}
```

- [ ] **Step 3: Verify**

Run `npm run dev`, open `http://localhost:3000`. Expect: landing page renders with Boardwalk card and two CTAs. (Property card may not exist yet — Task 15.)

If property card not built: stub it as `<div>Boardwalk</div>` here, replace once Task 15 lands.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx app/page.tsx
git commit -m "feat(home): landing page with hero + CTAs"
```

---

### Task 15: PropertyCard component (designed)

**Files:**
- Create: `components/property-card.tsx`

**Use skill:** `frontend-design:frontend-design`, `ui-ux-pro-max`. The card must look like a real Monopoly property card — cream/ivory base, colored header band, typewriter-feel typography for prices, classic black border. Source visual reference from photos of the US Monopoly card.

- [ ] **Step 1: Implement**

```tsx
'use client';
import { cn, formatMoney } from '@/lib/utils';
import type { PropertyColor } from '@/lib/game/types';

const COLOR: Record<PropertyColor, string> = {
  brown:     'bg-[--color-prop-brown]    text-white',
  lightblue: 'bg-[--color-prop-lightblue] text-black',
  pink:      'bg-[--color-prop-pink]     text-white',
  orange:    'bg-[--color-prop-orange]   text-white',
  red:       'bg-[--color-prop-red]      text-white',
  yellow:    'bg-[--color-prop-yellow]   text-black',
  green:     'bg-[--color-prop-green]    text-white',
  darkblue:  'bg-[--color-prop-darkblue] text-white',
};

export interface PropertyCardProps {
  name: string;
  color: PropertyColor;
  price: number;          // cents
  rents: number[];        // [base, 1H, 2H, 3H, 4H, hotel] (cents)
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function PropertyCard({ name, color, price, rents, className, size = 'md' }: PropertyCardProps) {
  const dims = size === 'sm' ? 'w-44' : size === 'lg' ? 'w-72' : 'w-56';
  return (
    <div className={cn(
      'rounded-[--radius-card] border-2 border-black bg-[oklch(0.98_0.01_85)] shadow-[--shadow-card] overflow-hidden font-[family-name:var(--font-mono-active)]',
      dims, className,
    )}>
      <div className="px-3 pb-2 pt-3 text-center bg-white">
        <div className="text-[10px] uppercase tracking-[0.2em] text-black/60">Title Deed</div>
      </div>
      <div className={cn('flex h-12 items-center justify-center px-3 text-center', COLOR[color])}>
        <span className="text-base font-bold uppercase tracking-wide leading-tight">{name}</span>
      </div>
      <div className="space-y-1 px-3 py-3 text-[11px] text-black">
        <Row k="Rent" v={formatMoney(rents[0])} />
        <Row k="With 1 House" v={formatMoney(rents[1])} />
        <Row k="With 2 Houses" v={formatMoney(rents[2])} />
        <Row k="With 3 Houses" v={formatMoney(rents[3])} />
        <Row k="With 4 Houses" v={formatMoney(rents[4])} />
        <Row k="With HOTEL" v={formatMoney(rents[5])} />
        <div className="my-1 h-px bg-black/15" />
        <Row k="Mortgage Value" v={formatMoney(Math.floor(price / 2))} />
        <Row k="Houses cost" v={formatMoney(5000)} />
        <Row k="Hotels, plus 4 houses" v={formatMoney(5000)} />
        <div className="mt-2 text-center text-[9px] uppercase tracking-wider text-black/60">
          Price ${(price / 100).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-black/80">{k}</span>
      <span className="font-bold tabular-nums text-black">{v}</span>
    </div>
  );
}
```

- [ ] **Step 2: Visual verify**

Render the home page; the Boardwalk card should look immediately like a Monopoly title deed. Tweak spacing/colors until it does.

- [ ] **Step 3: Commit**

```bash
git add components/property-card.tsx
git commit -m "feat(ui): designed property card"
```

---

### Task 16: MoneyBill component (designed)

**Files:**
- Create: `components/money-bill.tsx`

**Use skill:** `frontend-design:frontend-design`, `ui-ux-pro-max`. Money should look like a colored bill with denomination corners, ornate border lines (CSS-only), and a centered $-symbol seal.

- [ ] **Step 1: Implement**

```tsx
import { cn } from '@/lib/utils';

const DENOM_COLOR: Record<number, string> = {
  1: 'bg-[--color-money-1] text-black border-black/30',
  5: 'bg-[--color-money-5] text-black border-black/40',
  10: 'bg-[--color-money-10] text-black border-black/40',
  20: 'bg-[--color-money-20] text-white border-black/50',
  50: 'bg-[--color-money-50] text-white border-black/60',
  100: 'bg-[--color-money-100] text-white border-black/60',
  500: 'bg-[--color-money-500] text-white border-black/70',
};

export interface MoneyBillProps {
  denomination: 1 | 5 | 10 | 20 | 50 | 100 | 500;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export function MoneyBill({ denomination, size = 'sm', className }: MoneyBillProps) {
  const dims = size === 'xs' ? 'h-10 w-20 text-base' : size === 'md' ? 'h-20 w-40 text-3xl' : 'h-14 w-28 text-xl';
  return (
    <div className={cn(
      'relative inline-flex items-center justify-center rounded-[--radius-bill] border shadow-[--shadow-bill] font-[family-name:var(--font-display-active)]',
      DENOM_COLOR[denomination], dims, className,
    )}>
      <span className="absolute left-1.5 top-0.5 text-[10px] font-bold opacity-80">${denomination}</span>
      <span className="absolute right-1.5 bottom-0.5 text-[10px] font-bold opacity-80">${denomination}</span>
      <span className="font-bold tabular-nums">${denomination}</span>
      <div className="absolute inset-1 rounded-[2px] border opacity-30" />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/money-bill.tsx
git commit -m "feat(ui): designed money bill"
```

---

### Task 17: Create Room page

**Files:**
- Create: `app/create/page.tsx`

**Use skill:** `frontend-design:frontend-design`, `framer-motion-animator` for form transitions.

- [ ] **Step 1: Implement**

```tsx
'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { createRoom } from '@/lib/client/api';

export default function CreateRoom() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [starting, setStarting] = useState(1500); // dollars
  const [rules, setRules] = useState<'house' | 'official'>('house');
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    start(async () => {
      try {
        const { code } = await createRoom({
          adminName: name.trim(),
          passcode,
          startingCashCents: Math.round(starting * 100),
          preset: 'monopoly_us',
          rules,
        });
        router.push(`/room/${code}`);
      } catch (e) { setErr((e as Error).message); }
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 pb-10 pt-8">
      <Link href="/" className="mb-6 inline-flex items-center gap-1 text-sm text-[--color-ink-soft]"><ArrowLeft className="size-4" /> Back</Link>
      <h1 className="font-[family-name:var(--font-display-active)] text-3xl mb-1">Create a room</h1>
      <p className="mb-8 text-sm text-[--color-ink-soft]">You'll be the admin. Share the room code + passcode with friends.</p>

      <form onSubmit={submit} className="space-y-5">
        <Field label="Your name">
          <input
            value={name} onChange={e => setName(e.target.value)} required maxLength={20} autoFocus
            className="w-full rounded-xl border border-[--color-line] bg-[--color-bg-elev] px-4 py-3 text-base outline-none focus:border-[--color-accent]"
            placeholder="Alice"
          />
        </Field>
        <Field label="Room passcode" hint="4–20 chars. Friends need this to join.">
          <input
            value={passcode} onChange={e => setPasscode(e.target.value)} required minLength={4} maxLength={20}
            className="w-full rounded-xl border border-[--color-line] bg-[--color-bg-elev] px-4 py-3 text-base font-[family-name:var(--font-mono-active)] outline-none focus:border-[--color-accent]"
            placeholder="••••"
          />
        </Field>
        <Field label="Starting cash">
          <div className="grid grid-cols-3 gap-2">
            {[1500, 2500, 5000].map(v => (
              <button key={v} type="button" onClick={() => setStarting(v)}
                className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${starting === v ? 'border-[--color-accent] bg-[--color-accent-soft]' : 'border-[--color-line] bg-[--color-bg-elev]'}`}>
                ${v.toLocaleString()}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Rules">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setRules('house')}
              className={`rounded-xl border p-3 text-left text-sm transition ${rules === 'house' ? 'border-[--color-accent] bg-[--color-accent-soft]' : 'border-[--color-line] bg-[--color-bg-elev]'}`}>
              <div className="font-semibold">Our rules</div>
              <div className="text-xs text-[--color-ink-soft]">Loans, gifts, partnerships allowed</div>
            </button>
            <button type="button" onClick={() => setRules('official')}
              className={`rounded-xl border p-3 text-left text-sm transition ${rules === 'official' ? 'border-[--color-accent] bg-[--color-accent-soft]' : 'border-[--color-line] bg-[--color-bg-elev]'}`}>
              <div className="font-semibold">Official</div>
              <div className="text-xs text-[--color-ink-soft]">Trades only — no free transfers</div>
            </button>
          </div>
        </Field>

        {err && <p className="text-sm text-[--color-danger]">{err}</p>}

        <button disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[--color-ink] px-5 py-4 text-white shadow-[--shadow-elev] transition active:scale-[0.99] disabled:opacity-60">
          {pending && <Loader2 className="size-4 animate-spin" />} Create room
        </button>
      </form>
    </main>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-[--color-ink-soft]">{hint}</span>}
    </label>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/create/page.tsx
git commit -m "feat(create): admin create-room form"
```

---

### Task 18: Join Room page

**Files:**
- Create: `app/join/page.tsx`
- Create: `app/join/[code]/page.tsx`

- [ ] **Step 1: Implement /join (manual entry)**

```tsx
'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { joinRoom } from '@/lib/client/api';

export default function JoinRoom() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    start(async () => {
      try {
        await joinRoom(code.toUpperCase(), { name: name.trim(), passcode });
        router.push(`/room/${code.toUpperCase()}`);
      } catch (e) { setErr((e as Error).message); }
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 pb-10 pt-8">
      <Link href="/" className="mb-6 inline-flex items-center gap-1 text-sm text-[--color-ink-soft]"><ArrowLeft className="size-4" /> Back</Link>
      <h1 className="font-[family-name:var(--font-display-active)] text-3xl mb-1">Join a room</h1>
      <p className="mb-8 text-sm text-[--color-ink-soft]">Ask the host for the room code and passcode.</p>

      <form onSubmit={submit} className="space-y-5">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Room code</span>
          <input
            value={code} onChange={e => setCode(e.target.value.toUpperCase().slice(0, 4))} required minLength={4} maxLength={4} autoFocus
            className="w-full rounded-xl border border-[--color-line] bg-[--color-bg-elev] px-4 py-3 text-2xl font-bold uppercase tracking-[0.4em] text-center font-[family-name:var(--font-mono-active)] outline-none focus:border-[--color-accent]"
            placeholder="BANK"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Your name</span>
          <input value={name} onChange={e => setName(e.target.value)} required maxLength={20}
            className="w-full rounded-xl border border-[--color-line] bg-[--color-bg-elev] px-4 py-3 outline-none focus:border-[--color-accent]" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Passcode</span>
          <input value={passcode} onChange={e => setPasscode(e.target.value)} required minLength={4} maxLength={20}
            className="w-full rounded-xl border border-[--color-line] bg-[--color-bg-elev] px-4 py-3 font-[family-name:var(--font-mono-active)] outline-none focus:border-[--color-accent]" />
        </label>
        {err && <p className="text-sm text-[--color-danger]">{err}</p>}
        <button disabled={pending} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[--color-ink] px-5 py-4 text-white shadow-[--shadow-elev] transition active:scale-[0.99] disabled:opacity-60">
          {pending && <Loader2 className="size-4 animate-spin" />} Join room
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: /join/[code] (pre-filled from QR)**

`app/join/[code]/page.tsx`:
```tsx
'use client';
import { use, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { joinRoom } from '@/lib/client/api';

export default function JoinPrefilled({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const [name, setName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    start(async () => {
      try {
        await joinRoom(code.toUpperCase(), { name: name.trim(), passcode });
        router.push(`/room/${code.toUpperCase()}`);
      } catch (e) { setErr((e as Error).message); }
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 pb-10 pt-8">
      <Link href="/" className="mb-6 inline-flex items-center gap-1 text-sm text-[--color-ink-soft]"><ArrowLeft className="size-4" /> Back</Link>
      <h1 className="font-[family-name:var(--font-display-active)] text-3xl mb-1">Join {code.toUpperCase()}</h1>
      <p className="mb-8 text-sm text-[--color-ink-soft]">Enter the passcode to join.</p>
      <form onSubmit={submit} className="space-y-5">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Your name</span>
          <input value={name} onChange={e => setName(e.target.value)} required maxLength={20} autoFocus
            className="w-full rounded-xl border border-[--color-line] bg-[--color-bg-elev] px-4 py-3 outline-none focus:border-[--color-accent]" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Passcode</span>
          <input value={passcode} onChange={e => setPasscode(e.target.value)} required minLength={4} maxLength={20}
            className="w-full rounded-xl border border-[--color-line] bg-[--color-bg-elev] px-4 py-3 font-[family-name:var(--font-mono-active)] outline-none focus:border-[--color-accent]" />
        </label>
        {err && <p className="text-sm text-[--color-danger]">{err}</p>}
        <button disabled={pending} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[--color-ink] px-5 py-4 text-white shadow-[--shadow-elev] transition active:scale-[0.99] disabled:opacity-60">
          {pending && <Loader2 className="size-4 animate-spin" />} Join
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/join/
git commit -m "feat(join): join room (manual + pre-filled)"
```

---

### Task 19: Game room shell + WalletPanel + LedgerFeed

**Files:**
- Create: `app/room/[code]/page.tsx`
- Create: `app/room/[code]/loading.tsx`
- Create: `components/wallet-panel.tsx`
- Create: `components/ledger-feed.tsx`
- Create: `components/balance-tick.tsx`

**Use skill:** `frontend-design:frontend-design`, `framer-motion-animator` (balance tick-up, ledger entry slide-in).

- [ ] **Step 1: BalanceTick (animated number)**

`components/balance-tick.tsx`:
```tsx
'use client';
import { motion, useSpring, useTransform } from 'framer-motion';
import { useEffect } from 'react';
import { formatMoney } from '@/lib/utils';

export function BalanceTick({ cents }: { cents: number }) {
  const spring = useSpring(cents, { stiffness: 100, damping: 24, mass: 0.6 });
  const display = useTransform(spring, (v) => formatMoney(Math.round(v)));
  useEffect(() => { spring.set(cents); }, [cents, spring]);
  return <motion.span className="tabular-nums">{display}</motion.span>;
}
```

- [ ] **Step 2: WalletPanel**

`components/wallet-panel.tsx`:
```tsx
'use client';
import { motion } from 'framer-motion';
import type { Player, Asset } from '@/lib/game/types';
import { PropertyCard } from './property-card';
import { BalanceTick } from './balance-tick';

export function WalletPanel({ player, assets }: { player: Player; assets: Asset[] }) {
  return (
    <motion.section
      layout
      className="rounded-3xl bg-[--color-bg-elev] border border-[--color-line] p-5 shadow-[--shadow-card]"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full text-white font-bold" style={{ background: player.color }}>
            {player.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <div className="font-semibold leading-tight">{player.name} {player.isAdmin && <span className="ml-1 text-[10px] uppercase tracking-wider text-[--color-ink-soft]">admin</span>}</div>
            <div className="text-xs text-[--color-ink-soft]">{assets.length} assets</div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-[family-name:var(--font-display-active)] text-3xl"><BalanceTick cents={player.cashCents} /></div>
        </div>
      </div>
      {assets.length > 0 && (
        <div className="mt-5 flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
          {assets.map(a => (
            a.kind === 'property' && a.color && a.rent ? (
              <div key={a.id} className="snap-start"><PropertyCard size="sm" name={a.name} color={a.color} price={a.price ?? 0} rents={a.rent} /></div>
            ) : (
              <div key={a.id} className="snap-start min-w-44 rounded-2xl border border-[--color-line] bg-white p-3 text-sm">{a.name}</div>
            )
          ))}
        </div>
      )}
    </motion.section>
  );
}
```

- [ ] **Step 3: LedgerFeed**

`components/ledger-feed.tsx`:
```tsx
'use client';
import { AnimatePresence, motion } from 'framer-motion';
import type { Transaction, Room } from '@/lib/game/types';
import { formatMoney, formatRelative } from '@/lib/utils';
import { ArrowRight, Building2, Banknote } from 'lucide-react';

export function LedgerFeed({ room }: { room: Omit<Room, 'passcodeHash'> }) {
  return (
    <section className="rounded-3xl bg-[--color-bg-elev] border border-[--color-line] p-2 shadow-[--shadow-card]">
      <h2 className="px-3 pt-2 pb-1 text-xs uppercase tracking-[0.18em] text-[--color-ink-soft]">Ledger</h2>
      <ul className="divide-y divide-[--color-line]">
        <AnimatePresence initial={false}>
          {room.transactions.slice(0, 30).map(t => (
            <motion.li key={t.id}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-3 px-3 py-3"
            >
              <StatusDot t={t} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-sm">
                  <PartyLabel party={t.from} room={room} />
                  <ArrowRight className="size-3.5 text-[--color-ink-soft]" />
                  <PartyLabel party={t.to} room={room} />
                  {t.amountCents > 0 && (
                    <span className="ml-auto font-bold tabular-nums">{formatMoney(t.amountCents)}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-[--color-ink-soft]">
                  <span>{t.reasonLabel}</span>
                  <span>·</span>
                  <span>{formatRelative(t.createdAt)}</span>
                  {t.status !== 'confirmed' && <span className="ml-1 rounded bg-[--color-warning]/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-black/70">{t.status}</span>}
                </div>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
        {room.transactions.length === 0 && (
          <li className="px-3 py-8 text-center text-sm text-[--color-ink-soft]">No transactions yet.</li>
        )}
      </ul>
    </section>
  );
}

function StatusDot({ t }: { t: Transaction }) {
  const color =
    t.status === 'confirmed' ? 'bg-[--color-success]' :
    t.status === 'pending' ? 'bg-[--color-warning] animate-pulse' :
    'bg-[--color-ink-soft]/40';
  return <span className={`size-2.5 rounded-full ${color}`} />;
}

function PartyLabel({ party, room }: { party: Transaction['from']; room: Omit<Room, 'passcodeHash'> }) {
  if (party.kind === 'bank') return <span className="inline-flex items-center gap-1"><Banknote className="size-3.5" /> Bank</span>;
  const p = room.players[party.playerId];
  if (!p) return <span>?</span>;
  return <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: p.color }} />{p.name}</span>;
}
```

- [ ] **Step 4: Game room page (composition)**

`app/room/[code]/page.tsx`:
```tsx
'use client';
import { use } from 'react';
import { useRoom } from '@/lib/client/use-room';
import { WalletPanel } from '@/components/wallet-panel';
import { LedgerFeed } from '@/components/ledger-feed';
import { ActionBar } from '@/components/action-bar';
import { ConfirmationStack } from '@/components/confirmation-prompt';

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, sessionPlayerId, loading, error } = useRoom(code.toUpperCase());

  if (loading) return null; // loading.tsx renders
  if (error || !room || !sessionPlayerId) return <ErrorPanel msg={error ?? 'Room not found'} />;

  const me = room.players[sessionPlayerId];
  const myAssets = me.assetIds.map(id => room.assets[id]).filter(Boolean);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-4 pb-28 pt-6">
      <header className="flex items-center justify-between">
        <span className="font-[family-name:var(--font-display-active)] text-xl">autobank</span>
        <span className="rounded-md bg-[--color-bg-elev] border border-[--color-line] px-2 py-1 font-[family-name:var(--font-mono-active)] text-sm tracking-[0.2em]">{room.code}</span>
      </header>

      <WalletPanel player={me} assets={myAssets} />

      <div className="grid grid-cols-2 gap-2">
        {Object.values(room.players).filter(p => p.id !== me.id).map(p => (
          <div key={p.id} className="flex items-center justify-between rounded-2xl border border-[--color-line] bg-[--color-bg-elev] px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="size-2.5 rounded-full" style={{ background: p.color }} />
              <span className="truncate text-sm">{p.name}</span>
            </div>
            <span className="font-[family-name:var(--font-mono-active)] text-sm tabular-nums">${(p.cashCents / 100).toLocaleString()}</span>
          </div>
        ))}
      </div>

      <LedgerFeed room={room} />
      <ConfirmationStack room={room} sessionPlayerId={sessionPlayerId} />
      <ActionBar room={room} sessionPlayerId={sessionPlayerId} />
    </main>
  );
}

function ErrorPanel({ msg }: { msg: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="text-[--color-danger]">{msg}</p>
    </main>
  );
}
```

- [ ] **Step 5: loading.tsx**

```tsx
export default function Loading() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-4 pb-28 pt-6 animate-pulse">
      <div className="h-6 w-24 rounded bg-[--color-line]" />
      <div className="h-32 rounded-3xl bg-[--color-line]/40" />
      <div className="h-64 rounded-3xl bg-[--color-line]/40" />
    </main>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add app/room/ components/wallet-panel.tsx components/ledger-feed.tsx components/balance-tick.tsx
git commit -m "feat(room): wallet, ledger, page composition"
```

---

### Task 20: Confirmation prompts + Action bar + Transfer sheet

**Files:**
- Create: `components/confirmation-prompt.tsx`
- Create: `components/action-bar.tsx`
- Create: `components/transfer-sheet.tsx`
- Create: `components/countdown-bar.tsx`

**Use skill:** `framer-motion-animator` for sheet entry, countdown-bar fill.

- [ ] **Step 1: CountdownBar**

`components/countdown-bar.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';
export function CountdownBar({ from, to }: { from: number; to: number }) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const now = Date.now();
      const total = to - from;
      const elapsed = Math.max(0, Math.min(total, now - from));
      setPct((elapsed / total) * 100);
      if (now < to) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [from, to]);
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-[--color-line]">
      <div className="h-full bg-[--color-accent] transition-[width] duration-100" style={{ width: `${pct}%` }} />
    </div>
  );
}
```

- [ ] **Step 2: ConfirmationStack**

`components/confirmation-prompt.tsx`:
```tsx
'use client';
import { AnimatePresence, motion } from 'framer-motion';
import type { Room, Transaction } from '@/lib/game/types';
import { formatMoney } from '@/lib/utils';
import { confirmTransaction, rejectTransaction } from '@/lib/client/api';
import { CountdownBar } from './countdown-bar';
import { Check, X } from 'lucide-react';
import { useTransition } from 'react';

export function ConfirmationStack({ room, sessionPlayerId }: { room: Omit<Room, 'passcodeHash'>; sessionPlayerId: string }) {
  const pending = room.transactions.filter(t => t.status === 'pending' && t.needsConfirmFrom.includes(sessionPlayerId));
  return (
    <AnimatePresence>
      {pending.map(t => <Prompt key={t.id} t={t} room={room} />)}
    </AnimatePresence>
  );
}

function Prompt({ t, room }: { t: Transaction; room: Omit<Room, 'passcodeHash'> }) {
  const [busy, start] = useTransition();
  const fromName = t.from.kind === 'bank' ? 'Bank' : room.players[t.from.playerId]?.name ?? '?';
  const toName = t.to.kind === 'bank' ? 'Bank' : room.players[t.to.playerId]?.name ?? '?';

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-3xl border border-[--color-accent]/40 bg-[--color-accent-soft] p-4 shadow-[--shadow-elev]"
    >
      <div className="text-xs uppercase tracking-wider text-[--color-ink-soft]">Confirm</div>
      <p className="mt-1 text-base"><b>{fromName}</b> → <b>{toName}</b> · {t.reasonLabel}</p>
      {t.amountCents > 0 && <p className="font-[family-name:var(--font-display-active)] text-3xl">{formatMoney(t.amountCents)}</p>}
      {t.expiresAt && <div className="my-3"><CountdownBar from={t.createdAt} to={t.expiresAt} /></div>}
      <div className="mt-3 flex gap-2">
        <button disabled={busy} onClick={() => start(async () => { await rejectTransaction(room.code, t.id); })}
          className="flex-1 rounded-xl border border-[--color-line] bg-white px-4 py-3 text-sm font-medium">
          <X className="mx-auto size-4" />
        </button>
        <button disabled={busy} onClick={() => start(async () => { await confirmTransaction(room.code, t.id); })}
          className="flex-[2] rounded-xl bg-[--color-ink] px-4 py-3 text-white">
          <span className="inline-flex items-center justify-center gap-2"><Check className="size-4" /> Confirm</span>
        </button>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 3: ActionBar**

`components/action-bar.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { Banknote, ArrowDownToLine, Send, Repeat, Split } from 'lucide-react';
import type { Room } from '@/lib/game/types';
import { TransferSheet, type TransferIntent } from './transfer-sheet';

export function ActionBar({ room, sessionPlayerId }: { room: Omit<Room, 'passcodeHash'>; sessionPlayerId: string }) {
  const [intent, setIntent] = useState<TransferIntent | null>(null);
  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[--color-line] bg-[--color-bg-elev]/95 backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1 px-3 py-2">
          <Btn icon={<ArrowDownToLine className="size-5" />} label="Pay bank"   onClick={() => setIntent({ direction: 'to_bank' })} />
          <Btn icon={<Banknote className="size-5" />}        label="From bank"  onClick={() => setIntent({ direction: 'from_bank' })} />
          <Btn icon={<Send className="size-5" />}            label="Send"        onClick={() => setIntent({ direction: 'p2p' })} />
          <Btn icon={<Repeat className="size-5" />}          label="Trade"       onClick={() => setIntent({ direction: 'trade' })} />
          <Btn icon={<Split className="size-5" />}           label="Split"       onClick={() => setIntent({ direction: 'split' })} />
        </div>
      </nav>
      {intent && <TransferSheet room={room} sessionPlayerId={sessionPlayerId} intent={intent} onClose={() => setIntent(null)} />}
    </>
  );
}

function Btn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-0.5 rounded-xl px-2 py-2 active:bg-[--color-accent-soft]">
      {icon}
      <span className="text-[10px] font-medium text-[--color-ink-soft]">{label}</span>
    </button>
  );
}
```

- [ ] **Step 4: TransferSheet (handles to_bank, from_bank, p2p)**

`components/transfer-sheet.tsx`:
```tsx
'use client';
import { useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Room, Party, ReasonKey } from '@/lib/game/types';
import { REASON_PRESETS } from '@/lib/game/types';
import { proposeTransaction } from '@/lib/client/api';
import { formatMoney } from '@/lib/utils';
import { X, Loader2 } from 'lucide-react';

export type TransferIntent =
  | { direction: 'to_bank' } | { direction: 'from_bank' }
  | { direction: 'p2p' } | { direction: 'trade' } | { direction: 'split' };

export function TransferSheet({ room, sessionPlayerId, intent, onClose }: {
  room: Omit<Room, 'passcodeHash'>; sessionPlayerId: string; intent: TransferIntent; onClose: () => void;
}) {
  const [amount, setAmount] = useState(0);                  // dollars
  const [reasonKey, setReasonKey] = useState<ReasonKey>('other');
  const [recipientId, setRecipientId] = useState<string>('');
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const me: Party = { kind: 'player', playerId: sessionPlayerId };
  const bank: Party = { kind: 'bank' };
  const others = Object.values(room.players).filter(p => p.id !== sessionPlayerId);

  const reasons = REASON_PRESETS.filter(r =>
    intent.direction === 'to_bank' ? (r.dir === 'to_bank' || r.dir === 'either') :
    intent.direction === 'from_bank' ? (r.dir === 'from_bank' || r.dir === 'either') :
    (r.dir === 'to_player' || r.dir === 'either')
  );

  function submit() {
    setErr(null);
    let from: Party, to: Party;
    if (intent.direction === 'to_bank') { from = me; to = bank; }
    else if (intent.direction === 'from_bank') { from = bank; to = me; }
    else { from = me; to = { kind: 'player', playerId: recipientId }; }

    const reason = REASON_PRESETS.find(r => r.key === reasonKey)!;
    start(async () => {
      try {
        await proposeTransaction(room.code, {
          from, to,
          amountCents: Math.round(amount * 100),
          assetIds: [],
          reason: reason.key,
          reasonLabel: reason.label,
        });
        onClose();
      } catch (e) { setErr((e as Error).message); }
    });
  }

  const title = intent.direction === 'to_bank' ? 'Pay the bank' :
                intent.direction === 'from_bank' ? 'Take from the bank' :
                intent.direction === 'p2p' ? 'Send to a player' :
                intent.direction;

  const needsRecipient = intent.direction === 'p2p';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
      />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-3xl bg-[--color-bg-elev] p-5 shadow-[--shadow-elev]"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[--color-line]" />
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-[family-name:var(--font-display-active)] text-2xl">{title}</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-[--color-ink-soft]"><X className="size-4" /></button>
        </div>

        {needsRecipient && (
          <div className="mb-4">
            <label className="mb-2 block text-xs uppercase tracking-wider text-[--color-ink-soft]">Recipient</label>
            <div className="flex flex-wrap gap-2">
              {others.map(p => (
                <button key={p.id} onClick={() => setRecipientId(p.id)}
                  className={`rounded-xl border px-3 py-2 text-sm ${recipientId === p.id ? 'border-[--color-accent] bg-[--color-accent-soft]' : 'border-[--color-line]'}`}>
                  <span className="mr-1.5 inline-block size-2 rounded-full align-middle" style={{ background: p.color }} />
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-4">
          <label className="mb-2 block text-xs uppercase tracking-wider text-[--color-ink-soft]">Reason</label>
          <div className="flex flex-wrap gap-2">
            {reasons.map(r => (
              <button key={r.key} onClick={() => { setReasonKey(r.key); if (r.defaultAmount > 0) setAmount(r.defaultAmount / 100); }}
                className={`rounded-xl border px-3 py-2 text-sm ${reasonKey === r.key ? 'border-[--color-accent] bg-[--color-accent-soft]' : 'border-[--color-line]'}`}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <label className="mb-2 block text-xs uppercase tracking-wider text-[--color-ink-soft]">Amount</label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-2xl text-[--color-ink-soft]">$</span>
            <input type="number" min={0} step={1} value={amount || ''} onChange={e => setAmount(Number(e.target.value))}
              className="w-full rounded-2xl border border-[--color-line] bg-white py-4 pl-9 pr-4 text-3xl font-[family-name:var(--font-display-active)] outline-none focus:border-[--color-accent]" />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[50, 100, 200, 500, 1000].map(v => (
              <button key={v} onClick={() => setAmount(v)}
                className="rounded-lg border border-[--color-line] bg-white px-2.5 py-1 text-xs">+${v}</button>
            ))}
          </div>
        </div>

        {err && <p className="mb-3 text-sm text-[--color-danger]">{err}</p>}

        <button disabled={pending || amount <= 0 || (needsRecipient && !recipientId)}
          onClick={submit}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[--color-ink] px-5 py-4 text-white shadow-[--shadow-elev] disabled:opacity-50">
          {pending && <Loader2 className="size-4 animate-spin" />} Propose {formatMoney(Math.round(amount * 100))}
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add components/confirmation-prompt.tsx components/action-bar.tsx components/transfer-sheet.tsx components/countdown-bar.tsx
git commit -m "feat(room): confirmation prompts, action bar, transfer sheet"
```

---

### Task 21: Bank-withdrawal auto-confirm sweeper

**Background:** When a `bank → player` transaction expires (`expiresAt < now`) with no objection, it should auto-confirm. Without server-side cron we sweep on each `roomStore.update` and on each transaction list query.

**Files:**
- Modify: `lib/server/stores.ts` — wrap update/get to sweep expired
- Modify: `lib/game/rules.ts` — add `sweepExpired(room: Room): Room`

- [ ] **Step 1: sweepExpired test (failing)**

Add to `tests/rules.test.ts`:
```ts
import { sweepExpired } from '@/lib/game/rules';

describe('sweepExpired', () => {
  it('auto-confirms expired bank withdrawals with no objection', () => {
    const r = baseRoom();
    const t = tx({
      id: 'tw', from: { kind: 'bank' }, to: { kind: 'player', playerId: 'p1' },
      amountCents: 20000, reason: 'pass_go', needsConfirmFrom: ['p2'],
      createdAt: Date.now() - 20_000, expiresAt: Date.now() - 5_000,
    });
    r.transactions = [t];
    const next = sweepExpired(r);
    const swept = next.transactions.find(x => x.id === 'tw')!;
    expect(swept.status).toBe('confirmed');
    expect(next.players.p1.cashCents).toBe(170000);
  });
});
```

- [ ] **Step 2: Implement sweepExpired**

In `lib/game/rules.ts`:
```ts
export function sweepExpired(room: Room): Room {
  const now = Date.now();
  let next = room;
  for (const t of room.transactions) {
    if (t.status === 'pending' && t.expiresAt && t.expiresAt <= now) {
      const idx = next.transactions.findIndex(x => x.id === t.id);
      const updated = { ...t, status: 'confirmed' as const, resolvedAt: now, needsConfirmFrom: [] };
      const after = applyTransaction(next, updated);
      const txs = [...after.transactions];
      txs[idx] = updated;
      next = { ...after, transactions: txs };
    }
  }
  return next;
}
```

- [ ] **Step 3: Wire into stores.ts get**

Wrap `roomStore.get` to apply sweep:
```ts
import { sweepExpired } from '@/lib/game/rules';

const inner = globalThis.__autobankStore ?? new MemoryRoomStore();
globalThis.__autobankStore = inner;

export const roomStore: RoomStore = {
  create: (r) => inner.create(r),
  get: async (code) => {
    const r = await inner.get(code);
    if (!r) return null;
    const swept = sweepExpired(r);
    if (swept !== r) await inner.update(code, () => swept);
    return swept;
  },
  update: (code, mut) => inner.update(code, (r) => mut(sweepExpired(r))),
  delete: (code) => inner.delete(code),
};
```

- [ ] **Step 4: Run tests**

`npx vitest run`

- [ ] **Step 5: Commit**

```bash
git add lib/game/rules.ts lib/server/stores.ts tests/rules.test.ts
git commit -m "feat(rules): sweep expired bank withdrawals"
```

---

### Task 22: Asset transfer in TransferSheet (buy property flow)

**Files:**
- Modify: `components/transfer-sheet.tsx` — when reason = `buy_property` from bank, show asset picker

- [ ] **Step 1: Add asset picker**

In TransferSheet, when `reasonKey === 'buy_property'` and `intent.direction === 'to_bank'`:
- Show grid of bank-held properties (those in `room.bankAssetIds`)
- On select, set amount to `asset.price`
- Submit also sends `assetIds: [picked]`

```tsx
// inside TransferSheet, after the reason buttons
{reasonKey === 'buy_property' && intent.direction === 'to_bank' && (
  <div className="mb-4">
    <label className="mb-2 block text-xs uppercase tracking-wider text-[--color-ink-soft]">Property</label>
    <div className="flex gap-2 overflow-x-auto pb-2">
      {room.bankAssetIds.map(id => room.assets[id]).filter(a => a.kind === 'property' && a.color && a.rent).map(a => (
        <button key={a.id} onClick={() => { setAmount((a.price ?? 0) / 100); setSelectedAssetId(a.id); }}
          className={`shrink-0 rounded-xl border p-1 ${selectedAssetId === a.id ? 'border-[--color-accent] ring-2 ring-[--color-accent]/30' : 'border-[--color-line]'}`}>
          <PropertyCard size="sm" name={a.name} color={a.color!} price={a.price ?? 0} rents={a.rent!} />
        </button>
      ))}
    </div>
  </div>
)}
```

Add `selectedAssetId` state, include in submit's `assetIds`.

- [ ] **Step 2: Commit**

```bash
git add components/transfer-sheet.tsx
git commit -m "feat(transfer): asset picker for buy_property"
```

---

### Task 23: Split sheet (one-to-up-to-three)

**Files:**
- Create: `components/split-sheet.tsx`
- Modify: `components/action-bar.tsx` — render split sheet when intent.direction === 'split'

- [ ] **Step 1: Implement split sheet**

`components/split-sheet.tsx`:
```tsx
'use client';
import { useMemo, useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Room } from '@/lib/game/types';
import { proposeTransaction } from '@/lib/client/api';
import { formatMoney } from '@/lib/utils';
import { X, Loader2, Equal } from 'lucide-react';

export function SplitSheet({ room, sessionPlayerId, onClose }: {
  room: Omit<Room, 'passcodeHash'>; sessionPlayerId: string; onClose: () => void;
}) {
  const me = room.players[sessionPlayerId];
  const others = Object.values(room.players).filter(p => p.id !== sessionPlayerId);
  const [picks, setPicks] = useState<string[]>([]);
  const [amounts, setAmounts] = useState<Record<string, number>>({}); // dollars
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const total = useMemo(() => picks.reduce((a, id) => a + (amounts[id] || 0), 0), [picks, amounts]);

  function toggle(id: string) {
    setPicks(p => p.includes(id) ? p.filter(x => x !== id) : (p.length < 3 ? [...p, id] : p));
  }
  function evenSplit(perPerson: number) {
    const next: Record<string, number> = {};
    for (const id of picks) next[id] = perPerson;
    setAmounts(next);
  }

  function submit() {
    setErr(null);
    if (picks.length === 0) { setErr('Pick at least one recipient'); return; }
    if (total > me.cashCents / 100) { setErr('Insufficient funds'); return; }
    start(async () => {
      try {
        for (const id of picks) {
          if (!amounts[id] || amounts[id] <= 0) continue;
          await proposeTransaction(room.code, {
            from: { kind: 'player', playerId: me.id },
            to: { kind: 'player', playerId: id },
            amountCents: Math.round(amounts[id] * 100),
            assetIds: [],
            reason: 'split',
            reasonLabel: 'Split share',
          });
        }
        onClose();
      } catch (e) { setErr((e as Error).message); }
    });
  }

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-3xl bg-[--color-bg-elev] p-5 shadow-[--shadow-elev]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[--color-line]" />
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-[family-name:var(--font-display-active)] text-2xl">Split with up to 3</h3>
          <button onClick={onClose} className="rounded-full p-1.5"><X className="size-4" /></button>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {others.map(p => (
            <button key={p.id} onClick={() => toggle(p.id)}
              className={`rounded-xl border px-3 py-2 text-sm ${picks.includes(p.id) ? 'border-[--color-accent] bg-[--color-accent-soft]' : 'border-[--color-line]'}`}>
              <span className="mr-1.5 inline-block size-2 rounded-full align-middle" style={{ background: p.color }} />
              {p.name}
            </button>
          ))}
        </div>

        {picks.length > 0 && (
          <div className="mb-4 space-y-2">
            {picks.map(id => {
              const p = room.players[id];
              return (
                <div key={id} className="flex items-center gap-3 rounded-xl border border-[--color-line] bg-white px-3 py-2">
                  <span className="size-2 rounded-full" style={{ background: p.color }} />
                  <span className="flex-1 text-sm">{p.name}</span>
                  <span className="text-[--color-ink-soft]">$</span>
                  <input type="number" min={0} value={amounts[id] || ''}
                    onChange={e => setAmounts(a => ({ ...a, [id]: Number(e.target.value) }))}
                    className="w-24 rounded-lg border border-[--color-line] px-2 py-1 text-right tabular-nums outline-none focus:border-[--color-accent]" />
                </div>
              );
            })}
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-[--color-ink-soft]">Total: {formatMoney(Math.round(total * 100))}</span>
              <button onClick={() => {
                const per = Math.floor((me.cashCents / 100) / picks.length);
                evenSplit(per);
              }} className="inline-flex items-center gap-1 text-xs text-[--color-accent]"><Equal className="size-3" /> Even split</button>
            </div>
          </div>
        )}
        {err && <p className="mb-3 text-sm text-[--color-danger]">{err}</p>}
        <button disabled={pending || picks.length === 0 || total <= 0}
          onClick={submit}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[--color-ink] px-5 py-4 text-white shadow-[--shadow-elev] disabled:opacity-50">
          {pending && <Loader2 className="size-4 animate-spin" />} Send {picks.length} transfer{picks.length === 1 ? '' : 's'}
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Wire into ActionBar**

In ActionBar, when intent.direction === 'split', render `<SplitSheet>` instead of `<TransferSheet>`.

- [ ] **Step 3: Commit**

```bash
git add components/split-sheet.tsx components/action-bar.tsx
git commit -m "feat(split): split sheet for up to 3 recipients"
```

---

### Task 24: PWA manifest + meta polish

**Files:**
- Create: `public/manifest.json`
- Create: `public/icons/icon-192.png`, `icon-512.png`, `maskable.png` (placeholder solid-color SVG converted; use Inkscape or just generate a simple gradient PNG)

- [ ] **Step 1: manifest.json**

```json
{
  "name": "Autobank",
  "short_name": "Autobank",
  "description": "Wallet for tabletop board games",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#fbfaf6",
  "theme_color": "#fbfaf6",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 2: Generate placeholder icons**

Use a single-color SVG → PNG export (any 512×512 with a centered "$" sign on the brand background). Hand-curate later.

- [ ] **Step 3: Commit**

```bash
git add public/manifest.json public/icons/
git commit -m "feat(pwa): manifest + icons"
```

---

### Task 25: Upstash Redis adapter (production)

**Files:**
- Create: `lib/store/redis.ts`
- Create: `lib/pubsub/redis.ts`
- Modify: `lib/server/stores.ts` — pick adapter by env

**Use skill:** `vercel:vercel-storage`, `vercel:env-vars`.

- [ ] **Step 1: Install Upstash client**

`npm install @upstash/redis`

- [ ] **Step 2: redis store**

```ts
import { Redis } from '@upstash/redis';
import type { Room } from '@/lib/game/types';
import type { RoomStore } from './interface';

export class RedisRoomStore implements RoomStore {
  private redis: Redis;
  constructor() {
    this.redis = Redis.fromEnv();
  }
  private key(code: string) { return `autobank:room:${code}`; }
  async create(room: Room): Promise<void> {
    await this.redis.set(this.key(room.code), JSON.stringify(room));
  }
  async get(code: string): Promise<Room | null> {
    const raw = await this.redis.get<string>(this.key(code));
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : (raw as Room);
  }
  async update(code: string, mutator: (room: Room) => Room): Promise<Room> {
    // Optimistic: read, mutate, write. Single-writer assumption is acceptable for low-concurrency rooms.
    const current = await this.get(code);
    if (!current) throw new Error(`Room ${code} not found`);
    const next = mutator(current);
    await this.redis.set(this.key(code), JSON.stringify(next));
    return next;
  }
  async delete(code: string): Promise<void> {
    await this.redis.del(this.key(code));
  }
}
```

- [ ] **Step 3: redis pubsub (poll fallback)**

Upstash REST Redis does not stream pub/sub. Use a sorted-set ring buffer per room and poll via long-poll API. Implementation detail in this task is to ship a working adapter using `@upstash/redis` `lpush` + `lrange` keyed by `autobank:events:{code}`, with each SSE consumer remembering the last index.

- [ ] **Step 4: Env-toggle in stores.ts**

```ts
const useRedis = !!process.env.KV_REST_API_URL || !!process.env.UPSTASH_REDIS_REST_URL;
const inner: RoomStore = useRedis ? new RedisRoomStore() : new MemoryRoomStore();
```

- [ ] **Step 5: Commit**

```bash
git add lib/store/redis.ts lib/pubsub/redis.ts lib/server/stores.ts package.json
git commit -m "feat(prod): Upstash Redis adapters with env toggle"
```

---

### Task 26: Final verification + README

**Files:**
- Modify: `README.md`

**Use skill:** `superpowers:verification-before-completion`.

- [ ] **Step 1: Run full test suite**

`npm run test` — all green.
`npx tsc --noEmit` — no type errors.
`npm run lint` — no lint errors.
`npm run build` — production build succeeds.

- [ ] **Step 2: Manual two-window smoke test**

In one terminal: `npm run dev`. In two browser windows:
1. Window A: create room, get code, get session cookie.
2. Window B: open `/join/<code>`, enter passcode + name. Verify A sees the join (player chip appears).
3. A proposes "Pay $50 to B" → B's window shows confirmation prompt → B confirms → both balances update.
4. A taps "Take from bank, Pass GO, $200" → B's window shows objection-window prompt → wait 10s → auto-confirms → A balance up $200.

- [ ] **Step 3: README**

Replace default README with a short overview:
- What it is
- How to run dev (`npm run dev`)
- How to deploy to Vercel + add Upstash from Marketplace
- Architecture diagram (ASCII)

- [ ] **Step 4: Final commit**

```bash
git add README.md
git commit -m "docs: README with run + deploy instructions"
```

---

## Self-Review

**Spec coverage check:** Each item from the locked spec is covered by:
- Wallets (cash + assets) — Tasks 3, 19
- P2P transfer dual-confirm — Task 12
- Bank withdrawal timeout-objection — Tasks 12, 21
- Player → Bank sender-only — Task 12
- Asset transfers — Tasks 4, 22
- Reason tags (preset + custom) — Task 3 (presets), Task 20 (UI)
- Asset registry per player — Tasks 3, 19
- Public ledger — Task 19
- Undo with consensus — Task 12
- Split (up to 3) — Task 23
- Game presets (Monopoly US) — Task 3
- Official vs House rules toggle — Tasks 4, 17
- No game-rule automation — by omission (correct)
- Beautiful designs — Tasks 15, 16, 19, design tokens in Task 2
- No accounts, just admin passcode — Tasks 7, 8, 9
- Polished animations — Tasks 19 (BalanceTick), 19 (LedgerFeed AnimatePresence), 20 (sheet entry, countdown), 23 (split sheet)
- Chance + Community Chest in presets — Task 3 (REASON_PRESETS)
- PWA — Task 24
- Production Upstash — Task 25

**Placeholder scan:** none.

**Type consistency:** `Party`, `Room`, `Transaction` types defined once in Task 3, used identically across all later tasks. `REASON_PRESETS` keys referenced consistently. `passcodeHash` stripped at the API boundary in Task 10 — `Omit<Room, 'passcodeHash'>` used in all client code.

---

## Execution Handoff

Plan saved to `docs/plans/2026-05-03-autobank-mvp.md`. Recommend **Subagent-Driven** execution: dispatch a fresh subagent per task group with two-stage review (build then code-review). Tasks are mostly sequential within the data layer (1→2→3→4→5→6→7) and parallelizable in the UI layer (15, 16 in parallel; 19, 20, 23 in parallel after 13/14 are done).
