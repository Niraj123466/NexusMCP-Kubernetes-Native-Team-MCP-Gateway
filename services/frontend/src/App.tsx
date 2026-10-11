import React, { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Navbar, NavTab } from "./components/Navbar";
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          <p className="text-xs text-slate-400 font-medium">Connecting to NexusMCP Gateway...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-900 text-slate-100 flex flex-col">
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className="flex-1">
        {!isAuthenticated ? (
          <LoginView />
        ) : (
          <>
            {activeTab === "chat" && <ChatPage />}
            {activeTab === "upstreams" && <UpstreamsPage />}
            {activeTab === "tools" && <ToolsPage />}
            {activeTab === "audit" && <AuditPage />}
            {activeTab === "keys" && <KeysPage />}
          </>
        )}
      </main>

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
