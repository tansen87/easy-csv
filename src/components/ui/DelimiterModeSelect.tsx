import { useLanguage } from "@/i18n";
import { Select } from "@/components/ui/Select";
import type { DelimiterMode } from "@/types/xan";

export interface DelimiterModeSelectProps {
  /** `"auto"` = detect on open; any other value = that delimiter, detection off. */
  value: DelimiterMode;
  onChange: (mode: DelimiterMode) => void;
  size?: "sm" | "md";
  width?: string | number;
  placeholder?: string;
}

/**
 * The single delimiter control, shared by the settings page and the input node's
 * badge so the two always show — and edit — the same value (design 018 §3.9).
 *
 * The first option is the auto-detection master switch: picking it lets every
 * file be detected on open, while picking a concrete delimiter turns detection
 * off and reads every file with it.
 */
export function DelimiterModeSelect({
  value,
  onChange,
  size = "sm",
  width,
  placeholder,
}: DelimiterModeSelectProps) {
  const { t } = useLanguage();

  return (
    <Select
      value={value}
      onChange={onChange}
      options={[
        { label: t.delimiterAuto, value: "auto" },
        { label: "Comma (,)", value: "," },
        { label: "Semicolon (;)", value: ";" },
        { label: "Tab (\\t)", value: "\t" },
        { label: "Pipe (|)", value: "|" },
        { label: "Caret (^)", value: "^" },
      ]}
      placeholder={placeholder ?? t.csvDelimiter}
      size={size}
      width={width}
    />
  );
}
