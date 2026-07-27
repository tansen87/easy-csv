import { useState, useCallback } from "react";
import { PipelineStep, PipelineEdge, StepLineage, ColumnSchema, Transformation, PipelineTab } from "@/types/xan";
import { invoke } from "@tauri-apps/api/core";

function inferColumnType(value: string): "string" | "number" | "date" | "boolean" {
  if (value === "true" || value === "false") return "boolean";
  if (!isNaN(Number(value)) && value !== "") return "number";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return "date";
  return "string";
}

function inferSchemaFromData(headers: string[], rows: string[][]): ColumnSchema[] {
  return headers.map((name, colIndex) => {
    const sampleValues = rows.slice(0, 10).map((row) => row[colIndex] || "");
    const types = sampleValues.map(inferColumnType);
    const typeCounts = types.reduce(
      (acc, type) => {
        acc[type]++;
        return acc;
      },
      { string: 0, number: 0, date: 0, boolean: 0 },
    );

    const dominantType = Object.entries(typeCounts).reduce((a, b) =>
      a[1] > b[1] ? a : b,
    )[0] as "string" | "number" | "date" | "boolean";

    return { name, type: dominantType };
  });
}

function analyzeTransformations(
  step: PipelineStep,
  inputSchema: ColumnSchema[],
  outputSchema: ColumnSchema[],
): Transformation[] {
  const transformations: Transformation[] = [];
  const commandName = step.command.name;

  const inputCols = new Set(inputSchema.map((c) => c.name));
  const outputCols = new Set(outputSchema.map((c) => c.name));

  const addedCols = outputSchema.filter((c) => !inputCols.has(c.name));
  const removedCols = inputSchema.filter((c) => !outputCols.has(c.name));

  if (addedCols.length > 0) {
    transformations.push({
      type: "add",
      description: `Added columns: ${addedCols.map((c) => c.name).join(", ")}`,
      affectedColumns: addedCols.map((c) => c.name),
    });
  }

  if (removedCols.length > 0) {
    transformations.push({
      type: "remove",
      description: `Removed columns: ${removedCols.map((c) => c.name).join(", ")}`,
      affectedColumns: removedCols.map((c) => c.name),
    });
  }

  const commonCols = inputSchema.filter((c) => outputCols.has(c.name));
  const renamedCols = commonCols.filter((inputCol) => {
    const outputCol = outputSchema.find((c) => c.name === inputCol.name);
    return outputCol && outputCol.type !== inputCol.type;
  });

  if (renamedCols.length > 0) {
    transformations.push({
      type: "cast",
      description: `Type casts: ${renamedCols.map((c) => c.name).join(", ")}`,
      affectedColumns: renamedCols.map((c) => c.name),
    });
  }

  if (["filter", "search", "head", "tail", "slice", "top", "sample", "bisect"].includes(commandName)) {
    transformations.push({
      type: "filter",
      description: `Filtered rows using ${commandName}`,
      affectedColumns: [],
    });
  }

  if (["sort", "shuffle"].includes(commandName)) {
    transformations.push({
      type: "sort",
      description: `Sorted rows using ${commandName}`,
      affectedColumns: [],
    });
  }

  if (["groupby", "frequency", "stats", "agg", "bins", "window"].includes(commandName)) {
    transformations.push({
      type: "aggregate",
      description: `Aggregated data using ${commandName}`,
      affectedColumns: [],
    });
  }

  if (commandName === "rename") {
    const renameParam = step.parameters.rename;
    if (renameParam) {
      transformations.push({
        type: "rename",
        description: `Renamed columns: ${renameParam}`,
        affectedColumns: [],
      });
    }
  }

  if (commandName === "pivot" || commandName === "unpivot") {
    transformations.push({
      type: "pivot",
      description: `Pivoted data using ${commandName}`,
      affectedColumns: [],
    });
  }

  if (commandName === "flatten" || commandName === "implode") {
    transformations.push({
      type: "flatten",
      description: `Flattened data using ${commandName}`,
      affectedColumns: [],
    });
  }

  if (transformations.length === 0) {
    transformations.push({
      type: "other",
      description: `Applied ${commandName} transformation`,
      affectedColumns: [],
    });
  }

  return transformations;
}

