import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center p-6">
      <div className="w-full max-w-md flex flex-col gap-6">
        <header className="text-center">
          <h1 className="text-3xl font-semibold">Autobank</h1>
          <p className="text-muted-foreground mt-2">
            A multiplayer wallet for tabletop Monopoly. Replaces the human
            banker so every move is dual-confirmed and publicly logged.
          </p>
        </header>

        <div className="flex flex-col gap-3">
          <Button size="lg" render={<Link href="/create" />}>
            Create Room
          </Button>
          <Button size="lg" variant="outline" render={<Link href="/join" />}>
            Join Room
          </Button>
        </div>
      </div>
    </main>
  );
}
