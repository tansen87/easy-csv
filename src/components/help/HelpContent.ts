import { helpContentCn } from "./HelpContentCn";

export const getHelpContent = (lang: "en" | "zh") => lang === "zh" ? helpContentCn : helpContentEn;

export const helpContentEn = `
## Easy CSV - CSV Processing Tool
> Handle CSV data in a modular way (chain operations together like building blocks using xan)

---

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| \`Ctrl\` + \`O\` | Open |
| \`Ctrl\` + \`N\` | Open New Tab |
| \`Ctrl\` + \`S\` | Save pipeline |
| \`Ctrl\` + \`I\` | Import workflow |
| \`Ctrl\` + \`E\` | Export workflow |
| \`Ctrl\` + \`Z\` | Undo |
| \`Ctrl\` + \`Y\` | Redo |
| \`Ctrl\` + \`R\` | Execute |
| \`Shift\` + \`H\` | Show help |
| \`Shift\` + \`C\` | Check for updates |
| \`Shift\` + \`S\` | Open settings |
| \`F5\` | Refresh |

---

### Main Menu
- **File**
   - Open: Open a CSV file for processing
   - Open New Tab: Open a CSV file in a new tab
   - Save Pipeline: Save the current pipeline to a file
   - Import Workflow: Import a workflow from a file
   - Export Workflow: Export the current workflow to a file
- **Undo**: Undo the last action
- **Redo**: Redo the last action
- **Execute**: Execute the current pipeline
- **Help**: Show this help content
- **Check Update**: Check for application updates
- **Settings**: Open application settings

---

### Basic Operations
1. **Add Commands**: Click on commands in the left panel to add them to the pipeline
2. **Configure Steps**: Click on a setting icon in the pipeline to configure its parameters
3. **Connect Steps**: Drag lines to connect steps in the pipeline
4. **Execute**: Click the "Run" button to execute the pipeline

---

### Log Panel
View execution logs and debug information by clicking the log icon in the bottom-left corner.

---

### Settings
- **Default delimiter**: Configure default CSV delimiter
- **No headers**: Toggle header detection
`;
