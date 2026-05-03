import { cn } from "@/lib/utils";

export type Denomination = 1 | 5 | 10 | 20 | 50 | 100 | 500;

export interface MoneyBillProps {
  denomination: Denomination;
  /** Renders 1-4 stacked bills with slight offset to imply a wad. */
  count?: 1 | 2 | 3 | 4;
  /** Size variant. Default md. */
  size?: "sm" | "md" | "lg";
  rotate?: number;
  className?: string;
}

/**
 * Authentic Monopoly note palette — sampled from real US edition notes.
 * Outer = colored border band; inner = paper area; ink = denomination text.
 */
const PALETTE: Record<
  Denomination,
  { outer: string; inner: string; ink: string; band: string }
> = {
  1:   { outer: "#D8C19B", inner: "#FBF5E8", ink: "#1a1a1a", band: "#8C7656" },
  5:   { outer: "#F0B0A2", inner: "#FCEFE9", ink: "#1a1a1a", band: "#A86555" },
  10:  { outer: "#A0C0DC", inner: "#EDF4FB", ink: "#1a1a1a", band: "#5A85AC" },
  20:  { outer: "#E5C95C", inner: "#FBF6E0", ink: "#1a1a1a", band: "#9C7E1E" },
  50:  { outer: "#B89DC8", inner: "#F4ECFA", ink: "#1a1a1a", band: "#7A609A" },
  100: { outer: "#D8C290", inner: "#FAF3DD", ink: "#1a1a1a", band: "#9A8048" },
  500: { outer: "#E69854", inner: "#FCEDDB", ink: "#1a1a1a", band: "#A4541A" },
};

const SIZE = {
  sm: { w: 132, h: 64,  digit: 22, label: 8,  monoW: 7,  m: 10 },
  md: { w: 188, h: 92,  digit: 32, label: 10, monoW: 9,  m: 14 },
  lg: { w: 260, h: 128, digit: 46, label: 12, monoW: 11, m: 18 },
} as const;

export function MoneyBill({
  denomination,
  count = 1,
  size = "md",
  rotate = 0,
  className,
}: MoneyBillProps) {
  const dims = SIZE[size];
  const palette = PALETTE[denomination];
  const stack = Math.max(1, Math.min(4, count));

  return (
    <div
      className={cn("relative inline-block select-none", className)}
      style={{
        width: dims.w + (stack - 1) * 4,
        height: dims.h + (stack - 1) * 4,
      }}
      aria-label={`Monopoly $${denomination} note`}
      role="img"
    >
      {Array.from({ length: stack }).map((_, idx) => {
        const isTop = idx === stack - 1;
        return (
          <div
            key={idx}
            className="absolute rounded-[3px] overflow-hidden"
            style={{
              width: dims.w,
              height: dims.h,
              left: idx * 3,
              top: idx * 3,
              transform: `rotate(${
                isTop ? rotate : rotate + (idx % 2 === 0 ? -1 : 1) * 0.6
              }deg)`,
              background: palette.outer,
              boxShadow:
                "0 1px 0 rgba(0,0,0,0.12), 0 6px 12px -4px rgba(0,0,0,0.30)",
              border: `1px solid ${palette.band}`,
            }}
          >
            {isTop ? (
              <BillFace denomination={denomination} dims={dims} palette={palette} />
            ) : (
              <div
                className="w-full h-full"
                style={{
                  background: `repeating-linear-gradient(135deg, ${palette.band}33 0 2px, transparent 2px 6px)`,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function BillFace({
  denomination,
  dims,
  palette,
}: {
  denomination: Denomination;
  dims: (typeof SIZE)[keyof typeof SIZE];
  palette: (typeof PALETTE)[Denomination];
}) {
  // Inner paper inset from the colored border
  const inset = Math.max(3, Math.round(dims.h * 0.08));
  return (
    <div
      className="absolute rounded-[2px]"
      style={{
        inset,
        background: palette.inner,
        boxShadow: `inset 0 0 0 1px ${palette.band}55`,
      }}
    >
      {/* Dashed inner frame */}
      <div
        className="absolute rounded-[2px] pointer-events-none"
        style={{
          inset: 3,
          border: `1px dashed ${palette.band}88`,
        }}
      />

      {/* MONOPOLY header band */}
      <div
        className="absolute left-1/2 -translate-x-1/2 px-2 py-[1px] rounded-[2px] flex items-center justify-center"
        style={{
          top: -Math.round(dims.label / 2) - 2,
          background: palette.band,
          fontSize: dims.monoW,
          color: palette.inner,
          letterSpacing: "0.18em",
          fontWeight: 800,
          fontFamily: "var(--font-sans)",
          lineHeight: 1.1,
          minHeight: dims.label + 2,
        }}
      >
        MONOPOLY
      </div>

      {/* Four corner denomination numbers */}
      <CornerNum value={denomination} pos="tl" dims={dims} ink={palette.ink} />
      <CornerNum value={denomination} pos="tr" dims={dims} ink={palette.ink} />
      <CornerNum value={denomination} pos="bl" dims={dims} ink={palette.ink} />
      <CornerNum value={denomination} pos="br" dims={dims} ink={palette.ink} />

      {/* Side "M" oval marks (left + right) */}
      <SideM side="left" dims={dims} band={palette.band} inner={palette.inner} />
      <SideM side="right" dims={dims} band={palette.band} inner={palette.inner} />

      {/* Center circle with the big number */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="rounded-full flex items-center justify-center"
          style={{
            width: dims.h * 0.62,
            height: dims.h * 0.62,
            background: palette.inner,
            border: `1.5px solid ${palette.band}`,
            boxShadow: `inset 0 0 0 1px ${palette.band}33`,
          }}
        >
          <span
            className="font-black tabular-nums leading-none"
            style={{
              fontSize: dims.digit,
              color: palette.ink,
              letterSpacing: "-0.02em",
              fontFamily: "var(--font-sans)",
            }}
          >
            {denomination}
          </span>
        </div>
      </div>
    </div>
  );
}

function CornerNum({
  value,
  pos,
  dims,
  ink,
}: {
  value: Denomination;
  pos: "tl" | "tr" | "bl" | "br";
  dims: (typeof SIZE)[keyof typeof SIZE];
  ink: string;
}) {
  const offset = Math.max(4, Math.round(dims.h * 0.10));
  const style: React.CSSProperties = {
    position: "absolute",
    fontSize: dims.label,
    color: ink,
    fontWeight: 800,
    lineHeight: 1,
    fontFamily: "var(--font-sans)",
  };
  switch (pos) {
    case "tl":
      style.top = offset;
      style.left = offset;
      break;
    case "tr":
      style.top = offset;
      style.right = offset;
      break;
    case "bl":
      style.bottom = offset;
      style.left = offset;
      break;
    case "br":
      style.bottom = offset;
      style.right = offset;
      break;
  }
  return <span style={style}>{value}</span>;
}

function SideM({
  side,
  dims,
  band,
  inner,
}: {
  side: "left" | "right";
  dims: (typeof SIZE)[keyof typeof SIZE];
  band: string;
  inner: string;
}) {
  const size = dims.m;
  const style: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    width: size,
    height: size * 1.25,
    borderRadius: "50%",
    background: band,
    color: inner,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: size * 0.7,
    fontWeight: 800,
    fontFamily: "var(--font-sans)",
    boxShadow: `inset 0 0 0 1px ${inner}55`,
  };
  if (side === "left") style.left = Math.round(dims.h * 0.10);
  else style.right = Math.round(dims.h * 0.10);
  return <span style={style}>M</span>;
}
