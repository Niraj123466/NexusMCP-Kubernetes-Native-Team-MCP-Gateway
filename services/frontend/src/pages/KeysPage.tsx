import React, { useState, useEffect } from "react";
import {
  Key,
  Plus,
  Trash2,
  Copy,
  CheckCircle2,
  RefreshCw,
  X,
  Loader2,
  AlertCircle,
  Check,
} from "lucide-react";
import { api } from "../services/api";
import { ApiKeyItem } from "../types";

export const KeysPage: React.FC = () => {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal & Creation
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Newly created plaintext key banner
  const [newKeyData, setNewKeyData] = useState<{ name: string; key: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchKeys = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.listKeys();
      setKeys(data);
    } catch (err: any) {
      setError(err.message || "Failed to load API keys");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) return;
    setIsSubmitting(true);
    setModalError(null);
    try {
      const created = await api.createKey(keyName.trim());
      setNewKeyData({ name: created.name, key: created.key });
      setKeyName("");
      setIsModalOpen(false);
      await fetchKeys();
    } catch (err: any) {
      setModalError(err.message || "Failed to generate key");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    if (!window.confirm("Are you sure you want to revoke this API key? This action is permanent and cannot be undone.")) {
      return;
    }
    try {
      await api.revokeKey(keyId);
      await fetchKeys();
    } catch (err: any) {
      alert(`Revoke failed: ${err.message}`);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center space-x-2">
            <Key className="w-5 h-5 text-emerald-400" />
            <span>API Credentials & Access Keys</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Issue and revoke high-entropy access keys used by MCP agents and team members.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={fetchKeys}
            disabled={isLoading}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-canvas-card hover:bg-canvas-elevated border border-canvas-border text-xs text-slate-300 font-medium transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-subtle transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Issue New Key</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Newly Created Key Alert (One-time view) */}
      {newKeyData && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2.5 animate-subtle-fade shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Key Generated: &ldquo;{newKeyData.name}&rdquo;</span>
            </div>
            <button
              onClick={() => setNewKeyData(null)}
              className="text-slate-400 hover:text-white text-[11px]"
            >
              Dismiss
            </button>
          </div>
          <p className="text-[11px] text-slate-300">
            Copy this token now. For security, it is hashed with bcrypt and <strong>will not be displayed again</strong>!
          </p>
          <div className="flex items-center space-x-2 bg-canvas-card border border-canvas-border rounded-lg p-2">
            <input
              type="text"
              readOnly
              value={newKeyData.key}
              className="bg-transparent font-mono text-xs text-slate-100 w-full focus:outline-none select-all"
            />
            <button
              onClick={() => copyToClipboard(newKeyData.key)}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-emerald-600 text-white font-semibold text-xs shrink-0 hover:bg-emerald-500 transition"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Keys Table */}
      <div className="rounded-xl border border-canvas-border bg-canvas-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-canvas-subtle border-b border-canvas-border uppercase text-[10px] font-mono tracking-wider text-slate-400">
              <tr>
                <th className="py-2.5 px-4">Label</th>
                <th className="py-2.5 px-4">Prefix Index</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Issued At</th>
                <th className="py-2.5 px-4">Last Used</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-canvas-border">
              {keys.map((k) => (
                <tr key={k.id} className="hover:bg-canvas-elevated/40 transition">
                  <td className="py-3 px-4 font-semibold text-white">{k.name}</td>
                  <td className="py-3 px-4 font-mono text-slate-300">
                    <span className="px-2 py-0.5 rounded bg-canvas-subtle border border-canvas-border text-emerald-400 text-[11px]">
                      {k.key_prefix}...
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        k.is_active
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-slate-700/30 text-slate-400 border-slate-700/50"
                      }`}
                    >
                      {k.is_active ? "Active" : "Revoked"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-400 text-[11px]">
                    {new Date(k.created_at).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-slate-400 text-[11px]">
                    {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "Never"}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {k.is_active && (
                      <button
                        onClick={() => handleRevoke(k.id)}
                        className="text-slate-500 hover:text-rose-400 transition p-1 rounded-md hover:bg-canvas-subtle"
                        title="Revoke credential"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {keys.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    No API credentials issued.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Issue Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-canvas-subtle border border-canvas-border rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-canvas-border">
              <div className="flex items-center space-x-2">
                <Key className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Issue New API Credential</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-canvas-card transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold uppercase text-slate-300 mb-1">
                  Key Label / Name *
                </label>
                <input
                  type="text"
                  required
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="e.g. Staging MCP Client or CLI Token"
                  className="w-full bg-canvas-card border border-canvas-border rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-sans"
                />
              </div>

              {modalError && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                  {modalError}
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-canvas-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-subtle transition disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <span>Generate Key</span>
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
