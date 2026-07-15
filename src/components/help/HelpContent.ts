import { helpContentCn } from "./HelpContentCn";

export const getHelpContent = (lang: "en" | "zh") => lang === "zh" ? helpContentCn : helpContentEn;

export const helpContentEn = `
### Basic Operations
1. **Add Commands**: Click the command button in the menu bar to expand the command dialog, then click any command to add it to the canvas
2. **Set Parameters**: Click the settings icon in a command to set or modify its parameters
3. **Connect Steps**: Right-click on a node and drag to another node to create a connection
4. **Move View**: Left-click and drag on the canvas to pan the view
5. **Delete Connection**: Right-click on an empty area and drag across a connection line to delete it
6. **Zoom**: Scroll the mouse wheel to zoom in/out on the canvas
7. **Execute**: Click the "Execute" button to execute the pipeline

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
| \`Shift\` + \`h\` | Show help |
| \`Shift\` + \`c\` | Check for updates |
| \`Shift\` + \`s\` | Open settings |
| \`Alt\` + \`C\` | Commands |
| \`Alt\` + \`Q\` | Logs |
| \`Alt\` + \`D\` | Data Profile |
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

### Log Panel
View execution logs and debug information by clicking the log icon in the bottom-left corner.

---

### Settings
- **Default delimiter**: Configure default CSV delimiter
- **No headers**: Toggle header detection
`;
