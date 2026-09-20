// Line-based annotator for design 019 headings — the file uses CRLF, so a
// `heading + "\n"` needle never matches.
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "docs/design/019_frontend-structure-refactor.md";

const STATUS = {
  "### 3.1 第一步": "✅ 已实施",
  "### 3.2 第二步": "✅ 已实施",
  "### 3.3 第三步": "✅ 已实施",
  "### 3.4 第四步": "✅ 已实施",
  "### 3.5 `dialog/` 重构后的预期指标": "🔶 部分达成",
  "### 4.1 拆分优先级": "🔶 部分实施(2.4 / 2.7)",
  "### 4.2 `MainMenuHooks.ts`": "⬜ 未实施",
  "### 4.3 `FlowPanel.tsx`": "⬜ 未实施",
  "### 4.4 `App.tsx`": "⬜ 未实施",
  "### 4.5 `data/commands.ts`": "✅ 已实施",
  "### 4.6 `i18n/translations.ts`": "✅ 已实施",
  "### 4.7 `ChartPanel.tsx`": "⬜ 未实施",
  "### 5.1 命名收敛": "🔶 部分实施",
  "### 5.2 依赖方向规则": "🔶 已固化(部分 warn)",
  "### 5.3 单文件行数约束": "🔶 已固化(warn)",
  "### 1.6 `docs/AI/INDEX.md` 登记漂移": "✅ 已修正",
};

const raw = readFileSync(FILE, "utf8");
const eol = raw.includes("\r\n") ? "\r\n" : "\n";
const lines = raw.split(/\r?\n/);

let hit = 0;
const out = lines.map((line) => {
  for (const [prefix, status] of Object.entries(STATUS)) {
    if (!line.startsWith(prefix)) continue;
    if (line.includes(status)) return line; // already annotated (idempotent)
    hit++;
    return `${line} —— ${status}`;
  }
  return line;
});

writeFileSync(FILE, out.join(eol));
console.log(`annotated ${hit} headings; file eol = ${eol === "\r\n" ? "CRLF" : "LF"}`);
