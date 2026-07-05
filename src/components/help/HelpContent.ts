export const helpContent = `
## Easy CSV - CSV Processing Tool
> Handle CSV data in a modular way (chain operations together like building blocks using xan)

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

### Basic Operations
1. **Add Commands**: Click on commands in the left panel to add them to the pipeline
2. **Configure Steps**: Click on a setting icon in the pipeline to configure its parameters
3. **Connect Steps**: Drag lines to connect steps in the pipeline
4. **Execute**: Click the "Run" button to execute the pipeline

### Log Panel
View execution logs and debug information by clicking the log icon in the bottom-right corner.

### Settings
Customize the application:
- **Theme**: Light or dark mode
- **Default delimiter**: Configure default CSV delimiter
- **No headers**: Toggle header detection
`;
