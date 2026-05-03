"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/client/api";
import { isValidCode } from "@/lib/game/codes";
import { PLAYER_COLORS } from "@/lib/game/monopoly";
import { cn } from "@/lib/utils";

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fromQuery = searchParams.get("code");
    if (fromQuery) {
      setCode(fromQuery.toUpperCase().slice(0, 4));
    }
  }, [searchParams]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const cleanCode = code.trim().toUpperCase();
    if (!isValidCode(cleanCode)) {
      toast.error("Room code must be 4 letters (no I or O).");
      return;
    }
    if (!name.trim() || !passcode.trim()) {
      toast.error("Name and passcode are required.");
      return;
    }
    if (!color) {
      toast.error("Pick your token color.");
      return;
    }
    setSubmitting(true);
    try {
      await api.joinRoom(cleanCode, {
        name: name.trim(),
        passcode: passcode.trim(),
        color,
      });
      router.push(`/room/${cleanCode}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to join room.");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-md flex flex-col gap-5 rounded-[2rem] p-6 bg-surface-lowest shadow-soft animate-in fade-in slide-in-from-bottom-3 duration-500"
    >
      <header className="flex flex-col gap-1.5">
        <span className="text-[11px] uppercase tracking-[0.06em] font-semibold text-on-surface-variant">
          Sign in to room
        </span>
        <h1 className="text-[28px] leading-[34px] font-bold tracking-tight text-foreground">
          Join the table
        </h1>
        <p className="text-sm text-on-surface-variant leading-relaxed">
          Enter the 4-letter room code from the host.
        </p>
      </header>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="code" className="text-[13px] font-semibold">
          Room code
        </Label>
        <Input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
          placeholder="ABCD"
          autoCapitalize="characters"
          maxLength={4}
          className="h-16 text-center text-3xl font-bold uppercase tracking-[0.4em] font-mono rounded-2xl bg-surface border-transparent focus-visible:bg-surface-lowest focus-visible:border-brand"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name" className="text-[13px] font-semibold">
          Your name
        </Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sam"
          autoComplete="off"
          maxLength={40}
          className="h-12 text-base rounded-xl bg-surface border-transparent focus-visible:bg-surface-lowest focus-visible:border-brand"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="passcode" className="text-[13px] font-semibold">
          Passcode
        </Label>
        <Input
          id="passcode"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          autoComplete="off"
          maxLength={64}
          className="h-12 text-base rounded-xl bg-surface border-transparent focus-visible:bg-surface-lowest focus-visible:border-brand"
        />
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <Label className="text-[13px] font-semibold flex items-center gap-1.5">
            Pick your token color
            <span
              title="this is the color other players see next to your name"
              className="inline-flex items-center text-on-surface-variant/70 hover:text-on-surface-variant transition-colors cursor-help"
            >
              <HelpCircle className="size-3.5" aria-hidden />
              <span className="sr-only">
                this is the color other players see next to your name
              </span>
            </span>
          </Label>
          {color && (
            <span className="text-[11px] tabular-nums font-mono text-on-surface-variant">
              {color}
            </span>
          )}
        </div>
        <div
          role="radiogroup"
          aria-label="Token color"
          className="flex items-center justify-between gap-2"
        >
          {PLAYER_COLORS.map((c) => {
            const selected = color === c;
            return (
              <motion.button
                key={c}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`Select color ${c}`}
                onClick={() => setColor(c)}
                whileTap={{ scale: 0.88 }}
                whileHover={{ y: -2 }}
                animate={{ scale: selected ? 1.1 : 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                className={cn(
                  "size-9 rounded-full relative shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-lowest focus-visible:ring-foreground/30",
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
          If someone else already grabbed it, we&apos;ll let you know.
        </p>
      </div>

      <Button
        type="submit"
        disabled={submitting}
        className="h-14 rounded-full text-base font-semibold bg-brand text-white shadow-ambient-brand hover:bg-brand/90 active:scale-95"
      >
        {submitting ? "Joining..." : "Join room"}
      </Button>
    </form>
  );
}

export default function JoinPage() {
  return (
    <main className="flex flex-1 flex-col animate-in fade-in duration-500">
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

      <div className="flex-1 flex flex-col items-center justify-center pt-24 px-5 pb-10">
        <Suspense
          fallback={
            <div className="text-on-surface-variant">Loading...</div>
          }
        >
          <JoinForm />
        </Suspense>
      </div>
    </main>
  );
}
