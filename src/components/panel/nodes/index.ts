import { TableNode } from "@/components/panel/nodes/TableNode";
import { PipelineStepNode } from "@/components/panel/nodes/PipelineStepNode";

export const nodeTypes = {
  tableNode: TableNode,
  pipelineStep: PipelineStepNode,
};

export { TableNode } from "@/components/panel/nodes/TableNode";
export { PipelineStepNode } from "@/components/panel/nodes/PipelineStepNode";
export type { TableNodeData } from "@/components/panel/nodes/TableNode";
export type { PipelineStepNodeData } from "@/components/panel/nodes/PipelineStepNode";
