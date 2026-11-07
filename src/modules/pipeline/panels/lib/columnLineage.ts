import { ColumnSchema, StepLineage } from "@/types/xan";

/**
 * 列级血缘的推导层（设计 045）。
 *
 * 输入只有 `StepLineage[]`——执行时按步骤跑出来的 schema 快照，没有真实
 * 数据行。所以这里做的是「按 schema 差集 + `sourceColumnName` 链」的推断，
 * 和 `useDataLineage` 里 `<任意>RowCount` 的估算同属一个精度级别。
 *
 * 三个入口：
 * - `diffStep`：单步的增 / 删 / 改类型 / 改名，喂给「本次改动」列表。
 * - `buildColumnTrace`：某一列从源列到结果的完整轨迹，喂给「列路径」。
 * - `summarizeColumns`：面板列表的两个分组。
 */

export type TraceKind = "kept" | "cast" | "derived" | "renamed" | "removed";

export interface StepDiff {
  added: ColumnSchema[];
  removed: ColumnSchema[];
  cast: { name: string; from: string; to: string }[];
  renamed: { from: string; to: string }[];
}

export interface TraceStep {
  /** 1 起的步骤序号，与图上竖线一致 */
  index: number;
  stepId: string;
  commandName: string;
  /** 用户给这一步起的名字 */
  alias?: string;
  kind: TraceKind;
  /** 进入这一步时的列名；该列在本步生成时为 null */
  columnIn: string | null;
  /** 离开这一步时的列名；被移除时为 null */
  columnOut: string | null;
  typeIn?: string;
  typeOut?: string;
  /** 聚合 / 计算列的定义，用来在路径里显示表达式 */
  expression?: string;
  rowCountIn: number;
  rowCountOut: number;
  /** 分组键：这一步是 groupby 且该列原样保留 */
  groupKey?: boolean;
}

export interface ColumnTrace {
  column: string;
  type: string;
  /** 该列最初在源数据里的名字 */
  sourceName: string;
  sourceType: string;
  finalName: string;
  finalType: string;
  steps: TraceStep[];
  /** 除「保留」之外的步骤数 */
  changed: number;
  /** 是否活到结果 */
  survives: boolean;
  /** 在第几步消失（survives 为 false 时有效） */
  removedAt?: number;
}

export interface ColumnSummary {
  name: string;
  type: string;
  steps: number;
  changed: number;
  renamedCount: number;
  castCount: number;
  /** 结果列：在第几步生成 / 改名 / 是否分组键 */
  derivedAt?: number;
  renamedAt?: number;
  groupKeyAt?: number;
  /** 被移除：在第几步消失 */
  removedAt?: number;
}

export interface ColumnGroups {
  result: ColumnSummary[];
  removed: ColumnSummary[];
}

export interface StepChange {
  index: number;
  stepId: string;
  commandName: string;
  alias?: string;
  rowCountIn: number;
  rowCountOut: number;
  diff: StepDiff;
}

function sameColumn(a: ColumnSchema, b: ColumnSchema): boolean {
  return a.name === b.name;
}

/**
 * 单步的列变化。
 *
 * 改名只能靠推断：输入里有、输出里没有的列，与输出里多出来、且
 * `sourceStepId` 相同、没有 `expression`（不是聚合出来的新列）的列配成一对。
 */
