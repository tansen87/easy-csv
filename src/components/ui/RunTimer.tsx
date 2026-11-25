import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface RunTimerProps {
  /** Starts the clock when it turns true, unmounts the readout when false. */
  running: boolean;
  /**
   * Epoch ms when the run entered "running". When given, the readout counts
   * from that moment instead of the component's own mount, so it matches the
   * duration saved in the execution history.
   */
  startedAt?: number;
  /** Final duration in ms; rendered frozen while a finished pill lingers. */
  frozenMs?: number;
  className?: string;
}

/**
 * Live elapsed readout shown next to the primary action of the one-shot tool
 * dialogs. The button already names the state ("拆分中"), so this only reports
 * the number: `0.4 s` up to a minute, then `1:04`.
 */
export function formatRunningTime(ms: number): { value: string; unit?: string } {
  if (ms < 60_000) {
    return { value: (ms / 1000).toFixed(1), unit: "s" };
  }
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return { value: `${minutes}:${String(seconds).padStart(2, "0")}` };
}

export function RunTimer({
  running,
  startedAt,
  frozenMs,
  className,
}: RunTimerProps) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!running) return;
    const mountedAt = performance.now();
    const read = () =>
      startedAt !== undefined
        ? Math.max(0, Date.now() - startedAt)
        : performance.now() - mountedAt;
    setElapsedMs(read());
    const id = window.setInterval(() => {
      setElapsedMs(read());
    }, 250);
    return () => window.clearInterval(id);
  }, [running, startedAt]);

  if (!running && frozenMs === undefined) return null;

  const { value, unit } = formatRunningTime(running ? elapsedMs : frozenMs ?? 0);

  return (
    <span
      role="timer"
      aria-live="off"
      className={cn(
        "inline-flex items-baseline gap-0.5 whitespace-nowrap",
        className,
      )}
    >
      {/* No fixed min-width: right-aligning a 3–4 character reading inside a
          46px box pushed the number away from its leading separator and left a
          dead gap. Tabular digits already keep the width steady; only a jump
          from 9.9 to 10.0 (or into minutes) changes it, twice per run. */}
      <span className="inline-block text-right font-mono text-[11.5px] tabular-nums text-foreground">
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
