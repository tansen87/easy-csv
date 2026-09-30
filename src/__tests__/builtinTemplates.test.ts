import { describe, it, expect } from "vitest";
import {
  BUILTIN_DEMO_ID,
  BUILTIN_TEMPLATE_PREFIX,
  SAMPLE_INPUT_PLACEHOLDER,
  buildBuiltinTemplates,
  demoRevealCaptions,
  getBuiltinDemoTemplate,
  isBuiltinTemplate,
  needsSampleData,
  resolveBuiltinSnapshot,
} from "@/data/templates/builtin";
import { xanCommands } from "@/data/commands";
import { translations } from "@/i18n/translations";
import { deserializeTabSnapshot } from "@/utils/session";

const t = translations.zh;
const templates = buildBuiltinTemplates(t);

describe("built-in templates (design 027 §4.1)", () => {
  it("uses unique, prefixed ids so the UI can tell them from user templates", () => {
    const ids = templates.map((tpl) => tpl.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(isBuiltinTemplate(id)).toBe(true);
      expect(id.startsWith(BUILTIN_TEMPLATE_PREFIX)).toBe(true);
    }
    expect(isBuiltinTemplate("tpl-1234")).toBe(false);
  });

  // A built-in that references a command id which no longer exists would open an
  // empty tab: `reconstructStep` silently drops unknown commands.
  it("only references commands that exist", () => {
    const knownIds = new Set(xanCommands.map((cmd) => cmd.id));
    for (const tpl of templates) {
      for (const step of tpl.snapshot.pipeline) {
        expect(knownIds.has(step.commandId)).toBe(true);
      }
    }
  });

  /**
   * The app refuses to run a step whose `required` parameters are empty
   * (`useExecution.ts`). Every built-in must be runnable as-is, so this is the
   * structural half of "verified against the real xan binary".
   */
  it("satisfies every required parameter of every command it uses", () => {
    for (const tpl of templates) {
      for (const step of tpl.snapshot.pipeline) {
        const command = xanCommands.find((cmd) => cmd.id === step.commandId);
        expect(command).toBeDefined();
        for (const param of command!.parameters) {
          if (!param.required) continue;
          const value = step.parameters[param.name];
          expect(
            value !== undefined && value !== "",
            `${tpl.id} / ${step.commandId}: required param "${param.name}" is empty`,
          ).toBe(true);
        }
      }
    }
  });

  it("round-trips through the session snapshot serializer", () => {
    for (const tpl of templates) {
      const tab = deserializeTabSnapshot(tpl.snapshot);
      expect(tab).not.toBeNull();
      expect(tab!.pipeline).toHaveLength(tpl.snapshot.pipeline.length);
      expect(tab!.edges).toHaveLength(tpl.snapshot.edges.length);
    }
  });

  it("wires each template's steps into a connected chain from the input node", () => {
    for (const tpl of templates) {
      const { pipeline, edges } = tpl.snapshot;
      // One edge in from the input node, then one between each consecutive pair.
      expect(edges).toHaveLength(pipeline.length);
      expect(edges[0].source).toBe("table-node");
      expect(edges[0].target).toBe(pipeline[0].id);
      for (let i = 1; i < pipeline.length; i++) {
        expect(edges[i].source).toBe(pipeline[i - 1].id);
        expect(edges[i].target).toBe(pipeline[i].id);
      }
    }
  });
});

