import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  X,
  Bot,
  User,
  Loader2,
  Sparkles,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/i18n";
import {
  AIMessage,
  AIContext,
} from "@/services/ai/types";
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
}

export const AIPanel = React.memo(function AIPanel({
  isVisible,
  onClose,
  context,
  onAddCommand,
}: AIPanelProps) {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      const response = await sendAIMessage(
        userMessage.content,
        context,
      );

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
          response.content ||
          commandsText ||
          response.error ||
          "Sorry, I didn't understand your request.",
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (response.commands && response.commands.length > 0) {
        response.commands.forEach((cmd) => {
          const xanCommand = findXanCommand(cmd.command);
          if (xanCommand) {
            onAddCommand(xanCommand, cmd.parameters, undefined, true);
          }
        });
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
        (cmd) =>
          cmd.name === commandName || cmd.id === commandName,
      ) || null
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
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
          className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
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
    <div className="fixed bottom-2 left-1/2 -translate-x-1/2 w-[min(600px,calc(100vw-32px))] z-40">
      <div className="flex flex-col bg-background border border-border/50 rounded-lg shadow-xl overflow-hidden">
        <div className="p-2 border-b bg-card/80 flex items-center">
          <div className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              {t.aiPanel}
            </div>
          </div>
          {isExpanded && (
            <span className="flex-1 text-center text-xs text-muted-foreground">
              {t.aiCurrentOnlyHint}
            </span>
          )}
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
          <ScrollArea className="h-45">
            <div className="p-2">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Sparkles className="h-8 w-8 mb-2 opacity-50" />
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
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsExpanded(true)}
                placeholder={t.aiPlaceholder}
                disabled={isLoading}
                className="flex-1 h-7"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isLoading}
                size="sm"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Send />
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
