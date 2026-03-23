
import React, { useState, useMemo } from 'react';
import { Client } from '../../types';
import { useApp } from '../../context/AppContext';

const ClientsModule: React.FC = () => {
  const { clients, setClients, executeAction, companies, syncAll } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newClient, setNewClient] = useState({
    nome: '',
    telefone: '',
    empresa: companies.bellarte,
    observacoes: ''
  });

  const filteredClients = useMemo(() => 
    clients.filter(c => 
      c.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.empresa.toLowerCase().includes(searchTerm.toLowerCase())
    ), [clients, searchTerm]
  );

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.nome || !newClient.telefone) return;

    await executeAction('add_client', {
      ...newClient,
      status: 'Lead'
    });
    
    setShowAddForm(false);
    setNewClient({
      nome: '',
      telefone: '',
      empresa: companies.bellarte,
      observacoes: ''
    });
  };

  const exportLeads = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(clients));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "klaus_leads_export.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const importLeads = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const imported = JSON.parse(event.target?.result as string);
          if (Array.isArray(imported)) {
            const merged = [...clients, ...imported];
            setClients(merged);
            // garante persistência no db.json
            await syncAll({ clients: merged });
            alert("Leads importados com sucesso!");
          }
        } catch (err) {
          alert("Erro ao importar leads. Verifique o formato do arquivo.");
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="space-y-10 animate-fadeIn">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-5xl font-black text-white italic uppercase tracking-tighter">STRATEGIC <span className="text-blue-500">LEADS</span></h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] mt-2">Yukoyama CRM Engine - Persistência Local Ativa</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="px-6 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all border border-slate-700">
            📥 Importar
            <input type="file" className="hidden" onChange={importLeads} accept=".json" />
          </label>
          <button onClick={exportLeads} className="px-6 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-slate-700">
            📤 Exportar
          </button>
          <button onClick={() => setShowAddForm(!showAddForm)} className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-[2rem] text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-900/30 transition-all">
            {showAddForm ? '✕ Fechar' : '＋ Novo Lead'}
          </button>
        </div>
      </header>

      {showAddForm && (
        <section className="bg-slate-900 border border-blue-500/30 rounded-[3rem] p-10 shadow-2xl animate-fadeIn">
          <h3 className="text-xs font-black uppercase tracking-[0.3em] text-blue-400 mb-8">Cadastro de Prospect</h3>
          <form onSubmit={handleAddClient} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Nome Completo</label>
              <input 
                type="text" 
                required
                value={newClient.nome}
                onChange={e => setNewClient({...newClient, nome: e.target.value})}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-white outline-none focus:border-blue-500"
                placeholder="Ex: João Silva"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase ml-1">WhatsApp / Telefone</label>
              <input 
                type="text" 
                required
                value={newClient.telefone}
                onChange={e => setNewClient({...newClient, telefone: e.target.value})}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-white outline-none focus:border-blue-500"
                placeholder="Ex: 11999999999"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Vincular Empresa</label>
              <select 
                value={newClient.empresa}
                onChange={e => setNewClient({...newClient, empresa: e.target.value})}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-white outline-none focus:border-blue-500"
              >
                <option value={companies.bellarte}>{companies.bellarte}</option>
                <option value={companies.alfa}>{companies.alfa}</option>
                <option value={companies.personal}>{companies.personal}</option>
              </select>
            </div>
            <div className="flex items-end">
              <button type="submit" className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-900/20 transition-all">
                Salvar Prospect
              </button>
            </div>
          </form>
        </section>
      )}

      <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-[3rem] overflow-hidden min-h-[600px] shadow-2xl">
        <div className="p-8 border-b border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6">
           <div className="relative w-full md:w-96">
             <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600">🔍</span>
             <input 
               type="text" 
               placeholder="Filtrar ecossistema Yukoyama..." 
               value={searchTerm} 
               onChange={e => setSearchTerm(e.target.value)}
               className="bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-14 pr-8 text-xs text-white outline-none focus:border-blue-500 w-full transition-all"
             />
           </div>
           <div className="text-[9px] font-black uppercase tracking-widest text-slate-600">
             Total de Leads: <span className="text-blue-500">{filteredClients.length}</span>
           </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-950/30 border-b border-slate-800">
                <th className="px-12 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Identidade</th>
                <th className="px-12 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Protocolo</th>
                <th className="px-12 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Empresa</th>
                <th className="px-12 py-6 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-12 py-20 text-center opacity-30 italic text-slate-500 text-sm">
                    Nenhum sinal de lead detectado.
                  </td>
                </tr>
              ) : (
                filteredClients.map(c => (
                  <tr key={c.id} className="hover:bg-blue-600/5 group transition-all cursor-pointer">
                    <td className="px-12 py-8 font-black text-white text-sm tracking-tight">{c.nome}</td>
                    <td className="px-12 py-8 font-mono text-slate-400 text-xs">{c.telefone}</td>
                    <td className="px-12 py-8">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${
                        c.empresa === companies.bellarte ? 'text-blue-400' :
                        c.empresa === companies.alfa ? 'text-emerald-400' : 'text-slate-400'
                      }`}>
                        {c.empresa}
                      </span>
                    </td>
                    <td className="px-12 py-8 text-right">
                      <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase ${
                        c.status === 'Lead' ? 'bg-blue-500/10 text-blue-500' :
                        c.status === 'Interessado' ? 'bg-emerald-500/10 text-emerald-500' :
                        c.status === 'Desqualificado' ? 'bg-rose-500/10 text-rose-500' : 'bg-slate-500/10 text-slate-500'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ClientsModule;
