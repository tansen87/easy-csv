import { useEffect, useState } from "react";
import { Check, Copy, X } from "lucide-react";
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
  /** Release name, e.g. "Windows 11 Pro 24H2 (26100.2314)". */
  osVersion: string;
  /** WebView2 / WebKit version reported by the webview runtime. */
  webviewVersion: string;
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
  const [copied, setCopied] = useState(false);

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

  // "Copied" is a local, self-clearing acknowledgement: no toast, no colour
  // flash - the label simply says it worked for a moment.
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    if (!isOpen) setCopied(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const platformLabel = info
    ? (PLATFORM_LABELS[info.platform] ?? info.platform)
    : "—";
  const archLabel = info ? (ARCH_LABELS[info.arch] ?? info.arch) : "—";
  // Windows ships WebView2, macOS/Linux the system WebKit. The engine name is
  // the useful half: "158.0.4370.45" alone means nothing in a bug report.
  const webviewEngine = info?.platform === "windows" ? "WebView2" : "WebKit";
  const webviewLine = info?.webviewVersion
    ? `${webviewEngine} ${info.webviewVersion}`
    : "—";
  // The OS release already names the platform; keep the bare platform as the
  // fallback for hosts that cannot report a release.
  const systemLine = info
    ? `${info.osVersion || platformLabel} · ${archLabel}`
    : "—";

  // One fact per line: this pastes into a bug report, and a single "·"-joined
  // string is unreadable there — reviewers scan for the WebView line first.
  const versionBlock = info
    ? [
        `easy-csv ${info.version}`,
        `Tauri ${info.tauriVersion}`,
        webviewLine,
        systemLine,
      ].join("\n")
    : "";

  const handleCopy = () => {
    if (!versionBlock) return;
    void navigator.clipboard
      ?.writeText(versionBlock)
      .then(() => setCopied(true))
      .catch(() => {});
  };

  const rows = [
    { label: t.aboutVersion, value: info?.version ?? "—" },
    { label: "Tauri", value: info?.tauriVersion ?? "—" },
    { label: t.aboutWebView, value: webviewLine },
    { label: t.aboutSystem, value: systemLine },
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

        <div className="px-5 pb-2 pt-2">
          <div>
            {/* Rows grow instead of truncating: the OS release ("Windows 11
                Pro 24H2 (26100.2314) · x64") does not fit 400px in mono, and a
                version report must be readable on screen, not only in the
                copied text. */}
            {rows.map((row, index) => (
              <div
                key={row.label}
                className={
                  index === 0
                    ? "flex min-h-8 items-center gap-4 py-1"
                    : "flex min-h-8 items-center gap-4 border-t border-border/50 py-1"
                }
              >
                <span className="w-20 flex-none text-[11px] text-muted-foreground">
                  {row.label}
                </span>
                <span className="min-w-0 break-words font-mono text-xs leading-snug tabular-nums">
                  {row.value}
                </span>
              </div>
            ))}
            <div className="flex min-h-8 items-center gap-4 border-t border-border/50 py-1">
              <span className="w-20 flex-none text-[11px] text-muted-foreground">
                {t.aboutRepository}
              </span>
              <button
                type="button"
                onClick={() => void openUrl(REPO_URL).catch(() => {})}
                className="min-w-0 break-words text-left font-mono text-xs text-primary hover:underline"
              >
                {REPO_LABEL}
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
            <span className="font-mono text-[11px] text-muted-foreground">
              © {new Date().getFullYear()} tansen
            </span>
            {/* Build facts for issue reports: one per line, so pasting is
                readable instead of one long "·"-joined string. */}
            <button
              type="button"
              onClick={handleCopy}
              disabled={!info}
              aria-label={t.aboutCopyInfo}
              className="flex h-6 items-center gap-1.5 rounded-[5px] px-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              {copied ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              <span aria-live="polite">
                {copied ? t.aboutCopied : t.aboutCopyInfo}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
