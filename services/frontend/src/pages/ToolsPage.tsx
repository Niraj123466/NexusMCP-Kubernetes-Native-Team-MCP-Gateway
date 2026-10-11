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
} from "lucide-react";
import { api } from "../services/api";
import { ToolDefinition } from "../types";

export const ToolsPage: React.FC = () => {
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedUpstream, setSelectedUpstream] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTool, setActiveTool] = useState<ToolDefinition | null>(null);

  // Execution state
  const [executionArgs, setExecutionArgs] = useState<string>("{}");
  const [isExecuting, setIsExecuting] = useState(false);
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

    // Generate sample args template based on schema properties
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

  // Upstream unique list
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
        throw new Error("Invalid JSON in Arguments field");
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
            <Wrench className="w-6 h-6 text-brand-500" />
            <span>Aggregated Tools Catalog</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Discover and interactively test MCP tools aggregated across all enabled upstream microservices.
          </p>
        </div>

        <button
          onClick={fetchTools}
          disabled={isLoading}
          className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 border border-slate-700/80 text-xs text-slate-300 font-medium transition self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh Tools</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-accent-rose/10 border border-accent-rose/20 text-accent-rose text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools by name or description..."
            className="w-full bg-dark-850 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition"
          />
        </div>

        <div className="flex items-center space-x-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedUpstream("all")}
            className={`px-3 py-2 rounded-xl text-xs font-medium shrink-0 transition ${
              selectedUpstream === "all"
                ? "bg-brand-600 text-white"
                : "bg-dark-850 border border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            All Upstreams ({tools.length})
          </button>
          {upstreamSlugs.map((slug) => (
            <button
              key={slug}
              onClick={() => setSelectedUpstream(slug)}
              className={`px-3 py-2 rounded-xl text-xs font-mono shrink-0 transition ${
                selectedUpstream === slug
                  ? "bg-brand-600 text-white"
                  : "bg-dark-850 border border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              {slug}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Tool List on Left, Detail/Runner on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Tool list (5 cols) */}
        <div className="lg:col-span-5 space-y-2 max-h-[75vh] overflow-y-auto pr-1">
          {filteredTools.map((tool) => {
            const isSelected = activeTool?.name === tool.name;
            const upstream = tool.upstream_slug || tool.name.split("__")[0];
            const shortName = tool.name.includes("__") ? tool.name.split("__")[1] : tool.name;

            return (
              <button
                key={tool.name}
                type="button"
                onClick={() => selectTool(tool)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  isSelected
                    ? "bg-dark-800 border-brand-500/50 shadow-md shadow-brand-500/10"
                    : "bg-dark-850 border-slate-800 hover:border-slate-700/80"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-xs font-bold text-white">{shortName}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-dark-900 border border-slate-800 text-brand-400">
                    {upstream}
                  </span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  {tool.description || "No description available."}
                </p>
              </button>
            );
          })}

          {filteredTools.length === 0 && !isLoading && (
            <div className="p-8 text-center rounded-xl bg-dark-850 border border-slate-800 text-xs text-slate-400">
              No matching tools found.
            </div>
          )}
        </div>

        {/* Tool Inspector and Sandbox (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {activeTool ? (
            <div className="p-6 rounded-2xl bg-dark-850 border border-slate-800 space-y-6">
              {/* Header */}
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-xs font-mono uppercase tracking-wider text-brand-500 font-bold">
                    {activeTool.upstream_slug || activeTool.name.split("__")[0]}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-xs text-slate-400">MCP Tool</span>
                </div>
                <h2 className="text-xl font-bold font-mono text-white">{activeTool.name}</h2>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">{activeTool.description}</p>
              </div>

              {/* Schema parameters preview */}
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                  <Code2 className="w-3.5 h-3.5 text-brand-500" />
                  <span>Input Parameter Schema</span>
                </div>

                <div className="rounded-xl border border-slate-800 bg-dark-900 p-3 space-y-2 text-xs">
                  {activeTool.input_schema?.properties &&
                  Object.keys(activeTool.input_schema.properties).length > 0 ? (
                    <div className="space-y-2">
                      {Object.entries(activeTool.input_schema.properties).map(([name, schema]: any) => {
                        const isRequired = activeTool.input_schema.required?.includes(name);
                        return (
                          <div key={name} className="flex items-start justify-between py-1 border-b border-slate-800/60 last:border-0">
                            <div>
                              <div className="flex items-center space-x-1.5">
                                <span className="font-mono font-semibold text-slate-200">{name}</span>
                                {isRequired && (
                                  <span className="text-[10px] text-accent-rose font-medium">*required</span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-400">{schema.description || ""}</span>
                            </div>
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-dark-950 text-slate-400">
                              {schema.type || "any"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-slate-500 text-[11px]">No input arguments required.</div>
                  )}
                </div>
              </div>

              {/* Interactive Execution Sandbox */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                    <Play className="w-3.5 h-3.5 text-accent-emerald" />
                    <span>Interactive Execution Sandbox</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">JSON Arguments</span>
                </div>

                <textarea
                  value={executionArgs}
                  onChange={(e) => setExecutionArgs(e.target.value)}
                  rows={4}
                  className="w-full bg-dark-900 border border-slate-700/80 rounded-xl p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-brand-500 transition"
                />

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleExecute}
                    disabled={isExecuting}
                    className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-accent-emerald hover:bg-accent-emerald/90 text-dark-900 font-bold text-xs shadow-md shadow-accent-emerald/20 transition disabled:opacity-50"
                  >
                    {isExecuting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Invoking Tool...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Execute Tool</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Execution Result */}
              {executionResult && (
                <div className="space-y-2 pt-2 border-t border-slate-800 animate-fade-in">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-1.5">
                      {executionResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-accent-emerald" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-accent-rose" />
                      )}
                      <span className="font-semibold text-slate-200">
                        {executionResult.success ? "Execution Succeeded" : "Execution Failed"}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-400 flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{executionResult.durationMs}ms</span>
                    </span>
                  </div>

                  <pre className="p-3 rounded-xl bg-dark-950 border border-slate-800 font-mono text-xs text-slate-200 overflow-x-auto max-h-60 overflow-y-auto">
                    {typeof executionResult.data === "string"
                      ? executionResult.data
                      : JSON.stringify(executionResult.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center rounded-2xl bg-dark-850 border border-slate-800 text-xs text-slate-400">
              Select a tool on the left to inspect its schema and execute test payloads.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
