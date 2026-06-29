import React, { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HelpMarkdown } from "@/components/help/HelpMarkdown";
import { X, Search, ArrowUp, ArrowDown } from "lucide-react";

interface HelpDialogProps {
  isOpen: boolean;
  onClose: () => void;
  commandName: string;
  content: string;
}

export const HelpDialog: React.FC<HelpDialogProps> = ({
  isOpen,
  onClose,
  commandName,
  content,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // 转义正则表达式特殊字符
  const escapeRegExp = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  // 查找所有匹配项
  const matches = useMemo(() => {
    if (!searchQuery.trim() || !content) {
      return [];
    }

    const escapedQuery = escapeRegExp(searchQuery);
    const regex = new RegExp(escapedQuery, "gi");
    const matchPositions: number[] = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      matchPositions.push(match.index);
    }

    return matchPositions;
  }, [searchQuery, content]);

  // 更新匹配计数
  useEffect(() => {
    setMatchCount(matches.length);
    if (matches.length > 0 && currentMatchIndex >= matches.length) {
      setCurrentMatchIndex(0);
    }
  }, [matches, currentMatchIndex]);

  // 处理键盘快捷键
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F 打开搜索
      if (e.ctrlKey && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // ArrowDown 查找下一个
      if (e.key === "ArrowDown" && document.activeElement === searchInputRef.current) {
        e.preventDefault();
        if (matches.length > 0) {
          setCurrentMatchIndex((prev) => (prev + 1) % matches.length);
        }
      }
      // ArrowUp 查找上一个
      if (e.key === "ArrowUp" && document.activeElement === searchInputRef.current) {
        e.preventDefault();
        if (matches.length > 0) {
          setCurrentMatchIndex((prev) => (prev - 1 + matches.length) % matches.length);
        }
      }
      // Escape 关闭搜索或对话框
      if (e.key === "Escape") {
        if (searchQuery) {
          setSearchQuery("");
        } else {
          onClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, matches, searchQuery, onClose]);

  // 跳转到当前匹配项
  useEffect(() => {
    if (matches.length === 0 || !scrollAreaRef.current) return;

    const currentMatchPosition = matches[currentMatchIndex];
    const scrollArea = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]");

    if (scrollArea) {
      // 计算大致的滚动位置(简单实现)
      const totalLength = content.length;
      const scrollRatio = currentMatchPosition / totalLength;
      const maxScroll = scrollArea.scrollHeight - scrollArea.clientHeight;
      scrollArea.scrollTop = scrollRatio * maxScroll;
    }
  }, [currentMatchIndex, matches, content]);

  const handleNextMatch = () => {
    if (matches.length > 0) {
      setCurrentMatchIndex((prev) => (prev + 1) % matches.length);
    }
  };

  const handlePreviousMatch = () => {
    if (matches.length > 0) {
      setCurrentMatchIndex((prev) => (prev - 1 + matches.length) % matches.length);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-foreground/20 backdrop-blur-xs flex items-center justify-center z-50">
      <div className="bg-card border rounded-lg shadow-xl p-4 w-full max-w-5xl h-[75vh] flex flex-col">
        {/* 标题栏和搜索栏合并 */}
        <div className="flex items-center flex-shrink-0">
          {/* 标题 */}
          <div className="flex-1 flex justify-start">
            <h3 className="text-lg font-semibold">{commandName}</h3>
          </div>

          {/* 搜索框 */}
          <div className="flex-1 flex justify-center items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Search (Ctrl+F)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8"
              />
            </div>
            {searchQuery && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground min-w-[60px]">
                  {matchCount > 0 ? `${currentMatchIndex + 1}/${matchCount}` : "0/0"}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={handlePreviousMatch}
                  disabled={matchCount === 0}
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={handleNextMatch}
                  disabled={matchCount === 0}
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          {/* 关闭按钮 */}
          <div className="flex-1 flex justify-end">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 内容区域 */}
        <ScrollArea ref={scrollAreaRef} className="flex-1 h-0">
          <div className="text-sm font-mono pr-2">
            <HelpMarkdown 
              content={content}
              searchQuery={searchQuery}
            />
          </div>
        </ScrollArea>

        {/* 底部提示 */}
        <div className="flex-shrink-0 pt-2 text-xs text-muted-foreground">
          <span className="mr-4">Ctrl+F: Search</span>
          <span className="mr-4">↑: Previous match</span>
          <span className="mr-4">↓: Next match</span>
          <span>Escape: Close</span>
        </div>
      </div>
    </div>
  );
};