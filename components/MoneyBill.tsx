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

const PALETTE: Record<Denomination, { bg: string; ink: string; border: string }> = {
  1:   { bg: "oklch(0.97 0.01 95)",  ink: "oklch(0.25 0.04 60)",  border: "oklch(0.78 0.04 80)" },
  5:   { bg: "oklch(0.85 0.10 350)", ink: "oklch(0.30 0.10 350)", border: "oklch(0.55 0.16 350)" },
  10:  { bg: "oklch(0.88 0.13 75)",  ink: "oklch(0.32 0.10 50)",  border: "oklch(0.60 0.18 55)" },
  20:  { bg: "oklch(0.78 0.13 145)", ink: "oklch(0.22 0.06 152)", border: "oklch(0.42 0.12 150)" },
  50:  { bg: "oklch(0.78 0.10 230)", ink: "oklch(0.20 0.06 250)", border: "oklch(0.45 0.12 245)" },
  100: { bg: "oklch(0.92 0.08 90)",  ink: "oklch(0.30 0.06 70)",  border: "oklch(0.60 0.10 80)" },
  500: { bg: "oklch(0.78 0.16 55)",  ink: "oklch(0.30 0.10 40)",  border: "oklch(0.50 0.18 45)" },
};

const SIZE = {
  sm: { w: 96,  h: 50,  digit: 18, label: 7,  band: 4 },
  md: { w: 168, h: 84,  digit: 30, label: 9,  band: 6 },
  lg: { w: 240, h: 120, digit: 44, label: 11, band: 8 },
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
      aria-label={`${denomination} dollar bill`}
      role="img"
    >
      {Array.from({ length: stack }).map((_, idx) => {
        const isTop = idx === stack - 1;
        return (
          <div
            key={idx}
            className="absolute rounded-md overflow-hidden"
            style={{
              width: dims.w,
              height: dims.h,
              left: idx * 3,
              top: idx * 3,
              transform: `rotate(${isTop ? rotate : rotate + (idx % 2 === 0 ? -1 : 1) * 0.6}deg)`,
              background: palette.bg,
              boxShadow:
                "0 1px 0 rgba(0,0,0,0.1), 0 4px 10px -4px rgba(0,0,0,0.25)",
              border: `1px solid ${palette.border}`,
              color: palette.ink,
            }}
          >
            {isTop && <BillFace denomination={denomination} dims={dims} palette={palette} />}
            {!isTop && (
              <div
                className="w-full h-full"
                style={{
                  background: `repeating-linear-gradient(135deg, ${palette.border}33 0 2px, transparent 2px 6px)`,
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
  return (
    <div
      className="relative w-full h-full px-2 py-1.5 flex flex-col"
      style={{
        background: `
          radial-gradient(120% 80% at 50% 50%, transparent 60%, ${palette.border}22 100%),
          ${palette.bg}
        `,
      }}
    >
      {/* Inner border */}
      <div
        className="absolute inset-1 rounded-[3px] pointer-events-none"
        style={{ border: `1px solid ${palette.border}88` }}
      />
      {/* Corner band */}
      <div
        className="absolute top-1 left-1 px-1 rounded-sm font-bold tracking-wide"
        style={{
          fontSize: dims.label,
          background: palette.ink,
          color: palette.bg,
        }}
      >
        {denomination}
      </div>
      <div
        className="absolute bottom-1 right-1 px-1 rounded-sm font-bold tracking-wide"
        style={{
          fontSize: dims.label,
          background: palette.ink,
          color: palette.bg,
        }}
      >
        {denomination}
      </div>

      {/* Center medallion */}
      <div className="flex-1 flex items-center justify-center relative">
        <div
          className="absolute rounded-full opacity-30"
          style={{
            width: dims.digit * 1.6,
            height: dims.digit * 1.6,
            border: `1px dashed ${palette.ink}`,
          }}
        />
        <div
          className="font-black tabular-nums leading-none"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: dims.digit,
            color: palette.ink,
            letterSpacing: "-0.02em",
          }}
        >
          ${denomination}
        </div>
      </div>

      {/* Footer wordmark */}
      <div
        className="text-center uppercase font-semibold tracking-[0.25em]"
        style={{ fontSize: dims.label - 1, color: palette.ink, opacity: 0.75 }}
      >
        Autobank Banking
      </div>
    </div>
  );
}
