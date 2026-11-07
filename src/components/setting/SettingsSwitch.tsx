import React from "react";

import { cn } from "@/lib/utils";

/**
 * The settings switch (design 040 §4).
 *
 * Booleans used to be native `<input type="checkbox">` sitting next to
 * hand-built segmented pickers and selects; six of them in a column read as a
 * form, not as settings. A switch says "this is on" at a glance and matches the
 * other controls in weight.
 *
 * It is a real `<button role="switch">` so `aria-checked` is exposed and the
 * row's click delegation can call `.click()` on it, exactly like the old
 * checkbox. No motion beyond the knob's transform: a switch that springs or
 * glows is decoration.
 */
interface SettingsSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name — the row's title. */
  label: string;
  disabled?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}

export function SettingsSwitch({
  checked,
  onChange,
  label,
  disabled,
  ref,
}: SettingsSwitchProps) {
  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-foreground/15",
      )}
    >
      {/* The knob is the surface colour: off = the card, on = the ink that sits
          on the accent. That keeps it legible in both themes, where the brand
          flips from dark ink to a light tint. */}
      <span
        className={cn(
          "absolute top-0.5 left-0.5 h-4 w-4 rounded-full transition-transform duration-150 ease-out",
          checked
            ? "translate-x-4 bg-primary-foreground"
            : "translate-x-0 bg-background shadow-sm",
        )}
      />
    </button>
  );
}
