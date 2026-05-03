# Autobank

A multiplayer wallet for tabletop Monopoly that replaces the human banker. Friends open the URL on their phones, join a room with a code + passcode, and every transaction is dual-confirmed and publicly logged. No accounts, no setup, no cheating.

## What it does (and doesn't)

**Does:**
- Tracks each player's cash + property cards in a per-phone wallet
- All player-to-player transfers require both sides to confirm before money moves
- Bank withdrawals (e.g. "Pass GO, +$200") show on every other player's phone with a 10-second objection window — auto-confirms if no one objects
- Public ledger of every transaction visible to everyone
- Buy property: pay bank → property card moves into your wallet atomically
- Split a windfall to up to 3 other players in one tap
- Undo your last action (any party involved)
- Two rule modes: **Our rules** (free transfers, gifts, loans, splits) and **Official** (trades only — gifts/splits/loans blocked at the API)

**Doesn't:**
- Roll dice (you use physical dice)
- Move tokens (you move them on the board)
- Calculate or auto-collect rent (you tap "Pay Player" and pick the amount)
- Enforce house rules — they all just work because the app is a neutral ledger

## Stack

Next.js 16 (App Router · Turbopack) · React 19 · TypeScript · Tailwind v4 · shadcn/ui · Server-Sent Events for live sync · in-memory store for dev (Upstash Redis adapter wired for prod when needed) · Vitest.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. To play with friends on the same WiFi, find your laptop's LAN IP and have phones open `http://<your-ip>:3000`.

## Test

```bash
npm test          # vitest run
npm run test:watch
```

25 unit tests covering room codes, the Monopoly preset, the rules engine, and the in-memory store.

## Deploy to Vercel

1. Push the repo to GitHub.
2. Import the repo on vercel.com.
3. Set environment variable `SESSION_SECRET` to a long random string.
4. (Optional, for shared state across regions) provision Upstash Redis from the Vercel Marketplace; it auto-injects `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`. The Redis-backed store adapter still needs to be enabled — see the plan doc.

## Project layout

```
app/
  api/rooms/...           # All HTTP endpoints
  page.tsx                # Landing
  create/                 # Admin creates a room
  join/                   # Player joins
  room/[code]/            # The game room

components/               # UI (mostly plain shadcn for now; polish pass pending)
  ui/                     # shadcn primitives

lib/
  game/                   # Pure types + Monopoly preset + rules + sweep
  store/                  # Store interface + in-memory impl
  client/                 # Typed API client + useRoom SSE hook
  session.ts              # HMAC-signed cookie session

tests/                    # Vitest specs for pure logic
docs/plans/               # Implementation plan
```

## How it stays cheat-proof

- **P2P transfers**: both sender and receiver must tap Confirm before money moves.
- **Bank withdrawals**: every other player gets a notification with a 10s countdown to Object. Silent assent = approval. Anyone who saw the proposer trying to inflate their own balance can stop it instantly.
- **Bank payments**: just the payer confirms (you can't cheat by giving away money).
- **Asset moves**: trades are atomic — properties + cash move together, both parties confirm.
- **Public ledger**: every action is timestamped and visible to all players forever (well, for the lifetime of the room).
- **No banker**: removes the entire role that introduced the cheating risk.
