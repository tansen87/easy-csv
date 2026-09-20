import { TableNode } from "@/modules/pipeline/nodes/TableNode";
import { PipelineStepNode } from "@/modules/pipeline/nodes/PipelineStepNode";
import { ResultTableNode } from "@/modules/pipeline/nodes/ResultTableNode";

export const nodeTypes = {
  tableNode: TableNode,
  pipelineStep: PipelineStepNode,
  resultTableNode: ResultTableNode,
};

export { TableNode } from "@/modules/pipeline/nodes/TableNode";
export { PipelineStepNode } from "@/modules/pipeline/nodes/PipelineStepNode";
export { ResultTableNode } from "@/modules/pipeline/nodes/ResultTableNode";
export type { TableNodeData } from "@/modules/pipeline/nodes/TableNode";
export type { PipelineStepNodeData } from "@/modules/pipeline/nodes/PipelineStepNode";
export type { ResultTableNodeData } from "@/modules/pipeline/nodes/ResultTableNode";
