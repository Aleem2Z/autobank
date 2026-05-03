"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wallet } from "@/components/Wallet";
import { Ledger } from "@/components/Ledger";
import { PendingTransaction } from "@/components/PendingTransaction";
import { ActionBar } from "@/components/ActionBar";
import { SoundToggle } from "@/components/SoundToggle";
import { BalanceTicker } from "@/components/animations/BalanceTicker";
import { useRoom } from "@/lib/client/useRoom";
import { useNotifications } from "@/lib/client/useNotifications";
import type { Player, Transaction } from "@/lib/game/types";

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

export default function RoomClient({ code }: { code: string }) {
  const { room, you, status, error } = useRoom(code);
  useNotifications(room, you);
  const [copied, setCopied] = useState(false);

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
        <div className="border rounded-lg p-5 bg-card max-w-sm w-full text-center flex flex-col gap-3">
          <h1 className="font-medium">Cannot load room</h1>
          <p className="text-sm text-muted-foreground">
            {error ?? "You may not be in this room."}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" render={<Link href={`/join?code=${code}`} />} className="flex-1">
              Join
            </Button>
            <Button render={<Link href="/" />} className="flex-1">
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
    <main className="flex flex-1 flex-col">
      <div className="flex-1 max-w-2xl w-full mx-auto p-3 flex flex-col gap-3">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-2 border rounded-xl px-3 py-2 bg-card">
          <Link
            href="/"
            className="flex flex-col leading-tight"
            aria-label="Go to home"
          >
            <span
              className="text-sm font-bold tracking-tight"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Auto<span className="text-[var(--mono-green)]">bank</span>
            </span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {room.mode}
            </span>
          </Link>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Room
            </span>
            <span className="font-mono text-lg font-bold tracking-[0.2em] px-2 py-0.5 rounded-md bg-muted">
              {room.code}
            </span>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={copyCode}
              aria-label="Copy room code"
            >
              {copied ? <Check className="size-4 text-[var(--mono-green)]" /> : <Copy className="size-4" />}
            </Button>
            <SoundToggle />
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
              <h2 className="font-semibold text-sm flex items-center gap-2">
                Pending action
                <span className="text-[10px] uppercase tracking-wide text-accent-foreground/80 px-1.5 py-0.5 rounded-full bg-accent/20">
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
        <section className="border rounded-xl p-3 bg-card flex flex-col gap-2">
          <header className="flex items-baseline justify-between">
            <h2 className="font-semibold text-sm">Players</h2>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {room.players.length} total
            </span>
          </header>
          {others.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No other players have joined yet. Share code{" "}
              <span className="font-mono font-semibold tracking-widest">
                {room.code}
              </span>
              .
            </p>
          ) : (
            <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
              {others.map((p) => (
                <PlayerChip key={p.id} player={p} />
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

function PlayerChip({ player }: { player: Player }) {
  return (
    <div className="shrink-0 min-w-[140px] flex flex-col gap-1.5 border rounded-xl px-3 py-2 bg-background">
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className="inline-block size-2.5 rounded-full border border-black/30 shrink-0"
          style={{ background: player.color }}
          aria-hidden
        />
        <span className="truncate text-sm font-medium">{player.name}</span>
        {player.isAdmin && (
          <span className="text-[9px] uppercase tracking-wide px-1 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
            admin
          </span>
        )}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <BalanceTicker
          value={player.cash}
          className="text-base font-semibold"
        />
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {player.assets.length} {player.assets.length === 1 ? "deed" : "deeds"}
        </span>
      </div>
    </div>
  );
}
