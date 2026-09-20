import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import type { Node } from "reactflow";
import type { PipelineStep } from "@/types/xan";

export interface CanvasSearchResult {
  step: PipelineStep | null;
  displayName: string;
  secondaryName: string | null;
  isTableNode?: boolean;
  resultId?: string;
}

interface UseCanvasSearchArgs {
  steps: PipelineStep[];
  resultPreview?: { id: string; label: string }[];
  nodes: Node[];
  reactFlowInstance: RefObject<any>;
}

/**
 * Canvas Ctrl+F search: query state, result matching (input node / result
 * preview nodes / pipeline steps) and jump-to-node with temporary highlight.
 */
export function useCanvasSearch({
  steps,
  resultPreview,
  nodes,
  reactFlowInstance,
}: UseCanvasSearchArgs) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(
    null,
  );
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Ctrl+F global shortcut (handled if HelpDialog is open)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block Ctrl+F regardless of case to avoid triggering browser search boxes
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "f") return;
      e.preventDefault();
      e.stopPropagation();
      // If the dialog box is open, do not open the search box
      // (handled if HelpDialog is open)
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog) return;
      setIsSearchOpen(true);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus and select search input when it opens
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.select();
    }
  }, [isSearchOpen]);

  // Search results: match command name or alias
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const results: CanvasSearchResult[] = [];

    // Search "Input Data" node (not its column names)
    if ("input data".includes(query) || "input".includes(query)) {
      results.push({
        step: null,
        displayName: "Input Data",
        secondaryName: null,
        isTableNode: true,
      });
    }

    // Search result preview nodes (F1)
    for (const r of resultPreview || []) {
      if (r.label.toLowerCase().includes(query)) {
        results.push({
          step: null,
          displayName: r.label,
          secondaryName: null,
          resultId: r.id,
        });
      }
    }

    // Search pipeline steps
    for (const step of steps) {
      const name = step.command.name.toLowerCase();
      const alias = step.alias?.toLowerCase() || "";
      if (name.includes(query) || alias.includes(query)) {
        results.push({
          step,
          displayName: step.alias || step.command.name,
          secondaryName: step.alias ? step.command.name : null,
        });
      }
    }

    return results;
  }, [searchQuery, steps, resultPreview]);

  // Click search result: jump to node and highlight
  const handleSearchResultClick = useCallback(
    (step: PipelineStep | null, isTable?: boolean, resultId?: string) => {
      const nodeId = resultId ? resultId : isTable ? "table-node" : step!.id;
      const node = nodes.find((n) => n.id === nodeId);
      if (!node || !reactFlowInstance.current) return;

      // Use setCenter to jump to node position (centered)
      const w =
        node.type === "tableNode" || node.type === "resultTableNode"
          ? 260
          : 110;
      const h =
        node.type === "tableNode" || node.type === "resultTableNode" ? 130 : 45;
      reactFlowInstance.current.setCenter(
        node.position.x + w,
        node.position.y + h,
        {
          zoom: Math.max(reactFlowInstance.current.getZoom(), 0.8),
          duration: 400,
        },
      );

      // Set highlighted node (trigger animation effect)
      setHighlightedNodeId(nodeId);
      setTimeout(() => setHighlightedNodeId(null), 1500);

      // Close search box
      setIsSearchOpen(false);
      setSearchQuery("");
    },
    [nodes, reactFlowInstance],
  );

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSearchQuery("");
  }, []);

  return {
    isSearchOpen,
    setIsSearchOpen,
    searchQuery,
    setSearchQuery,
    highlightedNodeId,
    searchInputRef,
    searchResults,
    handleSearchResultClick,
    closeSearch,
  };
}
