import React from "react";
import {
  Bot,
  Server,
  Wrench,
  ShieldCheck,
  Key,
  Settings,
  LogOut,
  Activity,
  Layers,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

export type NavTab = "chat" | "upstreams" | "tools" | "audit" | "keys";

interface NavbarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onOpenSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  onOpenSettings,
}) => {
  const { user, isAuthenticated, logout } = useAuth();

  const navItems: { id: NavTab; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
    { id: "chat", label: "AI Agent", icon: <Bot className="w-4 h-4" /> },
    { id: "upstreams", label: "Upstream Servers", icon: <Server className="w-4 h-4" /> },
    { id: "tools", label: "Tools Catalog", icon: <Wrench className="w-4 h-4" /> },
    { id: "audit", label: "Audit Logs", icon: <ShieldCheck className="w-4 h-4" /> },
    { id: "keys", label: "API Keys", icon: <Key className="w-4 h-4" />, adminOnly: true },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-dark-900/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onTabChange("chat")}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-accent-violet flex items-center justify-center shadow-lg shadow-brand-500/20">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white">Nexus<span className="text-brand-500">MCP</span></span>
                <span className="text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-500 border border-brand-500/20">
                  Gateway
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono -mt-0.5">Streamable HTTP • WooCommerce</p>
            </div>
          </div>

          {/* Navigation Links */}
          {isAuthenticated && (
            <nav className="flex items-center space-x-1">
              {navItems
                .filter((item) => !item.adminOnly || user?.role === "admin")
                .map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onTabChange(item.id)}
                      className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? "bg-brand-600/15 text-brand-500 border border-brand-500/30 shadow-sm"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  );
                })}
            </nav>
          )}

          {/* Right Status / Profile */}
          <div className="flex items-center space-x-3">
            {isAuthenticated ? (
              <>
                <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-dark-800 border border-slate-800 text-xs">
                  <div className="w-2 h-2 rounded-full bg-accent-emerald animate-pulse" />
                  <span className="text-slate-300 font-medium">{user?.username || user?.email || "Admin"}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-700/60 text-slate-400">
                    {user?.role}
                  </span>
                </div>

                <button
                  onClick={onOpenSettings}
                  title="Gateway Settings"
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
                >
                  <Settings className="w-4 h-4" />
                </button>

                <button
                  onClick={logout}
                  title="Log Out"
                  className="p-2 rounded-lg text-slate-400 hover:text-accent-rose hover:bg-slate-800 transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                onClick={onOpenSettings}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium transition"
              >
                <Activity className="w-3.5 h-3.5 text-accent-amber" />
                <span>Configure Gateway</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
