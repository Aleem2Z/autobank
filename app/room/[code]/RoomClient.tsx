"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wallet } from "@/components/Wallet";
import { Ledger } from "@/components/Ledger";
import { PendingTransaction } from "@/components/PendingTransaction";
import { ActionBar } from "@/components/ActionBar";
import { SoundToggle } from "@/components/SoundToggle";
import { BalanceTicker } from "@/components/animations/BalanceTicker";
import { useRoom } from "@/lib/client/useRoom";
import { useNotifications } from "@/lib/client/useNotifications";
import type { Player, Room, Transaction } from "@/lib/game/types";
import { cn } from "@/lib/utils";

function pendingForYou(txs: Transaction[], you: string): Transaction[] {
  return txs.filter((tx) => {
    if (tx.status !== "pending") return false;
    if (tx.kind === "request-bank") {
      return tx.proposedBy !== you;
    }
    return (
      tx.requiresConfirmFrom.includes(you) && !tx.confirmedBy.includes(you)
    );
  });
}

/**
 * Find the most recent confirmed transaction and return the set of player ids
 * involved in it (for highlighting last-tx targets in the player chip row).
 */
function lastTxParticipants(room: Room): Set<string> {
  const last = [...room.transactions]
    .filter((t) => t.status === "confirmed")
    .sort((a, b) => b.proposedAt - a.proposedAt)[0];
  if (!last) return new Set();
  const ids = new Set<string>([last.proposedBy]);
  for (const c of last.cash ?? []) {
    if (c.fromPlayerId !== "bank") ids.add(c.fromPlayerId);
    if (c.toPlayerId !== "bank") ids.add(c.toPlayerId);
  }
  for (const a of last.assets ?? []) {
    if (a.fromPlayerId !== "bank") ids.add(a.fromPlayerId);
    if (a.toPlayerId !== "bank") ids.add(a.toPlayerId);
  }
  for (const s of last.splitChildren ?? []) ids.add(s.toPlayerId);
  return ids;
}

