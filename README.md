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

Next.js 16 (App Router · Turbopack) · React 19 · TypeScript · Tailwind v4 · shadcn/ui · Server-Sent Events for live sync · in-memory store for solo dev with a Redis adapter (`ioredis`) for multi-instance / production · Vitest.

## Run locally (in-memory)

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. To play with friends on the same WiFi, find your laptop's LAN IP and have phones open `http://<your-ip>:3000`.

This mode uses an in-process `MemoryStore` — fine for a single dev process, but useless across reloads in serverless and useless across multiple workers.

## Run locally with Docker Redis (recommended)

The fastest way to mirror production: run Redis in Docker, run Next.js on the host.

```bash
docker compose up redis -d
REDIS_URL=redis://localhost:6379 npm run dev
```

Sanity-check Redis is up:

```bash
docker compose exec redis redis-cli ping   # → PONG
```

Add `INSTANCE_PASSCODE=secret` to gate room creation:

```bash
REDIS_URL=redis://localhost:6379 INSTANCE_PASSCODE=secret npm run dev
```

To shut Redis down: `docker compose down`.

## Run fully containerised

If you want the entire app (Next.js + Redis) in containers:

```bash
docker compose --profile app up --build
```

Tear it all down (and remove the volumes / network):

```bash
docker compose --profile app down
```

## Environment variables

See `.env.example` for the canonical list. The three you'll touch:

| Var                 | Required           | Purpose                                                                                                              |
| ------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `SESSION_SECRET`    | prod               | Long random string used to HMAC-sign the session cookie. Falls back to a hardcoded dev secret if unset.              |
| `INSTANCE_PASSCODE` | prod (recommended) | Admin passcode required by `POST /api/rooms`. Without this anyone who can reach your URL can create rooms.            |
| `REDIS_URL`         | prod / multi-host  | Switches the store from in-memory to Redis. Required for multi-instance deployments and for SSE fan-out across pods. |

## Test

```bash
npm test          # vitest run
npm run test:watch
```

34 unit tests covering room codes, the Monopoly preset, the rules engine, the trade flow, and the in-memory store. Additional Redis-store tests run when `REDIS_URL` is set:

```bash
docker compose up redis -d
REDIS_URL=redis://localhost:6379 npm test
```

## Deploy to Vercel

```bash
npm i -g vercel
vercel link            # link this dir to a Vercel project
vercel env add SESSION_SECRET production
vercel env add INSTANCE_PASSCODE production
```

For Redis on Vercel, the easiest path is the Upstash integration on the Vercel Marketplace:

1. Vercel dashboard → your project → **Storage** → **Add** → choose Upstash Redis.
2. Upstash provisions a database and **auto-injects connection-string env vars** into your project. The exact env-var names depend on the integration version — open your project's **Settings → Environment Variables** to see what was injected. Recent versions inject a standard `REDIS_URL` (a `rediss://default:<token>@<host>:6379` URL); older versions inject `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.
3. **Important**: this app needs `REDIS_URL` (the regular Redis protocol over TLS), not the REST endpoint. The REST endpoint does not support Pub/Sub, and SSE fan-out across serverless instances requires Pub/Sub. If your integration only injected REST vars, copy the standard `REDIS_URL` (or build it as `rediss://default:<UPSTASH_REDIS_REST_TOKEN>@<endpoint-host>:6379`) and add it as `REDIS_URL` in **Settings → Environment Variables**.
4. Redeploy: `vercel --prod`.

If you prefer to run Redis yourself, any reachable Redis 7+ endpoint works — set `REDIS_URL=redis://...` (or `rediss://...` for TLS) in the project's env vars.

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
