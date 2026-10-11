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
    if (!window.confirm("Are you sure you want to revoke this API key? This action is irreversible.")) {
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
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
            <Key className="w-6 h-6 text-brand-500" />
            <span>API Key Management</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Issue and revoke high-entropy access credentials for MCP clients and team members.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchKeys}
            disabled={isLoading}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 border border-slate-700/80 text-xs text-slate-300 font-medium transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md shadow-brand-500/25 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Issue New Key</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-accent-rose/10 border border-accent-rose/20 text-accent-rose text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Newly Created Key Alert (One-time view) */}
      {newKeyData && (
        <div className="p-5 rounded-2xl bg-accent-emerald/10 border border-accent-emerald/30 space-y-3 animate-fade-in shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-accent-emerald text-sm font-bold">
              <CheckCircle2 className="w-5 h-5" />
              <span>API Key Successfully Created: &ldquo;{newKeyData.name}&rdquo;</span>
            </div>
            <button
              onClick={() => setNewKeyData(null)}
              className="text-slate-400 hover:text-white text-xs"
            >
              Dismiss
            </button>
          </div>
          <p className="text-xs text-slate-300">
            Please copy this key now. It will <strong>never be shown again</strong> in plaintext!
          </p>
          <div className="flex items-center space-x-2 bg-dark-900/90 border border-slate-800 rounded-xl p-2.5">
            <input
              type="text"
              readOnly
              value={newKeyData.key}
              className="bg-transparent font-mono text-xs text-white w-full focus:outline-none select-all"
            />
            <button
              onClick={() => copyToClipboard(newKeyData.key)}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-accent-emerald text-dark-900 font-bold text-xs shrink-0 hover:bg-accent-emerald/90 transition"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied!" : "Copy"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Keys Table */}
      <div className="rounded-2xl border border-slate-800 bg-dark-850 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-dark-900/80 border-b border-slate-800 uppercase text-[10px] font-semibold tracking-wider text-slate-400">
              <tr>
                <th className="py-3 px-4">Label</th>
                <th className="py-3 px-4">Prefix</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Created At</th>
                <th className="py-3 px-4">Last Used</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {keys.map((k) => (
                <tr key={k.id} className="hover:bg-dark-800/40 transition">
                  <td className="py-3.5 px-4 font-semibold text-white">{k.name}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-300">
                    <span className="px-2 py-0.5 rounded bg-dark-900 border border-slate-800 text-brand-400">
                      {k.key_prefix}...
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        k.is_active
                          ? "bg-accent-emerald/10 text-accent-emerald border-accent-emerald/20"
                          : "bg-slate-700/30 text-slate-400 border-slate-700/50"
                      }`}
                    >
                      {k.is_active ? "Active" : "Revoked"}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-400">
                    {new Date(k.created_at).toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-slate-400">
                    {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "Never"}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {k.is_active && (
                      <button
                        onClick={() => handleRevoke(k.id)}
                        className="text-slate-500 hover:text-accent-rose transition p-1.5 rounded-lg hover:bg-dark-800"
                        title="Revoke key"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {keys.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No API keys issued.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Issue Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-dark-850 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Key className="w-5 h-5 text-brand-500" />
                <h3 className="text-base font-bold text-white">Issue New API Key</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                  Key Label / Name *
                </label>
                <input
                  type="text"
                  required
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="e.g. CLI Dev Key or Staging Bot"
                  className="w-full bg-dark-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              {modalError && (
                <div className="p-3 rounded-xl bg-accent-rose/10 border border-accent-rose/20 text-accent-rose text-xs">
                  {modalError}
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md shadow-brand-500/25 transition disabled:opacity-50"
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
