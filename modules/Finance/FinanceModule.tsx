
import React, { useState, useMemo } from 'react';
import { Transaction } from '../../types';
import { useApp } from '../../context/AppContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { apiUrl } from '../../services/runtimeBase';

const FinanceModule: React.FC = () => {
  const { transactions, clients, companies } = useApp();
  const [filterCompany, setFilterCompany] = useState('Todas');
  const [filterCategory, setFilterCategory] = useState('Todas');
  const [filterStatus, setFilterStatus] = useState('Todas');
  const [filterPeriod, setFilterPeriod] = useState('Total'); // 'Mês Atual', '30 Dias', 'Total'

  // Filtragem de dados avançada
  const filteredTxs = useMemo(() => {
    return transactions.filter(t => {
      const companyMatch = filterCompany === 'Todas' || t.empresa === filterCompany;
      const categoryMatch = filterCategory === 'Todas' || t.categoria === filterCategory;
      const statusMatch = filterStatus === 'Todas' || t.status === filterStatus;
      
      let periodMatch = true;
      if (filterPeriod !== 'Total') {
        const txDate = new Date(t.data);
        const now = new Date();
        if (filterPeriod === 'Mês Atual') {
          periodMatch = txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
        } else if (filterPeriod === '30 Dias') {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(now.getDate() - 30);
          periodMatch = txDate >= thirtyDaysAgo;
        }
      }
      
      return companyMatch && categoryMatch && statusMatch && periodMatch;
    });
  }, [transactions, filterCompany, filterCategory, filterStatus, filterPeriod]);

  // Cálculos de KPI
  const stats = useMemo(() => {
    const toPay = filteredTxs.filter(t => t.tipo === 'Pagar' && t.status === 'Pendente').reduce((acc, t) => acc + t.valor, 0);
    const toReceive = filteredTxs.filter(t => t.tipo === 'Receber' && t.status === 'Pendente').reduce((acc, t) => acc + t.valor, 0);
    const totalIn = filteredTxs.filter(t => (t.tipo === 'Entrada' || t.tipo === 'Receber') && t.status === 'Concluído').reduce((acc, t) => acc + t.valor, 0);
    const totalOut = filteredTxs.filter(t => (t.tipo === 'Saída' || t.tipo === 'Pagar') && t.status === 'Concluído').reduce((acc, t) => acc + t.valor, 0);
    const balance = totalIn - totalOut;

    return { toPay, toReceive, balance, totalIn, totalOut };
  }, [filteredTxs]);

  const sendWhatsAppReminder = async (tx: Transaction) => {
    const client = clients.find(c => c.id === tx.clienteId);
    if (tx.tipo !== 'Receber') {
      alert('Lembrete automático via WhatsApp está disponível apenas para contas a receber (Receber).');
      return;
    }

    if (!client?.telefone) {
      alert('Essa transação não tem cliente vinculado com telefone. Vincule o clienteId/telefone para usar o lembrete.');
      return;
    }

    const phone = String(client.telefone).replace(/\D/g, '');
    if (!phone) {
      alert('Telefone do cliente inválido.');
      return;
    }

    const message = `Olá ${client.nome || ''}! 😊\n\nPassando para lembrar do pagamento pendente de R$ ${tx.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} referente a: ${tx.descricao}.\n\nSe já pagou, por favor me avise por aqui. Obrigado!`;

    try {
      const res = await fetch(apiUrl('/api/whatsapp/send'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: phone, message })
      });

      if (!res.ok) throw new Error('Falha ao enviar.');
      alert(`✅ Lembrete enviado para ${client.nome} (${phone}).`);
    } catch (e) {
      alert('❌ Não foi possível enviar o lembrete. Verifique se o WhatsApp está conectado no Klaus Pocket.');
    }
  };

  return (
    <div className="space-y-10 animate-fadeIn pb-20">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
        <div>
          <h2 className="text-5xl font-black text-white italic uppercase tracking-tighter">Chief <span className="text-emerald-500 text-4xl">Finance</span></h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] mt-2">Yukoyama Auditor & Flow Management Engine</p>
        </div>
        
        <div className="flex flex-wrap gap-4 bg-slate-900/50 p-2 rounded-[2rem] border border-slate-800">
          {['Total', 'Mês Atual', '30 Dias'].map(p => (
            <button 
              key={p}
              onClick={() => setFilterPeriod(p)}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterPeriod === p ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {p}
            </button>
          ))}
        </div>
      </header>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 text-4xl group-hover:scale-125 transition-transform">📉</div>
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Contas a Pagar (Pendentes)</h3>
          <p className="text-3xl font-mono font-bold text-rose-500 tracking-tighter">R$ {stats.toPay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <div className="mt-4 h-1 w-24 bg-rose-500/20 rounded-full overflow-hidden">
             <div className="h-full bg-rose-500 w-2/3"></div>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 text-4xl group-hover:scale-125 transition-transform">📈</div>
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Contas a Receber (Pendentes)</h3>
          <p className="text-3xl font-mono font-bold text-emerald-500 tracking-tighter">R$ {stats.toReceive.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <div className="mt-4 h-1 w-24 bg-emerald-500/20 rounded-full overflow-hidden">
             <div className="h-full bg-emerald-500 w-1/2"></div>
          </div>
        </div>
        <div className="bg-slate-900 border border-emerald-500/30 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden bg-gradient-to-br from-slate-900 to-emerald-950/20">
          <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2 italic">Saldo em Caixa (Líquido)</h3>
          <p className="text-4xl font-mono font-black text-white tracking-tighter">R$ {stats.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <p className="text-[9px] text-slate-500 mt-2 font-bold uppercase tracking-widest">Baseado em transações concluídas</p>
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-slate-900/30 p-8 rounded-[3rem] border border-slate-800/50">
        <div className="space-y-2">
          <label className="text-[9px] font-black text-slate-600 uppercase ml-2">Empresa / Unidade</label>
          <select 
            value={filterCompany}
            onChange={e => setFilterCompany(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-white outline-none focus:border-emerald-500"
          >
            <option value="Todas">Todas as Unidades</option>
            <option value={companies.bellarte}>{companies.bellarte}</option>
            <option value={companies.alfa}>{companies.alfa}</option>
            <option value={companies.personal}>{companies.personal}</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-[9px] font-black text-slate-600 uppercase ml-2">Classificação de Custo</label>
          <select 
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-white outline-none focus:border-emerald-500"
          >
            <option value="Todas">Todas as Categorias</option>
            <option value="Fixo">Custos Fixos</option>
            <option value="Variável">Custos Variáveis</option>
            <option value="Emergencial">Custos Emergenciais</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-[9px] font-black text-slate-600 uppercase ml-2">Status da Conta</label>
          <select 
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-white outline-none focus:border-emerald-500"
          >
            <option value="Todas">Todos os Status</option>
            <option value="Concluído">Concluídos</option>
            <option value="Pendente">Pendentes</option>
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={() => { setFilterCompany('Todas'); setFilterCategory('Todas'); setFilterStatus('Todas'); setFilterPeriod('Total'); }} className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
            Resetar Filtros
          </button>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-950/50 border-b border-slate-800">
                <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Data / Cliente</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Descrição / Unidade</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Categoria</th>
                <th className="px-10 py-6 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Valor / Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30">
              {filteredTxs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-10 py-20 text-center text-slate-600 italic text-sm">Nenhum registro encontrado para estes filtros.</td>
                </tr>
              ) : (
                filteredTxs.map(t => {
                  const client = clients.find(c => c.id === t.clienteId);
                  return (
                    <tr key={t.id} className="hover:bg-slate-800/20 group transition-all">
                      <td className="px-10 py-8">
                        <p className="text-[10px] font-mono text-slate-500 font-bold">{t.data}</p>
                        <p className="text-sm font-black text-white mt-1">{client?.nome || 'Fluxo Interno'}</p>
                      </td>
                      <td className="px-10 py-8">
                        <p className="text-sm text-slate-300 font-bold">{t.descricao}</p>
                        <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${
                          t.empresa === companies.bellarte ? 'text-blue-500' :
                          t.empresa === companies.alfa ? 'text-emerald-500' : 'text-slate-500'
                        }`}>
                          {t.empresa}
                        </p>
                      </td>
                      <td className="px-10 py-8 text-center">
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          t.categoria === 'Emergencial' ? 'bg-rose-500/10 text-rose-500' :
                          t.categoria === 'Fixo' ? 'bg-blue-500/10 text-blue-500' : 'bg-emerald-500/10 text-emerald-500'
                        }`}>
                          {t.categoria}
                        </span>
                      </td>
                      <td className="px-10 py-8 text-right">
                        <div className="flex flex-col items-end gap-2">
                           <p className={`text-xl font-mono font-black ${
                             (t.tipo === 'Entrada' || t.tipo === 'Receber') ? 'text-emerald-500' : 'text-rose-500'
                           }`}>
                             {(t.tipo === 'Entrada' || t.tipo === 'Receber') ? '+' : '-'} R$ {t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                           </p>
                           <div className="flex items-center gap-3">
                              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${t.status === 'Concluído' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                {t.status}
                              </span>
                              {t.status === 'Pendente' && (
                                <button 
                                  onClick={() => sendWhatsAppReminder(t)}
                                  className="text-[9px] font-black text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors uppercase tracking-widest"
                                  title="Enviar lembrete WhatsApp"
                                >
                                  Lembrar 💬
                                </button>
                              )}
                           </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FinanceModule;
