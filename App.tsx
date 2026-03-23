import React, { useState } from 'react';
import { ModuleType } from './types';
import Sidebar from './components/Sidebar';
import DashboardModule from './modules/Dashboard/DashboardModule';
import IAConfigModule from './modules/IAConfig/IAConfigModule';
import ClientsModule from './modules/Clients/ClientsModule';
import FinanceModule from './modules/Finance/FinanceModule';
import BudgetsModule from './modules/Budgets/BudgetsModule';
import ModelsModule from './modules/Models/ModelsModule';
import WhatsAppModule from './modules/WhatsApp/WhatsAppModule';
import VoiceModule from './modules/Voice/VoiceModule';
import SupportAIModule from './modules/SupportAI/SupportAIModule';
import RuntimeModule from './modules/Runtime/RuntimeModule';
import { AppProvider } from './context/AppContext';

const AppContent: React.FC = () => {
  const [activeModule, setActiveModule] = useState<ModuleType>(ModuleType.DASHBOARD);
  
  const renderModule = () => {
    switch (activeModule) {
      case ModuleType.DASHBOARD: return <DashboardModule />;
      case ModuleType.IA_CONFIG: return <IAConfigModule />;
      case ModuleType.CLIENTS: return <ClientsModule />;
      case ModuleType.BUDGETS: return <BudgetsModule />;
      case ModuleType.FINANCE: return <FinanceModule />;
      case ModuleType.MODELS: return <ModelsModule />;
      case ModuleType.WHATSAPP: return <WhatsAppModule />;
      case ModuleType.VOICE: return <VoiceModule />;
      case ModuleType.SUPPORT_AI: return <SupportAIModule />;
      case ModuleType.RUNTIME: return <RuntimeModule />;
      default: return <DashboardModule />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <Sidebar activeModule={activeModule} setActiveModule={setActiveModule} />
      <main className="flex-1 overflow-y-auto p-8 relative">
        <div className="max-w-6xl mx-auto animate-fadeIn">
          {renderModule()}
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => (
  <AppProvider>
    <AppContent />
  </AppProvider>
);

export default App;