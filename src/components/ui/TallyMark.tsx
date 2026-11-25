/**
 * One tally mark — the ledger's signature (design 079). Four strokes plus the
 * diagonal, drawn as a stroke so it can "write itself" in the milestone card.
 */
import { cn } from "@/lib/utils";

interface TallyMarkProps {
  className?: string;
  /** Unlocked marks take the accent; locked ones stay a hairline ghost. */
  muted?: boolean;
}

export function TallyMark({ className, muted = false }: TallyMarkProps) {
  return (
    <svg
      viewBox="0 0 22 20"
      aria-hidden="true"
      className={cn(
        "h-[18px] w-[20px] flex-none",
        muted ? "text-muted-foreground/35" : "text-primary",
        className,
      )}
    >
      <path
        d="M3 3v14M8 3v14M13 3v14M2 17l18-12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
