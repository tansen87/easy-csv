import { TableNode } from "@/components/panel/nodes/TableNode";
import { PipelineStepNode } from "@/components/panel/nodes/PipelineStepNode";
import { ConditionalNode } from "@/components/panel/nodes/ConditionalNode";

export const nodeTypes = {
  tableNode: TableNode,
  pipelineStep: PipelineStepNode,
  conditional: ConditionalNode,
};

export { TableNode } from "@/components/panel/nodes/TableNode";
export { PipelineStepNode } from "@/components/panel/nodes/PipelineStepNode";
export { ConditionalNode } from "@/components/panel/nodes/ConditionalNode";
export type { TableNodeData } from "@/components/panel/nodes/TableNode";
export type { PipelineStepNodeData } from "@/components/panel/nodes/PipelineStepNode";
export type { ConditionalNodeData } from "@/components/panel/nodes/ConditionalNode";
