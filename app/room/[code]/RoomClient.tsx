"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Grid3x3 } from "lucide-react";
import { Wallet } from "@/components/Wallet";
import { Ledger } from "@/components/Ledger";
import { PendingTransaction } from "@/components/PendingTransaction";
import { BottomNav, type PaymentAction } from "@/components/BottomNav";
import { TransferSheet } from "@/components/TransferSheet";
import { SplitSheet } from "@/components/SplitSheet";
import { TradeSheet } from "@/components/TradeSheet";
import { JoinOverlay } from "@/components/JoinOverlay";
import { MortgageSheet } from "@/components/MortgageSheet";
import { SoundToggle } from "@/components/SoundToggle";
import { BalanceTicker } from "@/components/animations/BalanceTicker";
import { useRoom } from "@/lib/client/useRoom";
import { useNotifications } from "@/lib/client/useNotifications";
import type { Player, PlayerAsset, Room, Transaction } from "@/lib/game/types";
import { cn } from "@/lib/utils";

function pendingForYou(txs: Transaction[], you: string): Transaction[] {
  return txs.filter((tx) => {
    if (tx.status !== "pending") return false;
    if (tx.objectionDeadline) {
      return tx.proposedBy !== you;
    }
    return (
      tx.requiresConfirmFrom.includes(you) && !tx.confirmedBy.includes(you)
    );
  });
}

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

type Sheet =
  | null
  | {
      kind: "transfer";
      transferKind: "p2p" | "pay-bank" | "request-bank";
      allowKindToggle?: boolean;
    }
  | { kind: "split" }
  | { kind: "trade" };

function sheetForAction(a: PaymentAction): Sheet {
  switch (a) {
    case "pay":
      // Pay opens with Player selected by default but lets the user
      // switch to Bank (which also exposes the buy-property flow).
      return { kind: "transfer", transferKind: "p2p", allowKindToggle: true };
    case "request":
      return { kind: "transfer", transferKind: "request-bank" };
    case "trade":
      return { kind: "trade" };
    case "split":
      return { kind: "split" };
  }
}

