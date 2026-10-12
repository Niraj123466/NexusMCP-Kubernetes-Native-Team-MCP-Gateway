import React, { useState, useEffect } from "react";
import {
  Wrench,
  Search,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  Code2,
  Loader2,
  RefreshCw,
  Copy,
  Check,
} from "lucide-react";
import { api, getStoredApiKey } from "../services/api";
import { ToolDefinition } from "../types";

export const ToolsPage: React.FC = () => {
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedUpstream, setSelectedUpstream] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTool, setActiveTool] = useState<ToolDefinition | null>(null);
  const [activeTab, setActiveTab] = useState<"runner" | "schema" | "curl">("runner");

  // Execution state
  const [executionArgs, setExecutionArgs] = useState<string>("{}");
  const [isExecuting, setIsExecuting] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [executionResult, setExecutionResult] = useState<{
    success: boolean;
    data: unknown;
    durationMs: number;
  } | null>(null);

  const fetchTools = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.listTools();
      setTools(data);
      if (data.length > 0 && !activeTool) {
        selectTool(data[0]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load aggregated tools");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTools();
  }, []);

  const selectTool = (tool: ToolDefinition) => {
    setActiveTool(tool);
    setExecutionResult(null);

    const defaultArgs: Record<string, unknown> = {};
    const props = tool.input_schema?.properties || {};
    for (const [propName, propDef] of Object.entries(props)) {
      if (propDef.default !== undefined) {
        defaultArgs[propName] = propDef.default;
      } else if (propDef.type === "string") {
        defaultArgs[propName] = "";
      } else if (propDef.type === "integer" || propDef.type === "number") {
        defaultArgs[propName] = 0;
      } else if (propDef.type === "boolean") {
        defaultArgs[propName] = false;
      } else if (propDef.type === "array") {
        defaultArgs[propName] = [];
      } else {
        defaultArgs[propName] = null;
      }
    }
    setExecutionArgs(JSON.stringify(defaultArgs, null, 2));
  };

  const upstreamSlugs = Array.from(
    new Set(tools.map((t) => t.upstream_slug || t.name.split("__")[0]))
  );

  const filteredTools = tools.filter((t) => {
    const slug = t.upstream_slug || t.name.split("__")[0];
    const matchesUpstream = selectedUpstream === "all" || slug === selectedUpstream;
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesUpstream && matchesSearch;
  });

  const handleExecute = async () => {
    if (!activeTool) return;
    setIsExecuting(true);
    setExecutionResult(null);
    const start = Date.now();
    try {
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = JSON.parse(executionArgs);
      } catch {
        throw new Error("Invalid JSON syntax in arguments textarea");
      }

      const res = await api.executeTool(activeTool.name, parsedArgs);
      const durationMs = Date.now() - start;
      setExecutionResult({
        success: true,
        data: res,
        durationMs,
      });
    } catch (err: any) {
      const durationMs = Date.now() - start;
      setExecutionResult({
        success: false,
        data: err.message || "Execution error",
        durationMs,
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const currentApiKey = getStoredApiKey() || "nexus_YOUR_API_KEY";
  const generateCurl = () => {
    if (!activeTool) return "";
    return `curl -X POST http://api.nexusmcp.local:9080/api/tools/execute \\
  -H "X-API-Key: ${currentApiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "${activeTool.name}",
    "arguments": ${executionArgs}
  }'`;
  };

  const copyCurl = () => {
    navigator.clipboard.writeText(generateCurl());
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center space-x-2">
            <Wrench className="w-5 h-5 text-emerald-400" />
            <span>Tools Explorer & Sandbox</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Test and inspect all 8 tools aggregated across WooCommerce, Time, and Fetch microservices.
          </p>
        </div>

        <button
          onClick={fetchTools}
          disabled={isLoading}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-canvas-card hover:bg-canvas-elevated border border-canvas-border text-xs text-slate-300 font-medium transition self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools by name or description..."
            className="w-full bg-canvas-card border border-canvas-border rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition"
          />
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedUpstream("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition ${
              selectedUpstream === "all"
                ? "bg-canvas-elevated text-emerald-400 border border-emerald-500/30 font-semibold"
                : "bg-canvas-card border border-canvas-border text-slate-400 hover:text-slate-200"
            }`}
          >
            All Upstreams ({tools.length})
          </button>
          {upstreamSlugs.map((slug) => (
            <button
              key={slug}
              onClick={() => setSelectedUpstream(slug)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono shrink-0 transition ${
                selectedUpstream === slug
                  ? "bg-canvas-elevated text-emerald-400 border border-emerald-500/30 font-semibold"
                  : "bg-canvas-card border border-canvas-border text-slate-400 hover:text-slate-200"
              }`}
            >
              {slug}
            </button>
          ))}
        </div>
      </div>

      {/* Split Pane Explorer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Tool List (4 cols) */}
        <div className="lg:col-span-4 space-y-1.5 max-h-[72vh] overflow-y-auto pr-1">
          {filteredTools.map((tool) => {
            const isSelected = activeTool?.name === tool.name;
            const upstream = tool.upstream_slug || tool.name.split("__")[0];
            const shortName = tool.name.includes("__") ? tool.name.split("__")[1] : tool.name;

            return (
              <button
                key={tool.name}
                type="button"
                onClick={() => selectTool(tool)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${
                  isSelected
                    ? "bg-canvas-elevated border-emerald-500/40 shadow-subtle"
                    : "bg-canvas-card border-canvas-border hover:border-canvas-border-focus"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-mono text-xs font-semibold ${isSelected ? "text-emerald-400" : "text-slate-200"}`}>
                    {shortName}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-canvas-subtle border border-canvas-border text-slate-400">
                    {upstream}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {tool.description || "No description provided."}
                </p>
              </button>
            );
          })}

          {filteredTools.length === 0 && !isLoading && (
            <div className="p-8 text-center rounded-xl bg-canvas-card border border-canvas-border text-xs text-slate-400">
              No tools matching your search.
            </div>
          )}
        </div>

        {/* Right Column: Interactive Sandbox & Schema Inspector (8 cols) */}
        <div className="lg:col-span-8">
          {activeTool ? (
            <div className="rounded-xl bg-canvas-card border border-canvas-border overflow-hidden">
              {/* Header */}
              <div className="p-4 border-b border-canvas-border bg-canvas-subtle/50">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {activeTool.upstream_slug || activeTool.name.split("__")[0]}
                    </span>
                    <span className="text-xs font-mono font-bold text-white">{activeTool.name}</span>
                  </div>

                  {/* Tabs */}
                  <div className="inline-flex p-0.5 rounded-lg bg-canvas-card border border-canvas-border text-xs">
                    <button
                      onClick={() => setActiveTab("runner")}
                      className={`px-2.5 py-1 rounded-md font-medium transition ${
                        activeTab === "runner"
                          ? "bg-canvas-elevated text-emerald-400 font-semibold"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Playground
                    </button>
                    <button
                      onClick={() => setActiveTab("schema")}
                      className={`px-2.5 py-1 rounded-md font-medium transition ${
                        activeTab === "schema"
                          ? "bg-canvas-elevated text-emerald-400 font-semibold"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Schema
                    </button>
                    <button
                      onClick={() => setActiveTab("curl")}
                      className={`px-2.5 py-1 rounded-md font-medium transition ${
                        activeTab === "curl"
                          ? "bg-canvas-elevated text-emerald-400 font-semibold"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      cURL
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{activeTool.description}</p>
              </div>

              {/* Tab 1: Playground */}
              {activeTab === "runner" && (
                <div className="p-4 space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
                        Input JSON Arguments
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">POST /api/tools/execute</span>
                    </div>
                    <textarea
                      value={executionArgs}
                      onChange={(e) => setExecutionArgs(e.target.value)}
                      rows={4}
                      className="w-full bg-canvas-subtle border border-canvas-border rounded-lg p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50 transition leading-relaxed"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleExecute}
                      disabled={isExecuting}
                      className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-subtle transition disabled:opacity-50"
                    >
                      {isExecuting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Executing...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Execute Tool</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Execution Output */}
                  {executionResult && (
                    <div className="pt-3 border-t border-canvas-border space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-1.5">
                          {executionResult.success ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-rose-400" />
                          )}
                          <span className="font-semibold text-slate-200">
                            {executionResult.success ? "Execution Succeeded (200 OK)" : "Execution Error"}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-slate-400 flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{executionResult.durationMs}ms</span>
                        </span>
                      </div>

                      <pre className="p-3 rounded-lg bg-canvas-subtle border border-canvas-border font-mono text-xs text-slate-200 overflow-x-auto max-h-60 overflow-y-auto leading-relaxed">
                        {typeof executionResult.data === "string"
                          ? executionResult.data
                          : JSON.stringify(executionResult.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Schema */}
              {activeTab === "schema" && (
                <div className="p-4 space-y-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5 font-mono">
                    <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Schema Properties</span>
                  </div>

                  <div className="rounded-lg border border-canvas-border bg-canvas-subtle overflow-hidden">
                    {activeTool.input_schema?.properties &&
                    Object.keys(activeTool.input_schema.properties).length > 0 ? (
                      <table className="w-full text-left text-xs">
                        <thead className="bg-canvas-card border-b border-canvas-border text-[10px] uppercase font-mono text-slate-400">
                          <tr>
                            <th className="py-2.5 px-3">Field</th>
                            <th className="py-2.5 px-3">Type</th>
                            <th className="py-2.5 px-3">Required</th>
                            <th className="py-2.5 px-3">Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-canvas-border">
                          {Object.entries(activeTool.input_schema.properties).map(([name, schema]: any) => {
                            const isReq = activeTool.input_schema.required?.includes(name);
                            return (
                              <tr key={name}>
                                <td className="py-2.5 px-3 font-mono font-semibold text-slate-200">{name}</td>
                                <td className="py-2.5 px-3 font-mono text-emerald-400 text-[11px]">{schema.type || "any"}</td>
                                <td className="py-2.5 px-3">
                                  {isReq ? (
                                    <span className="text-[10px] text-rose-400 font-semibold font-mono">yes</span>
                                  ) : (
                                    <span className="text-[10px] text-slate-500 font-mono">no</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-slate-400 text-[11px]">{schema.description || "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-4 text-xs text-slate-400">No arguments required for this tool.</div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 3: cURL Snippet */}
              {activeTab === "curl" && (
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
                      Terminal Request
                    </span>
                    <button
                      onClick={copyCurl}
                      className="flex items-center space-x-1 text-xs text-slate-400 hover:text-emerald-400 transition"
                    >
                      {copiedCurl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCurl ? "Copied!" : "Copy cURL"}</span>
                    </button>
                  </div>

                  <pre className="p-3 rounded-lg bg-canvas-subtle border border-canvas-border font-mono text-xs text-slate-200 overflow-x-auto leading-relaxed">
                    {generateCurl()}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center rounded-xl bg-canvas-card border border-canvas-border text-xs text-slate-400">
              Select a tool on the left to inspect its schema and execute test payloads.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
