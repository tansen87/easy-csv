interface FlagSwitchProps {
  on: boolean;
  onChange: (on: boolean) => void;
  /** Accessible name; the visible label sits next to it in the card header. */
  label: string;
}

/**
 * The on/off control for a boolean parameter (design 080).
 *
 * A flag is "on the command or not", so it is a plain switch with no caption of
 * its own — the field name beside it already says what it does. The knob moves
 * with an inline transform: the `translate-x-*` utility did not take effect
 * inside this button, which silently hid the knob inside the track.
 */
export function FlagSwitch({ on, onChange, label }: FlagSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={
        "relative h-[17px] w-[30px] flex-none rounded-full border transition-colors " +
        (on ? "border-brand bg-brand" : "border-border bg-muted")
      }
    >
      <span
        aria-hidden="true"
        style={{ transform: on ? "translateX(15px)" : "translateX(2px)" }}
        className="absolute top-[2px] left-0 h-[11px] w-[11px] rounded-full bg-white shadow-[0_1px_1px_rgba(0,0,0,0.25)] transition-transform dark:bg-neutral-900"
      />
    </button>
  );
}
