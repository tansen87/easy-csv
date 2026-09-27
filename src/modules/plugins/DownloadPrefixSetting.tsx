import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { useLanguage } from "@/i18n";
import {
  describePluginError,
  getPluginDownloadPrefix,
  setPluginDownloadPrefix,
} from "@/services/plugins";

interface DownloadPrefixSettingProps {
  showToast: (
    message: string,
    type?: "info" | "success" | "warning" | "error",
  ) => void;
}

/**
 * The download acceleration prefix.
 *
 * A transport hint and nothing more: the prefix is tried before each asset's
 * direct URL, and a download that comes back wrong is rejected by the sha256
 * pinned in the signed catalog regardless of who served it. That is what makes
 * it safe to hand this knob to the user at all — the worst a bad proxy can do is
 * fail.
 */
export function DownloadPrefixSetting({
  showToast,
}: DownloadPrefixSettingProps) {
  const { t } = useLanguage();
  const [prefix, setPrefix] = useState("");
  const [stored, setStored] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getPluginDownloadPrefix()
      .then((value) => {
        if (cancelled) return;
        setStored(value);
        setPrefix(value ?? "");
      })
      .catch(() => {
        // A failure here only means the field starts empty; the tab still works.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(
    async (next: string | null) => {
      setIsSaving(true);
      try {
        await setPluginDownloadPrefix(next);
        const saved = await getPluginDownloadPrefix();
        setStored(saved);
        setPrefix(saved ?? "");
        showToast(
          saved ? t.pluginPrefixSaved : t.pluginPrefixCleared,
          "success",
        );
      } catch (cause) {
        // The backend rejects a non-https prefix with its own explanation, which
        // is more useful than anything this component could invent.
        showToast(describePluginError(cause), "error");
      } finally {
        setIsSaving(false);
      }
    },
    [showToast, t.pluginPrefixSaved, t.pluginPrefixCleared],
  );

  const isDirty = prefix.trim() !== (stored ?? "");

  return (
    <div className="border border-border rounded-md p-3 space-y-2">
      <div>
        <h4 className="text-sm font-medium">{t.pluginPrefixTitle}</h4>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t.pluginPrefixDesc}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={prefix}
          spellCheck={false}
          placeholder={t.pluginPrefixPlaceholder}
          onChange={(event) => setPrefix(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && isDirty) void persist(prefix);
          }}
          className="flex-1 h-7 px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <Button
          variant="secondary"
          size="sm"
          disabled={isSaving || !isDirty}
          onClick={() => void persist(prefix)}
        >
          {t.pluginPrefixSave}
        </Button>
        <Tooltip content={t.pluginPrefixClear}>
          <Button
            variant="ghost"
            size="sm"
            aria-label={t.pluginPrefixClear}
            disabled={isSaving || !stored}
            onClick={() => void persist(null)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
