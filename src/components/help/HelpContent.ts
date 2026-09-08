import { helpContentCn } from "./HelpContentCn";

export const getHelpContent = (lang: "en" | "zh") => lang === "zh" ? helpContentCn : helpContentEn;

export const helpContentEn = `
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
| \`Shift\` + \`H\` | Show help |
| \`Shift\` + \`C\` | Check for updates |
| \`Shift\` + \`S\` | Open settings |
| \`Alt\` + \`C\` | Command |
| \`Alt\` + \`Q\` | Logs |
| \`Alt\` + \`A\` | AI Assistant |
| \`F5\` | Refresh |
`;
