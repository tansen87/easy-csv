import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  X,
  Bot,
  User,
  Loader2,
  ChevronUp,
  ChevronDown,
  Copy,
  Check,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/i18n";
import { AIMessage, AIContext, TokenUsage } from "@/services/ai/types";
import { sendAIMessage, isAIConfigured } from "@/services/ai/index";
import { XanCommand } from "@/types/xan";
import { xanCommands } from "@/data/commands";

interface AIPanelProps {
  isVisible: boolean;
  onClose: () => void;
  context: AIContext;
  onAddCommand: (
    command: XanCommand,
    initialParameters?: Record<string, any>,
    alias?: string,
    autoConnect?: boolean,
  ) => void;
  onAddCommands?: (
    commands: { command: XanCommand; parameters?: Record<string, any> }[],
  ) => void;
}

export const AIPanel = React.memo(function AIPanel({
  isVisible,
  onClose,
  context,
  onAddCommand,
  onAddCommands,
}: AIPanelProps) {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [cumulativeUsage, setCumulativeUsage] = useState<TokenUsage>({
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  });
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const autoResizeTextarea = useCallback(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const scrollHeight = textarea.scrollHeight;
    textarea.style.height = Math.min(scrollHeight + 2, 96) + "px";
  }, []);

  useEffect(() => {
    autoResizeTextarea();
  }, [inputValue, autoResizeTextarea]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (isExpanded) {
      scrollToBottom();
    }
  }, [messages, isExpanded, scrollToBottom]);

  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isVisible]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: AIMessage = {
      role: "user",
      content: inputValue.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);
    setIsExpanded(true);

    try {
      const response = await sendAIMessage(userMessage.content, context);

      if (response.usage) {
        setCumulativeUsage((prev) => ({
          prompt_tokens: prev.prompt_tokens + response.usage!.prompt_tokens,
          completion_tokens:
            prev.completion_tokens + response.usage!.completion_tokens,
          total_tokens: prev.total_tokens + response.usage!.total_tokens,
        }));
      }

      const commandsText = response.commands
        ? response.commands
            .map(
              (cmd) =>
                cmd.explanation ||
                `${cmd.command}${
                  cmd.parameters && Object.keys(cmd.parameters).length > 0
                    ? " " + JSON.stringify(cmd.parameters)
                    : ""
                }`,
            )
            .join("\n")
        : "";

      const assistantMessage: AIMessage = {
        role: "assistant",
        content:
          (response.suggestion
            ? `💡suggestion: ${response.suggestion}\n\n`
            : "") +
          (response.content ||
            commandsText ||
            response.error ||
            "Sorry, I didn't understand your request."),
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (response.commands && response.commands.length > 0) {
        if (onAddCommands) {
          // Batch add all commands at once
          const commandsToAdd = response.commands
            .map((cmd) => {
              const xanCommand = findXanCommand(cmd.command);
              if (xanCommand) {
                return { command: xanCommand, parameters: cmd.parameters };
              }
              return null;
            })
            .filter(Boolean) as {
            command: XanCommand;
            parameters?: Record<string, any>;
          }[];
          if (commandsToAdd.length > 0) {
            onAddCommands(commandsToAdd);
          }
        } else {
          // Fallback: add one by one (may have issues with stale state)
          response.commands.forEach((cmd, _index) => {
            const xanCommand = findXanCommand(cmd.command);
            if (xanCommand) {
              onAddCommand(xanCommand, cmd.parameters, undefined, true);
            }
          });
        }
      }
    } catch (error) {
      const errorMessage: AIMessage = {
        role: "assistant",
        content: `${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const findXanCommand = (commandName: string): XanCommand | null => {
    return (
      xanCommands.find(
        (cmd) => cmd.name === commandName || cmd.id === commandName,
      ) || null
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopy = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderMessage = (message: AIMessage) => {
    const isUser = message.role === "user";
    return (
      <div
        key={message.timestamp}
        className={`flex gap-2 mb-3 ${isUser ? "justify-end" : "justify-start"}`}
      >
        {!isUser && (
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Bot className="h-3.5 w-3.5 text-primary" />
          </div>
        )}
        <div
          className={`max-w-[80%] rounded-lg px-3 py-2 text-sm relative group bg-muted text-muted-foreground`}
        >
          <div className="whitespace-pre-wrap break-words pr-6">
            {message.content}
          </div>
          <button
            onClick={() => handleCopy(message.content, message.timestamp)}
            className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-black/10 text-muted-foreground`}
          >
            {copiedId === message.timestamp ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        {isUser && (
          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        )}
      </div>
    );
  };

  if (!isVisible) return null;

  return (
    <div
      className="fixed bottom-2 left-1/2 -translate-x-1/2 w-[min(700px,calc(100vw-32px))] z-40"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex flex-col bg-transparent border border-border/50 rounded-lg shadow-xl overflow-hidden">
        <div className="p-2 bg-transparent flex items-center">
          <div className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-primary text-primary-foreground shadow-sm">
              <Bot className="h-3.5 w-3.5" />
              {t.aiPanel}
            </div>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap px-2 flex-shrink-0">
            {t.aiTokenUsed} {cumulativeUsage.total_tokens.toLocaleString()}
          </span>
          <div className="flex items-center gap-1 justify-end flex-1">
            {isExpanded && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setMessages([])}
                disabled={messages.length === 0}
                className="px-2 font-medium"
              >
                {t.aiClear}
              </Button>
            )}
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setIsExpanded(!isExpanded)}
              className="px-2 font-medium"
              disabled={!isAIConfigured()}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={onClose}
              className="px-2 font-medium"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isExpanded && (
          <ScrollArea className="h-[36vh]">
            <div className="p-2">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Bot className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">{t.aiWelcomeMessage}</p>
                </div>
              ) : (
                messages.map(renderMessage)
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        )}

        <div className="p-2">
          {!isAIConfigured() ? (
            <div className="text-center text-sm text-muted-foreground">
              {t.aiConfigureApiKey}
            </div>
          ) : (
            <div className="relative">
              <Textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  autoResizeTextarea();
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsExpanded(true)}
                placeholder={t.aiPlaceholder}
                disabled={isLoading}
                className="w-full h-auto min-h-[36px] max-h-[96px] resize-none overflow-y-auto py-2 pr-10 text-sm leading-5 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"
                rows={1}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isLoading}
                size="sm"
                className="absolute bottom-1 right-3 h-7 w-7 p-0"
              >
                {isLoading ? <Loader2 className="animate-spin" /> : <Send />}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
