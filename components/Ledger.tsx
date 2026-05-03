"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock,
  Split as SplitIcon,
  XCircle,
} from "lucide-react";
import { REASON_LABELS, getAssetDef } from "@/lib/game/monopoly";
import type { Room, Transaction } from "@/lib/game/types";
import { formatMoney, cn } from "@/lib/utils";

function nameOf(room: Room, id: string): string {
  if (id === "bank") return "Bank";
  return room.players.find((p) => p.id === id)?.name ?? "Unknown";
}

function colorOf(room: Room, id: string): string | null {
  if (id === "bank") return null;
  return room.players.find((p) => p.id === id)?.color ?? null;
}

interface Described {
  title: string;
  subtitle: string;
  amount: number | null;
  signForViewer: 1 | -1 | 0;
  avatarColor: string | null;
  avatarLetter: string;
  kind: "send" | "receive" | "split" | "trade" | "asset" | "system";
}

function describe(room: Room, tx: Transaction, you: string): Described {
  const reasonLabel = REASON_LABELS[tx.reason]?.label ?? tx.reason;

  if (tx.kind === "split") {
    const total = tx.splitChildren?.reduce((s, c) => s + c.amount, 0) ?? 0;
    const recipients =
      tx.splitChildren?.map((c) => nameOf(room, c.toPlayerId)).join(", ") ?? "";
    let signForViewer: 1 | -1 | 0 = 0;
    if (tx.proposedBy === you) signForViewer = -1;
    else if (tx.splitChildren?.some((c) => c.toPlayerId === you))
      signForViewer = 1;
    const proposerName = nameOf(room, tx.proposedBy);
    return {
      title: tx.reasonNote || `Split · ${reasonLabel}`,
      subtitle: `${proposerName} → ${recipients}`,
      amount: total,
      signForViewer,
      avatarColor: colorOf(room, tx.proposedBy),
      avatarLetter: proposerName.charAt(0).toUpperCase(),
      kind: "split",
    };
  }

  const cash = tx.cash?.[0];
  if (cash) {
    let signForViewer: 1 | -1 | 0 = 0;
    if (cash.toPlayerId === you) signForViewer = 1;
    else if (cash.fromPlayerId === you) signForViewer = -1;
    const fromName = nameOf(room, cash.fromPlayerId);
    const toName = nameOf(room, cash.toPlayerId);

    let title = tx.reasonNote || reasonLabel;
    if (tx.kind === "asset-move") {
      const asset = tx.assets?.[0];
      if (asset) {
        const def = getAssetDef(asset.defId);
        title = def?.name ?? title;
      }
    }
    const counterpartyId =
      cash.toPlayerId === you
        ? cash.fromPlayerId
        : cash.fromPlayerId === you
          ? cash.toPlayerId
          : cash.fromPlayerId;
    const counterpartyName = nameOf(room, counterpartyId);

    return {
      title,
      subtitle:
        signForViewer === 1
          ? `From ${fromName}`
          : signForViewer === -1
            ? `To ${toName}`
            : `${fromName} → ${toName}`,
      amount: cash.amount,
      signForViewer,
      avatarColor: colorOf(room, counterpartyId),
      avatarLetter: counterpartyName.charAt(0).toUpperCase(),
      kind:
        tx.kind === "asset-move"
          ? "asset"
          : signForViewer === 1
            ? "receive"
            : "send",
    };
  }

  const asset = tx.assets?.[0];
  if (asset) {
    const def = getAssetDef(asset.defId);
    const fromName = nameOf(room, asset.fromPlayerId);
    const toName = nameOf(room, asset.toPlayerId);
    return {
      title: def?.name ?? asset.defId,
      subtitle: `${fromName} → ${toName}`,
      amount: null,
      signForViewer: 0,
      avatarColor: colorOf(room, asset.toPlayerId),
      avatarLetter: toName.charAt(0).toUpperCase(),
      kind: "asset",
    };
  }
  const proposerName = nameOf(room, tx.proposedBy);
  return {
    title: tx.reasonNote || reasonLabel,
    subtitle: proposerName,
    amount: null,
    signForViewer: 0,
    avatarColor: colorOf(room, tx.proposedBy),
    avatarLetter: proposerName.charAt(0).toUpperCase(),
    kind: "system",
  };
}

function StatusChip({ status }: { status: Transaction["status"] }) {
  const map = {
    pending: {
      Icon: Clock,
      label: "Pending",
      cls: "text-on-surface-variant bg-surface-high",
    },
    confirmed: {
      Icon: CheckCircle2,
      label: "Done",
      cls: "text-received bg-received-soft/40",
    },
    rejected: {
      Icon: XCircle,
      label: "Rejected",
      cls: "text-destructive bg-error-soft",
    },
  } as const;
  const { Icon, label, cls } = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.05em]",
        cls,
      )}
      aria-label={status}
    >
      <Icon className="size-2.5" />
      {label}
    </span>
  );
}

