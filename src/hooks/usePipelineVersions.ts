import { useState, useCallback } from "react";
import { PipelineVersion, PipelineStep, PipelineTab, StoredPipelineStep } from "@/types/xan";
import { invoke } from "@tauri-apps/api/core";
import { formatDateTime } from "@/utils/format";
import { xanCommands } from "@/data/commands";

function generateVersionId(): string {
  return `v-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function stripStepCommand(step: PipelineStep): StoredPipelineStep {
  return {
    id: step.id,
    commandId: step.command.id,
    parameters: step.parameters,
    alias: step.alias,
    position: step.position,
  };
}

function reconstructStep(step: StoredPipelineStep | any): PipelineStep | null {
  if (step.command) return step;
  const command = xanCommands.find((cmd) => cmd.id === step.commandId);
  if (!command) return null;
  return {
    id: step.id,
    command,
    parameters: step.parameters || {},
    alias: step.alias,
    position: step.position,
  };
}

export function usePipelineVersions(
  tabs: PipelineTab[],
  setTabs: React.Dispatch<React.SetStateAction<PipelineTab[]>>,
  selectedTabId: string,
) {
  const [isSavingVersion, setIsSavingVersion] = useState(false);

  const getCurrentVersions = useCallback((): PipelineVersion[] => {
    const currentTab = tabs.find((t) => t.id === selectedTabId);
    return currentTab?.versions || [];
  }, [tabs, selectedTabId]);

  const saveVersion = useCallback(
    async (message?: string, tags?: string[]) => {
      const currentTab = tabs.find((t) => t.id === selectedTabId);
      if (!currentTab) return;

      setIsSavingVersion(true);

      try {
        const parentId = currentTab.currentVersionId;
        const version: PipelineVersion = {
          id: generateVersionId(),
          pipelineId: selectedTabId,
          parentId,
          steps: [...currentTab.pipeline.map(stripStepCommand)],
          edges: [...(currentTab.edges || [])],
          inputPosition: currentTab.inputPosition,
          message,
          createdAt: formatDateTime(new Date()),
          tags,
        };

        const versions = [...(currentTab.versions || []), version];

        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === selectedTabId
              ? {
                  ...tab,
                  versions,
                  currentVersionId: version.id,
                }
              : tab,
          ),
        );

        await invoke("save_pipeline_versions", {
          pipelineId: selectedTabId,
          versions: JSON.stringify(versions),
        });

        return version;
      } catch (error) {
        console.error("Failed to save version:", error);
        throw error;
      } finally {
        setIsSavingVersion(false);
      }
    },
    [tabs, selectedTabId, setTabs],
  );

  const restoreVersion = useCallback(
    async (versionId: string) => {
      const currentTab = tabs.find((t) => t.id === selectedTabId);
      if (!currentTab) return;

      const version = currentTab.versions?.find((v) => v.id === versionId);
      if (!version) return;

      const restoredPipeline = version.steps
        .map(reconstructStep)
        .filter(Boolean) as PipelineStep[];

      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === selectedTabId
            ? {
                ...tab,
                pipeline: restoredPipeline,
                edges: [...version.edges],
                inputPosition: version.inputPosition,
                currentVersionId: versionId,
                updatedAt: formatDateTime(new Date()),
              }
            : tab,
        ),
      );
    },
    [tabs, selectedTabId, setTabs],
  );

  const deleteVersion = useCallback(
    async (versionId: string) => {
      const currentTab = tabs.find((t) => t.id === selectedTabId);
      if (!currentTab) return;

      const versions = (currentTab.versions || []).filter(
        (v) => v.id !== versionId,
      );

      const newCurrentVersionId =
        currentTab.currentVersionId === versionId
          ? versions.length > 0
            ? versions[versions.length - 1].id
            : undefined
          : currentTab.currentVersionId;

      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === selectedTabId
            ? {
                ...tab,
                versions,
                currentVersionId: newCurrentVersionId,
              }
            : tab,
        ),
      );

      await invoke("save_pipeline_versions", {
        pipelineId: selectedTabId,
        versions: JSON.stringify(versions),
      });
    },
    [tabs, selectedTabId, setTabs],
  );

  const addTag = useCallback(
    async (versionId: string, tag: string) => {
      const currentTab = tabs.find((t) => t.id === selectedTabId);
      if (!currentTab) return;

      const versions = (currentTab.versions || []).map((v) =>
        v.id === versionId
          ? { ...v, tags: [...(v.tags || []), tag] }
          : v,
      );

      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === selectedTabId ? { ...tab, versions } : tab,
        ),
      );

      await invoke("save_pipeline_versions", {
        pipelineId: selectedTabId,
        versions: JSON.stringify(versions),
      });
    },
    [tabs, selectedTabId, setTabs],
  );

  const removeTag = useCallback(
    async (versionId: string, tag: string) => {
      const currentTab = tabs.find((t) => t.id === selectedTabId);
      if (!currentTab) return;

      const versions = (currentTab.versions || []).map((v) =>
        v.id === versionId
          ? { ...v, tags: (v.tags || []).filter((t) => t !== tag) }
          : v,
      );

      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === selectedTabId ? { ...tab, versions } : tab,
        ),
      );

      await invoke("save_pipeline_versions", {
        pipelineId: selectedTabId,
        versions: JSON.stringify(versions),
      });
    },
    [tabs, selectedTabId, setTabs],
  );

  const loadVersions = useCallback(
    async () => {
      try {
        const content = await invoke<string>("load_pipeline_versions", {
          pipelineId: selectedTabId,
        });
        const versions: PipelineVersion[] = JSON.parse(content).map(
          (v: any) => ({
            ...v,
            steps: v.steps.map(reconstructStep).filter(Boolean),
          }),
        );

        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === selectedTabId
              ? {
                  ...tab,
                  versions,
                  currentVersionId:
                    versions.length > 0
                      ? versions[versions.length - 1].id
                      : undefined,
                }
              : tab,
          ),
        );

        return versions;
      } catch (error) {
        console.error("Failed to load versions:", error);
        return [];
      }
    },
    [selectedTabId, setTabs],
  );

  return {
    isSavingVersion,
    getCurrentVersions,
    saveVersion,
    restoreVersion,
    deleteVersion,
    addTag,
    removeTag,
    loadVersions,
  };
}
