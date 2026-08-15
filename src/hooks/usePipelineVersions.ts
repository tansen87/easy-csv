import { useState, useCallback } from "react";
import { PipelineVersion, PipelineStep, PipelineTab } from "@/types/xan";
import { invoke } from "@tauri-apps/api/core";
import { formatDateTime } from "@/utils/format";
import { reconstructStep, stripStepCommand } from "@/utils/session";
import { snapshotsEqual } from "@/utils/versionDiff";

const MAX_VERSIONS = 20;

function pruneVersions(
  versions: PipelineVersion[],
  currentVersionId?: string,
): PipelineVersion[] {
  if (versions.length <= MAX_VERSIONS) return versions;
  const pruned = [...versions];
  while (pruned.length > MAX_VERSIONS && pruned.length > 0) {
    const first = pruned[0];
    if (first.id === currentVersionId) break;
    pruned.shift();
  }
  return pruned;
}

function generateVersionId(): string {
  return `v-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
        const steps = [...currentTab.pipeline.map(stripStepCommand)];
        const edges = [...(currentTab.edges || [])];

        const previousVersions = currentTab.versions || [];
        const latest = previousVersions[previousVersions.length - 1];
        if (
          latest &&
          snapshotsEqual(
            { steps: latest.steps, edges: latest.edges },
            { steps, edges },
          )
        ) {
          return latest;
        }

        const version: PipelineVersion = {
          id: generateVersionId(),
          pipelineId: selectedTabId,
          parentId,
          steps,
          edges,
          inputPosition: currentTab.inputPosition,
          message,
          createdAt: formatDateTime(new Date()),
          tags,
        };

        const versions = pruneVersions(
          [...previousVersions, version],
          parentId,
        );

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
        v.id === versionId ? { ...v, tags: [...(v.tags || []), tag] } : v,
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

  const clearAllVersions = useCallback(async () => {
    const currentTab = tabs.find((t) => t.id === selectedTabId);
    if (!currentTab) return;

    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === selectedTabId
          ? { ...tab, versions: [], currentVersionId: undefined }
          : tab,
      ),
    );

    await invoke("save_pipeline_versions", {
      pipelineId: selectedTabId,
      versions: JSON.stringify([]),
    });
  }, [tabs, selectedTabId, setTabs]);

  const renameVersion = useCallback(
    async (versionId: string, message: string) => {
      const currentTab = tabs.find((t) => t.id === selectedTabId);
      if (!currentTab) return;

      const versions = (currentTab.versions || []).map((v) =>
        v.id === versionId ? { ...v, message } : v,
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
    async (tabId?: string) => {
      const targetTabId = tabId || selectedTabId;
      try {
        const content = await invoke<string>("load_pipeline_versions", {
          pipelineId: targetTabId,
        });
        const versions: PipelineVersion[] = JSON.parse(content).map(
          (v: any) => ({
            ...v,
            steps: v.steps.map(reconstructStep).filter(Boolean),
          }),
        );

        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === targetTabId
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
    clearAllVersions,
    addTag,
    removeTag,
    renameVersion,
    loadVersions,
  };
}
