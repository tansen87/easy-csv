import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  Send,
  X,
  Bot,
  User,
  Loader2,
  Trash2,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  List,
  Plus,
  Pencil,
} from "lucide-react";

import { ScrollArea } from "@/components/ui/ScrollArea";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Tooltip } from "@/components/ui/Tooltip";
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
  listAISessions,
  loadAISession,
  saveAISession,
  renameAISession,
  deleteAISession,
  saveFeedback,
  saveCorrection,
  type AISessionSummary,
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
  /** Left conversation list (design 066); owned by App for canvas width. */
  historyOpen?: boolean;
  onHistoryOpenChange?: (open: boolean) => void;
}

interface FeedbackState {
  [messageIndex: number]: "positive" | "negative" | null;
}

/** First user message, one line, 24 characters. */
function deriveSessionTitle(text: string): string {
  const oneLine = text.split(/\s+/).filter(Boolean).join(" ");
  const title = oneLine.slice(0, 24);
  return title || "新的对话";
}

function newSessionId(): string {
  return `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** `2026-11-21 09:41:00` (SQLite localtime) → timestamp. */
function parseUpdatedAt(value: string): number {
  const parsed = Date.parse(value.replace(" ", "T"));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sessionTimeLabel(timestamp: number): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
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
  historyOpen = false,
  onHistoryOpenChange,
}: AIPanelProps) {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
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
  const [sessions, setSessions] = useState<AISessionSummary[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const sessionIdRef = useRef<string | null>(null);
  const sessionTitleRef = useRef("");
  const bootstrappedRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Message timeline (design 066): measured dots + active/hovered message.
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const threadViewportRef = useRef<HTMLElement | null>(null);
  const messageEls = useRef(new Map<number, HTMLDivElement>());
  const [activeUserTs, setActiveUserTs] = useState<number | null>(null);
  const [hoveredUserTs, setHoveredUserTs] = useState<number | null>(null);
  // Timestamps are used as React keys, so they must be strictly increasing.
  const lastTimestampRef = useRef(0);
  const nextTimestamp = useCallback(() => {
    const now = Math.max(Date.now(), lastTimestampRef.current + 1);
    lastTimestampRef.current = now;
    return now;
  }, []);
  // Assistant message currently receiving streamed chunks (null when idle).
  const streamingRef = useRef<AIMessage | null>(null);

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
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isVisible]);

  // Load the conversation list once per mount; the newest chat opens first.
  useEffect(() => {
    if (!isVisible || bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    let cancelled = false;
    (async () => {
      const list = await listAISessions();
      if (cancelled) return;
      setSessions(list);
      if (list.length === 0) return;
      const first = list[0];
      const loaded = await loadAISession(first.id);
      if (cancelled) return;
      sessionIdRef.current = first.id;
      setSessionId(first.id);
      sessionTitleRef.current = first.title;
      setSessionTitle(first.title);
      setMessages(loaded);
      setConversationHistory(loaded);
    })();
    return () => {
      cancelled = true;
    };
  }, [isVisible]);

  const persistSession = useCallback(async (all: AIMessage[]) => {
    const sid = sessionIdRef.current;
    if (!sid || all.length === 0) return;
    await saveAISession(sid, sessionTitleRef.current, all);
    setSessions(await listAISessions());
  }, []);

  const startNewSession = useCallback(() => {
    sessionIdRef.current = null;
    setSessionId(null);
    sessionTitleRef.current = "";
    setSessionTitle("");
    setMessages([]);
    setConversationHistory([]);
    setClarificationState(null);
    inputRef.current?.focus();
  }, []);

  const openSession = useCallback(
    async (id: string) => {
      if (isLoading || id === sessionIdRef.current) return;
      const loaded = await loadAISession(id);
      const summary = sessions.find((session) => session.id === id);
      sessionIdRef.current = id;
      setSessionId(id);
      sessionTitleRef.current = summary?.title ?? "";
      setSessionTitle(summary?.title ?? "");
      setMessages(loaded);
      setConversationHistory(loaded);
      setClarificationState(null);
      setCumulativeUsage({
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      });
      setTimeout(() => threadViewportRef.current?.scrollTo({ top: 0 }), 0);
    },
    [isLoading, sessions],
  );

  const beginRename = useCallback((session: AISessionSummary) => {
    if (isLoading) return;
    setEditingSessionId(session.id);
    setRenameValue(session.title);
  }, [isLoading]);

  const commitRename = useCallback(async () => {
    const id = editingSessionId;
    if (!id) return;
    const title = renameValue.trim();
    setEditingSessionId(null);
    if (!title) return;
    await renameAISession(id, title);
    setSessions((prev) =>
      prev.map((session) =>
        session.id === id ? { ...session, title } : session,
      ),
    );
    if (id === sessionIdRef.current) {
      sessionTitleRef.current = title;
      setSessionTitle(title);
    }
  }, [editingSessionId, renameValue]);

  const confirmDeleteSession = useCallback(async () => {
    setConfirmDeleteOpen(false);
    const sid = sessionIdRef.current;
    if (!sid) {
      startNewSession();
      return;
    }
    await deleteAISession(sid);
    const rest = await listAISessions();
    setSessions(rest);
    sessionIdRef.current = null;
    setSessionId(null);
    sessionTitleRef.current = "";
    setSessionTitle("");
    setMessages([]);
    setConversationHistory([]);
    if (rest.length > 0) {
      const next = rest[0];
      const loaded = await loadAISession(next.id);
      sessionIdRef.current = next.id;
      setSessionId(next.id);
      sessionTitleRef.current = next.title;
      setSessionTitle(next.title);
      setMessages(loaded);
      setConversationHistory(loaded);
      setCumulativeUsage({
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      });
    }
  }, [startNewSession]);

  const sessionGroups = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const today = startOfToday.getTime();
    const yesterday = today - 86_400_000;
    const buckets = [
      { label: t.aiHistoryToday, items: [] as AISessionSummary[] },
      { label: t.aiHistoryYesterday, items: [] as AISessionSummary[] },
      { label: t.aiHistoryEarlier, items: [] as AISessionSummary[] },
    ];
    for (const session of sessions) {
      const updated = parseUpdatedAt(session.updated_at);
      const index = updated >= today ? 0 : updated >= yesterday ? 1 : 2;
      buckets[index].items.push(session);
    }
    return buckets.filter((bucket) => bucket.items.length > 0);
  }, [sessions, t]);

  const handleSendMessage = async (
    overrideContext?: Partial<AIContext>,
    directMessage?: string,
  ) => {
    const messageToSend = directMessage || inputValue.trim();
    if (!messageToSend || isLoading) return;

    if (!sessionIdRef.current) {
      const sid = newSessionId();
      sessionIdRef.current = sid;
      setSessionId(sid);
      const title = deriveSessionTitle(messageToSend);
      sessionTitleRef.current = title;
      setSessionTitle(title);
    }

    const userMessage: AIMessage = {
      role: "user",
      content: messageToSend,
      timestamp: nextTimestamp(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    // Placeholder that receives the streamed deltas as they arrive.
    const placeholder: AIMessage = {
      role: "assistant",
      content: "",
      timestamp: nextTimestamp(),
    };
    streamingRef.current = placeholder;
    setMessages((prev) => [...prev, placeholder]);

    const onChunk = (delta: string) => {
      const target = streamingRef.current;
      if (!target) return;
      const updated = { ...target, content: target.content + delta };
      streamingRef.current = updated;
      setMessages((prev) => prev.map((m) => (m === target ? updated : m)));
    };

    // Replaces the placeholder with the final (formatted) message.
    const finalizeStream = (content: string): AIMessage => {
      const target = streamingRef.current;
      streamingRef.current = null;
      const final: AIMessage = target
        ? { ...target, content }
        : { role: "assistant", content, timestamp: nextTimestamp() };
      setMessages((prev) =>
        target ? prev.map((m) => (m === target ? final : m)) : [...prev, final],
      );
      return final;
    };

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
        onChunk,
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

        const assistantMessage = finalizeStream(response.clarification);
        setConversationHistory((prev) => [...prev, assistantMessage]);
        void persistSession([...updatedHistory, assistantMessage]);
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

      const assistantMessage = finalizeStream(
        (response.suggestion
          ? `💡suggestion: ${response.suggestion}\n\n`
          : "") +
          (response.content ||
            commandsText ||
            response.error ||
            "Sorry, I didn't understand your request."),
      );
      setConversationHistory((prev) => [...prev, assistantMessage]);

      // Save conversation history
      void persistSession([...updatedHistory, assistantMessage]);

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
      const errorMessage = finalizeStream(
        `${error instanceof Error ? error.message : "Unknown error"}`,
      );
      setConversationHistory((prev) => [...prev, errorMessage]);
      void persistSession([...updatedHistory, errorMessage]);
    } finally {
      streamingRef.current = null;
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
    // While loading, the trailing assistant message is the one being streamed.
    const isStreaming = isLoading && !isUser && index === messages.length - 1;

    return (
      <div
        key={message.timestamp}
        ref={
          isUser
            ? (el) => {
                if (el) messageEls.current.set(message.timestamp, el);
                else messageEls.current.delete(message.timestamp);
              }
            : undefined
        }
        className={`flex gap-2 mb-3 group ${isUser ? "justify-end" : "justify-start"}`}
      >
        {!isUser && (
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Bot className="h-3.5 w-3.5 text-primary" />
          </div>
        )}
        <div
          className={`w-[80%] rounded-lg px-3 py-2 text-[13px] leading-relaxed relative bg-muted text-muted-foreground`}
        >
          <div className="whitespace-pre-wrap break-words">
            {message.content}
            {isStreaming && (
              <span
                aria-hidden="true"
                className="inline-block w-1.5 h-3.5 ml-0.5 align-middle bg-primary animate-pulse"
              />
            )}
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
          <div
            className={`flex items-center gap-1 transition-opacity ${
              feedback ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
          >
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 w-6 p-0 ${
                feedback === "positive" ? "text-primary" : ""
              }`}
              onClick={() => handleFeedback(index, "positive")}
            >
              <ThumbsUp
                className={`h-3.5 w-3.5 ${
                  feedback === "positive" ? "fill-current" : ""
                }`}
              />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 w-6 p-0 ${
                feedback === "negative" ? "text-primary" : ""
              }`}
              onClick={() =>
                feedback === "negative"
                  ? handleFeedback(index, "negative")
                  : openFeedbackDialog(index, message)
              }
            >
              <ThumbsDown
                className={`h-3.5 w-3.5 ${
                  feedback === "negative" ? "fill-current" : ""
                }`}
              />
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

  const userMessages = useMemo(
    () => messages.filter((message) => message.role === "user"),
    [messages],
  );
  const showTimeline = userMessages.length >= 3;

  const syncActiveUser = useCallback(() => {
    const viewport = threadViewportRef.current;
    if (!viewport) return;
    const threshold = viewport.scrollTop + viewport.clientHeight * 0.35;
    let current: number | null = userMessages[0]?.timestamp ?? null;
    for (const message of userMessages) {
      const el = messageEls.current.get(message.timestamp);
      if (el && el.offsetTop <= threshold) current = message.timestamp;
    }
    setActiveUserTs(current);
  }, [userMessages]);

  const syncActiveUserRef = useRef(syncActiveUser);
  syncActiveUserRef.current = syncActiveUser;

  useEffect(() => {
    if (!showTimeline) return;
    const viewport = scrollRootRef.current?.querySelector<HTMLElement>(
      "[data-radix-scroll-area-viewport]",
    );
    if (!viewport) return;
    threadViewportRef.current = viewport;
    const onScroll = () => syncActiveUserRef.current();
    viewport.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      viewport.removeEventListener("scroll", onScroll);
    };
  }, [showTimeline, sessionId, historyOpen]);

  const jumpToMessage = useCallback((timestamp: number) => {
    const el = messageEls.current.get(timestamp);
    const viewport = threadViewportRef.current;
    if (!el || !viewport) return;
    viewport.scrollTo({ top: Math.max(0, el.offsetTop - 8), behavior: "smooth" });
    setActiveUserTs(timestamp);
  }, []);

  if (!isVisible) return null;

  return (
    <>
      <div
        className={`fixed right-0 top-9 bottom-0 z-30 flex ${
          historyOpen
            ? "w-[min(520px,calc(100vw-80px))]"
            : "w-[min(360px,calc(100vw-80px))]"
        }`}
        onContextMenu={(e) => e.preventDefault()}
      >
        {historyOpen && (
          <div className="flex w-40 shrink-0 flex-col border-r border-border/60 bg-muted/30">
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border/50 px-3">
              <span className="text-xs font-medium">{t.aiSessions}</span>
              <span className="ml-auto font-mono text-[9px] tabular-nums text-muted-foreground/60">
                {sessions.length}
              </span>
            </div>
            <button
              type="button"
              onClick={startNewSession}
              disabled={isLoading}
              className="mx-2 mt-2 flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-md border border-border bg-card text-[10.5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <Plus className="h-3 w-3" />
              {t.aiNewSession}
            </button>
            <ScrollArea className="mt-1 min-h-0 flex-1">
              <div className="px-1.5 pb-2 pt-1">
                {sessions.length === 0 ? (
                  <p className="px-2 py-6 text-center text-[10px] text-muted-foreground/70">
                    {t.aiHistoryEmpty}
                  </p>
                ) : (
                  sessionGroups.map((group) => (
                    <div key={group.label}>
                      <div className="px-1.5 pb-1 pt-2 font-mono text-[8.5px] text-muted-foreground/60">
                        {group.label}
                      </div>
                      {group.items.map((session) =>
                        editingSessionId === session.id ? (
                          <div
                            key={session.id}
                            className="mb-0.5 rounded-md bg-primary/10 px-2 py-1"
                          >
                            <input
                              autoFocus
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  void commitRename();
                                } else if (e.key === "Escape") {
                                  e.preventDefault();
                                  setEditingSessionId(null);
                                }
                              }}
                              onBlur={() => void commitRename()}
                              maxLength={40}
                              className="h-5 w-full bg-transparent text-[10.5px] text-foreground outline-none"
                            />
                          </div>
                        ) : (
                          <div
                            key={session.id}
                            className="group/row relative mb-0.5"
                          >
                            <button
                              type="button"
                              onClick={() => void openSession(session.id)}
                              disabled={isLoading}
                              className={`flex w-full flex-col gap-px rounded-md py-1 pl-2 pr-6 text-left transition-colors disabled:opacity-50 ${
                                session.id === sessionId
                                  ? "bg-primary/10"
                                  : "hover:bg-muted"
                              }`}
                            >
                              <span
                                className={`line-clamp-2 text-[10.5px] leading-[1.45] ${
                                  session.id === sessionId
                                    ? "font-medium text-primary"
                                    : "text-foreground"
                                }`}
                              >
                                {session.title}
                              </span>
                              <span className="font-mono text-[8.5px] tabular-nums text-muted-foreground/60">
                                {sessionTimeLabel(
                                  parseUpdatedAt(session.updated_at),
                                )}
                                {" · "}
                                {session.message_count}
                              </span>
                            </button>
                            {!isLoading && (
                              <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover/row:opacity-100">
                                <Tooltip
                                  content={t.aiRenameSession}
                                  side="left"
                                >
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      beginRename(session);
                                    }}
                                    aria-label={t.aiRenameSession}
                                    className="grid h-[18px] w-[18px] place-items-center rounded text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                                  >
                                    <Pencil className="h-2.5 w-2.5" />
                                  </button>
                                </Tooltip>
                              </div>
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        <aside
          aria-label={t.ai}
          className="relative flex h-full min-w-0 flex-1 flex-col border-l border-border bg-card"
        >
          <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border/50 px-3">
            <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <Bot className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 truncate text-xs font-medium">
              {sessionTitle || t.ai}
            </span>
            <span className="ml-auto whitespace-nowrap font-mono text-[9.5px] tabular-nums text-muted-foreground/60">
              {t.aiTokenUsed} {cumulativeUsage.total_tokens.toLocaleString()}
            </span>
            <div className="ml-1 flex shrink-0 items-center gap-0.5">
              <Tooltip content={t.aiSessions}>
                <button
                  type="button"
                  onClick={() => onHistoryOpenChange?.(!historyOpen)}
                  aria-label={t.aiSessions}
                  aria-pressed={historyOpen}
                  className={`grid h-[22px] w-[22px] place-items-center rounded transition-colors ${
                    historyOpen
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <List className="h-3.5 w-3.5" />
                </button>
              </Tooltip>
              <Tooltip content={t.aiDeleteSession}>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteOpen(true)}
                  disabled={isLoading || (messages.length === 0 && !sessionId)}
                  aria-label={t.aiDeleteSession}
                  className="grid h-[22px] w-[22px] place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </Tooltip>
              <Tooltip content={t.close}>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t.close}
                  className="grid h-[22px] w-[22px] place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="flex min-h-0 flex-1">
            {confirmDeleteOpen && (
              <div className="absolute right-3 top-11 z-20 w-[228px] rounded-lg border border-border bg-card p-3 shadow-lg">
                <p className="text-[11px] leading-relaxed text-foreground">
                  {t.aiDeleteSessionConfirm}
                </p>
                <div className="mt-2.5 flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteOpen(false)}
                    className="h-6 rounded-md px-2 text-[10.5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={() => void confirmDeleteSession()}
                    className="h-6 rounded-md bg-danger/10 px-2 text-[10.5px] font-medium text-danger transition-colors hover:bg-danger/15"
                  >
                    {t.aiDeleteSession}
                  </button>
                </div>
              </div>
            )}
            {showTimeline && (
              <div className="flex w-6 shrink-0 items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  {userMessages.map((message) => (
                    <div
                      key={message.timestamp}
                      className="relative flex h-2 items-center justify-center"
                    >
                      <button
                        type="button"
                        onMouseEnter={() => setHoveredUserTs(message.timestamp)}
                        onMouseLeave={() => setHoveredUserTs(null)}
                        onClick={() => jumpToMessage(message.timestamp)}
                        aria-label={`${t.aiTimeline}: ${message.content.slice(0, 20)}`}
                        className={`rounded-full transition-colors ${
                          message.timestamp === activeUserTs
                            ? "h-1.5 w-1.5 bg-primary"
                            : "h-1 w-1 bg-border hover:bg-muted-foreground/50"
                        }`}
                      />
                      {hoveredUserTs === message.timestamp && (
                        <div className="pointer-events-none absolute left-4 top-1/2 z-20 w-[196px] -translate-y-1/2 rounded-md border border-border bg-card px-2.5 py-1.5 shadow-lg">
                          <p className="line-clamp-2 text-[10px] leading-relaxed text-foreground">
                            {message.content}
                          </p>
                          <p className="mt-1 font-mono text-[8.5px] tabular-nums text-muted-foreground/60">
                            {new Date(
                              message.timestamp,
                            ).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <ScrollArea ref={scrollRootRef} className="min-h-0 flex-1">
              <div className="relative px-3 py-3">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
                    <Bot className="h-7 w-7 opacity-40" />
                    <p className="text-xs">{t.aiWelcomeMessage}</p>
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
          </div>

          <div className="shrink-0 border-t border-border/50 px-3 pb-2 pt-2.5">
            {!isAIConfigured() ? (
              <div className="py-2 text-center text-xs text-muted-foreground">
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
                  placeholder={t.aiPlaceholder}
                  disabled={isLoading}
                  className="w-full min-h-[56px] max-h-[96px] resize-none overflow-y-auto py-2 pr-11 text-[13px] leading-5 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"
                  rows={2}
                />
                <Button
                  onClick={() => handleSendMessage()}
                  disabled={!inputValue.trim() || isLoading}
                  size="sm"
                  className="absolute bottom-2 right-2 h-7 w-7 p-0"
                >
                  {isLoading ? <Loader2 className="animate-spin" /> : <Send />}
                </Button>
              </div>
            )}
          </div>
        </aside>
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
    </>
  );
});
