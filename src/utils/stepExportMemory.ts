/**
 * Last "导出此步结果" path per tab + step. Used by "从此步运行": the target
 * step's default input is the nearest upstream step's exported CSV, so a run
 * can continue from the middle of a pipeline without touching the tab's input.
 *
 * Storage failures (private mode, quota) degrade to "no memory": the caller
 * then asks once via the file picker.
 */
const KEY_PREFIX = "easy-csv-step-export:";

export function rememberStepExport(
  tabId: string,
  stepId: string,
  filePath: string,
): void {
  try {
    localStorage.setItem(`${KEY_PREFIX}${tabId}:${stepId}`, filePath);
  } catch {
    // Private mode / quota errors: keep the export, just without memory.
  }
}

export function readStepExport(
  tabId: string,
  stepId: string,
): string | null {
  try {
    return localStorage.getItem(`${KEY_PREFIX}${tabId}:${stepId}`);
  } catch {
    return null;
  }
}
