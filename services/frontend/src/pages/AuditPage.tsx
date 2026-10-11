import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Terminal,
  Search,
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
            <ShieldCheck className="w-6 h-6 text-brand-500" />
            <span>Audit & Compliance Logs</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Immutable cryptographic records of all tool calls, HMAC argument hashes, and execution metrics.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          disabled={isLoading}
          className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 border border-slate-700/80 text-xs text-slate-300 font-medium transition self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-accent-rose/10 border border-accent-rose/20 text-accent-rose text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search logs by tool name, error, or args hash..."
            className="w-full bg-dark-850 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition"
          />
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setOutcomeFilter("")}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition ${
              outcomeFilter === ""
                ? "bg-brand-600 text-white"
                : "bg-dark-850 border border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            All Outcomes ({logs.length})
          </button>
          <button
            onClick={() => setOutcomeFilter("success")}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition ${
              outcomeFilter === "success"
                ? "bg-accent-emerald text-dark-900 font-semibold"
                : "bg-dark-850 border border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            Success
          </button>
          <button
            onClick={() => setOutcomeFilter("error")}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition ${
              outcomeFilter === "error"
                ? "bg-accent-rose text-white"
                : "bg-dark-850 border border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            Error
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-2xl border border-slate-800 bg-dark-850 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-dark-900/80 border-b border-slate-800 uppercase text-[10px] font-semibold tracking-wider text-slate-400">
              <tr>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Tool Name</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Arg HMAC-SHA256</th>
                <th className="py-3 px-4">User ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredLogs.map((log) => {
                const isSuccess = log.outcome === "success";
                return (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-dark-800/60 transition cursor-pointer"
                  >
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-sans font-semibold border ${
                          isSuccess
                            ? "bg-accent-emerald/10 text-accent-emerald border-accent-emerald/20"
                            : "bg-accent-rose/10 text-accent-rose border-accent-rose/20"
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
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-bold text-white whitespace-nowrap">
                      {log.tool_name}
                    </td>
                    <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                      {log.duration_ms !== null && log.duration_ms !== undefined
                        ? `${log.duration_ms}ms`
                        : "—"}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                      {log.args_hash ? log.args_hash.substring(0, 16) + "..." : "—"}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                      {log.user_id ? log.user_id.substring(0, 8) + "..." : "—"}
                    </td>
                  </tr>
                );
              })}

              {filteredLogs.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                    No audit records match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-dark-850 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Terminal className="w-5 h-5 text-brand-500" />
                <h3 className="text-base font-bold text-white font-mono">{selectedLog.tool_name}</h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded-lg bg-dark-900 border border-slate-800"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500 uppercase text-[10px] font-semibold">Outcome:</span>
                <div className="font-semibold text-slate-200 mt-0.5">{selectedLog.outcome}</div>
              </div>

              <div>
                <span className="text-slate-500 uppercase text-[10px] font-semibold">Timestamp:</span>
                <div className="text-slate-300 font-mono mt-0.5">
                  {new Date(selectedLog.created_at).toISOString()}
                </div>
              </div>

              <div>
                <span className="text-slate-500 uppercase text-[10px] font-semibold">Full Args Hash:</span>
                <div className="text-slate-300 font-mono text-[11px] mt-0.5 p-2 rounded bg-dark-900 border border-slate-800 break-all select-all">
                  {selectedLog.args_hash}
                </div>
              </div>

              {selectedLog.error_message && (
                <div>
                  <span className="text-accent-rose uppercase text-[10px] font-semibold">Error Message:</span>
                  <div className="text-accent-rose font-mono text-[11px] mt-0.5 p-2 rounded bg-accent-rose/10 border border-accent-rose/20 break-all">
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
