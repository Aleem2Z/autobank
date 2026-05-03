"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wallet } from "@/components/Wallet";
import { Ledger } from "@/components/Ledger";
import { PendingTransaction } from "@/components/PendingTransaction";
import { ActionBar } from "@/components/ActionBar";
import { useRoom } from "@/lib/client/useRoom";
import { formatMoney } from "@/lib/utils";
import type { Transaction } from "@/lib/game/types";

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
        <header className="flex items-center justify-between gap-2 border rounded-lg p-3 bg-card">
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Room
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xl font-semibold tracking-widest">
                {room.code}
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={copyCode}
                aria-label="Copy room code"
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Mode
            </div>
            <div className="text-sm capitalize">{room.mode}</div>
          </div>
        </header>

        {/* Wallet */}
        <Wallet player={me} />

        {/* Pending */}
        {pending.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="font-medium">
              Pending ({pending.length})
            </h2>
            {pending.map((tx) => (
              <PendingTransaction key={tx.id} room={room} you={you} tx={tx} />
            ))}
          </section>
        )}

        {/* Other players */}
        <section className="border rounded-lg p-3 bg-card">
          <h2 className="font-medium mb-2">Players ({room.players.length})</h2>
          {others.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No other players have joined yet. Share code{" "}
              <span className="font-mono font-semibold">{room.code}</span>.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {others.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between text-sm border rounded px-2 py-1.5"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="inline-block size-3 rounded-full border shrink-0"
                      style={{ background: p.color }}
                      aria-hidden
                    />
                    <span className="truncate">{p.name}</span>
                    {p.isAdmin && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        admin
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                    <span>{p.assets.length} assets</span>
                    <span className="tabular-nums font-medium text-foreground">
                      {formatMoney(p.cash)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Ledger */}
        <Ledger room={room} you={you} />
      </div>

      <ActionBar room={room} you={me} />
    </main>
  );
}
