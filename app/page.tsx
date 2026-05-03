import Link from "next/link";
import { ArrowRight, LogIn, Plus } from "lucide-react";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col animate-in fade-in duration-500">
      {/* Top app bar — fixed */}
      <header className="fixed top-0 inset-x-0 z-50 top-bar-bg">
        <div className="flex justify-between items-center px-6 py-4 max-w-2xl mx-auto">
          <span
            className="size-9"
            aria-hidden
          />
          <h1 className="text-xl font-black tracking-tighter text-foreground">
            Autobank
          </h1>
          <span className="size-9" aria-hidden />
        </div>
      </header>

      {/* Canvas */}
      <div className="flex-1 w-full max-w-2xl mx-auto pt-24 px-5 pb-10 flex flex-col gap-6">
        {/* Hero welcome */}
        <section className="flex flex-col gap-2 py-6">
          <h2 className="text-[36px] leading-[44px] font-bold tracking-tight text-foreground">
            Ready to play?
          </h2>
          <p className="text-base text-on-surface-variant">
            Start a new session or join an existing ledger room.
          </p>
        </section>

        {/* Primary actions bento */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Create */}
          <Link
            href="/create"
            aria-label="Create a new room"
            className="group relative overflow-hidden bg-gradient-brand text-primary-foreground rounded-[2rem] p-6 aspect-square flex flex-col justify-between items-start shadow-ambient-brand sink-on-press"
          >
            <div className="absolute top-0 right-0 size-48 bg-white/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110 duration-500" />
            <div className="bg-white/20 p-4 rounded-full backdrop-blur-sm">
              <Plus className="size-8" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col gap-1 relative z-10">
              <h3 className="text-2xl font-bold tracking-tight leading-[32px]">
                Create Room
              </h3>
              <p className="text-sm opacity-90">Host a new game ledger</p>
            </div>
          </Link>

          {/* Join */}
          <Link
            href="/join"
            aria-label="Join an existing room"
            className="group relative overflow-hidden bg-surface-lowest text-foreground rounded-[2rem] p-6 aspect-square flex flex-col justify-between items-start shadow-ambient sink-on-press border-2 border-transparent hover:border-brand/20"
          >
            <div className="absolute bottom-0 right-0 size-40 bg-surface opacity-50 rounded-full -mr-12 -mb-12 transition-transform group-hover:scale-110 duration-500" />
            <div className="bg-brand/10 text-brand p-4 rounded-full">
              <LogIn className="size-8" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col gap-1 relative z-10 w-full">
              <h3 className="text-2xl font-bold tracking-tight leading-[32px]">
                Join Room
              </h3>
              <p className="text-sm text-on-surface-variant mb-3">
                Enter a code to connect
              </p>
              <div className="flex bg-surface rounded-2xl p-2 items-center w-full">
                <span className="text-[11px] uppercase tracking-[0.06em] font-semibold text-outline px-2">
                  Code
                </span>
                <div className="h-5 w-px bg-outline-variant mx-2" />
                <span className="font-mono text-base text-on-surface-variant opacity-50 flex-1 tracking-[0.3em]">
                  ____
                </span>
                <span className="bg-brand text-white p-1.5 rounded-full inline-flex items-center justify-center">
                  <ArrowRight className="size-4" strokeWidth={2.5} />
                </span>
              </div>
            </div>
          </Link>
        </section>

        {/* Trust pills */}
        <ul className="flex flex-wrap items-center justify-center gap-2 text-xs text-on-surface-variant pt-2">
          {["No accounts", "Cheat-proof", "Plays nice"].map((feature) => (
            <li
              key={feature}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-surface-lowest"
            >
              <span className="size-1.5 rounded-full bg-brand" aria-hidden />
              {feature}
            </li>
          ))}
        </ul>

        <footer className="text-[11px] text-center text-on-surface-variant/60 mt-auto pt-4">
          Open the same code on every player&apos;s phone.
        </footer>
      </div>
    </main>
  );
}
