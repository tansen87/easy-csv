import { useState, useCallback, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PipelineTemplate } from "@/types/xan";
import { useLanguage } from "@/i18n";
import { formatDateTime } from "@/utils/format";
import {
  buildBuiltinTemplates,
  isBuiltinTemplate,
} from "@/data/templates/builtin";

/**
 * Frontend store for the pipeline template library.
 *
 * Backing persistence is JSON in the un-sandboxed resources/templates dir via
 * the Rust commands `save_pipeline_template` / `load_pipeline_templates` /
 * `delete_pipeline_template`. Each mutation upserts by `id` and reloads so the
 * React state stays the single consistent view.
 *
 * Built-in templates (design 027 §4.4) are **not** persisted: they are merged in
 * on the fly, ahead of the user's own, so a fresh install no longer opens an
 * empty library. They are read-only — renaming or deleting one is a no-op, and
 * "copy to my templates" is how a user adopts one.
 */
export function usePipelineTemplates() {
  const { t } = useLanguage();
  const [userTemplates, setUserTemplates] = useState<PipelineTemplate[]>([]);

  const refresh = useCallback(async () => {
    try {
      const content = await invoke<string>("load_pipeline_templates");
      setUserTemplates(JSON.parse(content) as PipelineTemplate[]);
    } catch (error) {
      console.error("Failed to load pipeline templates:", error);
      setUserTemplates([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const templates = useMemo(
    () => [...buildBuiltinTemplates(t), ...userTemplates],
    [t, userTemplates],
  );

  const savePipelineTemplate = useCallback(
    async (template: PipelineTemplate) => {
      await invoke("save_pipeline_template", {
        template: JSON.stringify(template),
      });
      await refresh();
    },
    [refresh],
  );

  const deletePipelineTemplate = useCallback(
    async (id: string) => {
      if (isBuiltinTemplate(id)) return;
      await invoke("delete_pipeline_template", { templateId: id });
      await refresh();
    },
    [refresh],
  );

  const renamePipelineTemplate = useCallback(
    async (id: string, name: string, description?: string) => {
      if (isBuiltinTemplate(id)) return;
      const target = userTemplates.find((tpl) => tpl.id === id);
      if (!target) return;
      const updated: PipelineTemplate = {
        ...target,
        name,
        description,
        updated: formatDateTime(new Date()),
      };
      await invoke("save_pipeline_template", {
        template: JSON.stringify(updated),
      });
      await refresh();
    },
    [userTemplates, refresh],
  );

  /**
   * Copy a template (usually a built-in) into the user's own library under a
   * fresh id, so it can then be renamed, edited and deleted freely.
   */
  const copyToMyTemplates = useCallback(
    async (id: string): Promise<PipelineTemplate | undefined> => {
      const source = templates.find((tpl) => tpl.id === id);
      if (!source) return undefined;
      const now = formatDateTime(new Date());
      const suffix = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const copy: PipelineTemplate = {
        ...source,
        id: `tpl-${suffix}`,
        snapshot: { ...source.snapshot, id: `snapshot-${suffix}` },
        created: now,
        updated: now,
      };
      await savePipelineTemplate(copy);
      return copy;
    },
    [templates, savePipelineTemplate],
  );

  return {
    templates,
    refresh,
    savePipelineTemplate,
    deletePipelineTemplate,
    renamePipelineTemplate,
    copyToMyTemplates,
  };
}
