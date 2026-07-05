import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useLanguage } from "@/i18n";

interface UpdateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  updateInfo: {
    hasUpdate: boolean;
    latestVersion: string;
    changelog: string;
  } | null;
  currentVersion: string | null;
}

export function UpdateDialog({
  isOpen,
  onClose,
  updateInfo,
  currentVersion,
}: UpdateDialogProps) {
  const { t } = useLanguage();
  if (!isOpen) return null;

  const handleOpenRelease = () => {
    openUrl("https://github.com/tansen87/easy-csv/releases/latest");
    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-none"
        onContextMenu={(e) => e.preventDefault()}
      />
      <div
        className="relative bg-card rounded-lg shadow-xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-muted/20">
          <h3 className="text-sm font-semibold text-foreground">{t.checkForUpdates}</h3>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-accent rounded transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ScrollArea className="p-4 h-[28vh]">
          {updateInfo ? (
            updateInfo.hasUpdate ? (
              <div>
                <div className="text-sm font-medium text-foreground mb-2">
                  {t.newVersionAvailable}: {updateInfo.latestVersion}
                </div>
                <div className="text-xs text-muted-foreground mb-3">
                  {t.currentVersion}: {currentVersion}
                </div>
                <div className="text-xs text-muted-foreground bg-muted/50 rounded p-3 border border-border/50">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children }) => <h1 className="text-sm font-bold mb-2">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-xs font-semibold mb-2">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-xs font-medium mb-2">{children}</h3>,
                      p: ({ children }) => <p className="mb-2">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                      li: ({ children }) => <li>{children}</li>,
                      code: ({ className, children }) => {
                        const isInline = !className;
                        if (isInline) {
                          return <code className="bg-accent px-1 rounded font-mono">{children}</code>;
                        }
                        return <code className={`${className} font-mono`}>{children}</code>;
                      },
                      pre: ({ children }) => <pre className="bg-muted/80 p-2 rounded font-mono overflow-x-auto mb-2">{children}</pre>,
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          onClick={(e) => {
                            e.preventDefault();
                            openUrl(href || "");
                          }}
                          className="text-blue-400 underline hover:text-blue-300"
                        >
                          {children}
                        </a>
                      ),
                      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                      em: ({ children }) => <em className="italic">{children}</em>,
                      blockquote: ({ children }) => <blockquote className="border-l-2 border-muted-foreground/50 pl-2 italic">{children}</blockquote>,
                    }}
                  >
                    {updateInfo.changelog}
                  </ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="text-sm font-medium text-foreground mb-2">
                  {t.usingLatestVersion}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t.latestVersion}: {currentVersion}
                </div>
              </div>
            )
          ) : (
            <div className="text-center py-4">
              <div className="text-sm text-muted-foreground">{t.loadingUpdateInfo}</div>
            </div>
          )}
        </ScrollArea>
        <div className="flex items-center justify-end gap-2 px-4 py-3 bg-muted/20">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleClose}
          >
            {t.cancel}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleOpenRelease}
          >
            {t.update}
          </Button>
        </div>
      </div>
    </div>
  );
}