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
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/i18n";
import {
  AIMessage,
  AIContext,
  TokenUsage,
  AIFeedback,
} from "@/services/ai/types";
import {
  sendAIMessage,
  isAIConfigured,
  loadConversationHistory,
  saveConversationHistory,
  saveFeedback,
  saveCorrection,
} from "@/services/ai/index";
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

interface FeedbackState {
  [messageIndex: number]: "positive" | "negative" | null;
}

interface ClarificationState {
  question: string;
  options: string[];
  originalQuery: string;
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
  const [feedbackState, setFeedbackState] = useState<FeedbackState>({});
  const [showFeedbackDialog, setShowFeedbackDialog] = useState<{
    messageIndex: number;
    message: AIMessage;
  } | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [clarificationState, setClarificationState] =
    useState<ClarificationState | null>(null);
  const [conversationHistory, setConversationHistory] = useState<AIMessage[]>(
    [],
  );
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

  // Load conversation history on mount
  useEffect(() => {
    if (isVisible) {
      loadConversationHistory().then((history) => {
        setConversationHistory(history);
        if (history.length > 0) {
          setMessages(history.slice(-20)); // Show last 20 messages
        }
      });
    }
  }, [isVisible]);

  const handleSendMessage = async (
    overrideContext?: Partial<AIContext>,
    directMessage?: string,
  ) => {
    const messageToSend = directMessage || inputValue.trim();
    if (!messageToSend || isLoading) return;

    const userMessage: AIMessage = {
      role: "user",
      content: messageToSend,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);
    setIsExpanded(true);

    // Add to conversation history
    const updatedHistory = [...conversationHistory, userMessage];
    setConversationHistory(updatedHistory);

    // Merge context with override (for clarification responses)
    const messageContext: AIContext = {
      ...context,
      ...overrideContext,
    };

    try {
      const response = await sendAIMessage(
        userMessage.content,
        messageContext,
        conversationHistory,
      );

      if (response.usage) {
        setCumulativeUsage((prev) => ({
          prompt_tokens: prev.prompt_tokens + response.usage!.prompt_tokens,
          completion_tokens:
            prev.completion_tokens + response.usage!.completion_tokens,
          total_tokens: prev.total_tokens + response.usage!.total_tokens,
        }));
      }

      // Handle clarification response
      if (response.clarification && response.clarificationOptions) {
        setClarificationState({
          question: response.clarification,
          options: response.clarificationOptions,
          originalQuery: userMessage.content,
        });

        const assistantMessage: AIMessage = {
          role: "assistant",
          content: response.clarification,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setConversationHistory((prev) => [...prev, assistantMessage]);
        return;
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
      setConversationHistory((prev) => [...prev, assistantMessage]);

      // Save conversation history
      saveConversationHistory([...updatedHistory, assistantMessage]);

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
      setConversationHistory((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClarificationResponse = async (selectedOption: string) => {
    if (!clarificationState) return;

    const combinedQuery = `${clarificationState.originalQuery} - ${selectedOption}`;
    setClarificationState(null);

    // Directly send the combined query
    await handleSendMessage({ pendingClarification: true }, combinedQuery);
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

  const handleFeedback = async (
    messageIndex: number,
    type: "positive" | "negative",
    correction?: string,
  ) => {
    const message = messages[messageIndex];
    if (!message || message.role !== "assistant") return;

    // Toggle off if same feedback type
    if (feedbackState[messageIndex] === type) {
      setFeedbackState((prev) => {
        const next = { ...prev };
        delete next[messageIndex];
        return next;
      });
      return;
    }

    // Find the previous user message
    const userMessage = messages
      .slice(0, messageIndex)
      .reverse()
      .find((m) => m.role === "user");

    const feedback: AIFeedback = {
      userQuery: userMessage?.content || "",
      aiResponse: message.content,
      feedbackType: type,
      correction,
      timestamp: Date.now(),
    };

    await saveFeedback(feedback);

    setFeedbackState((prev) => ({
      ...prev,
      [messageIndex]: type,
    }));

    if (type === "negative" && correction) {
      // Save correction rule
      await saveCorrection(
        userMessage?.content || "",
        message.content.substring(0, 100),
        correction,
      );
    }
  };

  const openFeedbackDialog = (messageIndex: number, message: AIMessage) => {
    setShowFeedbackDialog({ messageIndex, message });
    setFeedbackText("");
  };

  const submitNegativeFeedback = async () => {
    if (!showFeedbackDialog) return;

    await handleFeedback(
      showFeedbackDialog.messageIndex,
      "negative",
      feedbackText,
    );
    setShowFeedbackDialog(null);
    setFeedbackText("");
  };

  const renderMessage = (message: AIMessage, index: number) => {
    const isUser = message.role === "user";
    const feedback = feedbackState[index];

    return (
      <div
        key={message.timestamp}
        className={`flex gap-2 mb-3 group ${isUser ? "justify-end" : "justify-start"}`}
      >
        {!isUser && (
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Bot className="h-3.5 w-3.5 text-primary" />
          </div>
        )}
        <div
          className={`w-[80%] rounded-lg px-3 py-2 text-sm relative bg-muted text-muted-foreground`}
        >
          <div className="whitespace-pre-wrap break-words">
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
        {!isUser && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 w-6 p-0 ${feedback === "positive" ? "text-green-500 opacity-100" : ""}`}
              onClick={() => handleFeedback(index, "positive")}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 w-6 p-0 ${feedback === "negative" ? "text-red-500 opacity-100" : ""}`}
              onClick={() => feedback === "negative" ? handleFeedback(index, "negative") : openFeedbackDialog(index, message)}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    );
  };

  const renderClarification = () => {
    if (!clarificationState) return null;

    return (
      <div className="flex flex-col gap-2 mb-3 ml-8">
        <div className="text-sm text-muted-foreground">
          {clarificationState.question}
        </div>
        <div className="flex flex-wrap gap-2">
          {clarificationState.options.map((option, idx) => (
            <Button
              key={idx}
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => handleClarificationResponse(option)}
            >
              {option}
            </Button>
          ))}
        </div>
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
                <>
                  {messages.map((msg, idx) => (
                    <React.Fragment key={msg.timestamp}>
                      {renderMessage(msg, idx)}
                    </React.Fragment>
                  ))}
                  {renderClarification()}
                </>
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
                onClick={() => handleSendMessage()}
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

      {/* Feedback Dialog */}
      {showFeedbackDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-4 w-[min(400px,calc(100vw-32px))]">
            <h3 className="text-lg font-medium mb-2">{t.aiFeedbackNegative}</h3>
            <p className="text-sm text-muted-foreground mb-3">
              {t.aiFeedbackPlaceholder}
            </p>
            <Textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder={t.aiFeedbackPlaceholder}
              className="w-full h-24 resize-none"
            />
            <div className="flex justify-end gap-2 mt-3">
              <Button
                variant="outline"
                onClick={() => setShowFeedbackDialog(null)}
              >
                {t.cancel}
              </Button>
              <Button onClick={submitNegativeFeedback}>{t.confirm}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
