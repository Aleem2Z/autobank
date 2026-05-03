import Link from "next/link";
import { ArrowRight, Plus, KeyRound } from "lucide-react";
import { MoneyBill } from "@/components/MoneyBill";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col animate-in fade-in duration-500">
      <div className="flex-1 max-w-md w-full mx-auto px-6 pt-16 pb-12 flex flex-col gap-10">
        {/* Hero */}
        <header className="relative pt-8">
          {/* Decorative bills */}
          <div
            className="absolute -top-4 -left-2 -rotate-12 opacity-90 pointer-events-none"
            aria-hidden
          >
            <MoneyBill denomination={100} count={3} size="md" rotate={-8} />
          </div>
          <div
            className="absolute top-2 right-0 rotate-6 opacity-90 pointer-events-none"
            aria-hidden
          >
            <MoneyBill denomination={500} count={2} size="md" rotate={10} />
          </div>

          <div className="relative pt-32 flex flex-col items-center text-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.25em] text-[var(--mono-green)] font-semibold">
              <span className="size-1.5 rounded-full bg-[var(--mono-green)]" />
              Tabletop Banking
            </span>
            <h1
              className="text-6xl font-black tracking-tight leading-[0.9]"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Auto<span className="text-[var(--mono-green)]">bank</span>
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed mt-2 max-w-xs">
              The fairest banker your tabletop Monopoly never had — no cheating,
              no accounts, just play.
            </p>
          </div>
        </header>

        {/* Action cards */}
        <div className="flex flex-col gap-3">
          <Link
            href="/create"
            className="group relative flex items-center gap-4 p-4 rounded-2xl border bg-card hover:bg-card/90 transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.2)] active:translate-y-0 paper"
          >
            <div className="size-12 rounded-xl bg-[var(--mono-green)] text-white flex items-center justify-center shadow-[0_2px_8px_-2px_color-mix(in_oklch,var(--mono-green)_50%,transparent)]">
              <Plus className="size-5" strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold leading-tight">Create Room</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Start a new game · share a 4-letter code
              </div>
            </div>
            <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>

          <Link
            href="/join"
            className="group relative flex items-center gap-4 p-4 rounded-2xl border bg-card hover:bg-card/90 transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.2)] active:translate-y-0 paper"
          >
            <div className="size-12 rounded-xl bg-foreground text-background flex items-center justify-center">
              <KeyRound className="size-5" strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold leading-tight">Join Room</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Enter a code your group shared with you
              </div>
            </div>
            <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Feature pills */}
        <ul className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
          {[
            "Dual-confirm transfers",
            "Public ledger",
            "Undo any move",
            "Live SSE sync",
          ].map((feature) => (
            <li
              key={feature}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border bg-card/50"
            >
              <span className="size-1 rounded-full bg-[var(--mono-green)]" aria-hidden />
              {feature}
            </li>
          ))}
        </ul>

        <footer className="text-[11px] text-center text-muted-foreground/70 mt-auto">
          Open the same code on every player's phone.
        </footer>
      </div>
    </main>
  );
}
