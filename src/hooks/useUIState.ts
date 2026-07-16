import { useState } from "react";

export function useUIState() {
  const [showHelp, setShowHelp] = useState(false);
  const [helpContent, setHelpContent] = useState("");
  const [helpCommandName, setHelpCommandName] = useState("");
  const [showLogPanel, setShowLogPanel] = useState(false);
  const [showCommandPanel, setShowCommandPanel] = useState(false);
  const [activeLeftPanel, setActiveLeftPanel] = useState<
    "commands" | "history"
  >("commands");
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
    activeLeftPanel,
    setActiveLeftPanel,
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
  };
}