export function diffStep(step: StepLineage): StepDiff {
  const { inputSchema, outputSchema } = step;

  const cast = outputSchema
    .filter((out) => {
      const before = inputSchema.find((c) => sameColumn(c, out));
      return Boolean(before) && before !== undefined && before.type !== out.type;
    })
    .map((out) => {
      const before = inputSchema.find((c) => sameColumn(c, out))!;
      return { name: out.name, from: before.type, to: out.type };
    });

  const rawRemoved = inputSchema.filter(
    (c) => !outputSchema.some((o) => o.name === c.name),
  );
  const rawAdded = outputSchema.filter(
    (c) => !inputSchema.some((i) => i.name === c.name),
  );

  const renamed: { from: string; to: string }[] = [];
  const usedAdded = new Set<string>();

  rawRemoved.forEach((gone) => {
    // rename 步骤会留下 previousName，最可靠；老数据没有这个字段时退回
    // 「同来源、同类型、不是聚合列」的启发式配对。
    const match =
      rawAdded.find(
        (cand) => !usedAdded.has(cand.name) && cand.previousName === gone.name,
      ) ??
      rawAdded.find(
        (cand) =>
          !usedAdded.has(cand.name) &&
          !cand.previousName &&
          !cand.expression &&
          cand.type === gone.type &&
          (cand.sourceStepId || "") === (gone.sourceStepId || ""),
      );
    if (match) {
      usedAdded.add(match.name);
      renamed.push({ from: gone.name, to: match.name });
    }
  });

  return {
    cast,
    renamed,
    added: rawAdded.filter((c) => !usedAdded.has(c.name)),
    removed: rawRemoved.filter((c) => !renamed.some((r) => r.from === c.name)),
  };
}

export function summarizeSteps(lineage: StepLineage[]): StepChange[] {
  return lineage.map((step, i) => ({
    index: i + 1,
    stepId: step.stepId,
    commandName: step.commandName,
    alias: step.alias,
    rowCountIn: step.inputRowCount,
    rowCountOut: step.outputRowCount,
    diff: diffStep(step),
  }));
}

/**
 * 找到某一列最初的源列名。用于从结果列反向找到「它是从哪一列来的」。
 */
function findOrigin(
  lineage: StepLineage[],
  columnName: string,
): { name: string; type: string } | null {
  // 源列直接命中（最常见）
  const fromSource = lineage[0].inputSchema.find((c) => c.name === columnName);
  if (fromSource) return { name: fromSource.name, type: fromSource.type };

  // 否则沿「改名 / 生成」链往回走，顺便记住最早见到的类型
  let current: string | null = columnName;
  let type = "";

  for (let i = lineage.length - 1; i >= 0; i--) {
    if (!current) break;
    const step = lineage[i];
    const inCol = step.inputSchema.find((c) => c.name === current);
    const outCol = step.outputSchema.find((c) => c.name === current);
    // 往回走时后看到的更早，所以每次都覆盖，最后留下的是源头的类型
    if (outCol?.type) type = outCol.type;

    if (inCol) {
      if (inCol.type) type = inCol.type;
      current = inCol.name;
      continue;
    }

    const diff = diffStep(step);
    const rename = diff.renamed.find((r) => r.to === current);
    if (rename) {
      const prev = step.inputSchema.find((c) => c.name === rename.from);
      if (prev?.type) type = prev.type;
      current = rename.from;
      continue;
    }

    const created = diff.added.find((c) => c.name === current);
    if (created?.sourceColumnName) {
      const prev = step.inputSchema.find(
        (c) => c.name === created.sourceColumnName,
      );
      if (prev) {
        if (prev.type) type = prev.type;
        current = prev.name;
        continue;
      }
    }

    // 上游没有来源：它就是在这一步出生的
    type = created?.type || outCol?.type || type;
    return { name: current, type };
  }

  if (!current) return null;
  return {
    name: current,
    type: type || lineage[0].inputSchema.find((c) => c.name === current)?.type || "",
  };
}

/**
 * 一列从源到结果的完整轨迹。传入结果列名也能拿到完整的上游路径。
 */
