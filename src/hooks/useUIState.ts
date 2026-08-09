import { useState } from "react";
import { ChartConfig, ChartSeries } from "@/types/xan";

export function useUIState() {
  const [showHelp, setShowHelp] = useState(false);
  const [helpContent, setHelpContent] = useState("");
  const [helpCommandName, setHelpCommandName] = useState("");
  const [showLogPanel, setShowLogPanel] = useState(false);
  const [showCommandPanel, setShowCommandPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMenu, setActiveMenu] = useState<"file" | null>(null);
  const [isMenuActivated, setIsMenuActivated] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showProgressBar, setShowProgressBar] = useState(false);
  const [branchProgress, setBranchProgress] = useState<{
    current: number;
    total: number;
    name: string;
    status: "executing" | "completed" | "error";
  } | null>(null);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showDataProfile, setShowDataProfile] = useState(false);
  const [showRefreshDialog, setShowRefreshDialog] = useState(false);
  const [batchFilterDialog, setBatchFilterDialog] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [updateInfo, setUpdateInfo] = useState<{
    hasUpdate: boolean;
    latestVersion: string;
    changelog: string;
  } | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [showVersionPanel, setShowVersionPanel] = useState(false);
  const [showLineagePanel, setShowLineagePanel] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showChartPanel, setShowChartPanel] = useState(false);
  const [chartConfig, setChartConfig] = useState<ChartConfig | null>(null);
  const [chartSeries, setChartSeries] = useState<ChartSeries[]>([]);
  const [chartHeaders, setChartHeaders] = useState<string[]>([]);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showCsvDiff, setShowCsvDiff] = useState(false);
  const [csvDiffInitialFileA, setCsvDiffInitialFileA] = useState<
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
    showCommandPanel,
    setShowCommandPanel,
    searchQuery,
    setSearchQuery,
    activeMenu,
    setActiveMenu,
    isMenuActivated,
    setIsMenuActivated,
    showSettingsDialog,
    setShowSettingsDialog,
    showProgressBar,
    setShowProgressBar,
    branchProgress,
    setBranchProgress,
    showUpdateDialog,
    setShowUpdateDialog,
    showDataProfile,
    setShowDataProfile,
    showRefreshDialog,
    setShowRefreshDialog,
    batchFilterDialog,
    setBatchFilterDialog,
    updateInfo,
    setUpdateInfo,
    isCheckingUpdate,
    setIsCheckingUpdate,
    showVersionPanel,
    setShowVersionPanel,
    showLineagePanel,
    setShowLineagePanel,
    showAIPanel,
    setShowAIPanel,
    showChartPanel,
    setShowChartPanel,
    chartConfig,
    setChartConfig,
    chartSeries,
    setChartSeries,
    chartHeaders,
    setChartHeaders,
    showCommandPalette,
    setShowCommandPalette,
    showCsvDiff,
    setShowCsvDiff,
    csvDiffInitialFileA,
    setCsvDiffInitialFileA,
  };
}
