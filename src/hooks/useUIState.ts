import { useCallback, useState } from "react";
import type { TabChartState } from "@/types/execution";

export function useUIState() {
  const [showHelp, setShowHelp] = useState(false);
  const [helpContent, setHelpContent] = useState("");
  const [helpCommandName, setHelpCommandName] = useState("");
  const [showLogPanel, setShowLogPanel] = useState(false);
  /**
   * Which tab the bottom dock shows (design 084). `logs` is always the first
   * tab; results follow as `result:<index>`. Kept as a string so a stale index
   * from a previous run can fall back instead of rendering an empty body.
   */
  const [bottomDockTab, setBottomDockTab] = useState<string>("logs");
  /**
   * A run finished with results while the user was reading logs: mark the
   * result tab instead of stealing the view (design 084).
   */
  const [resultsUnseen, setResultsUnseen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<
    "file" | "edit" | "view" | "tools" | "help" | null
  >(null);
  const [isMenuActivated, setIsMenuActivated] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showRefreshDialog, setShowRefreshDialog] = useState(false);
  // Update check/install state lives in `useUpdater`; only dialog visibility is
  // pure UI state.
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showChartPanel, setShowChartPanel] = useState(false);
  /**
   * Chart of each tab. Charts belong to the tab that produced
   * them, so a second tab running a `chart` branch cannot replace the first.
   */
  const [chartsByTab, setChartsByTab] = useState<Record<string, TabChartState>>(
    {},
  );
  const setTabChart = useCallback(
    (tabId: string, chart: TabChartState | null) => {
      setChartsByTab((prev) => {
        if (!chart) {
          if (!(tabId in prev)) return prev;
          const next = { ...prev };
          delete next[tabId];
          return next;
        }
        return { ...prev, [tabId]: chart };
      });
    },
    [],
  );
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showCsvDiff, setShowCsvDiff] = useState(false);
  const [csvDiffInitialFileA, setCsvDiffInitialFileA] = useState<
    string | undefined
  >(undefined);
  const [showCsvEncoding, setShowCsvEncoding] = useState(false);
  const [csvEncodingInitialInput, setCsvEncodingInitialInput] = useState<
    string | undefined
  >(undefined);
  const [showSeparateCsv, setShowSeparateCsv] = useState(false);
  const [separateCsvInitialInput, setSeparateCsvInitialInput] = useState<
    string | undefined
  >(undefined);
  const [showCleanChars, setShowCleanChars] = useState(false);
  const [cleanCharsInitialInput, setCleanCharsInitialInput] = useState<
    string | undefined
  >(undefined);
  const [showSplitLines, setShowSplitLines] = useState(false);
  const [splitLinesInitialInput, setSplitLinesInitialInput] = useState<
    string | undefined
  >(undefined);
  const [showMergeExcel, setShowMergeExcel] = useState(false);
  const [mergeExcelInitialInput, setMergeExcelInitialInput] = useState<
    string | undefined
  >(undefined);
  const [showEnumerateByGroup, setShowEnumerateByGroup] = useState(false);
  const [enumerateByGroupInitialInput, setEnumerateByGroupInitialInput] =
    useState<string | undefined>(undefined);
  const [showCsvToExcel, setShowCsvToExcel] = useState(false);
  const [csvToExcelInitialInput, setCsvToExcelInitialInput] = useState<
    string | undefined
  >(undefined);

  return {
    showHelp,
    setShowHelp,
    helpContent,
    setHelpContent,
    helpCommandName,
    setHelpCommandName,
    showLogPanel,
    setShowLogPanel,
    bottomDockTab,
    setBottomDockTab,
    resultsUnseen,
    setResultsUnseen,
    activeMenu,
    setActiveMenu,
    isMenuActivated,
    setIsMenuActivated,
    showSettingsDialog,
    setShowSettingsDialog,
    showUpdateDialog,
    setShowUpdateDialog,
    showRefreshDialog,
    setShowRefreshDialog,
    showAIPanel,
    setShowAIPanel,
    showChartPanel,
    setShowChartPanel,
    chartsByTab,
    setTabChart,
    showCommandPalette,
    setShowCommandPalette,
    showCsvDiff,
    setShowCsvDiff,
    csvDiffInitialFileA,
    setCsvDiffInitialFileA,
    showCsvEncoding,
    setShowCsvEncoding,
    csvEncodingInitialInput,
    setCsvEncodingInitialInput,
    showSeparateCsv,
    setShowSeparateCsv,
    separateCsvInitialInput,
    setSeparateCsvInitialInput,
    showCleanChars,
    setShowCleanChars,
    cleanCharsInitialInput,
    setCleanCharsInitialInput,
    showSplitLines,
    setShowSplitLines,
    splitLinesInitialInput,
    setSplitLinesInitialInput,
    showMergeExcel,
    setShowMergeExcel,
    mergeExcelInitialInput,
    setMergeExcelInitialInput,
    showEnumerateByGroup,
    setShowEnumerateByGroup,
    enumerateByGroupInitialInput,
    setEnumerateByGroupInitialInput,
    showCsvToExcel,
    setShowCsvToExcel,
    csvToExcelInitialInput,
    setCsvToExcelInitialInput,
  };
}
