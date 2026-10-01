import { useEffect, useRef, useCallback } from "react";
import { X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useLanguage } from "@/i18n";
import type { Translations } from "@/i18n/translations/types";
import { formatBytes } from "@/utils/format";
import {
  RELEASES_PAGE_URL,
  type InstallForm,
  type InstallFormInfo,
  type UpdateSession,
} from "@/services/update";
import type { UpdateProgressState } from "@/hooks/useUpdater";

interface UpdateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Result of the most recent check; `null` while one is in flight. */
  updateInfo: UpdateSession | null;
  /** How this build is installed; drives whether one-click update is offered. */
  installForm: InstallFormInfo | null;
  isInstalling: boolean;
  progress: UpdateProgressState | null;
  error: string | null;
  onInstall: () => void;
}

export function UpdateDialog({
  isOpen,
  onClose,
  updateInfo,
  installForm,
  isInstalling,
  progress,
  error,
  onInstall,
}: UpdateDialogProps) {
  const { t } = useLanguage();
  const dialogRef = useRef<HTMLDivElement>(null);

  // While the installer has taken over there is nothing useful to close to, and
  // closing would hide the only progress indicator. The X button is disabled,
  // so the backdrop and Escape must not get around that.
  const requestClose = useCallback(() => {
    if (!isInstalling) onClose();
  }, [isInstalling, onClose]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        requestClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [requestClose],
  );

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.focus();
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const handleOpenRelease = () => {
    openUrl(RELEASES_PAGE_URL);
    onClose();
  };

  // The updater cannot write to a deb / unpacked install, nor to an app bundle
  // in a system directory, so the one-click path is withheld there and the
  // manual download is promoted instead.
  const canSelfUpdate = installForm?.canSelfUpdate ?? true;
  const formLabel = installFormLabel(t, installForm);
  const blockedReason = canSelfUpdate ? null : formLabel;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-xs"
        onClick={requestClose}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="relative bg-card rounded-lg shadow-xl w-full max-w-2xl overflow-hidden outline-none"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* The title and the close button are laid out as two equal `flex-1`
            boxes, which is what puts the progress in the exact middle of the
            header — and keeps it visible while the release notes scroll. */}
        <div className="flex items-center gap-2 px-4 py-3 bg-muted/20">
          <h3 className="flex-1 min-w-0 truncate text-sm font-semibold text-foreground">
            {t.checkForUpdates}
          </h3>
          {isInstalling && progress && (
            <UpdateProgressInline progress={progress} />
          )}
          <div className="flex flex-1 justify-end">
            <button
              onClick={requestClose}
              disabled={isInstalling}
              className="p-1 hover:bg-accent rounded transition-colors text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <ScrollArea className="p-4 h-[40vh]">
          {!updateInfo ? (
            <div className="text-center py-4">
              <div className="text-sm text-muted-foreground">
                {t.loadingUpdateInfo}
              </div>
            </div>
          ) : !updateInfo.available ? (
            <div className="text-center py-4">
              <div className="text-sm font-medium text-foreground mb-2">
                {t.usingLatestVersion}
              </div>
              <div className="text-xs text-muted-foreground">
                {t.latestVersion}: {updateInfo.currentVersion}
              </div>
            </div>
          ) : (
            <div>
              <div className="text-sm font-medium text-foreground mb-2">
                {t.newVersionAvailable}: {updateInfo.version}
              </div>
              <div className="text-xs text-muted-foreground mb-1">
                {t.currentVersion}: {updateInfo.currentVersion}
              </div>
              <div className="text-xs text-muted-foreground mb-3">
                {t.updateSource}:{" "}
                <button
                  onClick={handleOpenRelease}
                  className="text-blue-500 underline hover:text-blue-400"
                >
                  GitHub Releases
                </button>
                {updateInfo.date && (
                  <span className="ml-3">
                    {t.updatePublishedAt}: {updateInfo.date}
                  </span>
                )}
              </div>

              {updateInfo.notes && (
                <>
                  <div className="text-xs font-medium text-foreground mb-1">
                    {t.updateReleaseNotes}
                  </div>
                  <div className="text-xs text-muted-foreground bg-muted/50 rounded p-3 border border-border/50">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ children }) => (
                          <h1 className="text-sm font-bold mb-2">{children}</h1>
                        ),
                        h2: ({ children }) => (
                          <h2 className="text-xs font-semibold mb-2">
                            {children}
                          </h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="text-xs font-medium mb-2">
                            {children}
                          </h3>
                        ),
                        p: ({ children }) => <p className="mb-2">{children}</p>,
                        ul: ({ children }) => (
                          <ul className="list-disc list-inside mb-2 space-y-1">
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal list-inside mb-2 space-y-1">
                            {children}
                          </ol>
                        ),
                        li: ({ children }) => <li>{children}</li>,
                        code: ({ className, children }) => {
                          const isInline = !className;
                          if (isInline) {
                            return (
                              <code className="bg-accent px-1 rounded font-mono">
                                {children}
                              </code>
                            );
                          }
                          return (
                            <code className={`${className} font-mono`}>
                              {children}
                            </code>
                          );
                        },
                        pre: ({ children }) => (
                          <pre className="bg-muted/80 p-2 rounded font-mono overflow-x-auto mb-2">
                            {children}
                          </pre>
                        ),
                        a: ({ href, children }) => (
                          <a
                            href={href}
                            onClick={(e) => {
                              e.preventDefault();
                              openUrl(href || "");
                            }}
                            className="text-blue-500 underline hover:text-blue-400"
                          >
                            {children}
                          </a>
                        ),
                        strong: ({ children }) => (
                          <strong className="font-semibold">{children}</strong>
                        ),
                        em: ({ children }) => (
                          <em className="italic">{children}</em>
                        ),
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-2 border-muted-foreground/50 pl-2 italic">
                            {children}
                          </blockquote>
                        ),
                      }}
                    >
                      {updateInfo.notes}
                    </ReactMarkdown>
                  </div>
                </>
              )}

              {/* Install layout: a plain hint when updating is possible, a
                  blocking notice when it is not. */}
              {blockedReason ? (
                <div className="mt-3 flex items-start gap-2 text-xs text-yellow-700 bg-yellow-500/10 border border-yellow-500/30 rounded p-2">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{blockedReason}</span>
                </div>
              ) : (
                formLabel && (
                  <div className="mt-3 text-xs text-muted-foreground">
                    {formLabel}
                  </div>
                )
              )}
            </div>
          )}

          {error && (
            <div className="mt-3 text-xs text-red-600 bg-red-500/10 border border-red-500/30 rounded p-2">
              <div className="font-medium mb-0.5">
                {updateInfo?.available
                  ? t.updateInstallFailed
                  : t.updateCheckFailed}
              </div>
              <div className="break-all">{error}</div>
            </div>
          )}
        </ScrollArea>

        <div className="flex items-center justify-between gap-2 px-4 py-3 bg-muted/20">
          <div className="text-[11px] text-muted-foreground truncate">
            {t.updateManualDownloadHint}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={isInstalling}
            >
              {t.cancel}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleOpenRelease}
              disabled={isInstalling}
            >
              {t.updateManualDownload}
            </Button>
            {updateInfo?.available && (
              <Button
                size="sm"
                onClick={onInstall}
                disabled={isInstalling || !canSelfUpdate || !updateInfo.update}
                title={blockedReason ?? undefined}
              >
                {isInstalling ? t.updateInstalling : t.updateDownloadAndInstall}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact progress for the dialog header.
 *
 * Deliberately narrow: the byte counts are dropped below `sm` (a narrow window
 * cannot show everything) and are always available through the tooltip.
 */
function UpdateProgressInline({ progress }: { progress: UpdateProgressState }) {
  const { t } = useLanguage();
  const percent =
    progress.total && progress.total > 0
      ? Math.min(100, Math.round((progress.downloaded / progress.total) * 100))
      : null;

  const label =
    progress.phase === "installing" ? t.updateInstalling : t.updateDownloading;
  const bytes = `${formatBytes(progress.downloaded)}${
    progress.total ? ` / ${formatBytes(progress.total)}` : ""
  }`;

  return (
    <div
      className="flex shrink-0 items-center gap-2 whitespace-nowrap text-xs text-muted-foreground"
      title={`${label} ${bytes}${percent !== null ? ` (${percent}%)` : ""}`}
    >
      <span>{label}</span>
      {/* Without a content-length there is no percentage to show; pulse so the
          bar does not read as a stalled 30%. */}
      <div className="h-1.5 w-24 lg:w-40 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full bg-primary transition-[width] duration-200 ${
            percent === null ? "animate-pulse" : ""
          }`}
          style={{ width: percent !== null ? `${percent}%` : "30%" }}
        />
      </div>
      <span className="w-9 text-right tabular-nums">
        {percent !== null ? `${percent}%` : ""}
      </span>
      <span className="hidden sm:inline tabular-nums">{bytes}</span>
    </div>
  );
}

/**
 * User-facing description of the detected install layout.
 *
 * Returns `null` while detection is still pending — the dialog then keeps the
 * one-click path enabled and relies on the installer's own error reporting.
 */
function installFormLabel(
  t: Translations,
  info: InstallFormInfo | null,
): string | null {
  if (!info) return null;
  const labels: Record<InstallForm, string> = {
    userScoped: t.updateFormUserScoped,
    machineScoped: t.updateFormMachineScoped,
    appBundleUser: t.updateFormAppBundleUser,
    appBundleSystem: t.updateFormAppBundleSystem,
    appImage: t.updateFormAppImage,
    debOrUnpacked: t.updateFormDebOrUnpacked,
    unknown: t.updateFormUnknown,
  };
  return labels[info.form];
}