export function buildColumnTrace(
  lineage: StepLineage[],
  columnName: string,
): ColumnTrace | null {
  if (lineage.length === 0) return null;

  const origin = findOrigin(lineage, columnName);
  if (!origin) return null;

  let current: string = origin.name;
  let currentType: string = origin.type;
  const steps: TraceStep[] = [];

  for (let i = 0; i < lineage.length; i++) {
    const step = lineage[i];
    const inCol = step.inputSchema.find((c) => c.name === current);
    const outCol = step.outputSchema.find((c) => c.name === current);
    const diff = diffStep(step);

    if (outCol && inCol) {
      const kind: TraceKind = inCol.type !== outCol.type ? "cast" : "kept";
      steps.push({
        index: i + 1,
        stepId: step.stepId,
        commandName: step.commandName,
        alias: step.alias,
        kind,
        columnIn: inCol.name,
        columnOut: outCol.name,
        typeIn: inCol.type,
        typeOut: outCol.type,
        rowCountIn: step.inputRowCount,
        rowCountOut: step.outputRowCount,
        groupKey:
          kind === "kept" && step.commandName === "groupby" ? true : undefined,
      });
      current = outCol.name;
      currentType = outCol.type;
      continue;
    }

    if (outCol && !inCol) {
      // 出现在输出里但输入里没有：本步生成（或上游 schema 缺失，退化为保留）
      const derived = Boolean(outCol.expression) || Boolean(origin.name !== current);
      steps.push({
        index: i + 1,
        stepId: step.stepId,
        commandName: step.commandName,
        alias: step.alias,
        kind: derived ? "derived" : "kept",
        columnIn: null,
        columnOut: outCol.name,
        typeIn: undefined,
        typeOut: outCol.type,
        expression: outCol.expression,
        rowCountIn: step.inputRowCount,
        rowCountOut: step.outputRowCount,
      });
      current = outCol.name;
      currentType = outCol.type;
      continue;
    }

    // 输出里没有这一列：改名 / 聚合成新列 / 移除
    const rename = diff.renamed.find((r) => r.from === current);
    if (rename) {
      const next = step.outputSchema.find((c) => c.name === rename.to)!;
      steps.push({
        index: i + 1,
        stepId: step.stepId,
        commandName: step.commandName,
        alias: step.alias,
        kind: "renamed",
        columnIn: current,
        columnOut: next.name,
        typeIn: currentType,
        typeOut: next.type,
        rowCountIn: step.inputRowCount,
        rowCountOut: step.outputRowCount,
      });
      current = next.name;
      currentType = next.type;
      continue;
    }

    const derivedTo = diff.added.find(
      (c) => c.sourceColumnName === current && c.expression,
    );
    if (derivedTo) {
      steps.push({
        index: i + 1,
        stepId: step.stepId,
        commandName: step.commandName,
        alias: step.alias,
        kind: "derived",
        columnIn: current,
        columnOut: derivedTo.name,
        typeIn: currentType,
        typeOut: derivedTo.type,
        expression: derivedTo.expression,
        rowCountIn: step.inputRowCount,
        rowCountOut: step.outputRowCount,
      });
      current = derivedTo.name;
      currentType = derivedTo.type;
      continue;
    }

    if (inCol) {
      steps.push({
        index: i + 1,
        stepId: step.stepId,
        commandName: step.commandName,
        alias: step.alias,
        kind: "removed",
        columnIn: inCol.name,
        columnOut: null,
        typeIn: inCol.type,
        rowCountIn: step.inputRowCount,
        rowCountOut: step.outputRowCount,
      });
      return {
        column: columnName,
        type: currentType,
        sourceName: origin.name,
        sourceType: origin.type,
        finalName: inCol.name,
        finalType: inCol.type,
        steps,
        changed: steps.filter((s) => s.kind !== "kept").length,
        survives: false,
        removedAt: i + 1,
      };
    }

    // 这一步和这一列无关（列还没出生，或已消失）——跳过
  }

  const last = steps[steps.length - 1];
  return {
    column: columnName,
    type: currentType,
    sourceName: origin.name,
    sourceType: origin.type,
    finalName: current,
    finalType: currentType,
    steps,
    changed: steps.filter((s) => s.kind !== "kept").length,
    survives: Boolean(last && last.kind !== "removed"),
  };
}