function KindIcon({
  kind,
  className,
}: {
  kind: Described["kind"];
  className?: string;
}) {
  switch (kind) {
    case "send":
      return <ArrowUpRight className={className} strokeWidth={2.5} />;
    case "receive":
      return <ArrowDownLeft className={className} strokeWidth={2.5} />;
    case "split":
      return <SplitIcon className={className} strokeWidth={2.5} />;
    case "trade":
      return <ArrowLeftRight className={className} strokeWidth={2.5} />;
    case "asset":
      return <Building2 className={className} strokeWidth={2.5} />;
    default:
      return <Clock className={className} strokeWidth={2.5} />;
  }
}

export function Ledger({ room, you }: { room: Room; you: string }) {
  const items = [...room.transactions]
    .sort((a, b) => b.proposedAt - a.proposedAt)
    .slice(0, 30);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex justify-between items-baseline px-1">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Public Ledger
          </h2>
          <p className="text-sm text-on-surface-variant">
            Real-time transaction history.
          </p>
        </div>
        <span className="text-sm tabular-nums text-on-surface-variant">
          {items.length} {items.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-[2rem] bg-surface-lowest shadow-soft p-6 text-center">
          <p className="text-sm text-on-surface-variant italic">
            No transactions yet. The first move will appear here.
          </p>
        </div>
      ) : (
        <div className="relative bg-surface-lowest rounded-[2rem] p-5 shadow-soft">
          {/* Vertical timeline line */}
          <div
            className="absolute left-[44px] top-5 bottom-5 w-[2px] bg-surface-highest"
            aria-hidden
          />

          <ul className="flex flex-col gap-0">
            <AnimatePresence initial={false}>
              {items.map((tx) => {
                const d = describe(room, tx, you);
                const reasonLabel =
                  REASON_LABELS[tx.reason]?.label ?? tx.reason;

                const isMuted = tx.status === "rejected";
                const amountColor = isMuted
                  ? "text-on-surface-variant line-through"
                  : d.signForViewer === 1
                    ? "text-received"
                    : d.signForViewer === -1
                      ? "text-sent"
                      : "text-foreground";
                const sign =
                  d.signForViewer === 1
                    ? "+ "
                    : d.signForViewer === -1
                      ? "− "
                      : "";

                return (
                  <motion.li
                    key={tx.id}
                    layout
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="relative flex items-start gap-4 py-3 group"
                  >
                    {/* Avatar circle */}
                    <div
                      className="relative z-10 flex-shrink-0 size-10 rounded-full border-[3px] border-surface-lowest shadow-sm flex items-center justify-center text-white text-sm font-bold"
                      style={{
                        background:
                          d.avatarColor ??
                          (d.kind === "receive"
                            ? "var(--received)"
                            : d.kind === "send"
                              ? "var(--sent)"
                              : "var(--brand)"),
                        opacity: isMuted ? 0.5 : 1,
                      }}
                      aria-hidden
                    >
                      {d.avatarColor ? (
                        d.avatarLetter
                      ) : (
                        <KindIcon kind={d.kind} className="size-4" />
                      )}
                    </div>

                    {/* Body */}
                    <div className="flex flex-col flex-1 pt-0.5 min-w-0">
                      <div className="flex justify-between items-center w-full gap-3">
                        <span
                          className={cn(
                            "text-base font-semibold leading-tight truncate",
                            isMuted
                              ? "text-on-surface-variant"
                              : "text-foreground",
                          )}
                        >
                          {d.title}
                        </span>
                        {d.amount !== null && (
                          <span
                            className={cn(
                              "tabular-nums font-bold text-base shrink-0",
                              amountColor,
                            )}
                          >
                            {sign}
                            {formatMoney(d.amount).replace(/^-/, "")}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between items-center w-full mt-1 gap-2">
                        <span className="text-sm text-on-surface-variant truncate">
                          {d.subtitle}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          {tx.status === "pending" &&
                            tx.proposedBy === you &&
                            tx.kind !== "request-bank" && (
                              <span className="text-[10px] uppercase tracking-[0.05em] font-semibold px-2 py-0.5 rounded-full bg-sent-soft text-sent">
                                Awaiting
                              </span>
                            )}
                          <StatusChip status={tx.status} />
                        </div>
                      </div>
                      {tx.reasonNote &&
                        tx.reasonNote.toLowerCase() !==
                          d.title.toLowerCase() && (
                          <span className="text-xs text-on-surface-variant/80 italic mt-0.5 truncate">
                            “{tx.reasonNote}”
                          </span>
                        )}
                      <span className="text-[10px] uppercase tracking-[0.06em] font-semibold text-outline mt-1">
                        {reasonLabel}
                      </span>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </div>
      )}
    </section>
  );
}
