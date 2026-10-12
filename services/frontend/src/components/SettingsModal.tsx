import React, { useState } from "react";
import { X, CheckCircle, AlertTriangle, RefreshCw, Globe } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { apiKey, baseUrl, setKey, setUrl } = useAuth();
  const [inputKey, setInputKey] = useState(apiKey);
  const [inputUrl, setInputUrl] = useState(baseUrl);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      setUrl(inputUrl);
      const health = await api.checkHealth();
      if (health.status === "ok") {
        setTestResult({
          success: true,
          message: `Connected successfully to NexusMCP Gateway (v${health.version})!`,
        });
      } else {
        setTestResult({
          success: false,
          message: `Unexpected response: ${JSON.stringify(health)}`,
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Failed to reach NexusMCP Gateway.",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setUrl(inputUrl);
    if (inputKey !== apiKey) {
      await setKey(inputKey);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-canvas-subtle border border-canvas-border rounded-2xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between pb-3.5 border-b border-canvas-border">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Gateway Connection Settings</h3>
              <p className="text-xs text-slate-400">Configure API endpoint location and authentication credentials</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-canvas-card transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1 font-mono">
              Gateway API Base URL
            </label>
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="http://api.nexusmcp.local:9080 (or empty for relative /api)"
              className="w-full bg-canvas-card border border-canvas-border rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Leave empty if serving via same-origin ingress or reverse proxy.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1 font-mono">
              Nexus API Key
            </label>
            <input
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="nexus_xxxxxxxxxxxxxxxxxxxxxxxx..."
              className="w-full bg-canvas-card border border-canvas-border rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Bearer token for authenticating tool calls and accessing MCP endpoints.
            </p>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-lg border flex items-start space-x-2 text-xs ${
                testResult.success
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-400"
              }`}
            >
              {testResult.success ? (
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span className="font-medium">{testResult.message}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-3.5 border-t border-canvas-border">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-canvas-card hover:bg-canvas-elevated text-slate-200 text-xs font-medium transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? "animate-spin" : ""}`} />
            <span>{isTesting ? "Testing..." : "Test Connection"}</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white text-xs font-medium transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-subtle transition"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
