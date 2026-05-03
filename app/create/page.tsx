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
    <main className="flex flex-1 flex-col items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md flex flex-col gap-5 border rounded-lg p-5 bg-card"
      >
        <header>
          <h1 className="text-2xl font-semibold">Create Room</h1>
          <p className="text-sm text-muted-foreground">
            You will be the admin. Share the room code and passcode with the
            other players.
          </p>
        </header>

        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Your name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Aleem"
            autoComplete="off"
            maxLength={40}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="instance-passcode">Admin passcode</Label>
          <Input
            id="instance-passcode"
            type="password"
            value={instancePasscode}
            onChange={(e) => setInstancePasscode(e.target.value)}
            placeholder="Required to create rooms on this instance"
            autoComplete="off"
            maxLength={128}
          />
          <p className="text-xs text-muted-foreground">
            Leave blank if your instance doesn&apos;t have one set.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="passcode">Room passcode</Label>
          <Input
            id="passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="anything memorable"
            autoComplete="off"
            maxLength={64}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="balance">Starting balance</Label>
          <Input
            id="balance"
            type="number"
            value={startingBalance}
            onChange={(e) => setStartingBalance(e.target.value)}
            min={1}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Mode</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === "house" ? "default" : "outline"}
              onClick={() => setMode("house")}
              className="flex-1"
            >
              House rules
            </Button>
            <Button
              type="button"
              variant={mode === "official" ? "default" : "outline"}
              onClick={() => setMode("official")}
              className="flex-1"
            >
              Official
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Official mode disables splits, gifts, and loans.
          </p>
        </div>

        <div className="flex gap-2">
          <Button type="button" variant="outline" render={<Link href="/" />} className="flex-1">
            Back
          </Button>
          <Button type="submit" disabled={submitting} className="flex-1">
            {submitting ? "Creating..." : "Create"}
          </Button>
        </div>
      </form>
    </main>
  );
}
