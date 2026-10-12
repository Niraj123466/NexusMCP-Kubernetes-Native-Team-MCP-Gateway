import React, { useState } from "react";
import { Key, Shield, Layers, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export const LoginView: React.FC = () => {
  const { setKey, error } = useAuth();
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) {
      setLocalError("Please enter your NexusMCP API Key.");
      return;
    }
    setLocalError(null);
    setIsSubmitting(true);
    const ok = await setKey(apiKeyInput.trim());
    setIsSubmitting(false);
    if (!ok) {
      setLocalError("Invalid API key or cannot reach the Gateway.");
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-canvas-card border border-canvas-border rounded-2xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
            <Layers className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">NexusMCP Platform</h2>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Team MCP Gateway Platform for WooCommerce hosting, tool aggregation & AI agentic workflows.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1.5 font-mono">
              Nexus Access Key
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Key className="w-4 h-4" />
              </div>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="nexus_xxxxxxxxxxxxxxxxxxxxxxxx..."
                className="w-full bg-canvas-subtle border border-canvas-border rounded-lg pl-9 pr-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 font-mono transition"
              />
            </div>
          </div>

          {(localError || error) && (
            <div className="flex items-center space-x-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{localError || error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-subtle transition disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Connect to Gateway</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        <div className="pt-3 border-t border-canvas-border text-center">
          <div className="flex items-center justify-center space-x-1.5 text-[11px] text-slate-500">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Authenticated with bcrypt key hash & RBAC identity</span>
          </div>
        </div>
      </div>
    </div>
  );
};