function summarizeTrace(trace: ColumnTrace): ColumnSummary {
  const derived = trace.steps.find((s) => s.kind === "derived");
  const renamed = trace.steps.find((s) => s.kind === "renamed");
  const groupKey = trace.steps.find((s) => s.groupKey);
  return {
    name: trace.finalName,
    type: trace.finalType || trace.type,
    steps: trace.steps.length,
    changed: trace.changed,
    renamedCount: trace.steps.filter((s) => s.kind === "renamed").length,
    castCount: trace.steps.filter((s) => s.kind === "cast").length,
    derivedAt: derived?.index,
    renamedAt: renamed?.index,
    groupKeyAt: groupKey?.index,
    removedAt: trace.survives ? undefined : trace.removedAt,
  };
}

/**
 * 面板列表的两个分组：还在结果里的列、中途消失的列。
 *
 * 源列改名 / 聚合成新列后不算「被移除」——它的血缘还在，只是换了名字，
 * 所以这里按「源列的轨迹是否活到最后」判断，而不是按名字做差集。
 */
export function summarizeColumns(lineage: StepLineage[]): ColumnGroups {
  if (lineage.length === 0) return { result: [], removed: [] };

  const lastStep = lineage[lineage.length - 1];
  const firstStep = lineage[0];

  const result: ColumnSummary[] = [];
  const seen = new Set<string>();

  lastStep.outputSchema.forEach((col) => {
    if (seen.has(col.name)) return;
    seen.add(col.name);
    const trace =
      buildColumnTrace(lineage, col.name) ??
      ({
        column: col.name,
        type: col.type,
        sourceName: col.name,
        sourceType: col.type,
        finalName: col.name,
        finalType: col.type,
        steps: [],
        changed: 0,
        survives: true,
      } satisfies ColumnTrace);
    result.push(summarizeTrace(trace));
  });

  const removed: ColumnSummary[] = [];
  firstStep.inputSchema.forEach((col) => {
    if (seen.has(col.name)) return;
    const trace = buildColumnTrace(lineage, col.name);
    if (!trace || trace.survives) return;
    seen.add(col.name);
    removed.push(summarizeTrace(trace));
  });

  return { result, removed };
}

/** 图上的一条泳道：一个源列从左边走到右边 */
export interface Lane {
  key: string;
  sourceName: string;
  sourceType: string;
  finalName: string;
  finalType: string;
  survives: boolean;
  steps: TraceStep[];
}

/**
 * 泳道图的数据：每个源列一条泳道，另外把管道中途凭空生成的列（没有来源）
 * 补成从头开始的泳道。
 */
export function buildLanes(lineage: StepLineage[]): Lane[] {
  if (lineage.length === 0) return [];

  const lanes: Lane[] = [];
  const first = lineage[0];

  first.inputSchema.forEach((col) => {
    const trace = buildColumnTrace(lineage, col.name);
    lanes.push({
      key: col.name,
      sourceName: col.name,
      sourceType: col.type,
      finalName: trace?.finalName || col.name,
      finalType: trace?.finalType || col.type,
      survives: trace?.survives ?? true,
      steps: trace?.steps || [],
    });
  });

  // 没有来源的生成列（如 unpivot 的 variable / value）
  lineage.forEach((step) => {
    step.outputSchema.forEach((col) => {
      if (lanes.some((l) => l.sourceName === col.name || l.finalName === col.name))
        return;
      if (col.sourceColumnName && col.expression) return;
      const trace = buildColumnTrace(lineage, col.name);
      lanes.push({
        key: col.name,
        sourceName: col.name,
        sourceType: col.type,
        finalName: trace?.finalName || col.name,
        finalType: trace?.finalType || col.type,
        survives: trace?.survives ?? true,
        steps: trace?.steps || [],
      });
    });
  });

  return lanes;
}
