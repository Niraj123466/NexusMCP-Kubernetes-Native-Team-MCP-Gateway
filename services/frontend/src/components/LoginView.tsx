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
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-dark-850/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-brand-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-accent-violet/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-brand-600 to-accent-violet text-white shadow-xl shadow-brand-500/25">
              <Layers className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Welcome to NexusMCP</h2>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Unified MCP Gateway Platform for WooCommerce hosting, tool aggregation & AI agentic workflows.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Nexus API Key
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Key className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="nexus_xxxxxxxxxxxxxxxxxxxxxxxx..."
                  className="w-full bg-dark-900 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 font-mono transition"
                />
              </div>
            </div>

            {(localError || error) && (
              <div className="flex items-center space-x-2 p-3 rounded-xl bg-accent-rose/10 border border-accent-rose/20 text-accent-rose text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{localError || error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-accent-violet hover:from-brand-500 hover:to-accent-violet/90 text-white font-semibold text-sm shadow-lg shadow-brand-500/25 transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Connect to Gateway</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-800/80 text-center">
            <div className="flex items-center justify-center space-x-1.5 text-xs text-slate-400">
              <Shield className="w-3.5 h-3.5 text-brand-500" />
              <span>Secured by bcrypt hashing & RBAC token verification</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
