import { helpContentCn } from "./HelpContentCn";
import type { EffectiveLanguage } from "@/i18n/translations";

export const getHelpContent = (lang: EffectiveLanguage) =>
  lang === "zh" ? helpContentCn : helpContentEn;

export const helpContentEn = `
### Getting started in 5 minutes

1. **Open data** — drag a file onto the window, or press \`Ctrl\` + \`O\`. Nothing to hand yet? Click **See an example** on the welcome screen for sample data plus a pipeline that already runs.
2. **Add your first operation** — press \`Alt\` + \`C\` for the command panel and click any command to add it; or press \`Alt\` + \`A\` and describe what you need in one sentence.
3. **Pipelines and branches** — a new step **becomes its own branch** and applies straight to the input, so it **runs without being connected**. To chain two steps, **right-press on an operation node** and drag onto the target node (the connection must start on an operation node — the input node cannot be a source).
4. **Run and read the result** — press \`Ctrl\` + \`R\`. The log panel opens automatically when a run starts and holds every step's output; when it finishes a toast appears at the top with a "View result" button.
5. **Save and export** — \`Ctrl\` + \`S\` saves as a script, \`Ctrl\` + \`E\` exports the workflow; use a \`to\` or \`output\` step to write results to disk.

---

### Mouse Operations
1. **Box Select**: Left-click and drag to select nodes
2. **Move View**: Left-click + Space, or hold the middle mouse button and drag to pan the view
3. **Connect Nodes**: Right-click on a node and drag to another node to create a connection
4. **Delete**: Right-click on an empty area and drag across a connection or node to delete it
5. **Zoom**: Scroll the mouse wheel to zoom in/out on the canvas

---

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| \`Ctrl\` + \`K\` | Command Palette |
| \`Ctrl\` + \`O\` | Open |
| \`Ctrl\` + \`N\` | Open New Tab |
| \`Ctrl\` + \`S\` | Save as script |
| \`Ctrl\` + \`I\` | Import workflow |
| \`Ctrl\` + \`E\` | Export workflow |
| \`Ctrl\` + \`Z\` | Undo |
| \`Ctrl\` + \`Y\` | Redo |
| \`Ctrl\` + \`R\` | Execute |
| \`Ctrl\` + \`T\` | Templates |
| \`Alt\` + \`C\` | Command |
| \`Alt\` + \`Q\` | Logs |
| \`Alt\` + \`A\` | AI Assistant |
| \`F5\` | Refresh |
| \`W\`/\`A\`/\`S\`/\`D\` or \`↑\`/\`↓\`/\`←\`/\`→\` | Pan canvas (hold \`Shift\` to speed up) |
`;