describe("the demo template", () => {
  it("is the one the empty-state card opens", () => {
    const demo = getBuiltinDemoTemplate(t);
    expect(demo.id).toBe(BUILTIN_DEMO_ID);
    expect(templates.map((tpl) => tpl.id)).toContain(demo.id);
  });

  /**
   * The demo runs itself once when opened. An export step would therefore write
   * a file to the user's disk without them asking — the reason the pipeline
   * stops at "group and total".
   */
  it("has no export step, because it is executed automatically", () => {
    const demo = getBuiltinDemoTemplate(t);
    const commandIds = demo.snapshot.pipeline.map((step) => step.commandId);
    expect(commandIds).not.toContain("to");
    expect(commandIds).not.toContain("output");
    expect(commandIds).toEqual(["search", "dedup", "groupby"]);
  });

  // These exact values were run against the real xan binary. In particular a
  // bare CJK column name inside an expression is not a valid Moonblade
  // identifier, and `"金额"` on its own parses as a string literal — only
  // `col("金额")` refers to the column.
  it("uses the parameter values that were verified against xan", () => {
    const demo = getBuiltinDemoTemplate(t);
    const [search, dedup, groupby] = demo.snapshot.pipeline;

    expect(search.parameters).toMatchObject({ select: "金额", "non-empty": true });
    expect(dedup.parameters).toEqual({});
    expect(groupby.parameters).toEqual({
      columns: "地区",
      expression: 'sum(col("金额")) as "金额合计"',
    });
  });

  it("points its input file at the placeholder until the sample is written", () => {
    const demo = getBuiltinDemoTemplate(t);
    expect(demo.snapshot.inputFile).toBe(SAMPLE_INPUT_PLACEHOLDER);
  });

  /**
   * The demo owns its data, so it pins the delimiter that data was written
   * with. Any run that happens before the file has been read resolves the
   * delimiter from the global setting instead; if that is not a comma the whole
   * header row parses as a single field and every step fails with
   * "… does not exist as a named header in the given CSV data" — which is
   * exactly what happened on 2026-09-30 when the demo auto-ran too early.
   */
  it("pins the delimiter of its own sample data", () => {
    const demo = getBuiltinDemoTemplate(t);
    expect(demo.snapshot.defaultDelimiter).toBe(",");
  });

  // Templates that run on the user's own file must NOT pin a delimiter: the
  // tab's detected one is the only correct choice there.
  it("leaves the delimiter unset for templates that run on the user's file", () => {
    for (const tpl of templates) {
      if (tpl.id === BUILTIN_DEMO_ID) continue;
      expect(tpl.snapshot.defaultDelimiter).toBeUndefined();
    }
  });

  /**
   * The reveal hands out one caption per step, in order, so a caption count
   * that drifts from the step count would either leave a step unexplained or
   * show a caption for a step that never appeared.
   */
  it("has exactly one reveal caption per demo step, in order", () => {
    const demo = getBuiltinDemoTemplate(t);
    const captions = demoRevealCaptions(t);
    expect(captions).toHaveLength(demo.snapshot.pipeline.length);
    for (const caption of captions) {
      expect(caption.trim().length).toBeGreaterThan(0);
    }
    // Each caption names the command that the matching step runs, so the user
    // is told *how* the step was added rather than just seeing it appear.
    demo.snapshot.pipeline.forEach((step, index) => {
      expect(captions[index]).toContain(step.commandId);
    });
  });
});

describe("resolveBuiltinSnapshot", () => {
  it("substitutes the sample path", () => {
    const demo = getBuiltinDemoTemplate(t);
    const snapshot = resolveBuiltinSnapshot(demo, "/data/sample.csv");
    expect(snapshot.inputFile).toBe("/data/sample.csv");
    // The original template must stay untouched (it is a module constant).
    expect(demo.snapshot.inputFile).toBe(SAMPLE_INPUT_PLACEHOLDER);
  });

  it("returns snapshots without an input file unchanged", () => {
    const clean = templates.find((tpl) => tpl.id === "builtin:quick-clean")!;
    expect(resolveBuiltinSnapshot(clean, "/data/sample.csv")).toBe(
      clean.snapshot,
    );
  });

  // Applying the demo (from the card *or* the template dialog) must go through
  // the sample loader, which is keyed on the un-substituted placeholder — so a
  // user's own copy of the demo is covered too.
  it("detects which templates still need the sample written", () => {
    const demo = getBuiltinDemoTemplate(t);
    expect(needsSampleData(demo)).toBe(true);
    expect(needsSampleData({ ...demo, id: "tpl-user-copy" })).toBe(true);
    expect(
      needsSampleData(templates.find((tpl) => tpl.id === "builtin:quick-clean")!),
    ).toBe(false);

    // Once substituted, the placeholder is gone and the normal path applies.
    const applied = { ...demo, snapshot: resolveBuiltinSnapshot(demo, "/s.csv") };
    expect(needsSampleData(applied)).toBe(false);
  });
});
