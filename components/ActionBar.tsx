"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Banknote, Plus, Users, Split, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransferSheet } from "./TransferSheet";
import { SplitSheet } from "./SplitSheet";
import type { Player, Room } from "@/lib/game/types";

type Open =
  | null
  | { kind: "transfer"; transferKind: "p2p" | "pay-bank" | "request-bank" }
  | { kind: "split" };

export function ActionBar({ room, you }: { room: Room; you: Player }) {
  const [open, setOpen] = useState<Open>(null);
  const close = () => setOpen(null);

  return (
    <>
      <div className="sticky bottom-0 inset-x-0 border-t bg-background/95 backdrop-blur px-2 py-2 z-10">
        <div className="max-w-2xl mx-auto grid grid-cols-5 gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="flex flex-col gap-0.5 h-auto py-1.5"
            onClick={() => setOpen({ kind: "transfer", transferKind: "pay-bank" })}
          >
            <Banknote className="size-4" />
            <span className="text-[10px]">Pay Bank</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex flex-col gap-0.5 h-auto py-1.5"
            onClick={() =>
              setOpen({ kind: "transfer", transferKind: "request-bank" })
            }
          >
            <Plus className="size-4" />
            <span className="text-[10px]">Request</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex flex-col gap-0.5 h-auto py-1.5"
            onClick={() => setOpen({ kind: "transfer", transferKind: "p2p" })}
          >
            <Users className="size-4" />
            <span className="text-[10px]">Pay Player</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex flex-col gap-0.5 h-auto py-1.5"
            onClick={() => setOpen({ kind: "split" })}
            disabled={room.mode === "official"}
          >
            <Split className="size-4" />
            <span className="text-[10px]">Split</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex flex-col gap-0.5 h-auto py-1.5"
            onClick={() => toast.info("Trade is coming soon.")}
          >
            <ArrowLeftRight className="size-4" />
            <span className="text-[10px]">Trade</span>
          </Button>
        </div>
      </div>

      {open?.kind === "transfer" && (
        <TransferSheet
          kind={open.transferKind}
          room={room}
          you={you}
          open
          onClose={close}
        />
      )}

      {open?.kind === "split" && (
        <SplitSheet room={room} you={you} open onClose={close} />
      )}
    </>
  );
}
