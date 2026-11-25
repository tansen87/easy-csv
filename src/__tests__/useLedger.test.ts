import { describe, expect, it } from "vitest";

import {
  applyPipelineSaved,
  applyRun,
  applyTemplateApplied,
  createEmptyLedger,
  lastWeekActivity,
  localDateKey,
  weeklyRows,
  type LedgerRunRecord,
  type LedgerState,
} from "@/hooks/useLedger";

function run(overrides: Partial<LedgerRunRecord> = {}): LedgerRunRecord {
  return {
    runId: "run-1",
    tabId: "tab-1",
    rows: 1_000,
    ms: 2_100,
    steps: 3,
    commands: ["search", "trim"],
    files: ["out.csv"],
    ...overrides,
  };
}

describe("ledger", () => {
  it("accumulates totals and unlocks the 10k mark once", () => {
    const first = applyRun(createEmptyLedger(), run({ rows: 6_000 }));
    expect(first.state.totals).toMatchObject({
      rows: 6_000,
      runs: 1,
      files: 1,
      ms: 2_100,
    });
    expect(first.unlocked).toContain("first-run");
    expect(first.unlocked).not.toContain("rows-10k");

    const second = applyRun(
      first.state,
      run({ runId: "run-2", rows: 6_000 }),
    );
    expect(second.state.totals.rows).toBe(12_000);
    expect(second.state.milestones["rows-10k"]).toBeTruthy();
    expect(second.unlocked).toContain("rows-10k");

    // Crossed already: never again.
    const third = applyRun(
      second.state,
      run({ runId: "run-3", rows: 500_000 }),
    );
    expect(third.unlocked).not.toContain("rows-10k");
    expect(third.unlocked).toContain("rows-100k");
  });

  it("ignores a replayed runId", () => {
    const first = applyRun(createEmptyLedger(), run());
    const again = applyRun(first.state, run());
    expect(again.state).toBe(first.state);
    expect(again.unlocked).toEqual([]);
  });

  it("does nothing while the ledger is disabled", () => {
    const disabled: LedgerState = { ...createEmptyLedger(), enabled: false };
    const result = applyRun(disabled, run());
    expect(result.state).toBe(disabled);
    expect(result.unlocked).toEqual([]);
    expect(applyPipelineSaved(disabled).state).toBe(disabled);
    expect(applyTemplateApplied(disabled).state).toBe(disabled);
  });

  it("counts distinct commands and unlocks the tenth", () => {
    const nine = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
    const first = applyRun(createEmptyLedger(), run({ commands: nine }));
    expect(first.state.commands).toHaveLength(9);
    expect(first.unlocked).not.toContain("commands-10");

    const second = applyRun(
      first.state,
      run({ runId: "run-2", commands: ["a", "j"] }),
    );
    expect(second.state.commands).toHaveLength(10);
    expect(second.unlocked).toContain("commands-10");
  });

  it("unlocks the pipeline marks on saves and the template mark on apply", () => {
    let state = createEmptyLedger();
    const first = applyPipelineSaved(state);
    state = first.state;
    expect(first.unlocked).toContain("pipeline-1");

    const template = applyTemplateApplied(state);
    state = template.state;
    expect(template.unlocked).toContain("template-first");
    // Applying again is silent.
    expect(applyTemplateApplied(state).unlocked).toEqual([]);
  });

  it("unlocks run-from-step on its own event", () => {
    const result = applyRun(createEmptyLedger(), run({ via: "step-run" }));
    expect(result.unlocked).toContain("step-run-first");
  });

  it("buckets rows today and builds eight weekly buckets", () => {
    const { state } = applyRun(createEmptyLedger(), run({ rows: 4_200 }));
    const key = localDateKey(new Date());
    expect(state.days[key]).toEqual({ rows: 4_200, runs: 1 });

    const weeks = weeklyRows(state.days);
    expect(weeks).toHaveLength(8);
    expect(weeks[7]).toBe(4_200);

    const activity = lastWeekActivity(state.days);
    expect(activity).toHaveLength(7);
    expect(activity[6]).toBe(true);
  });

  it("keeps only the recent 90 day buckets", () => {
    const days: LedgerState["days"] = {};
    const today = new Date();
    for (let index = 0; index < 120; index += 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - index);
      days[localDateKey(date)] = { rows: 1, runs: 1 };
    }
    const result = applyRun({ ...createEmptyLedger(), days }, run());
    expect(Object.keys(result.state.days).length).toBe(90);
  });
});
