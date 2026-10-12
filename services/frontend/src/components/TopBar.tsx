import React, { useState } from "react";
import {
  Menu,
  Copy,
  CheckCircle2,
  Terminal,
  Settings,
} from "lucide-react";
import { NavTab } from "./Sidebar";
import { useAuth } from "../context/AuthContext";

interface TopBarProps {
  activeTab: NavTab;
  onToggleMobileMenu?: () => void;
  onOpenSettings: () => void;
}

const tabTitles: Record<NavTab, { title: string; subtitle: string }> = {
  chat: { title: "AI Operations", subtitle: "Autonomous agent coordinator with WooCommerce, Time & Fetch tools" },
  upstreams: { title: "Upstream MCP Servers", subtitle: "Microservices registered over Streamable HTTP protocol" },
  tools: { title: "Aggregated Tools", subtitle: "Dynamic multi-service tool catalog and interactive sandbox" },
  audit: { title: "Audit & Compliance", subtitle: "Cryptographic HMAC-SHA256 logs of all tool executions" },
  keys: { title: "API Credentials", subtitle: "High-entropy bcrypt-hashed tokens with RBAC access control" },
};

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onToggleMobileMenu,
  onOpenSettings,
}) => {
  const { apiKey } = useAuth();
  const [copiedKey, setCopiedKey] = useState(false);

  const copyKey = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const current = tabTitles[activeTab];

  return (
    <header className="h-16 px-6 border-b border-canvas-border bg-canvas-subtle/80 backdrop-blur-md flex items-center justify-between shrink-0">
      <div className="flex items-center space-x-4">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-canvas-card md:hidden"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500 font-medium">NexusMCP</span>
            <span className="text-xs text-slate-600">/</span>
            <span className="text-xs font-semibold text-slate-200">{current.title}</span>
          </div>
          <p className="text-[11px] text-slate-400 hidden sm:block truncate max-w-md">{current.subtitle}</p>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {/* Streamable HTTP indicator */}
        <div className="hidden lg:flex items-center space-x-2 px-2.5 py-1 rounded-md bg-canvas-card border border-canvas-border text-[11px] text-slate-300">
          <Terminal className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-mono text-slate-400">Streamable HTTP:</span>
          <span className="font-mono text-emerald-400">/mcp</span>
        </div>

        {/* Live cluster status */}
        <div className="flex items-center space-x-2 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-medium text-[11px]">Gateway Active</span>
        </div>

        {/* Copy API Key shortcut */}
        {apiKey && (
          <button
            onClick={copyKey}
            title="Copy current API key"
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-canvas-card hover:bg-canvas-elevated border border-canvas-border text-[11px] font-mono text-slate-300 transition"
          >
            {copiedKey ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>{apiKey.substring(0, 10)}...</span>
              </>
            )}
          </button>
        )}

        <button
          onClick={onOpenSettings}
          title="Connection Settings"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-canvas-card transition"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
