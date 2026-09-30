import {
  PipelineEdge,
  PipelineTemplate,
  StoredPipelineStep,
} from "@/types/xan";
import type { Translations } from "@/i18n/translations/types";

/**
 * Built-in pipeline templates (design 027 §4.1).
 *
 * These ship with the app so the template library is never an empty list for a
 * new user, and so the empty-state "see an example" card has a target that
 * needs no file of the user's own.
 *
 * Every template here was **verified against the real `xan` binary** — a
 * template that fails the first time it is run is worse than no template. The
 * column-agnostic ones use xan's 0-based column indices (`0` = first column) so
 * they work on whatever file the user has open.
 *
 * Names, descriptions and step aliases are resolved from `t` at build time
 * rather than hard-coded, so the library is bilingual like the rest of the UI.
 *
 * `created` / `updated` are static on purpose: built-ins must be identical
 * across runs, otherwise the template list would reorder itself.
 */

/** Ids of built-ins are prefixed so the UI can tell them from user templates. */
export const BUILTIN_TEMPLATE_PREFIX = "builtin:";

/** Stand-in for the sample CSV path, filled in when the demo is applied. */
export const SAMPLE_INPUT_PLACEHOLDER = "{{easy-csv-sample}}";

/** The one template the empty-state "see an example" card opens. */
export const BUILTIN_DEMO_ID = `${BUILTIN_TEMPLATE_PREFIX}demo-sales`;

const BUILTIN_TIMESTAMP = "2026-09-30 00:00:00";

export function isBuiltinTemplate(id: string): boolean {
  return id.startsWith(BUILTIN_TEMPLATE_PREFIX);
}

/** The subset of translations the built-in templates need. */
export type BuiltinTemplateLabels = Pick<
  Translations,
  | "builtinTplDemoName"
  | "builtinTplDemoDesc"
  | "builtinTplCleanName"
  | "builtinTplCleanDesc"
  | "builtinTplProfileName"
  | "builtinTplProfileDesc"
  | "builtinTplGroupName"
  | "builtinTplGroupDesc"
  | "builtinTplTopName"
  | "builtinTplTopDesc"
  | "builtinStepSearchAmount"
  | "builtinStepDedup"
  | "builtinStepGroupByRegion"
  | "onboardingDemoRevealAction1"
  | "onboardingDemoRevealAction2"
  | "onboardingDemoRevealAction3"
>;

function step(
  id: string,
  commandId: string,
  parameters: Record<string, unknown> = {},
  alias?: string,
): StoredPipelineStep {
  return { id, commandId, parameters, alias };
}

/** Linear chain edges; optionally rooted at the input `table-node`. */
function chainEdges(
  steps: StoredPipelineStep[],
  fromTableNode = false,
): PipelineEdge[] {
  const edges: PipelineEdge[] = [];
  if (fromTableNode && steps.length > 0) {
    edges.push({
      id: `e-table-node-${steps[0].id}`,
      source: "table-node",
      target: steps[0].id,
    });
  }
  for (let i = 1; i < steps.length; i++) {
    edges.push({
      id: `e-${steps[i - 1].id}-${steps[i].id}`,
      source: steps[i - 1].id,
      target: steps[i].id,
    });
  }
  return edges;
}

function template(
  id: string,
  name: string,
  description: string,
  steps: StoredPipelineStep[],
  options: {
    fromTableNode?: boolean;
    inputFile?: string;
    /** Only set for templates that ship their own data (see below). */
    defaultDelimiter?: string;
  } = {},
): PipelineTemplate {
  return {
    id: `${BUILTIN_TEMPLATE_PREFIX}${id}`,
    name,
    description,
    created: BUILTIN_TIMESTAMP,
    updated: BUILTIN_TIMESTAMP,
    snapshot: {
      id: `builtin-snapshot-${id}`,
      name,
      created: BUILTIN_TIMESTAMP,
      updated: BUILTIN_TIMESTAMP,
      inputFile: options.inputFile,
      defaultDelimiter: options.defaultDelimiter,
      pipeline: steps,
      edges: chainEdges(steps, options.fromTableNode),
    },
  };
}

/**
 * The demo pipeline: ① drop empty amounts ② dedup ③ total by region.
 *
 * Deliberately contains **no export step** (`to` / `output`): the demo is
 * executed once automatically when it is opened (design 027 §4.1), and an
 * export step would write a file to the user's disk as a side effect. Exporting
 * is taught in the help centre instead, where the user triggers it themselves.
 *
 * Also note the expression uses `col("金额")`: a bare CJK column name is not a
 * valid Moonblade identifier (`xan groupby 地区 'sum(金额)'` fails to parse), and
 * a quoted `"金额"` is parsed as a *string literal*, not a column reference.
 */