export function useDataLineage(
  _tabs: PipelineTab[],
  setTabs: React.Dispatch<React.SetStateAction<PipelineTab[]>>,
  selectedTabId: string,
) {
  const [isLineageMode, setIsLineageMode] = useState(false);
  const [lineageData, setLineageData] = useState<StepLineage[]>([]);

  const computeLineage = useCallback(
    (
      steps: PipelineStep[],
      edges: PipelineEdge[],
      inputHeaders: string[],
      inputRows: string[][],
    ): StepLineage[] => {
      const lineage: StepLineage[] = [];

      const stepMap = new Map<string, PipelineStep>();
      steps.forEach((step) => stepMap.set(step.id, step));

      const adjacency = new Map<string, string[]>();
      edges.forEach((edge) => {
        if (!adjacency.has(edge.source)) {
          adjacency.set(edge.source, []);
        }
        adjacency.get(edge.source)!.push(edge.target);
      });

      const visited = new Set<string>();
      const schemaCache = new Map<string, ColumnSchema[]>();
      const rowCountsCache = new Map<string, number>();

      schemaCache.set("table-node", inferSchemaFromData(inputHeaders, inputRows));
      rowCountsCache.set("table-node", inputRows.length);

      const processNode = (nodeId: string) => {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);

        if (nodeId === "table-node") return;

        const step = stepMap.get(nodeId);
        if (!step) return;

        const incomingEdges = edges.filter((e) => e.target === nodeId);
        const inputSchemas: ColumnSchema[] = [];
        let totalInputRows = 0;

        incomingEdges.forEach((edge) => {
          const parentSchema = schemaCache.get(edge.source) || [];
          const parentRows = rowCountsCache.get(edge.source) || 0;
          inputSchemas.push(...parentSchema);
          totalInputRows += parentRows;
        });

        if (inputSchemas.length === 0) {
          inputSchemas.push(...(schemaCache.get("table-node") || []));
          totalInputRows = rowCountsCache.get("table-node") || 0;
        }

        const uniqueInputCols = inputSchemas.filter(
          (col, index, self) =>
            index === self.findIndex((c) => c.name === col.name),
        );

        const outputSchema = computeOutputSchema(step, uniqueInputCols);
        const outputRowCount = computeOutputRowCount(step, totalInputRows);

        const transformations = analyzeTransformations(
          step,
          uniqueInputCols,
          outputSchema,
        );

        const lineageEntry: StepLineage = {
          stepId: step.id,
          commandName: step.command.name,
          inputSchema: uniqueInputCols,
          outputSchema,
          inputRowCount: totalInputRows,
          outputRowCount,
          transformations,
        };

        lineage.push(lineageEntry);
        schemaCache.set(nodeId, outputSchema);
        rowCountsCache.set(nodeId, outputRowCount);

        const children = adjacency.get(nodeId) || [];
        children.forEach(processNode);
      };

      const targetIds = new Set(edges.map((e) => e.target));
      const startNodes = steps
        .filter((step) => !targetIds.has(step.id))
        .map((step) => step.id);

      if (startNodes.length === 0) {
        const tableEdges = adjacency.get("table-node") || [];
        tableEdges.forEach(processNode);
      } else {
        startNodes.forEach(processNode);
      }

      return lineage;
    },
    [],
  );

  const computeOutputSchema = (
    step: PipelineStep,
    inputSchema: ColumnSchema[],
  ): ColumnSchema[] => {
    const commandName = step.command.name;

    switch (commandName) {
      case "select": {
        const cols = step.parameters.columns;
        if (cols) {
          const selectedCols = Array.isArray(cols) ? cols : cols.split(/[|,]/);
          return selectedCols
            .map((name: string) => name.trim())
            .filter(Boolean)
            .map((name: string) => ({
              name,
              type: inputSchema.find((c) => c.name === name)?.type || "string",
            }));
        }
        return inputSchema;
      }

      case "drop": {
        const cols = step.parameters.columns;
        if (cols) {
          const droppedCols = Array.isArray(cols) ? cols : cols.split(/[|,]/);
          const droppedSet = new Set(
            droppedCols.map((name: string) => name.trim()),
          );
          return inputSchema.filter((c) => !droppedSet.has(c.name));
        }
        return inputSchema;
      }

      case "rename": {
        const renameParam = step.parameters.rename;
        if (renameParam) {
          const renames = renameParam.split(/[|,]/).map((r: string) => {
            const [from, to] = r.split(":").map((s: string) => s.trim());
            return { from, to };
          });
          return inputSchema.map((col) => {
            const rename = renames.find((r: { from: string; to: string }) => r.from === col.name);
            return rename ? { ...col, name: rename.to } : col;
          });
        }
        return inputSchema;
      }

      case "map": {
        const newCol = step.parameters["new-column"];
        if (newCol) {
          return [
            ...inputSchema,
            { name: newCol, type: "string" },
          ];
        }
        return inputSchema;
      }

      case "pivot": {
        return [
          { name: step.parameters.column || "column", type: "string" },
          { name: "value", type: "string" },
        ];
      }

      case "unpivot": {
        return [
          { name: "variable", type: "string" },
          { name: "value", type: "string" },
        ];
      }

      case "transpose": {
        return [
          { name: "column", type: "string" },
          { name: "value", type: "string" },
        ];
      }

      case "flatten": {
        return inputSchema.map((col) => ({
          ...col,
          type: "string" as const,
        }));
      }

      case "explode": {
        return inputSchema;
      }

      default:
        return inputSchema;
    }
  };

  const computeOutputRowCount = (
    step: PipelineStep,
    inputRowCount: number,
  ): number => {
    const commandName = step.command.name;

    switch (commandName) {
      case "head": {
        const n = parseInt(step.parameters.n || "10", 10);
        return Math.min(n, inputRowCount);
      }

      case "tail": {
        const n = parseInt(step.parameters.n || "10", 10);
        return Math.min(n, inputRowCount);
      }

      case "sample": {
        const n = parseInt(step.parameters.n || "10", 10);
        return Math.min(n, inputRowCount);
      }

      case "dedup": {
        return Math.floor(inputRowCount * 0.8);
      }

      case "sort":
      case "shuffle":
      case "reverse":
        return inputRowCount;

      case "filter":
      case "search":
        return Math.floor(inputRowCount * 0.5);

      case "groupby":
        return Math.floor(inputRowCount * 0.3);

      case "bins":
        return parseInt(step.parameters.n || "10", 10);

      default:
        return inputRowCount;
    }
  };

  const trackLineage = useCallback(
    (
      steps: PipelineStep[],
      edges: PipelineEdge[],
      inputHeaders: string[],
      inputRows: string[][],
    ) => {
      const lineage = computeLineage(steps, edges, inputHeaders, inputRows);
      setLineageData(lineage);

      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === selectedTabId ? { ...tab, lineage } : tab,
        ),
      );

      return lineage;
    },
    [computeLineage, selectedTabId, setTabs],
  );

  const saveLineage = useCallback(
    async () => {
      try {
        await invoke("save_lineage_data", {
          pipelineId: selectedTabId,
          lineage: JSON.stringify(lineageData),
        });
      } catch (error) {
        console.error("Failed to save lineage:", error);
      }
    },
    [selectedTabId, lineageData],
  );

  const loadLineage = useCallback(async () => {
    try {
      const content = await invoke<string>("load_lineage_data", {
        pipelineId: selectedTabId,
      });
      const lineage: StepLineage[] = JSON.parse(content);
      setLineageData(lineage);
      return lineage;
    } catch (error) {
      console.error("Failed to load lineage:", error);
      return [];
    }
  }, [selectedTabId]);

  const getLineageForStep = useCallback(
    (stepId: string): StepLineage | undefined => {
      return lineageData.find((l) => l.stepId === stepId);
    },
    [lineageData],
  );

  const getLineageForColumn = useCallback(
    (columnName: string): StepLineage[] => {
      return lineageData.filter(
        (l) =>
          l.inputSchema.some((c) => c.name === columnName) ||
          l.outputSchema.some((c) => c.name === columnName),
      );
    },
    [lineageData],
  );

  return {
    isLineageMode,
    setIsLineageMode,
    lineageData,
    trackLineage,
    saveLineage,
    loadLineage,
    getLineageForStep,
    getLineageForColumn,
  };
}
