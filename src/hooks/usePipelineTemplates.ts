import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PipelineTemplate } from "@/types/xan";

/**
 * Frontend store for the pipeline template library.
 *
 * Backing persistence is JSON in the un-sandboxed resources/templates dir via
 * the Rust commands `save_pipeline_template` / `load_pipeline_templates` /
 * `delete_pipeline_template`. Each mutation upserts by `id` and reloads so the
 * React state stays the single consistent view.
 */
export function usePipelineTemplates() {
  const [templates, setTemplates] = useState<PipelineTemplate[]>([]);

  const refresh = useCallback(async () => {
    try {
      const content = await invoke<string>("load_pipeline_templates");
      setTemplates(JSON.parse(content) as PipelineTemplate[]);
    } catch (error) {
      console.error("Failed to load pipeline templates:", error);
      setTemplates([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
      await invoke("delete_pipeline_template", { templateId: id });
      await refresh();
    },
    [refresh],
  );

  const renamePipelineTemplate = useCallback(
    async (id: string, name: string, description?: string) => {
      const target = templates.find((t) => t.id === id);
      if (!target) return;
      const updated: PipelineTemplate = {
        ...target,
        name,
        description,
        updated: new Date().toLocaleString(),
      };
      await invoke("save_pipeline_template", {
        template: JSON.stringify(updated),
      });
      await refresh();
    },
    [templates, refresh],
  );

  return {
    templates,
    refresh,
    savePipelineTemplate,
    deletePipelineTemplate,
    renamePipelineTemplate,
  };
}
