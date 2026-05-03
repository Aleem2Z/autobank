"use client";

import { motion } from "framer-motion";
import { Train, Lightbulb, Droplet } from "lucide-react";
import { GROUP_TOKENS, getAssetDef } from "@/lib/game/monopoly";
import type { PlayerAsset, AssetDef } from "@/lib/game/types";
import { cn } from "@/lib/utils";

export type PropertyCardSize = "sm" | "md" | "lg";

export interface PropertyCardProps {
  defId: string;
  asset?: PlayerAsset;
  size?: PropertyCardSize;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  /** Hide rent rows when very small / inline. Defaults true for sm. */
  hideRent?: boolean;
}

const SIZE: Record<
  PropertyCardSize,
  { w: string; h: string; band: string; title: string; price: string; rent: string; pad: string; gap: string }
> = {
  sm: {
    w: "w-24",
    h: "h-32",
    band: "h-5",
    title: "text-[10px] leading-tight",
    price: "text-[9px]",
    rent: "text-[8px]",
    pad: "p-1.5",
    gap: "gap-1",
  },
  md: {
    w: "w-40",
    h: "h-[210px]",
    band: "h-7",
    title: "text-xs leading-snug",
    price: "text-[10px]",
    rent: "text-[9px]",
    pad: "p-2",
    gap: "gap-1.5",
  },
  lg: {
    w: "w-56",
    h: "h-72",
    band: "h-10",
    title: "text-base leading-snug",
    price: "text-xs",
    rent: "text-[11px]",
    pad: "p-3",
    gap: "gap-2",
  },
};

function GroupIcon({ def, className }: { def: AssetDef; className?: string }) {
  if (def.kind === "railroad") return <Train className={className} aria-hidden />;
  if (def.kind === "utility") {
    if (def.id === "electric") return <Lightbulb className={className} aria-hidden />;
    if (def.id === "water") return <Droplet className={className} aria-hidden />;
  }
  return null;
}

function HouseGlyphs({ count }: { count: number }) {
  if (count <= 0) return null;
  if (count >= 5) {
    // Hotel: single red rectangle glyph
    return (
      <span
        className="absolute top-1 right-1 inline-block w-3.5 h-2.5 rounded-[2px] bg-[var(--mono-red)] border border-black/30 shadow-sm"
        aria-label="hotel"
        title="Hotel"
      />
    );
  }
  return (
    <span
      className="absolute top-1 right-1 flex gap-[2px]"
      aria-label={`${count} house${count === 1 ? "" : "s"}`}
      title={`${count} house${count === 1 ? "" : "s"}`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="inline-block w-2 h-2 rounded-[1px] bg-[var(--mono-green)] border border-black/40 shadow-[0_0.5px_0_rgba(0,0,0,0.2)]"
        />
      ))}
    </span>
  );
}

