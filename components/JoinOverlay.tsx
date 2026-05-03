"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type RoomPreview } from "@/lib/client/api";
import { PLAYER_COLORS } from "@/lib/game/monopoly";
import { cn } from "@/lib/utils";

/**
 * Pre-room overlay: shown when the user navigates to /room/[code] without
 * a session. Asks for the player's name + color, then issues a join. On
 * success the parent re-fetches and the regular room UI takes over.
 */
export function JoinOverlay({
  code,
  onJoined,
}: {
  code: string;
  onJoined: () => void;
}) {
  const [preview, setPreview] = useState<RoomPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .previewRoom(code)
      .then((p) => {
        if (!cancelled) setPreview(p);
      })
      .catch((err) => {
        if (!cancelled)
          setPreviewError(
            err instanceof Error ? err.message : String(err),
          );
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const usedColors = new Set(preview?.usedColors ?? []);
  const usedNames = new Set(
    (preview?.usedNames ?? []).map((n) => n.toLowerCase()),
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!name.trim()) {
      toast.error("Pick a name.");
      return;
    }
    if (usedNames.has(name.trim().toLowerCase())) {
      toast.error("Name already taken in this room.");
      return;
    }
    if (!color) {
      toast.error("Pick a color.");
      return;
    }
    setSubmitting(true);
    try {
      await api.joinRoom(code, { name: name.trim(), color });
      onJoined();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to join.");
      setSubmitting(false);
    }
  }

  if (previewError) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="bg-surface-lowest rounded-[2rem] p-6 max-w-sm w-full text-center flex flex-col gap-3 shadow-soft">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Room not found
          </h1>
          <p className="text-sm text-on-surface-variant">
            {previewError}. The code may be wrong, or the room may have been
            cleared.
          </p>
          <Link
            href="/"
            className="h-12 rounded-full inline-flex items-center justify-center text-sm font-semibold bg-brand text-white active:scale-95 transition-transform"
          >
            Back to home
          </Link>
        </div>
      </main>
    );
  }

  if (!preview) {
    return (
      <main className="flex flex-1 items-center justify-center p-6 text-on-surface-variant">
        Looking up room {code}…
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col animate-in fade-in duration-300">
      <header className="fixed top-0 inset-x-0 z-50 top-bar-bg">
        <div className="flex justify-between items-center px-6 py-4 max-w-2xl mx-auto">
          <Link
            href="/"
            aria-label="Back to home"
            className="text-brand hover:opacity-80 active:scale-95 transition-all p-2 -ml-2 rounded-full"
          >
            <ArrowLeft className="size-5" strokeWidth={2.5} />
          </Link>
          <h1 className="text-xl font-black tracking-tighter text-foreground">
            Autobank
          </h1>
          <span className="size-9" aria-hidden />
        </div>
      </header>

      <div className="flex-1 w-full max-w-md mx-auto pt-24 px-5 pb-10 flex flex-col gap-5">
        <section className="flex flex-col gap-2 pt-2 pb-2">
          <span className="text-[11px] uppercase tracking-[0.06em] font-semibold text-on-surface-variant">
            Joining room
          </span>
          <h2
            className="text-[28px] leading-[34px] font-bold tracking-tight text-foreground"
            style={{ letterSpacing: "0.04em" }}
          >
            <span className="font-mono">#{preview.code}</span>
          </h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            {preview.playerCount === 0
              ? preview.canClaimAdmin
                ? "You'll be the admin and the first player."
                : "Waiting for players."
              : `${preview.playerCount} player${preview.playerCount === 1 ? "" : "s"} already in.`}{" "}
            {preview.canClaimAdmin && preview.playerCount === 0 && (
              <span className="inline-flex items-center gap-1 ml-1 text-brand font-semibold">
                <ShieldCheck className="size-3.5" /> admin
              </span>
            )}
          </p>
        </section>

        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-5 rounded-[2rem] p-6 bg-surface-lowest shadow-soft"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name" className="text-[13px] font-semibold">
              Your name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Aleem"
              autoComplete="off"
              maxLength={40}
              className="h-12 text-base rounded-xl bg-surface border-transparent focus-visible:bg-surface-lowest focus-visible:border-brand"
            />
          </div>

          <div className="flex flex-col gap-2.5">
            <Label className="text-[13px] font-semibold">
              Pick your token color
            </Label>
            <div
              role="radiogroup"
              aria-label="Token color"
              className="flex items-center justify-between gap-2 flex-wrap"
            >
              {PLAYER_COLORS.map((c) => {
                const taken = usedColors.has(c.toLowerCase());
                const selected = color === c;
                return (
                  <motion.button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`Color ${c}${taken ? " (taken)" : ""}`}
                    disabled={taken}
                    onClick={() => setColor(c)}
                    whileTap={taken ? undefined : { scale: 0.88 }}
                    whileHover={taken ? undefined : { y: -2 }}
                    animate={{ scale: selected ? 1.1 : 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 22,
                    }}
                    className={cn(
                      "size-9 rounded-full relative shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-lowest focus-visible:ring-foreground/30",
                      taken && "opacity-25 cursor-not-allowed",
                    )}
                    style={{
                      background: c,
                      boxShadow: selected
                        ? `0 0 0 3px var(--surface-lowest), 0 0 0 6px ${c}, 0 6px 18px -6px ${c}`
                        : `0 0 0 2px transparent, 0 1px 0 rgba(0,0,0,0.06), 0 2px 6px -2px rgba(0,0,0,0.18)`,
                    }}
                  />
                );
              })}
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Faded swatches are already taken.
            </p>
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="h-14 rounded-full text-base font-semibold bg-brand text-white shadow-ambient-brand hover:bg-brand/90 active:scale-95"
          >
            {submitting ? "Joining…" : "Join room"}
          </Button>
        </form>
      </div>
    </main>
  );
}