export default function RoomClient({ code }: { code: string }) {
  const { room, you, status, connection, error, refresh } = useRoom(code);
  useNotifications(room, you);
  const [copied, setCopied] = useState(false);
  const [openSheet, setOpenSheet] = useState<Sheet>(null);
  const [mortgaging, setMortgaging] = useState<PlayerAsset | null>(null);
  const closeSheet = () => setOpenSheet(null);

  const highlightedIds = useMemo(
    () => (room ? lastTxParticipants(room) : new Set<string>()),
    [room],
  );

  if (status === "loading") {
    return (
      <main className="flex flex-1 items-center justify-center p-6 text-on-surface-variant">
        Loading room {code}...
      </main>
    );
  }

  if (status === "needs-join") {
    return <JoinOverlay code={code} onJoined={refresh} />;
  }

  if (status === "error" || !room || !you) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="bg-surface-lowest rounded-[2rem] p-6 max-w-sm w-full text-center flex flex-col gap-3 shadow-soft">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Cannot load room
          </h1>
          <p className="text-sm text-on-surface-variant">
            {error ?? "You may not be in this room."}
          </p>
          <div className="flex pt-1">
            <Link
              href="/"
              className="flex-1 h-12 rounded-full inline-flex items-center justify-center text-sm font-semibold bg-brand text-white active:scale-95 transition-transform"
            >
              Back to home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const me = room.players.find((p) => p.id === you);
  if (!me) {
    return (
      <main className="flex flex-1 items-center justify-center p-6 text-on-surface-variant">
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

  function handleAction(a: PaymentAction) {
    setOpenSheet(sheetForAction(a));
  }

  return (
    <main className="flex flex-1 flex-col animate-in fade-in duration-300">
      {/* Top app bar — fixed */}
      <header className="fixed top-0 inset-x-0 z-40 top-bar-bg">
        <div className="flex justify-between items-center px-6 py-4 max-w-2xl mx-auto">
          <Link
            href="/"
            aria-label="Leave room"
            className="text-brand p-2 -ml-2 rounded-full hover:opacity-80 active:scale-95 transition-all"
          >
            <Grid3x3 className="size-5" strokeWidth={2.5} />
          </Link>
          <h1 className="text-xl font-black tracking-tighter text-foreground">
            Autobank
          </h1>
          <div className="flex items-center gap-1">
            {connection !== "online" && (
              <span
                role="status"
                aria-live="polite"
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] font-bold tracking-tight inline-flex items-center gap-1.5",
                  connection === "reconnecting"
                    ? "bg-sent/15 text-sent"
                    : "bg-destructive/15 text-destructive",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    connection === "reconnecting"
                      ? "bg-sent animate-pulse"
                      : "bg-destructive",
                  )}
                />
                {connection === "reconnecting" ? "Reconnecting…" : "Offline"}
              </span>
            )}
            <SoundToggle />
            <button
              type="button"
              onClick={copyCode}
              aria-label="Copy room code"
              className="px-3 py-1.5 bg-brand/10 rounded-full text-brand font-bold text-sm tracking-tight hover:bg-brand/15 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <span className="font-mono">#{room.code}</span>
              {copied ? (
                <Check className="size-3.5" />
              ) : (
                <Copy className="size-3.5 opacity-70" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Canvas */}
      <div className="flex-1 w-full max-w-2xl mx-auto pt-[88px] pb-[120px] px-5 flex flex-col gap-6">
        {/* Pending — high priority, above the wallet hero */}
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
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-on-surface-variant flex items-center gap-2 px-1">
                Pending action
                <span className="text-[10px] tracking-normal px-2 py-0.5 rounded-full bg-sent/20 text-sent">
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

        {/* Wallet */}
        <Wallet player={me} onPropertyTap={setMortgaging} />

        {/* Other players */}
        {others.length > 0 && (
          <section className="rounded-[2rem] bg-surface-lowest shadow-soft px-4 pt-4 pb-3 flex flex-col gap-3">
            <header className="flex items-baseline justify-between px-1">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                Players
              </h2>
              <span className="text-sm tabular-nums text-on-surface-variant">
                {room.players.length} total
              </span>
            </header>
            <div className="flex gap-3 overflow-x-auto hide-scrollbar -mx-2 px-2 pb-1 snap-x">
              {others.map((p) => (
                <PlayerChip
                  key={p.id}
                  player={p}
                  highlighted={highlightedIds.has(p.id)}
                  onPay={() =>
                    setOpenSheet({ kind: "transfer", transferKind: "p2p" })
                  }
                />
              ))}
            </div>
          </section>
        )}

        {/* Ledger */}
        <Ledger room={room} you={you} />
      </div>

      {/* Bottom payment bar */}
      <BottomNav
        onAction={handleAction}
        splitDisabled={room.mode === "official"}
      />

      {/* Sheets */}
      {openSheet?.kind === "transfer" && (
        <TransferSheet
          initialKind={openSheet.transferKind}
          allowKindToggle={openSheet.allowKindToggle}
          room={room}
          you={me}
          open
          onClose={closeSheet}
        />
      )}
      {openSheet?.kind === "split" && (
        <SplitSheet room={room} you={me} open onClose={closeSheet} />
      )}
      {openSheet?.kind === "trade" && (
        <TradeSheet room={room} you={me} open onClose={closeSheet} />
      )}
      {mortgaging && (
        <MortgageSheet
          asset={mortgaging}
          room={room}
          you={me}
          open
          onClose={() => setMortgaging(null)}
        />
      )}
    </main>
  );
}

function PlayerChip({
  player,
  highlighted,
  onPay,
}: {
  player: Player;
  highlighted?: boolean;
  onPay?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPay}
      className={cn(
        "shrink-0 snap-start w-[88px] flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 transition-all active:scale-95",
        highlighted
          ? "border-brand/50 bg-brand/5 shadow-[0_4px_18px_-6px_rgba(43,181,255,0.45)]"
          : "border-border bg-surface-lowest hover:bg-surface-low",
      )}
      aria-label={`Pay ${player.name}`}
    >
      <span
        className="size-10 rounded-full ring-2 ring-surface-lowest flex items-center justify-center text-white font-bold text-sm"
        style={{
          background: player.color,
          boxShadow: highlighted
            ? `0 0 0 2px ${player.color}66, 0 0 12px ${player.color}80`
            : "0 1px 0 rgba(0,0,0,0.06), 0 2px 6px -2px rgba(0,0,0,0.18)",
        }}
        aria-hidden
      >
        {player.name.charAt(0).toUpperCase()}
      </span>
      <span
        className="truncate text-[12px] font-semibold leading-none w-full text-center text-foreground"
        title={player.name}
      >
        {player.name}
      </span>
      <BalanceTicker
        value={player.cash}
        showDelta={false}
        className="text-[12px] font-bold leading-none text-on-surface-variant tabular-nums"
      />
      {player.isAdmin && (
        <span className="text-[8px] uppercase tracking-[0.2em] text-outline">
          admin
        </span>
      )}
    </button>
  );
}
