"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/client/api";
import type { Mode } from "@/lib/game/types";
import { STARTING_BALANCE_DEFAULT } from "@/lib/game/monopoly";
import { cn } from "@/lib/utils";

export default function CreatePage() {
  const router = useRouter();
  const [instancePasscode, setInstancePasscode] = useState("");
  const [startingBalance, setStartingBalance] = useState<string>(
    String(STARTING_BALANCE_DEFAULT),
  );
  const [mode, setMode] = useState<Mode>("house");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const balance = Number(startingBalance);
    if (!Number.isFinite(balance) || balance <= 0) {
      toast.error("Starting balance must be a positive number.");
      return;
    }
    setSubmitting(true);
    try {
      const { code } = await api.createRoom({
        startingBalance: Math.floor(balance),
        mode,
        instancePasscode: instancePasscode.trim() || undefined,
      });
      router.push(`/room/${code}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create room.");
      setSubmitting(false);
    }
  }

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

      <div className="flex-1 w-full max-w-md mx-auto pt-24 px-5 pb-10 flex flex-col gap-5">
        <section className="flex flex-col gap-1.5 pt-2 pb-2">
          <span className="text-[11px] uppercase tracking-[0.06em] font-semibold text-on-surface-variant">
            New room
          </span>
          <h2 className="text-[28px] leading-[34px] font-bold tracking-tight text-foreground">
            Create a room
          </h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            We&apos;ll generate a room code. Share it with the table — anyone
            with the code can join. You&apos;ll pick your name &amp; color on
            the next screen.
          </p>
        </section>

        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-5 rounded-[2rem] p-6 bg-surface-lowest shadow-soft"
        >
          <Field
            id="instance-passcode"
            label="Admin passcode"
            hint="Set by the host of this Autobank instance. Leave blank if none."
          >
            <Input
              id="instance-passcode"
              type="password"
              value={instancePasscode}
              onChange={(e) => setInstancePasscode(e.target.value)}
              placeholder="••••••••"
              autoComplete="off"
              maxLength={128}
              className="h-12 text-base rounded-xl bg-surface border-transparent focus-visible:bg-surface-lowest focus-visible:border-brand"
            />
          </Field>

          <Field id="balance" label="Starting balance">
            <Input
              id="balance"
              type="number"
              value={startingBalance}
              onChange={(e) => setStartingBalance(e.target.value)}
              min={1}
              className="h-12 text-base rounded-xl bg-surface border-transparent focus-visible:bg-surface-lowest focus-visible:border-brand tabular-nums"
            />
          </Field>

          <div className="flex flex-col gap-2">
            <Label className="text-[13px] font-semibold">Mode</Label>
            <div className="grid grid-cols-2 gap-2 bg-surface rounded-full p-1">
              {(["house", "official"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    "h-10 rounded-full text-sm font-semibold transition-all active:scale-95",
                    mode === m
                      ? "bg-surface-lowest text-foreground shadow-card-soft"
                      : "text-on-surface-variant hover:text-foreground",
                  )}
                >
                  {m === "house" ? "House rules" : "Official"}
                </button>
              ))}
            </div>
            <p className="text-xs text-on-surface-variant">
              Official mode disables splits, gifts, and loans.
            </p>
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="h-14 rounded-full text-base font-semibold bg-brand text-white shadow-ambient-brand hover:bg-brand/90 active:scale-95"
          >
            {submitting ? "Generating room…" : "Create room"}
          </Button>
        </form>
      </div>
    </main>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-[13px] font-semibold">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-on-surface-variant">{hint}</p>}
    </div>
  );
}