export function PropertyCard({
  defId,
  asset,
  size = "md",
  selected = false,
  disabled = false,
  onClick,
  className,
  hideRent,
}: PropertyCardProps) {
  const def = getAssetDef(defId);
  const dims = SIZE[size];
  const interactive = typeof onClick === "function";
  const showRent = hideRent === undefined ? size !== "sm" : !hideRent;
  const mortgaged = !!asset?.mortgaged;
  const houses = asset?.houses ?? 0;

  if (!def) {
    return (
      <div
        className={cn(
          "rounded-md border border-dashed bg-card text-muted-foreground flex items-center justify-center",
          dims.w,
          dims.h,
          className,
        )}
      >
        <span className="text-[10px]">Unknown</span>
      </div>
    );
  }

  const groupColor = GROUP_TOKENS[def.group ?? "utility"] ?? "var(--mono-utility)";
  const groupLabelLight =
    def.group === "lightblue" ||
    def.group === "yellow" ||
    def.group === "pink" ||
    def.group === "orange";

  const inner = (
    <div
      className={cn(
        "relative w-full h-full rounded-[6px] bg-[oklch(0.985_0.012_85)] paper",
        "border border-black/30 shadow-[0_1px_0_rgba(0,0,0,0.08),0_2px_6px_-2px_rgba(0,0,0,0.18)]",
        "flex flex-col overflow-hidden",
        mortgaged && "saturate-[0.35] opacity-90",
      )}
    >
      {/* Color band */}
      <div
        className={cn(
          "relative w-full flex items-center justify-between px-2 border-b border-black/40",
          dims.band,
        )}
        style={{ background: groupColor }}
      >
        <span
          className={cn(
            "uppercase tracking-[0.18em] font-semibold",
            size === "lg" ? "text-[10px]" : "text-[8px]",
            groupLabelLight ? "text-black/70" : "text-white/95",
          )}
        >
          Title Deed
        </span>
        <GroupIcon
          def={def}
          className={cn(
            size === "lg" ? "size-4" : size === "md" ? "size-3.5" : "size-3",
            groupLabelLight ? "text-black/70" : "text-white/95",
          )}
        />
        <HouseGlyphs count={houses} />
      </div>

      {/* Body */}
      <div className={cn("flex flex-col flex-1", dims.pad, dims.gap)}>
        <div
          className={cn(
            "text-center font-semibold text-[oklch(0.18_0.015_60)]",
            dims.title,
          )}
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {def.name}
        </div>

        {def.price && (
          <div className={cn("text-center text-muted-foreground", dims.price)}>
            Price <span className="font-medium text-foreground">${def.price}</span>
          </div>
        )}

        {showRent && def.rent && def.rent.length > 0 && (
          <div className="flex flex-col mt-auto">
            <Divider />
            {def.kind === "property" ? (
              <RentTable rent={def.rent} className={dims.rent} />
            ) : def.kind === "railroad" ? (
              <RailroadRent rent={def.rent} className={dims.rent} />
            ) : null}
          </div>
        )}

        {def.kind === "utility" && showRent && (
          <div className={cn("flex flex-col mt-auto", dims.rent)}>
            <Divider />
            <Row left="If 1 owned" right="4× dice" className={dims.rent} />
            <Row left="If 2 owned" right="10× dice" className={dims.rent} />
          </div>
        )}

        {def.mortgage && size === "lg" && (
          <div className={cn("text-center text-muted-foreground", dims.rent)}>
            Mortgage value <span className="text-foreground font-medium">${def.mortgage}</span>
          </div>
        )}
      </div>

      {/* Mortgaged stamp */}
      {mortgaged && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span
            className={cn(
              "uppercase tracking-[0.25em] font-black border-4 border-destructive/80 text-destructive/80 px-2 py-0.5 rotate-[-12deg] bg-background/30 backdrop-blur-[1px]",
              size === "sm" ? "text-[8px]" : size === "md" ? "text-[10px]" : "text-sm",
            )}
          >
            Mortgaged
          </span>
        </div>
      )}
    </div>
  );

  const wrapperClasses = cn(
    "block",
    dims.w,
    dims.h,
    "shrink-0",
    selected && "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-[7px]",
    disabled && "opacity-40 cursor-not-allowed",
    className,
  );

  if (interactive) {
    return (
      <motion.button
        type="button"
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        whileHover={disabled ? undefined : { y: -3 }}
        whileTap={disabled ? undefined : { scale: 0.97 }}
        transition={{ type: "spring", stiffness: 380, damping: 24 }}
        className={cn(wrapperClasses, "text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-[7px]")}
        aria-pressed={selected || undefined}
        aria-label={`${def.name}${mortgaged ? " (mortgaged)" : ""}`}
      >
        {inner}
      </motion.button>
    );
  }

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
      className={wrapperClasses}
      role="img"
      aria-label={`${def.name}${mortgaged ? " (mortgaged)" : ""}`}
    >
      {inner}
    </motion.div>
  );
}

function Divider() {
  return (
    <div
      aria-hidden
      className="border-t border-dashed border-black/25 my-1"
    />
  );
}

function Row({
  left,
  right,
  className,
}: {
  left: string;
  right: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-2", className)}>
      <span className="text-muted-foreground truncate">{left}</span>
      <span className="font-medium tabular-nums text-foreground shrink-0">{right}</span>
    </div>
  );
}

const RENT_LABELS = [
  "Rent",
  "With 1 house",
  "With 2 houses",
  "With 3 houses",
  "With 4 houses",
  "With hotel",
];

function RentTable({ rent, className }: { rent: number[]; className?: string }) {
  return (
    <div className="flex flex-col">
      {rent.map((r, i) => (
        <Row
          key={i}
          left={RENT_LABELS[i] ?? `Tier ${i}`}
          right={`$${r}`}
          className={className}
        />
      ))}
    </div>
  );
}

function RailroadRent({ rent, className }: { rent: number[]; className?: string }) {
  const labels = ["1 RR", "2 RR", "3 RR", "4 RR"];
  return (
    <div className="flex flex-col">
      {rent.map((r, i) => (
        <Row key={i} left={labels[i] ?? `${i + 1} RR`} right={`$${r}`} className={className} />
      ))}
    </div>
  );
}
