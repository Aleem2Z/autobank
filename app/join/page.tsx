"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/client/api";
import { isValidCode } from "@/lib/game/codes";

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [passcode, setPasscode] = useState("");
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
    setSubmitting(true);
    try {
      await api.joinRoom(cleanCode, {
        name: name.trim(),
        passcode: passcode.trim(),
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
      className="w-full max-w-md flex flex-col gap-5 border rounded-lg p-5 bg-card animate-in fade-in slide-in-from-bottom-3 duration-500"
    >
      <header>
        <h1 className="text-2xl font-semibold">Join Room</h1>
        <p className="text-sm text-muted-foreground">
          Enter the 4-letter room code from the host.
        </p>
      </header>

      <div className="flex flex-col gap-2">
        <Label htmlFor="code">Room code</Label>
        <Input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
          placeholder="ABCD"
          autoCapitalize="characters"
          maxLength={4}
          className="uppercase tracking-widest font-mono"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Your name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sam"
          autoComplete="off"
          maxLength={40}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="passcode">Passcode</Label>
        <Input
          id="passcode"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          autoComplete="off"
          maxLength={64}
        />
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" nativeButton={false} render={<Link href="/" />} className="flex-1">
          Back
        </Button>
        <Button type="submit" disabled={submitting} className="flex-1">
          {submitting ? "Joining..." : "Join"}
        </Button>
      </div>
    </form>
  );
}

export default function JoinPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center p-6">
      <Suspense fallback={<div className="text-muted-foreground">Loading...</div>}>
        <JoinForm />
      </Suspense>
    </main>
  );
}
