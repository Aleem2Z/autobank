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
  {
    w: string;
    h: string;
    band: string;
    titleDeed: string;
    name: string;
    rentHero: string;
    rentRow: string;
    note: string;
    pad: string;
    gap: string;
  }
> = {
  sm: {
    w: "w-28",
    h: "h-40",
    band: "h-7",
    titleDeed: "text-[6px]",
    name: "text-[9px] leading-[1.05]",
    rentHero: "text-[9px]",
    rentRow: "text-[7.5px]",
    note: "text-[6px]",
    pad: "px-1.5 py-1",
    gap: "gap-0.5",
  },
  md: {
    w: "w-44",
    h: "h-64",
    band: "h-10",
    titleDeed: "text-[8px]",
    name: "text-[13px] leading-tight",
    rentHero: "text-[12px]",
    rentRow: "text-[10px]",
    note: "text-[7.5px]",
    pad: "px-2.5 py-2",
    gap: "gap-1",
  },
  lg: {
    w: "w-60",
    h: "h-[22rem]",
    band: "h-12",
    titleDeed: "text-[10px]",
    name: "text-[18px] leading-tight",
    rentHero: "text-[15px]",
    rentRow: "text-[12px]",
    note: "text-[9px]",
    pad: "px-3 py-2.5",
    gap: "gap-1.5",
  },
};

const SERIF =
  "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif";

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
    return (
      <span
        className="absolute top-1 right-1 inline-block w-3.5 h-2.5 rounded-[2px] bg-[var(--mono-red)] border border-black/40 shadow-sm"
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
        // Authentic deed: cream paper with crisp black border
        "relative w-full h-full overflow-hidden flex flex-col",
        "bg-[#FBF6E4] border border-black/85",
        "shadow-[0_1px_0_rgba(0,0,0,0.10),0_4px_10px_-3px_rgba(0,0,0,0.30)]",
        mortgaged && "saturate-[0.4] opacity-90",
      )}
      style={{ borderRadius: 2 }}
    >
      {/* Cream framing inset (mimics the printed white margin) */}
      <div className="absolute inset-1 pointer-events-none ring-1 ring-black/15" />

      {/* "TITLE DEED" cream strip above the color band */}
      <div className="relative pt-1 pb-0.5 flex items-center justify-center">
        <span
          className={cn(
            "uppercase tracking-[0.3em] font-bold text-black/85",
            dims.titleDeed,
          )}
          style={{ fontFamily: SERIF }}
        >
          Title Deed
        </span>
      </div>

      {/* Color band with the property name */}
      <div
        className={cn(
          "relative w-full flex items-center justify-center px-2 mx-1 border border-black/70",
          dims.band,
        )}
        style={{ background: groupColor, width: "auto" }}
      >
        <GroupIcon
          def={def}
          className={cn(
            "absolute left-1.5",
            size === "lg" ? "size-4" : size === "md" ? "size-3.5" : "size-3",
            groupLabelLight ? "text-black/80" : "text-white/95",
          )}
        />
        <HouseGlyphs count={houses} />
        <span
          className={cn(
            "uppercase tracking-[0.05em] font-bold text-center px-3",
            dims.name,
            groupLabelLight ? "text-black/85" : "text-white",
          )}
          style={{ fontFamily: SERIF }}
        >
          {def.name}
        </span>
      </div>

      {/* Body */}
      <div
        className={cn(
          "flex flex-col flex-1 mx-1 mt-1.5 mb-1",
          dims.pad,
          dims.gap,
        )}
        style={{ fontFamily: SERIF, color: "#1a1a1a" }}
      >
        {def.kind === "property" && def.rent && def.rent.length > 0 && (
          <>
            {/* RENT hero line: "RENT $X" centered */}
            <div className={cn("text-center font-semibold", dims.rentHero)}>
              Rent <span className="font-black tabular-nums">${def.rent[0]}</span>
            </div>
            {showRent && (
              <div className="flex flex-col mt-0.5">
                {RENT_LABELS.slice(1, def.rent.length).map((label, i) => (
                  <Row
                    key={i}
                    left={label}
                    right={`$${def.rent![i + 1]}`}
                    className={dims.rentRow}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {def.kind === "railroad" && def.rent && (
          <>
            <div className={cn("text-center font-semibold", dims.rentHero)}>
              Rent <span className="font-black tabular-nums">${def.rent[0]}</span>
            </div>
            {showRent && (
              <div className="flex flex-col mt-0.5">
                {def.rent.slice(1).map((r, i) => (
                  <Row
                    key={i}
                    left={`If ${i + 2} R.R.s are owned`}
                    right={`$${r}`}
                    className={dims.rentRow}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {def.kind === "utility" && showRent && (
          <div className="flex flex-col gap-0.5">
            <p
              className={cn(
                "text-center italic leading-tight",
                dims.rentRow,
              )}
            >
              If <span className="font-bold not-italic">one</span> Utility is
              owned, rent is <span className="font-bold">4 times</span> dice.
            </p>
            <p
              className={cn(
                "text-center italic leading-tight",
                dims.rentRow,
              )}
            >
              If <span className="font-bold not-italic">both</span> Utilities,
              rent is <span className="font-bold">10 times</span> dice.
            </p>
          </div>
        )}

        {showRent && (def.kind === "property" || def.kind === "railroad") && (
          <Divider />
        )}

        {def.kind === "property" && def.houseCost && size !== "sm" && (
          <div
            className={cn(
              "text-center leading-snug",
              dims.note,
            )}
          >
            Houses cost{" "}
            <span className="font-bold tabular-nums">${def.houseCost}</span>{" "}
            each
            <br />
            Hotels, ${def.houseCost} each, plus 4 houses
          </div>
        )}

        {def.mortgage && (
          <div
            className={cn(
              "text-center mt-auto leading-snug",
              dims.rentRow,
            )}
          >
            Mortgage Value{" "}
            <span className="font-bold tabular-nums">${def.mortgage}</span>
          </div>
        )}

        {size === "lg" && def.kind === "property" && (
          <p
            className={cn(
              "text-center italic mt-1 leading-snug",
              dims.note,
            )}
          >
            If a player owns ALL the lots of any color group,
            <br />
            the rent is doubled on unimproved lots in that group.
          </p>
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
            style={{ fontFamily: SERIF }}
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
    selected && "ring-2 ring-brand ring-offset-2 ring-offset-background rounded-[3px]",
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
        className={cn(
          wrapperClasses,
          "text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-[3px]",
        )}
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
      className="border-t border-black/35 my-0.5"
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
    <div
      className={cn(
        "flex items-baseline justify-between gap-2 leading-tight",
        className,
      )}
    >
      <span className="text-black/85">{left}</span>
      <span className="font-bold tabular-nums shrink-0">{right}</span>
    </div>
  );
}

const RENT_LABELS = [
  "Rent",
  "With 1 House",
  "With 2 Houses",
  "With 3 Houses",
  "With 4 Houses",
  "With HOTEL",
];
