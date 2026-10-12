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
  Copy,
  Check,
  ShoppingBag,
  Globe,
  SlidersHorizontal,
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
        "Welcome to **NexusMCP Operations**. I coordinate actions across your WooCommerce store, system timezones, and safe web endpoints through unified MCP Streamable HTTP tools.\n\nAsk questions about inventory, manage products, or request external lookups below.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
  const [toolTabs, setToolTabs] = useState<Record<string, "result" | "args">>({});
  const [copiedKeys, setCopiedKeys] = useState<Record<string, boolean>>({});
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

  const copyToClipboard = (key: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedKeys((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setCopiedKeys((prev) => ({ ...prev, [key]: false }));
    }, 2000);
  };

  const samplePrompts = [
    {
      title: "Query WooCommerce Products",
      desc: "List products with pricing & stock status",
      icon: <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />,
      prompt: "List all products in my WooCommerce store with their current price, stock count, and ID.",
    },
    {
      title: "Global Timezone Comparison",
      desc: "Current time in Tokyo, New York & London",
      icon: <Clock className="w-3.5 h-3.5 text-cyan-400" />,
      prompt: "What is the current time in Tokyo, London, and New York using the time MCP tool?",
    },
    {
      title: "Create Catalog Product",
      desc: "Publish new simple product in WooCommerce",
      icon: <Sparkles className="w-3.5 h-3.5 text-amber-400" />,
      prompt: "Create a new WooCommerce product: 'Nexus Cloud Shell Jacket' for $129.99 with 30 units of stock.",
    },
    {
      title: "SSRF-Safe Web Fetch",
      desc: "Safely read and summarize remote URL",
      icon: <Globe className="w-3.5 h-3.5 text-violet-400" />,
      prompt: "Fetch the page content from https://news.ycombinator.com and summarize the top headline.",
    },
  ];

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || isLoading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    const startTime = Date.now();

    try {
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
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: `**Error:** ${err.message || "Failed to communicate with AI chat agent."}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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
          "Conversation reset. How can I help you coordinate MCP operations today?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col h-[calc(100vh-4rem)]">
      {/* Top Controls Ribbon */}
      <div className="flex items-center justify-between pb-3.5 border-b border-canvas-border">
        <div className="flex items-center space-x-2">
          {/* Provider selector pill */}
          <div className="inline-flex p-0.5 rounded-lg bg-canvas-card border border-canvas-border">
            <button
              onClick={() => setSelectedProvider("gemini")}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition ${
                selectedProvider === "gemini"
                  ? "bg-canvas-elevated text-emerald-400 font-semibold shadow-subtle"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Gemini 2.0 Flash</span>
            </button>
            <button
              onClick={() => setSelectedProvider("ollama")}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition ${
                selectedProvider === "ollama"
                  ? "bg-canvas-elevated text-emerald-400 font-semibold shadow-subtle"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Ollama (Local)</span>
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowSystemPrompt(!showSystemPrompt)}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
              showSystemPrompt
                ? "bg-canvas-elevated border-emerald-500/40 text-emerald-400"
                : "bg-canvas-card border-canvas-border text-slate-400 hover:text-slate-200"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Instructions</span>
          </button>

          <button
            onClick={handleReset}
            title="Reset conversation"
            className="p-1.5 rounded-lg bg-canvas-card border border-canvas-border text-slate-400 hover:text-slate-200 hover:bg-canvas-elevated transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* System prompt drawer */}
      {showSystemPrompt && (
        <div className="my-3 p-3.5 rounded-xl bg-canvas-card border border-canvas-border space-y-2 animate-subtle-fade">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <span>Custom System Prompt</span>
            <span className="text-slate-500 font-normal">Passed to agent loop</span>
          </div>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="You are an expert WooCommerce administrator. Always verify stock and confirm order status before modifying..."
            rows={2}
            className="w-full bg-canvas-subtle border border-canvas-border rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>
      )}

      {/* Messages Canvas */}
      <div className="flex-1 overflow-y-auto py-5 space-y-5 pr-1">
        {messages.map((m) => {
          const isUser = m.role === "user";
          return (
            <div
              key={m.id}
              className={`flex items-start space-x-3.5 ${isUser ? "flex-row-reverse space-x-reverse" : ""}`}
            >
              {/* Avatar */}
              <div
                className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center font-bold text-xs ${
                  isUser
                    ? "bg-slate-700 text-white"
                    : "bg-emerald-500/10 border border-emerald-500/25 text-emerald-400"
                }`}
              >
                {isUser ? <UserIcon className="w-3.5 h-3.5" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Message Card */}
              <div
                className={`max-w-2xl rounded-xl p-4 text-xs sm:text-sm leading-relaxed ${
                  isUser
                    ? "bg-canvas-elevated border border-canvas-border text-slate-100 rounded-tr-none shadow-sm"
                    : "bg-canvas-card border border-canvas-border text-slate-200 rounded-tl-none shadow-subtle"
                }`}
              >
                <div className="whitespace-pre-wrap font-sans">{m.content}</div>

                {/* Collapsible Tool Call Execution Cards */}
                {m.toolExecutions && m.toolExecutions.length > 0 && (
                  <div className="mt-3.5 pt-3.5 border-t border-canvas-border space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span className="flex items-center space-x-1.5 font-semibold text-slate-300">
                        <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                        <span>MCP Tool Calls ({m.toolExecutions.length})</span>
                      </span>
                    </div>

                    {m.toolExecutions.map((t, idx) => {
                      const toolKey = `${m.id}-tool-${idx}`;
                      const isExpanded = !!expandedTools[toolKey];
                      const activeTab = toolTabs[toolKey] || "result";
                      const isCopied = !!copiedKeys[toolKey];

                      const rawPayload = activeTab === "result" ? t.result : t.arguments;
                      const stringifiedPayload =
                        typeof rawPayload === "string"
                          ? rawPayload
                          : JSON.stringify(rawPayload, null, 2);

                      return (
                        <div
                          key={toolKey}
                          className="rounded-lg border border-canvas-border bg-canvas-subtle overflow-hidden"
                        >
                          {/* Tool Header Banner */}
                          <div className="flex items-center justify-between p-2.5 bg-canvas-card/60">
                            <div className="flex items-center space-x-2">
                              {t.status === "success" ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                              )}
                              <span className="font-mono text-xs font-semibold text-slate-200">
                                {t.tool}
                              </span>
                            </div>

                            <div className="flex items-center space-x-2">
                              <span
                                className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-semibold ${
                                  t.status === "success"
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                }`}
                              >
                                {t.status}
                              </span>

                              <button
                                type="button"
                                onClick={() => toggleToolExpand(toolKey)}
                                className="flex items-center space-x-1 text-slate-400 hover:text-slate-200 text-[10px] px-1.5 py-0.5 rounded hover:bg-canvas-elevated transition"
                              >
                                <span>{isExpanded ? "Collapse" : "Inspect"}</span>
                                {isExpanded ? (
                                  <ChevronDown className="w-3 h-3" />
                                ) : (
                                  <ChevronRight className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Expanded Content with Tabs & Copy */}
                          {isExpanded && (
                            <div className="p-3 border-t border-canvas-border space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="inline-flex p-0.5 rounded-md bg-canvas-card border border-canvas-border text-[10px]">
                                  <button
                                    onClick={() => setToolTabs((p) => ({ ...p, [toolKey]: "result" }))}
                                    className={`px-2 py-0.5 rounded font-medium transition ${
                                      activeTab === "result"
                                        ? "bg-canvas-elevated text-emerald-400 font-semibold"
                                        : "text-slate-400 hover:text-slate-200"
                                    }`}
                                  >
                                    Result
                                  </button>
                                  <button
                                    onClick={() => setToolTabs((p) => ({ ...p, [toolKey]: "args" }))}
                                    className={`px-2 py-0.5 rounded font-medium transition ${
                                      activeTab === "args"
                                        ? "bg-canvas-elevated text-emerald-400 font-semibold"
                                        : "text-slate-400 hover:text-slate-200"
                                    }`}
                                  >
                                    Arguments
                                  </button>
                                </div>

                                <button
                                  onClick={() => copyToClipboard(toolKey, stringifiedPayload)}
                                  className="flex items-center space-x-1 text-[10px] text-slate-400 hover:text-emerald-400 transition"
                                >
                                  {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                  <span>{isCopied ? "Copied" : "Copy JSON"}</span>
                                </button>
                              </div>

                              <pre className="p-2.5 rounded-md bg-canvas-card border border-canvas-border text-slate-300 font-mono text-[11px] overflow-x-auto max-h-52 overflow-y-auto leading-relaxed">
                                {stringifiedPayload}
                              </pre>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Turn metrics footer */}
                {(m.durationMs || m.iterations) && (
                  <div className="mt-2.5 pt-2 border-t border-canvas-border/50 flex items-center space-x-3 text-[10px] font-mono text-slate-400">
                    {m.durationMs && (
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{m.durationMs}ms</span>
                      </span>
                    )}
                    {m.iterations && (
                      <span>{m.iterations} turn{m.iterations > 1 ? "s" : ""}</span>
                    )}
                    <span className="text-slate-600">•</span>
                    <span>{m.timestamp}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-start space-x-3.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 animate-pulse" />
            </div>
            <div className="bg-canvas-card border border-canvas-border rounded-xl rounded-tl-none p-3.5 flex items-center space-x-2.5 text-xs text-slate-400 shadow-subtle">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
              <span>Coordinating with upstream MCP tools...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompt Cards */}
      {messages.length <= 2 && (
        <div className="py-2 space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Suggested Operations</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {samplePrompts.map((p, i) => (
              <button
                key={i}
                onClick={() => handleSend(p.prompt)}
                className="text-left p-3 rounded-xl bg-canvas-card hover:bg-canvas-elevated border border-canvas-border hover:border-canvas-border-focus transition-all group"
              >
                <div className="flex items-center space-x-2 mb-1">
                  {p.icon}
                  <span className="text-xs font-semibold text-slate-200 group-hover:text-emerald-400 transition">
                    {p.title}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-1">{p.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Composer Input */}
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
            placeholder="Ask agent or instruct operations (e.g. 'List all products in stock', 'What time is it in Tokyo?')..."
            className="w-full bg-canvas-card border border-canvas-border rounded-xl pl-4 pr-12 py-3.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2.5 p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-40 shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
