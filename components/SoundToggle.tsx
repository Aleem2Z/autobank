"use client";

import { useSyncExternalStore } from "react";
import { Volume2, VolumeX } from "lucide-react";
import {
  isMuted,
  setMuted,
  playSound,
  unlockAudio,
} from "@/lib/client/sound";

/**
 * Compact mute toggle for the room header. Persists state via the sound
 * module's localStorage handling. Plays a short test "prompt" sound when
 * un-muting so the user gets immediate confirmation it's working.
 */
function subscribeMuted(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === "autobank-muted") cb();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

export function SoundToggle() {
  // useSyncExternalStore is the canonical "synchronise to a non-React
  // source" hook — pure during render, hydration-safe via the server
  // snapshot, and avoids the setState-in-effect lint complaint.
  const muted = useSyncExternalStore(
    subscribeMuted,
    () => isMuted(),
    () => false,
  );

  function toggle() {
    const next = !muted;
    setMuted(next);
    if (!next) {
      // User just un-muted — confirm audibly. Their click satisfies the
      // gesture requirement, so unlock if this is the first ever interaction.
      unlockAudio();
      playSound("prompt");
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={muted ? "Unmute notifications" : "Mute notifications"}
      aria-pressed={muted}
      title={muted ? "Notifications muted" : "Notifications on"}
      className="size-9 rounded-full inline-flex items-center justify-center text-on-surface-variant hover:bg-surface active:scale-90 transition-all"
    >
      {muted ? (
        <VolumeX className="size-4" />
      ) : (
        <Volume2 className="size-4" />
      )}
    </button>
  );
}
