import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import { Button } from "@/components/ui/Button";
import { useLanguage } from "@/i18n";

const REPO_URL = "https://github.com/tansen87/easy-csv";
const REPO_LABEL = "github.com/tansen87/easy-csv";

interface AppInfo {
  version: string;
  tauriVersion: string;
  platform: string;
  arch: string;
}

const PLATFORM_LABELS: Record<string, string> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
};

const ARCH_LABELS: Record<string, string> = {
  x86_64: "x64",
  aarch64: "arm64",
  x86: "x86",
  i686: "x86",
  arm: "arm",
};

interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Compact colophon: build facts from the binary, plus the author signature. */
export function AboutDialog({ isOpen, onClose }: AboutDialogProps) {
  const { t } = useLanguage();
  const [info, setInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    invoke<AppInfo>("get_app_info")
      .then((next) => {
        if (!cancelled) setInfo(next);
      })
      .catch(() => {
        // Keep the em dashes; the dialog still opens with what it knows.
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const distribution = info
    ? `${PLATFORM_LABELS[info.platform] ?? info.platform} · ${
        ARCH_LABELS[info.arch] ?? info.arch
      }`
    : "—";

  const rows = [
    { label: t.aboutVersion, value: info?.version ?? "—" },
    { label: "Tauri", value: info?.tauriVersion ?? "—" },
    { label: t.aboutDistribution, value: distribution },
    { label: t.aboutLicense, value: "MIT" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-foreground/20"
        onClick={onClose}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.about}
        className="relative w-[400px] overflow-hidden rounded-lg border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="flex h-12 items-center border-b border-border/60 px-4">
          <h3 className="text-sm font-medium">Easy Csv</h3>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t.close}
            className="ml-auto h-7 w-7 text-muted-foreground"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="px-5 pb-4 pt-5">
          <div>
            {rows.map((row, index) => (
              <div
                key={row.label}
                className={
                  index === 0
                    ? "flex h-8 items-center gap-4"
                    : "flex h-8 items-center gap-4 border-t border-border/50"
                }
              >
                <span className="w-24 flex-none text-[11px] text-muted-foreground">
                  {row.label}
                </span>
                <span className="min-w-0 truncate font-mono text-xs tabular-nums">
                  {row.value}
                </span>
              </div>
            ))}
            <div className="flex h-8 items-center gap-4 border-t border-border/50">
              <span className="w-24 flex-none text-[11px] text-muted-foreground">
                {t.aboutRepository}
              </span>
              <button
                type="button"
                onClick={() => void openUrl(REPO_URL).catch(() => {})}
                className="min-w-0 truncate font-mono text-xs text-primary hover:underline"
              >
                {REPO_LABEL}
              </button>
            </div>
          </div>

          <div className="mt-4 border-t border-border/60 pt-3">
            <span className="font-mono text-[11px] text-muted-foreground">
              © {new Date().getFullYear()} tansen
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
