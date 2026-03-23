
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { askCore } from '../../services/coreService';

const DashboardModule: React.FC = () => {
  const { status, transactions, budgets, config, executeAction, resetSession } = useApp();
  const [aiAnalysis, setAiAnalysis] = useState<string>('Protocolo Klaus OS V2.5 inicializado. Aguardando diretivas...');
  const [telemetry, setTelemetry] = useState<{msg: string, id: number}[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [quickCmd, setQuickCmd] = useState('');
  
  const totalBalance = transactions
    .reduce((acc, t) => (t.tipo === 'Entrada' || t.tipo === 'Receber') ? acc + t.valor : acc - t.valor, 0);

  const pendingBudgets = budgets.filter(b => b.status === 'Pendente');

  const addTelemetry = (msg: string) => {
    setTelemetry(prev => [{ msg, id: Date.now() }, ...prev.slice(0, 4)]);
  };

  const handleQuickCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCmd || isAnalyzing) return;
    
    const cmd = quickCmd;
    setQuickCmd('');
    setIsAnalyzing(true);
    addTelemetry(`PROCESSANDO: ${cmd.substring(0, 20)}...`);

    try {
      const result = await askCore(cmd);
      setAiAnalysis(result);
    } catch (err: any) {
      setAiAnalysis(`Erro no Core: ${err?.message || err}`);
    }
    setIsAnalyzing(false);
  };

  return (
    <div className="space-y-10 animate-fadeIn pb-20">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
        <div className="relative">
          <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-1 h-12 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
          <h2 className="text-6xl font-black tracking-tighter text-white uppercase italic leading-none">
            Klaus <span className="text-emerald-500 font-extralight not-italic">OS</span>
          </h2>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em]">Strategic Control Center</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-6 rounded-[2.5rem] shadow-2xl flex items-center gap-8">
            <div>
              <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Liquidez de Caixa</p>
              <p className={`text-3xl font-mono font-bold tracking-tighter ${totalBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                R$ {totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="w-px h-10 bg-slate-800"></div>
            <div>
              <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Orçamentos</p>
              <p className="text-3xl font-mono font-bold text-blue-400">
                {pendingBudgets.length}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Database Local', val: 'db.json', icon: '💾', status: 'ok' },
          { label: 'Cérebro IA', val: 'Multimodal Active', icon: '🧠', status: 'ok' },
          { label: 'Nexus Bridge', val: status.server === 'ok' ? 'Online' : 'Offline', icon: '⚡', status: status.server },
          { label: 'WhatsApp', val: status.whatsapp === 'connected' ? 'Ativo' : 'Standby', icon: '📡', status: status.whatsapp === 'connected' ? 'ok' : 'error' }
        ].map((sensor, i) => (
          <div key={i} className="group bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-xl hover:border-emerald-500/30 transition-all relative overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <span className="text-4xl filter grayscale group-hover:grayscale-0 transition-all">{sensor.icon}</span>
              <div className={`w-3 h-3 rounded-full ${sensor.status === 'ok' ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.5)] animate-pulse'}`}></div>
            </div>
            <h3 className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">{sensor.label}</h3>
            <p className="text-lg font-mono font-bold text-white mt-1 tracking-tighter uppercase truncate">{sensor.val}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl">
            <h3 className="text-xs font-black uppercase tracking-[0.4em] text-slate-500 mb-8 flex items-center gap-3">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              Comando Neural Central
            </h3>
            
            <form onSubmit={handleQuickCommand} className="relative z-10">
              <input 
                type="text" 
                placeholder="Direcione o Klaus... ex: 'Gere um orçamento para o João'"
                value={quickCmd}
                onChange={e => setQuickCmd(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-3xl py-6 px-8 text-emerald-400 font-mono text-lg outline-none"
              />
            </form>

            <div className="mt-10 bg-slate-950/50 border border-slate-800/50 rounded-[2rem] p-8 min-h-[160px]">
              <p className={`text-base leading-relaxed font-medium ${isAnalyzing ? 'text-slate-600 italic' : 'text-slate-300'}`}>
                {isAnalyzing ? "Sincronizando com o Gemini 3 Flash..." : aiAnalysis}
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 bg-slate-900/80 border border-slate-800 rounded-[3rem] p-10 shadow-2xl">
          <h3 className="text-xs font-black uppercase tracking-[0.4em] text-slate-500 mb-8 flex items-center gap-3">
            📋 Orçamentos Recentes
          </h3>
          <div className="space-y-4">
            {pendingBudgets.length === 0 && <p className="text-[10px] text-slate-700 italic">Nenhum orçamento pendente.</p>}
            {pendingBudgets.slice(0, 5).map(b => (
              <div key={b.id} className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
                <p className="text-xs font-black text-white">{b.cliente}</p>
                <p className="text-[10px] text-slate-500 uppercase">{b.servico}</p>
                <p className="text-sm font-mono text-emerald-500 mt-2">R$ {b.valor.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardModule;
