import { useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";

const FILE_DIALOG_FILTERS = [
  { name: "CSV", extensions: ["csv", "txt", "tsv"] },
  { name: "JSON", extensions: ["json", "jsonl"] },
  { name: "Excel", extensions: ["xlsx", "xls", "xlsm"] },
  { name: "Parquet", extensions: ["parquet"] },
  { name: "All", extensions: ["*"] },
];

interface UseFileOpenProps {
  selectedTabId: string;
  addNewTab: () => string;
  loadCsvData: (
    tabId: string,
    filePath: string,
    customDelimiter?: string,
  ) => Promise<void>;
}

/** Open a CSV/JSON/Excel/Parquet file into the current tab or a new tab. */
export function useFileOpen({
  selectedTabId,
  addNewTab,
  loadCsvData,
}: UseFileOpenProps) {
  const handleOpenFile = useCallback(async () => {
    const file = await open({
      multiple: false,
      filters: FILE_DIALOG_FILTERS,
    });

    if (file) {
      loadCsvData(selectedTabId, file);
    }
  }, [selectedTabId, loadCsvData]);

  const handleOpenNewTabWithFile = useCallback(async () => {
    const file = await open({
      multiple: false,
      filters: FILE_DIALOG_FILTERS,
    });

    if (file) {
      const newTabId = addNewTab();
      loadCsvData(newTabId, file);
    }
  }, [addNewTab, loadCsvData]);

  return { handleOpenFile, handleOpenNewTabWithFile };
}
