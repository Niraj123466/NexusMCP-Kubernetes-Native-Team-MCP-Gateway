import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Terminal,
  Search,
  Copy,
  Check,
  X,
} from "lucide-react";
import { api } from "../services/api";

interface AuditItem {
  id: string;
  user_id: string;
  upstream_id?: string;
  tool_name: string;
  args_hash: string;
  duration_ms?: number;
  outcome: string;
  error_message?: string;
  created_at: string;
}

export const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [outcomeFilter, setOutcomeFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditItem | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.listAuditLogs({
        outcome: outcomeFilter || undefined,
        limit: 100,
      });
      setLogs(data as any);
    } catch (err: any) {
      setError(err.message || "Failed to load audit logs");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [outcomeFilter]);

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.tool_name.toLowerCase().includes(q) ||
      (log.error_message && log.error_message.toLowerCase().includes(q)) ||
      log.args_hash.toLowerCase().includes(q)
    );
  });

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span>Audit & Compliance Ledger</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable cryptographic records of all tool calls, HMAC argument hashes, and latencies.
          </p>
        </div>

        <button
          onClick={fetchLogs}
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
            placeholder="Search audit records by tool name, error text, or args hash..."
            className="w-full bg-canvas-card border border-canvas-border rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition"
          />
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setOutcomeFilter("")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              outcomeFilter === ""
                ? "bg-canvas-elevated text-emerald-400 border border-emerald-500/30 font-semibold"
                : "bg-canvas-card border border-canvas-border text-slate-400 hover:text-slate-200"
            }`}
          >
            All ({logs.length})
          </button>
          <button
            onClick={() => setOutcomeFilter("success")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              outcomeFilter === "success"
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold"
                : "bg-canvas-card border border-canvas-border text-slate-400 hover:text-slate-200"
            }`}
          >
            Success
          </button>
          <button
            onClick={() => setOutcomeFilter("error")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              outcomeFilter === "error"
                ? "bg-rose-500/15 text-rose-400 border border-rose-500/30 font-semibold"
                : "bg-canvas-card border border-canvas-border text-slate-400 hover:text-slate-200"
            }`}
          >
            Errors
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-xl border border-canvas-border bg-canvas-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-canvas-subtle border-b border-canvas-border uppercase text-[10px] font-mono tracking-wider text-slate-400">
              <tr>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">Tool Name</th>
                <th className="py-2.5 px-4">Duration</th>
                <th className="py-2.5 px-4">HMAC-SHA256 Args Hash</th>
                <th className="py-2.5 px-4">Actor ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-canvas-border font-mono">
              {filteredLogs.map((log) => {
                const isSuccess = log.outcome === "success";
                return (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-canvas-elevated/60 transition cursor-pointer"
                  >
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-sans font-semibold border ${
                          isSuccess
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}
                      >
                        {isSuccess ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <AlertCircle className="w-3 h-3" />
                        )}
                        <span>{log.outcome}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 whitespace-nowrap text-[11px]">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-white whitespace-nowrap">
                      {log.tool_name}
                    </td>
                    <td className="py-2.5 px-4 text-slate-300 whitespace-nowrap">
                      {log.duration_ms !== null && log.duration_ms !== undefined
                        ? `${log.duration_ms}ms`
                        : "—"}
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                      {log.args_hash ? log.args_hash.substring(0, 16) + "..." : "—"}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                      {log.user_id ? log.user_id.substring(0, 8) + "..." : "—"}
                    </td>
                  </tr>
                );
              })}

              {filteredLogs.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500 font-sans">
                    No audit records match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Drawer Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-canvas-subtle border border-canvas-border rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-canvas-border">
              <div className="flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white font-mono">{selectedLog.tool_name}</h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-canvas-card transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-slate-500 uppercase text-[10px] font-semibold">Outcome:</span>
                  <div className="font-semibold text-slate-200 mt-0.5">{selectedLog.outcome}</div>
                </div>
                <div>
                  <span className="text-slate-500 uppercase text-[10px] font-semibold">Duration:</span>
                  <div className="text-slate-300 font-mono mt-0.5">{selectedLog.duration_ms}ms</div>
                </div>
              </div>

              <div>
                <span className="text-slate-500 uppercase text-[10px] font-semibold">Timestamp:</span>
                <div className="text-slate-300 font-mono text-[11px] mt-0.5">
                  {new Date(selectedLog.created_at).toISOString()}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-500 uppercase text-[10px] font-semibold">
                    Cryptographic HMAC-SHA256 Args Hash:
                  </span>
                  <button
                    onClick={() => copyHash(selectedLog.args_hash)}
                    className="flex items-center space-x-1 text-[10px] text-slate-400 hover:text-emerald-400 transition"
                  >
                    {copiedHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedHash ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <div className="text-slate-300 font-mono text-[11px] p-2.5 rounded-lg bg-canvas-card border border-canvas-border break-all select-all">
                  {selectedLog.args_hash}
                </div>
              </div>

              {selectedLog.error_message && (
                <div>
                  <span className="text-rose-400 uppercase text-[10px] font-semibold">Error Trace:</span>
                  <div className="text-rose-400 font-mono text-[11px] mt-1 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 break-all">
                    {selectedLog.error_message}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
