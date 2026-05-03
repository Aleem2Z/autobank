"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Share, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Browser PWA install hook.
 *
 * Chrome / Edge / Android Chrome fire `beforeinstallprompt` when the site
 * is installable; we capture that event and trigger it on click.
 *
 * iOS Safari has no programmatic install prompt — the only path is the
 * Share-sheet → "Add to Home Screen". We detect that case and surface
 * the steps instead.
 *
 * Once the app is running standalone (already installed), we render
 * nothing.
 */
type Platform = "prompt" | "ios" | "installed" | "unknown";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallButton() {
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [iosHelpOpen, setIosHelpOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already running as an installed PWA → don't offer install.
    const standaloneMql = window.matchMedia?.("(display-mode: standalone)");
    const isIOSStandalone =
      "standalone" in navigator &&
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standaloneMql?.matches || isIOSStandalone) {
      setPlatform("installed");
      return;
    }

    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua);
    if (isIOS) {
      setPlatform("ios");
      return;
    }

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setPlatform("prompt");
    }
    function onInstalled() {
      setPlatform("installed");
      setDeferred(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function handlePromptInstall() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setPlatform("installed");
    setDeferred(null);
  }

  // Don't render anything if we have nothing to offer (already installed,
  // or browser without an install path that we can detect).
  if (platform === "installed") return null;
  if (platform === "unknown") return null;
  if (platform === "prompt" && !deferred) return null;

  return (
    <>
      <motion.button
        type="button"
        onClick={() =>
          platform === "ios" ? setIosHelpOpen(true) : handlePromptInstall()
        }
        whileTap={{ scale: 0.96 }}
        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-surface-lowest border border-border text-foreground text-sm font-semibold shadow-soft hover:shadow-ambient-brand transition-shadow"
        aria-label="Install Autobank app"
      >
        <Download className="size-4 text-brand" strokeWidth={2.5} />
        Install app
      </motion.button>

      {/* iOS instructions popover */}
      <AnimatePresence>
        {iosHelpOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            onClick={() => setIosHelpOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="bg-surface-lowest rounded-[2rem] p-6 max-w-sm w-full shadow-ambient-brand"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3 mb-4">
                <span className="size-12 rounded-full bg-brand/15 text-brand flex items-center justify-center shrink-0">
                  <Smartphone className="size-6" strokeWidth={2.5} />
                </span>
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-foreground">
                    Install on iOS
                  </h3>
                  <p className="text-sm text-on-surface-variant mt-0.5">
                    Safari handles install via the Share sheet.
                  </p>
                </div>
              </div>
              <ol className="flex flex-col gap-3 text-sm text-foreground">
                <Step n={1}>
                  Tap{" "}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface text-on-surface-variant font-semibold">
                    <Share className="size-3.5" /> Share
                  </span>{" "}
                  in the bottom Safari toolbar.
                </Step>
                <Step n={2}>
                  Scroll down and tap{" "}
                  <span className="font-semibold">Add to Home Screen</span>.
                </Step>
                <Step n={3}>
                  Tap <span className="font-semibold">Add</span> in the
                  top-right. Autobank will appear on your home screen.
                </Step>
              </ol>
              <button
                type="button"
                onClick={() => setIosHelpOpen(false)}
                className="mt-5 w-full h-12 rounded-full bg-brand text-white font-semibold active:scale-95 transition-transform"
              >
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={cn(
          "size-6 rounded-full bg-brand/15 text-brand flex items-center justify-center text-xs font-bold shrink-0 mt-0.5",
        )}
      >
        {n}
      </span>
      <span className="leading-snug">{children}</span>
    </li>
  );
}
