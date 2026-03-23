import React from 'react';
import { ModuleType } from '../types';
import { useApp } from '../context/AppContext';

interface SidebarProps {
  activeModule: ModuleType;
  setActiveModule: (module: ModuleType) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeModule, setActiveModule }) => {
  const { status, isSyncing } = useApp();
  
  const menuItems = [
    { type: ModuleType.DASHBOARD, label: 'Dashboard', icon: '📊' },
    { type: ModuleType.IA_CONFIG, label: 'Cérebro IA', icon: '🧠' },
    { type: ModuleType.SUPPORT_AI, label: 'Suporte IA', icon: '🛠️' },
    { type: ModuleType.CLIENTS, label: 'CRM Leads', icon: '👥' },
    { type: ModuleType.BUDGETS, label: 'Orçamentos', icon: '📝' },
    { type: ModuleType.FINANCE, label: 'Financeiro', icon: '💰' },
    { type: ModuleType.MODELS, label: 'Doc Studio', icon: '📄' },
    { type: ModuleType.WHATSAPP, label: 'Klaus Pocket', icon: '💬' },
    { type: ModuleType.VOICE, label: 'Jarvis', icon: '🎙️' },
    { type: ModuleType.RUNTIME, label: 'Runtime', icon: '🧩' },
  ];

  return (
    <aside className="w-72 bg-slate-950 border-r border-slate-800/50 flex flex-col relative z-50">
      <div className="p-8 border-b border-slate-900">
        <div className="flex items-center gap-4">
          <img src="/klaus-whatsapp-profile.png" alt="Klaus" className="w-12 h-12 object-contain rounded-full" />
          <div>
            <h1 className="text-lg font-black tracking-tighter text-white leading-none">KLAUS <span className="text-emerald-500 font-light">OS</span></h1>
            <p className="text-[9px] text-slate-600 mt-1 uppercase tracking-[0.2em] font-black">Yukoyama Engine v2.5</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 px-4 py-8 space-y-1 overflow-y-auto">
        {menuItems.map((item) => (
          <button
            key={item.type}
            onClick={() => setActiveModule(item.type)}
            className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl transition-all ${
              activeModule === item.type
                ? 'bg-emerald-600/10 text-emerald-400 border border-emerald-500/20'
                : 'text-slate-500 hover:bg-slate-900/50'
            }`}
          >
            <div className="flex items-center space-x-4">
              <span className="text-xl">{item.icon}</span>
              <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
            </div>
          </button>
        ))}
      </nav>

      <div className="p-8 border-t border-slate-900">
        <div className="bg-slate-900/40 rounded-3xl p-6 border border-slate-800/30">
          <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest block mb-4">Master User</span>
          <p className="text-xs font-bold text-white">César Yukoyama</p>
          <p className="text-[9px] text-emerald-500 font-mono mt-1">+55 11 96124-0197</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;