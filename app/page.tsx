import Link from "next/link";
import { ArrowRight, Plus, KeyRound } from "lucide-react";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col animate-in fade-in duration-500">
      <div className="flex-1 max-w-md w-full mx-auto px-6 pt-20 pb-10 flex flex-col gap-12">
        {/* Hero — kerned wordmark with a single green accent dot. */}
        <header className="flex flex-col items-center text-center gap-4 pt-10">
          <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.32em] text-muted-foreground font-medium">
            <span className="size-1 rounded-full bg-[var(--mono-green)]" aria-hidden />
            Tabletop Banking
          </span>
          <h1
            className="text-[64px] leading-[0.85] font-black tracking-[-0.04em] flex items-baseline"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            <span>Autobank</span>
            <span
              className="inline-block size-3 rounded-full bg-[var(--mono-green)] ml-1.5 translate-y-[-0.06em]"
              aria-hidden
            />
          </h1>
          <p className="text-[15px] text-muted-foreground leading-relaxed max-w-[280px]">
            The fairest banker your tabletop Monopoly never had —
            <span className="text-foreground/80 font-medium"> no cheating, no accounts, just play.</span>
          </p>
        </header>

        {/* Action cards — flat, premium, big icon chip on left */}
        <div className="flex flex-col gap-3">
          <Link
            href="/create"
            aria-label="Create a new room"
            className="press-card group relative flex items-center gap-4 px-4 py-5 rounded-2xl bg-card border border-border/60 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-22px_rgba(20,80,50,0.45)]"
          >
            <div className="size-14 rounded-2xl bg-[var(--mono-green)] text-white flex items-center justify-center shadow-[0_6px_18px_-6px_color-mix(in_oklch,var(--mono-green)_60%,transparent)]">
              <Plus className="size-6" strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="text-lg leading-tight font-semibold tracking-tight"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                Create Room
              </div>
              <div className="text-[13px] text-muted-foreground mt-0.5">
                Start a game · share a 4-letter code
              </div>
            </div>
            <ArrowRight className="size-5 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
          </Link>

          <Link
            href="/join"
            aria-label="Join an existing room"
            className="press-card group relative flex items-center gap-4 px-4 py-5 rounded-2xl bg-card border border-border/60 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-22px_rgba(20,30,30,0.35)]"
          >
            <div className="size-14 rounded-2xl bg-foreground text-background flex items-center justify-center shadow-[0_6px_18px_-6px_rgba(0,0,0,0.4)]">
              <KeyRound className="size-6" strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="text-lg leading-tight font-semibold tracking-tight"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                Join Room
              </div>
              <div className="text-[13px] text-muted-foreground mt-0.5">
                Enter a code your group shared with you
              </div>
            </div>
            <ArrowRight className="size-5 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
          </Link>
        </div>

        {/* Trust pills — compact row of three */}
        <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[12px] text-muted-foreground">
          {["No accounts", "Cheat-proof", "Plays nice"].map((feature) => (
            <li
              key={feature}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/60 bg-card/60"
            >
              <span className="size-1.5 rounded-full bg-[var(--mono-green)]" aria-hidden />
              {feature}
            </li>
          ))}
        </ul>

        <footer className="text-[11px] text-center text-muted-foreground/60 mt-auto pt-4">
          Open the same code on every player&apos;s phone.
        </footer>
      </div>
    </main>
  );
}