function demoSteps(t: BuiltinTemplateLabels): StoredPipelineStep[] {
  return [
    step(
      "builtin-demo-1-search",
      "search",
      { select: "金额", "non-empty": true },
      t.builtinStepSearchAmount,
    ),
    step("builtin-demo-2-dedup", "dedup", {}, t.builtinStepDedup),
    step(
      "builtin-demo-3-groupby",
      "groupby",
      { columns: "地区", expression: 'sum(col("金额")) as "金额合计"' },
      t.builtinStepGroupByRegion,
    ),
  ];
}

export function buildBuiltinTemplates(
  t: BuiltinTemplateLabels,
): PipelineTemplate[] {
  return [
    template(
      "demo-sales",
      t.builtinTplDemoName,
      t.builtinTplDemoDesc,
      demoSteps(t),
      {
        fromTableNode: true,
        inputFile: SAMPLE_INPUT_PLACEHOLDER,
        // The demo owns its data, so it can pin the delimiter its own CSV was
        // written with. Without this, any run that happens before the file has
        // been read falls back to the *global* default delimiter; if that is
        // not a comma the whole header row parses as one field and every step
        // fails with "… does not exist as a named header in the given CSV
        // data" (2026-09-30, reproduced against xan).
        defaultDelimiter: ",",
      },
    ),
    template("quick-clean", t.builtinTplCleanName, t.builtinTplCleanDesc, [
      step("builtin-clean-1", "search", { "non-empty": true }),
      step("builtin-clean-2", "dedup", {}),
    ], { fromTableNode: true }),
    template("profile", t.builtinTplProfileName, t.builtinTplProfileDesc, [
      step("builtin-profile-1", "headers", {}),
      step("builtin-profile-2", "stats", {}),
    ], { fromTableNode: true }),
    template("group-summary", t.builtinTplGroupName, t.builtinTplGroupDesc, [
      step("builtin-group-1", "groupby", {
        columns: "0",
        expression: 'count() as "行数"',
      }),
    ], { fromTableNode: true }),
    template("sort-and-top", t.builtinTplTopName, t.builtinTplTopDesc, [
      step("builtin-top-1", "sort", { select: "0" }),
      step("builtin-top-2", "head", { limit: 100 }),
    ], { fromTableNode: true }),
  ];
}

export function getBuiltinDemoTemplate(
  t: BuiltinTemplateLabels,
): PipelineTemplate {
  const found = buildBuiltinTemplates(t).find(
    (tpl) => tpl.id === BUILTIN_DEMO_ID,
  );
  // The list is built from a constant, so this can only fail if someone edits
  // ids without updating BUILTIN_DEMO_ID — fail loudly rather than open an
  // empty tab.
  if (!found) {
    throw new Error(`Built-in demo template ${BUILTIN_DEMO_ID} is missing`);
  }
  return found;
}

/**
 * Whether applying this template still needs the sample data to be written —
 * i.e. its `inputFile` is the un-substituted placeholder.
 *
 * Keyed on the placeholder rather than on `BUILTIN_DEMO_ID` on purpose: a user
 * who does "copy to my templates" on the demo gets a copy that keeps the
 * placeholder, and that copy must take the same loader path or it would be
 * applied with a literal `{{easy-csv-sample}}` file name.
 */
export function needsSampleData(tpl: PipelineTemplate): boolean {
  return tpl.snapshot.inputFile?.includes(SAMPLE_INPUT_PLACEHOLDER) ?? false;
}

/**
 * Captions for the demo's step-by-step reveal, in pipeline order.
 *
 * Each one names the action that produced the step, because the point of the
 * reveal is to teach *how* a step gets added — a finished three-node pipeline
 * appearing at once teaches nothing (design 027 §11.2). Kept next to the demo's
 * steps so the two cannot drift apart in order or count.
 */
export function demoRevealCaptions(t: BuiltinTemplateLabels): string[] {
  return [
    t.onboardingDemoRevealAction1,
    t.onboardingDemoRevealAction2,
    t.onboardingDemoRevealAction3,
  ];
}

/**
 * Point a template snapshot's input file at a concrete path, replacing
 * `SAMPLE_INPUT_PLACEHOLDER`. Pure, so it is unit-testable without Tauri.
 */
export function resolveBuiltinSnapshot(
  tpl: PipelineTemplate,
  samplePath: string,
): PipelineTemplate["snapshot"] {
  const { snapshot } = tpl;
  if (!snapshot.inputFile) {
    return snapshot;
  }
  return {
    ...snapshot,
    inputFile: snapshot.inputFile.replace(SAMPLE_INPUT_PLACEHOLDER, samplePath),
  };
}
