import React, { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Sidebar, NavTab } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { SettingsModal } from "./components/SettingsModal";
import { LoginView } from "./components/LoginView";
import { ChatPage } from "./pages/ChatPage";
import { UpstreamsPage } from "./pages/UpstreamsPage";
import { ToolsPage } from "./pages/ToolsPage";
import { AuditPage } from "./pages/AuditPage";
import { KeysPage } from "./pages/KeysPage";
import { Loader2 } from "lucide-react";

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>("chat");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <Loader2 className="w-7 h-7 animate-spin text-emerald-400" />
          <p className="text-xs text-slate-400 font-mono">Connecting to NexusMCP Gateway...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <LoginView />
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-slate-100 flex overflow-hidden">
      {/* Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar
          activeTab={activeTab}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        <main className="flex-1 overflow-y-auto">
          {activeTab === "chat" && <ChatPage />}
          {activeTab === "upstreams" && <UpstreamsPage />}
          {activeTab === "tools" && <ToolsPage />}
          {activeTab === "audit" && <AuditPage />}
          {activeTab === "keys" && <KeysPage />}
        </main>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