export default function RoomClient({ code }: { code: string }) {
  const { room, you, status, error } = useRoom(code);
  useNotifications(room, you);
  const [copied, setCopied] = useState(false);

  const highlightedIds = useMemo(
    () => (room ? lastTxParticipants(room) : new Set<string>()),
    [room],
  );

  if (status === "loading") {
    return (
      <main className="flex flex-1 items-center justify-center p-6 text-muted-foreground">
        Loading room {code}...
      </main>
    );
  }

  if (status === "error" || !room || !you) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="border border-border/60 rounded-2xl p-6 bg-card max-w-sm w-full text-center flex flex-col gap-3">
          <h1
            className="text-xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Cannot load room
          </h1>
          <p className="text-sm text-muted-foreground">
            {error ?? "You may not be in this room."}
          </p>
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={`/join?code=${code}`} />}
              className="flex-1 h-11 rounded-xl"
            >
              Join
            </Button>
            <Button
              nativeButton={false}
              render={<Link href="/" />}
              className="flex-1 h-11 rounded-xl"
            >
              Home
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const me = room.players.find((p) => p.id === you);
  if (!me) {
    return (
      <main className="flex flex-1 items-center justify-center p-6 text-muted-foreground">
        Player not found in room.
      </main>
    );
  }

  const others = room.players.filter((p) => p.id !== you);
  const pending = pendingForYou(room.transactions, you);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Room code copied.");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy.");
    }
  }

  return (
    <main className="flex flex-1 flex-col animate-in fade-in duration-500">
      <div className="flex-1 max-w-2xl w-full mx-auto px-3 pt-3 pb-3 flex flex-col gap-3">
        {/* Top bar — tight, clean, premium */}
        <header className="flex items-center justify-between gap-2 rounded-2xl px-3 py-2 bg-card border border-border/60">
          <Link
            href="/"
            className="flex items-center gap-2 leading-tight"
            aria-label="Go to home"
          >
            <span
              className="text-base font-black tracking-[-0.02em] flex items-baseline"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Autobank
              <span
                className="inline-block size-1.5 rounded-full bg-[var(--mono-green)] ml-1 translate-y-[-0.06em]"
                aria-hidden
              />
            </span>
            <span className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground/80 hidden sm:inline">
              {room.mode}
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={copyCode}
              aria-label="Copy room code"
              className="group flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-muted/60 active:scale-95 transition-all"
            >
              <span className="font-mono text-[15px] font-bold tracking-[0.18em] text-foreground">
                {room.code}
              </span>
              {copied ? (
                <Check className="size-3.5 text-[var(--mono-green)]" />
              ) : (
                <Copy className="size-3.5 text-muted-foreground group-hover:text-foreground" />
              )}
            </button>
            <SoundToggle />
            <Button
              size="icon-sm"
              variant="ghost"
              nativeButton={false}
              render={<Link href="/" />}
              aria-label="Leave room"
              title="Leave"
            >
              <Home className="size-4" />
            </Button>
          </div>
        </header>

        {/* Wallet (hero) */}
        <Wallet player={me} />

        {/* Pending — high priority */}
        <AnimatePresence initial={false}>
          {pending.length > 0 && (
            <motion.section
              key="pending"
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-2"
            >
              <h2 className="text-[10px] uppercase tracking-[0.28em] font-medium text-muted-foreground flex items-center gap-2 px-1">
                Pending action
                <span className="text-[10px] tracking-normal px-1.5 py-0.5 rounded-full bg-accent/25 text-accent-foreground">
                  {pending.length}
                </span>
              </h2>
              <AnimatePresence initial={false}>
                {pending.map((tx) => (
                  <PendingTransaction key={tx.id} room={room} you={you} tx={tx} />
                ))}
              </AnimatePresence>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Other players */}
        <section className="rounded-2xl bg-card border border-border/60 px-3 pt-3 pb-2 flex flex-col gap-2">
          <header className="flex items-baseline justify-between px-1">
            <h2 className="text-[10px] uppercase tracking-[0.28em] font-medium text-muted-foreground">
              Players
            </h2>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {room.players.length} total
            </span>
          </header>
          {others.length === 0 ? (
            <p className="text-sm text-muted-foreground italic px-1 pb-1">
              No other players have joined yet. Share code{" "}
              <span className="font-mono font-semibold tracking-widest text-foreground">
                {room.code}
              </span>
              .
            </p>
          ) : (
            <div className="flex gap-2 overflow-x-auto -mx-2 px-2 pb-1 snap-x">
              {others.map((p) => (
                <PlayerChip
                  key={p.id}
                  player={p}
                  highlighted={highlightedIds.has(p.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Ledger */}
        <Ledger room={room} you={you} />
      </div>

      <ActionBar room={room} you={me} />
    </main>
  );
}

function PlayerChip({
  player,
  highlighted,
}: {
  player: Player;
  highlighted?: boolean;
}) {
  return (
    <div
      className={cn(
        "shrink-0 snap-start w-[80px] flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-2.5 transition-all",
        highlighted
          ? "border-[var(--mono-green)]/50 bg-[color-mix(in_oklch,var(--mono-green)_8%,var(--card))] shadow-[0_4px_18px_-6px_color-mix(in_oklch,var(--mono-green)_40%,transparent)]"
          : "border-border/60 bg-background",
      )}
    >
      <span
        className="size-9 rounded-full ring-2 ring-card"
        style={{
          background: player.color,
          boxShadow: highlighted
            ? `0 0 0 2px ${player.color}66, 0 0 12px ${player.color}80`
            : "0 1px 0 rgba(0,0,0,0.06), 0 2px 6px -2px rgba(0,0,0,0.18)",
        }}
        aria-hidden
      />
      <span
        className="truncate text-[12px] font-semibold leading-none w-full text-center"
        title={player.name}
      >
        {player.name}
      </span>
      <BalanceTicker
        value={player.cash}
        showDelta={false}
        className="text-[12px] font-bold leading-none text-foreground/85"
      />
      {player.isAdmin && (
        <span className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground">
          admin
        </span>
      )}
    </div>
  );
}
