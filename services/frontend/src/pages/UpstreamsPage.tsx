import React, { useState, useEffect } from "react";
import {
  Server,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle2,
  Globe,
  Radio,
  X,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { api } from "../services/api";
import { UpstreamServer } from "../types";

export const UpstreamsPage: React.FC = () => {
  const [upstreams, setUpstreams] = useState<UpstreamServer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncingSlug, setSyncingSlug] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form state
  const [formSlug, setFormSlug] = useState("");
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formAuthType, setFormAuthType] = useState("none");
  const [formAuthToken, setFormAuthToken] = useState("");
  const [formTimeout, setFormTimeout] = useState(30);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchUpstreams = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.listUpstreams();
      setUpstreams(data);
    } catch (err: any) {
      setError(err.message || "Failed to load upstream MCP servers");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUpstreams();
  }, []);

  const handleSync = async (slug: string) => {
    setSyncingSlug(slug);
    try {
      await api.syncUpstream(slug);
      await fetchUpstreams();
    } catch (err: any) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      setSyncingSlug(null);
    }
  };

  const handleDelete = async (slug: string) => {
    if (!window.confirm(`Are you sure you want to delete upstream server '${slug}'?`)) {
      return;
    }
    try {
      await api.deleteUpstream(slug);
      await fetchUpstreams();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleToggleEnabled = async (slug: string, currentEnabled: boolean) => {
    try {
      await api.updateUpstream(slug, { enabled: !currentEnabled });
      await fetchUpstreams();
    } catch (err: any) {
      alert(`Failed to update upstream: ${err.message}`);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSubmitting(true);
    try {
      await api.createUpstream({
        slug: formSlug.trim(),
        name: formName.trim(),
        url: formUrl.trim(),
        description: formDesc.trim() || undefined,
        auth_type: formAuthType,
        auth_token: formAuthToken.trim() || undefined,
        timeout_seconds: Number(formTimeout),
      });
      setIsAddModalOpen(false);
      setFormSlug("");
      setFormName("");
      setFormUrl("");
      setFormDesc("");
      setFormAuthToken("");
      await fetchUpstreams();
    } catch (err: any) {
      setFormError(err.message || "Failed to register upstream server");
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center space-x-2">
            <Server className="w-5 h-5 text-emerald-400" />
            <span>Upstream MCP Microservices</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Registered microservices aggregated by the Gateway using Streamable HTTP.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={fetchUpstreams}
            disabled={isLoading}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-canvas-card hover:bg-canvas-elevated border border-canvas-border text-xs text-slate-300 font-medium transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-subtle transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Register Upstream</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <div className="p-4 rounded-xl bg-canvas-card border border-canvas-border flex items-center space-x-3.5">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Server className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-medium">Registered Services</div>
            <div className="text-xl font-bold text-white font-mono">{upstreams.length}</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-canvas-card border border-canvas-border flex items-center space-x-3.5">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-medium">Active & Healthy</div>
            <div className="text-xl font-bold text-white font-mono">
              {upstreams.filter((u: any) => u.enabled ?? u.is_enabled ?? true).length}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-canvas-card border border-canvas-border flex items-center space-x-3.5">
          <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-medium">Protocol Standard</div>
            <div className="text-base font-bold text-white font-mono">Streamable HTTP</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Servers list */}
      <div className="space-y-3">
        {upstreams.map((server: any) => {
          const isEnabled = server.enabled ?? server.is_enabled ?? true;
          const isSyncing = syncingSlug === server.slug;
          return (
            <div
              key={server.slug}
              className={`p-4 rounded-xl border transition-all ${
                isEnabled
                  ? "bg-canvas-card border-canvas-border hover:border-canvas-border-focus"
                  : "bg-canvas-card/40 border-canvas-border/50 opacity-60"
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2.5">
                    <span className="text-sm font-bold text-white">{server.name}</span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-canvas-subtle border border-canvas-border text-emerald-400">
                      {server.slug}
                    </span>
                    <span
                      className={`text-[9px] font-semibold uppercase px-2 py-0.5 rounded-full border ${
                        isEnabled
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-slate-700/30 text-slate-400 border-slate-700/50"
                      }`}
                    >
                      {isEnabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400">{server.description || "No description provided."}</p>

                  <div className="flex items-center space-x-3 pt-1 text-[11px] text-slate-400 font-mono">
                    <span className="flex items-center space-x-1 text-slate-300 truncate max-w-md">
                      <Globe className="w-3 h-3 text-slate-500" />
                      <span>{server.url}</span>
                    </span>
                    <span className="text-slate-600">•</span>
                    <span>Timeout: {server.timeout_seconds || 30}s</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => handleSync(server.slug)}
                    disabled={isSyncing || !isEnabled}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-canvas-subtle hover:bg-canvas-elevated border border-canvas-border text-xs text-slate-200 font-medium transition disabled:opacity-40"
                    title="Synchronize tools via Streamable HTTP initialize"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-emerald-400" : ""}`} />
                    <span>{isSyncing ? "Syncing..." : "Sync Tools"}</span>
                  </button>

                  <button
                    onClick={() => handleToggleEnabled(server.slug, isEnabled)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                      isEnabled
                        ? "bg-canvas-subtle border-canvas-border text-slate-300 hover:text-white"
                        : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                    }`}
                  >
                    {isEnabled ? "Disable" : "Enable"}
                  </button>

                  <button
                    onClick={() => handleDelete(server.slug)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-canvas-elevated transition"
                    title="Delete Upstream Server"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {upstreams.length === 0 && !isLoading && (
          <div className="p-12 text-center rounded-xl bg-canvas-card border border-canvas-border space-y-2">
            <Server className="w-8 h-8 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-white">No Upstream Microservices Registered</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Add your first MCP server (e.g., WooCommerce, Time, or Fetch) to begin aggregating tools.
            </p>
          </div>
        )}
      </div>

      {/* Add Upstream Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-canvas-subtle border border-canvas-border rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3.5 border-b border-canvas-border">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Register Upstream MCP Server</h3>
                  <p className="text-xs text-slate-400">Connect a Streamable HTTP MCP microservice to the gateway</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-canvas-card transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-300 mb-1">
                    Slug (Namespace) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                    placeholder="e.g. analytics"
                    className="w-full bg-canvas-card border border-canvas-border rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-300 mb-1">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Analytics MCP"
                    className="w-full bg-canvas-card border border-canvas-border rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-slate-300 mb-1">
                  MCP Streamable HTTP URL *
                </label>
                <input
                  type="url"
                  required
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="http://analytics-mcp-svc:8004/mcp"
                  className="w-full bg-canvas-card border border-canvas-border rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-slate-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Operations for querying business analytics metrics"
                  className="w-full bg-canvas-card border border-canvas-border rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-300 mb-1">
                    Auth Type
                  </label>
                  <select
                    value={formAuthType}
                    onChange={(e) => setFormAuthType(e.target.value)}
                    className="w-full bg-canvas-card border border-canvas-border rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="none">None (Internal)</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="api_key">API Key Header</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-300 mb-1">
                    Timeout (Seconds)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={formTimeout}
                    onChange={(e) => setFormTimeout(Number(e.target.value))}
                    className="w-full bg-canvas-card border border-canvas-border rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {formAuthType !== "none" && (
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-300 mb-1 flex items-center justify-between">
                    <span>Credential Token</span>
                    <span className="text-[10px] text-emerald-400 font-mono">AES-256-GCM Encrypted</span>
                  </label>
                  <input
                    type="password"
                    value={formAuthToken}
                    onChange={(e) => setFormAuthToken(e.target.value)}
                    placeholder="Secret token..."
                    className="w-full bg-canvas-card border border-canvas-border rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              )}

              {formError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                  {formError}
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-canvas-border">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg text-slate-400 hover:text-white text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-subtle transition disabled:opacity-50"
                >
                  {formSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Registering...</span>
                    </>
                  ) : (
                    <span>Register Server</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
