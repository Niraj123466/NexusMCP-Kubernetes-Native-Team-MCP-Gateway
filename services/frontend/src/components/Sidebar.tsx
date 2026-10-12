import React from "react";
import {
  Bot,
  Server,
  Wrench,
  ShieldCheck,
  Key,
  Settings,
  LogOut,
  Layers,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

export type NavTab = "chat" | "upstreams" | "tools" | "audit" | "keys";

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onOpenSettings: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  onOpenSettings,
  isCollapsed,
  onToggleCollapse,
}) => {
  const { user, logout } = useAuth();

  const navItems: { id: NavTab; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
    { id: "chat", label: "AI Operations", icon: <Bot className="w-4 h-4" /> },
    { id: "upstreams", label: "Upstream Servers", icon: <Server className="w-4 h-4" /> },
    { id: "tools", label: "Tools Catalog", icon: <Wrench className="w-4 h-4" /> },
    { id: "audit", label: "Audit & Compliance", icon: <ShieldCheck className="w-4 h-4" /> },
    { id: "keys", label: "API Keys", icon: <Key className="w-4 h-4" />, adminOnly: true },
  ];

  return (
    <aside
      className={`relative z-20 flex flex-col shrink-0 bg-canvas-subtle border-r border-canvas-border transition-all duration-200 select-none ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-canvas-border">
        <div
          className="flex items-center space-x-3 cursor-pointer overflow-hidden"
          onClick={() => onTabChange("chat")}
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4 text-emerald-400" />
          </div>
          {!isCollapsed && (
            <div className="leading-tight truncate">
              <span className="font-semibold text-sm tracking-tight text-white">Nexus<span className="text-emerald-400 font-bold">MCP</span></span>
              <p className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">Team Gateway</p>
            </div>
          )}
        </div>

        <button
          onClick={onToggleCollapse}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-canvas-card transition hidden md:flex items-center justify-center"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Cluster Environment Indicator */}
      {!isCollapsed && (
        <div className="px-4 py-3 border-b border-canvas-border bg-canvas-card/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-subtle-pulse" />
              <span className="text-[11px] font-mono text-slate-300">k8s-nexusmcp</span>
            </div>
            <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
              Live
            </span>
          </div>
        </div>
      )}

      {/* Navigation Items */}
      <nav className="flex-1 px-2.5 py-4 space-y-1 overflow-y-auto">
        {navItems
          .filter((item) => !item.adminOnly || user?.role === "admin")
          .map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-canvas-elevated text-emerald-400 border border-emerald-500/30 shadow-subtle font-semibold"
                    : "text-slate-400 hover:text-slate-100 hover:bg-canvas-card/60 border border-transparent"
                } ${isCollapsed ? "justify-center px-0" : ""}`}
              >
                <span className={isActive ? "text-emerald-400" : "text-slate-400"}>
                  {item.icon}
                </span>
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
      </nav>

      {/* External Direct Links */}
      {!isCollapsed && (
        <div className="px-3 py-3 border-t border-canvas-border space-y-1">
          <a
            href="http://store.nexusmcp.local:9080"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-3 py-1.5 rounded-lg text-[11px] text-slate-400 hover:text-slate-200 hover:bg-canvas-card transition"
          >
            <span>WooCommerce Store</span>
            <ExternalLink className="w-3 h-3 text-slate-500" />
          </a>
          <a
            href="http://api.nexusmcp.local:9080/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-3 py-1.5 rounded-lg text-[11px] text-slate-400 hover:text-slate-200 hover:bg-canvas-card transition"
          >
            <span>Gateway API Docs</span>
            <ExternalLink className="w-3 h-3 text-slate-500" />
          </a>
        </div>
      )}

      {/* Bottom Profile Footer */}
      <div className="p-3 border-t border-canvas-border bg-canvas-card/40">
        <div className={`flex items-center ${isCollapsed ? "justify-center" : "justify-between"}`}>
          {!isCollapsed && (
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                {(user?.username || user?.email || "A")[0].toUpperCase()}
              </div>
              <div className="truncate leading-tight">
                <div className="text-xs font-semibold text-slate-200 truncate">{user?.username || "Admin"}</div>
                <div className="text-[10px] text-slate-400 uppercase font-mono">{user?.role || "admin"}</div>
              </div>
            </div>
          )}

          <div className="flex items-center space-x-1 shrink-0">
            <button
              onClick={onOpenSettings}
              title="Gateway Connection Settings"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-canvas-elevated transition"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-canvas-elevated transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
