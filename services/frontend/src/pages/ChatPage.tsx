import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Bot,
  User as UserIcon,
  Sparkles,
  Terminal,
  ChevronDown,
  ChevronRight,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Cpu,
} from "lucide-react";
import { api } from "../services/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolExecutions?: {
    tool: string;
    arguments: Record<string, unknown>;
    result?: unknown;
    status: "success" | "error";
  }[];
  iterations?: number;
  durationMs?: number;
  timestamp: string;
}

export const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello! I am your **NexusMCP AI Agent**. I can help you manage your WooCommerce store, query local timezones, and fetch safe external web resources using aggregated MCP tools. How can I assist you today?",
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
  const [systemPrompt, setSystemPrompt] = useState("");
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<"gemini" | "ollama">("gemini");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const toggleToolExpand = (key: string) => {
    setExpandedTools((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const samplePrompts = [
    "List all products in my WooCommerce store with their price and stock.",
    "What is the current time in Tokyo, New York, and London?",
    "Fetch and summarize the page content of https://news.ycombinator.com",
    "Create a new WooCommerce product: 'Cyberpunk Neon Hoodie' for $89.99 with 25 stock.",
  ];

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || isLoading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text.trim(),
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    const startTime = Date.now();

    try {
      // Build history for backend
      const history = messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));
      history.push({ role: "user", content: text.trim() });

      const res = await api.chat(history, systemPrompt || undefined);

      const durationMs = Date.now() - startTime;

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: res.message.content || "(Completed tool executions)",
        toolExecutions: (res.tool_executions || []).map((t: any) => ({
          tool: t.tool,
          arguments: t.arguments || {},
          result: t.result,
          status: t.error ? "error" : "success",
        })),
        iterations: res.iterations,
        durationMs,
        timestamp: new Date().toLocaleTimeString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: `**Error:** ${err.message || "Failed to communicate with AI chat agent."}`,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          "Conversation reset. How can I help you manage your store and tools today?",
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col h-[calc(100vh-5rem)]">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-500">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center space-x-2">
              <span>Agentic Operations Assistant</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-brand-500/15 text-brand-500 border border-brand-500/25">
                v0.1
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Autonomous multi-turn agent with WooCommerce, Time, and SSRF-safe Fetch tools
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-2">
          {/* Provider badge */}
          <button
            onClick={() => setSelectedProvider(selectedProvider === "gemini" ? "ollama" : "gemini")}
            title="Toggle LLM Provider"
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-dark-800 hover:bg-dark-750 border border-slate-700/60 text-xs text-slate-300 transition"
          >
            <Cpu className="w-3.5 h-3.5 text-accent-cyan" />
            <span className="font-mono text-[11px]">{selectedProvider === "gemini" ? "Google Gemini 2.0" : "Ollama (Local)"}</span>
          </button>

          <button
            onClick={() => setShowSystemPrompt(!showSystemPrompt)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
              showSystemPrompt
                ? "bg-slate-700/60 border-slate-600 text-white"
                : "bg-dark-800 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            System Prompt
          </button>

          <button
            onClick={handleReset}
            title="Reset conversation"
            className="p-1.5 rounded-lg bg-dark-800 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* System prompt drawer */}
      {showSystemPrompt && (
        <div className="p-3 my-2 rounded-xl bg-dark-850 border border-slate-800 animate-fade-in">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Custom System Instructions
          </label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="You are an expert WooCommerce administrator. Always verify product stock before making adjustments..."
            rows={2}
            className="w-full bg-dark-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>
      )}

      {/* Message area */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
        {messages.map((m) => {
          const isUser = m.role === "user";
          return (
            <div
              key={m.id}
              className={`flex items-start space-x-3 ${isUser ? "flex-row-reverse space-x-reverse" : ""}`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center shadow-md ${
                  isUser
                    ? "bg-gradient-to-tr from-brand-600 to-accent-violet text-white"
                    : "bg-dark-800 border border-slate-700 text-brand-500"
                }`}
              >
                {isUser ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Message bubble */}
              <div
                className={`max-w-2xl rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  isUser
                    ? "bg-brand-600 text-white rounded-tr-none shadow-md"
                    : "bg-dark-850 border border-slate-800 text-slate-200 rounded-tl-none shadow-lg"
                }`}
              >
                {/* Content */}
                <div className="whitespace-pre-wrap">{m.content}</div>

                {/* Tool executions cards */}
                {m.toolExecutions && m.toolExecutions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                      <Terminal className="w-3.5 h-3.5 text-brand-500" />
                      <span>Executed MCP Tools ({m.toolExecutions.length})</span>
                    </div>

                    {m.toolExecutions.map((t, idx) => {
                      const toolKey = `${m.id}-tool-${idx}`;
                      const isExpanded = !!expandedTools[toolKey];
                      return (
                        <div
                          key={toolKey}
                          className="rounded-xl border border-slate-700/60 bg-dark-900 overflow-hidden text-xs"
                        >
                          <button
                            type="button"
                            onClick={() => toggleToolExpand(toolKey)}
                            className="w-full flex items-center justify-between p-2.5 bg-dark-800/60 hover:bg-dark-800 transition text-left"
                          >
                            <div className="flex items-center space-x-2">
                              {t.status === "success" ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-accent-emerald" />
                              ) : (
                                <AlertCircle className="w-3.5 h-3.5 text-accent-rose" />
                              )}
                              <span className="font-mono font-semibold text-slate-200">{t.tool}</span>
                            </div>
                            <div className="flex items-center space-x-1 text-slate-400 text-[10px]">
                              <span>Details</span>
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="p-3 border-t border-slate-800 space-y-2 font-mono text-[11px]">
                              <div>
                                <span className="text-slate-400 font-semibold uppercase text-[10px]">Arguments:</span>
                                <pre className="mt-1 p-2 rounded-lg bg-dark-950/70 border border-slate-800 text-slate-300 overflow-x-auto">
                                  {JSON.stringify(t.arguments, null, 2)}
                                </pre>
                              </div>
                              <div>
                                <span className="text-slate-400 font-semibold uppercase text-[10px]">Result:</span>
                                <pre className="mt-1 p-2 rounded-lg bg-dark-950/70 border border-slate-800 text-slate-300 overflow-x-auto max-h-48 overflow-y-auto">
                                  {typeof t.result === "string"
                                    ? t.result
                                    : JSON.stringify(t.result, null, 2)}
                                </pre>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Footer metrics */}
                {(m.durationMs || m.iterations) && (
                  <div className="mt-2 pt-2 border-t border-slate-800/40 flex items-center space-x-3 text-[10px] text-slate-400">
                    {m.durationMs && (
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{m.durationMs}ms</span>
                      </span>
                    )}
                    {m.iterations && (
                      <span>{m.iterations} turn{m.iterations > 1 ? "s" : ""}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-xl bg-dark-800 border border-slate-700 text-brand-500 flex items-center justify-center shadow-md">
              <Bot className="w-4 h-4 animate-pulse" />
            </div>
            <div className="bg-dark-850 border border-slate-800 rounded-2xl rounded-tl-none px-4 py-3 flex items-center space-x-2 text-xs text-slate-400 shadow-md">
              <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
              <span>Agent is thinking and coordinating MCP tools...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested prompts if empty or early */}
      {messages.length <= 2 && (
        <div className="py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center space-x-1">
            <Sparkles className="w-3 h-3 text-brand-500" />
            <span>Suggested prompts</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {samplePrompts.map((p, i) => (
              <button
                key={i}
                onClick={() => handleSend(p)}
                className="text-left p-2.5 rounded-xl bg-dark-850 hover:bg-dark-800 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 transition line-clamp-1"
              >
                &ldquo;{p}&rdquo;
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat input form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="pt-2"
      >
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            placeholder="Ask anything or instruct the agent to run WooCommerce operations..."
            className="w-full bg-dark-850 border border-slate-700/80 rounded-2xl pl-4 pr-12 py-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition shadow-inner"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2.5 p-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white transition disabled:opacity-40 disabled:hover:bg-brand-600 shadow-md shadow-brand-500/25"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
