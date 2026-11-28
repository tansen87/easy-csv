import { TableNode } from "@/modules/pipeline/nodes/TableNode";
import { PipelineStepNode } from "@/modules/pipeline/nodes/PipelineStepNode";

export const nodeTypes = {
  tableNode: TableNode,
  pipelineStep: PipelineStepNode,
};

export { TableNode } from "@/modules/pipeline/nodes/TableNode";
export { PipelineStepNode } from "@/modules/pipeline/nodes/PipelineStepNode";
export type { TableNodeData } from "@/modules/pipeline/nodes/TableNode";
export type { PipelineStepNodeData } from "@/modules/pipeline/nodes/PipelineStepNode";
