import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface RunTimerProps {
  /** Starts the clock when it turns true, unmounts the readout when false. */
  running: boolean;
  className?: string;
}

/**
 * Live elapsed readout shown next to the primary action of the one-shot tool
 * dialogs. The button already names the state ("拆分中"), so this only reports
 * the number: `0.4 s` up to a minute, then `1:04`.
 */
function formatRunningTime(ms: number): { value: string; unit?: string } {
  if (ms < 60_000) {
    return { value: (ms / 1000).toFixed(1), unit: "s" };
  }
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return { value: `${minutes}:${String(seconds).padStart(2, "0")}` };
}

export function RunTimer({ running, className }: RunTimerProps) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!running) return;
    const startedAt = performance.now();
    setElapsedMs(0);
    const id = window.setInterval(() => {
      setElapsedMs(performance.now() - startedAt);
    }, 250);
    return () => window.clearInterval(id);
  }, [running]);

  if (!running) return null;

  const { value, unit } = formatRunningTime(elapsedMs);

  return (
    <span
      role="timer"
      aria-live="off"
      className={cn(
        "inline-flex items-baseline gap-0.5 whitespace-nowrap",
        className,
      )}
    >
      <span className="inline-block min-w-[46px] text-right font-mono text-[11.5px] tabular-nums text-foreground">
        {value}
      </span>
      {unit && (
        <span className="font-mono text-[10px] text-muted-foreground/70">
          {unit}
        </span>
      )}
    </span>
  );
}
