"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/client/api";
import type { Mode } from "@/lib/game/types";
import { STARTING_BALANCE_DEFAULT } from "@/lib/game/monopoly";

export default function CreatePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [instancePasscode, setInstancePasscode] = useState("");
  const [startingBalance, setStartingBalance] = useState<string>(
    String(STARTING_BALANCE_DEFAULT),
  );
  const [mode, setMode] = useState<Mode>("house");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!name.trim() || !passcode.trim()) {
      toast.error("Name and passcode are required.");
      return;
    }
    const balance = Number(startingBalance);
    if (!Number.isFinite(balance) || balance <= 0) {
      toast.error("Starting balance must be a positive number.");
      return;
    }
    setSubmitting(true);
    try {
      const { code } = await api.createRoom({
        adminName: name.trim(),
        passcode: passcode.trim(),
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
    <main className="flex flex-1 flex-col items-center justify-center p-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md flex flex-col gap-5 rounded-3xl p-6 bg-card border border-border/60 shadow-[0_20px_60px_-32px_rgba(20,80,50,0.30)]"
      >
        <header className="flex flex-col gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground font-medium">
            Step 1 of 1
          </span>
          <h1
            className="text-3xl font-black tracking-[-0.02em] leading-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Create a room
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You&apos;ll be the admin. Share the code &amp; passcode with the
            other players.
          </p>
        </header>

        <div className="flex flex-col gap-2">
          <Label htmlFor="name" className="text-[13px] font-medium">
            Your name
          </Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Aleem"
            autoComplete="off"
            maxLength={40}
            className="h-12 text-base rounded-xl"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="instance-passcode" className="text-[13px] font-medium">
            Admin passcode
          </Label>
          <Input
            id="instance-passcode"
            type="password"
            value={instancePasscode}
            onChange={(e) => setInstancePasscode(e.target.value)}
            placeholder="Required to create rooms on this instance"
            autoComplete="off"
            maxLength={128}
            className="h-12 text-base rounded-xl"
          />
          <p className="text-xs text-muted-foreground">
            Leave blank if your instance doesn&apos;t have one set.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="passcode" className="text-[13px] font-medium">
            Room passcode
          </Label>
          <Input
            id="passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="anything memorable"
            autoComplete="off"
            maxLength={64}
            className="h-12 text-base rounded-xl"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="balance" className="text-[13px] font-medium">
            Starting balance
          </Label>
          <Input
            id="balance"
            type="number"
            value={startingBalance}
            onChange={(e) => setStartingBalance(e.target.value)}
            min={1}
            className="h-12 text-base rounded-xl tabular-nums"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-[13px] font-medium">Mode</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === "house" ? "default" : "outline"}
              onClick={() => setMode("house")}
              className="flex-1 h-11 rounded-xl"
            >
              House rules
            </Button>
            <Button
              type="button"
              variant={mode === "official" ? "default" : "outline"}
              onClick={() => setMode("official")}
              className="flex-1 h-11 rounded-xl"
            >
              Official
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Official mode disables splits, gifts, and loans.
          </p>
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            nativeButton={false}
            render={<Link href="/" />}
            className="flex-1 h-12 rounded-xl"
          >
            Back
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="flex-1 h-12 rounded-xl text-base font-semibold"
          >
            {submitting ? "Creating..." : "Create room"}
          </Button>
        </div>
      </form>
    </main>
  );
}
