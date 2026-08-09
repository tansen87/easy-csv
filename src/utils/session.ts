import {
  PipelineEdge,
  PipelineStep,
  PipelineTab,
  StoredPipelineStep,
} from "@/types/xan";
import { formatDateTime } from "@/utils/format";
import { xanCommands } from "@/data/commands";

export function stripStepCommand(step: PipelineStep): StoredPipelineStep {
  return {
    id: step.id,
    commandId: step.command.id,
    parameters: step.parameters,
    alias: step.alias,
    position: step.position,
  };
}

export function reconstructStep(
  step: StoredPipelineStep | any,
): PipelineStep | null {
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

export interface TabSnapshot {
  id: string;
  name: string;
  created: string;
  updated: string;
  inputFile?: string;
  defaultDelimiter?: string;
  headers?: string[];
  data?: string[][];
  inputPosition?: { x: number; y: number };
  isSettings?: boolean;
  currentVersionId?: string;
  pipeline: StoredPipelineStep[];
  edges: PipelineEdge[];
}

export function serializeTabSnapshot(tab: PipelineTab): TabSnapshot {
  return {
    id: tab.id,
    name: tab.name,
    created: tab.created,
    updated: tab.updated,
    inputFile: tab.inputFile,
    defaultDelimiter: tab.defaultDelimiter,
    headers: tab.headers,
    data: tab.data,
    inputPosition: tab.inputPosition,
    isSettings: tab.isSettings,
    currentVersionId: tab.currentVersionId,
    pipeline: (tab.pipeline || []).map(stripStepCommand),
    edges: tab.edges || [],
  };
}

export function deserializeTabSnapshot(snap: any): PipelineTab | null {
  if (!snap || !snap.id) return null;
  const pipeline = ((snap.pipeline || []) as StoredPipelineStep[])
    .map(reconstructStep)
    .filter(Boolean) as PipelineStep[];
  return {
    id: snap.id,
    name: snap.name || "Tab",
    pipeline,
    created: snap.created || formatDateTime(new Date()),
    updated: snap.updated || formatDateTime(new Date()),
    data: snap.data,
    headers: snap.headers,
    inputFile: snap.inputFile,
    defaultDelimiter: snap.defaultDelimiter,
    edges: snap.edges || [],
    inputPosition: snap.inputPosition,
    isSettings: snap.isSettings,
    currentVersionId: snap.currentVersionId,
  };
}
