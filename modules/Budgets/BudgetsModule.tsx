import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { apiUrl } from '../../services/runtimeBase';

const currency = (value: number) =>
  Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BudgetsModule: React.FC = () => {
  const { budgets, setBudgets, executeAction, syncAll, companies } = useApp();
  const [filter, setFilter] = useState<'Todos' | 'Pendente' | 'Aprovado' | 'Recusado'>('Todos');

  const filteredBudgets = useMemo(
    () => budgets.filter((b) => filter === 'Todos' || b.status === filter),
    [budgets, filter],
  );

  const totals = useMemo(() => {
    const total = budgets.reduce((acc, item) => acc + Number(item.valor || 0), 0);
    const pending = budgets.filter((b) => b.status === 'Pendente').reduce((acc, item) => acc + Number(item.valor || 0), 0);
    const approved = budgets.filter((b) => b.status === 'Aprovado').reduce((acc, item) => acc + Number(item.valor || 0), 0);
    const refused = budgets.filter((b) => b.status === 'Recusado').length;
    return { total, pending, approved, refused };
  }, [budgets]);

  const getCompanyLabel = (company?: string) => {
    const key = String(company || '').toLowerCase();
    if (key === 'alfa') return companies.alfa || 'Alfa DDT';
    if (key === 'personal') return companies.personal || 'Vida Pessoal';
    return companies.bellarte || 'Bellarte Pinturas';
  };

  const updateStatus = async (id: string, status: 'Aprovado' | 'Recusado') => {
    const res = await fetch(apiUrl('/api/budgets/decision'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: status }),
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.budgets)) {
        setBudgets(data.budgets);
        await syncAll({ budgets: data.budgets });
      }
    }

    if (status === 'Aprovado') {
      const budget = budgets.find((b) => b.id === id);
      if (budget) {
        await executeAction('add_transaction', {
          tipo: 'Receber',
          valor: budget.valor,
          descricao: `Orçamento Aprovado: ${budget.servico}`,
          empresa: budget.company || 'Geral',
          status: 'Pendente',
        });
      }
    }
  };

  const downloadBudgetPdf = (id: string) => {
    const url = apiUrl(`/api/budgets/${encodeURIComponent(id)}/pdf`);
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noreferrer';
    a.click();
  };

  const downloadBudgetsJson = () => {
    const blob = new Blob([JSON.stringify(budgets, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budgets-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-20">
      <section className="relative overflow-hidden rounded-[2.5rem] border border-amber-500/20 bg-slate-950 shadow-2xl">
        <div
          className="absolute inset-0 opacity-20 bg-cover bg-center"
          style={{ backgroundImage: "linear-gradient(135deg, rgba(251,191,36,0.18), rgba(15,23,42,0.55))" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/95 to-slate-950/70" />
        <div className="relative z-10 p-8 lg:p-10 flex flex-col xl:flex-row xl:items-end xl:justify-between gap-8">
          <div className="max-w-3xl">
            <div className="flex items-center gap-4 mb-5">
              <div className="h-16 w-16 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md flex items-center justify-center overflow-hidden p-2">
                <img src="/klaus-pocket-logo.png" alt="Bellarte" className="max-h-10 object-contain opacity-90" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-amber-300">Quote Studio</p>
                <p className="text-xs text-slate-400">Setor executivo de propostas e aprovação comercial</p>
              </div>
            </div>

            <h2 className="text-4xl lg:text-5xl font-black text-white tracking-tight leading-none">
              Orçamentos <span className="text-amber-400 font-light italic">Bellarte</span>
            </h2>
            <p className="text-slate-300 mt-4 max-w-2xl text-sm leading-relaxed">
              Visual premium para acompanhar propostas, baixar PDFs, aprovar com mais segurança e transformar cada orçamento em uma entrega mais profissional para o cliente.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 min-w-full xl:min-w-[540px]">
            <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-5">
              <p className="text-[10px] uppercase tracking-[0.25em] font-black text-slate-400">Pipeline total</p>
              <p className="text-2xl font-black text-white mt-3">R$ {currency(totals.total)}</p>
            </div>
            <div className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-5">
              <p className="text-[10px] uppercase tracking-[0.25em] font-black text-amber-200">Pendentes</p>
              <p className="text-2xl font-black text-white mt-3">R$ {currency(totals.pending)}</p>
            </div>
            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-5">
              <p className="text-[10px] uppercase tracking-[0.25em] font-black text-emerald-200">Aprovados</p>
              <p className="text-2xl font-black text-white mt-3">R$ {currency(totals.approved)}</p>
            </div>
            <div className="rounded-3xl border border-rose-500/20 bg-rose-500/5 p-5">
              <p className="text-[10px] uppercase tracking-[0.25em] font-black text-rose-200">Recusados</p>
              <p className="text-2xl font-black text-white mt-3">{totals.refused}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 rounded-[2rem] border border-slate-800 bg-slate-950 p-2">
          {(['Todos', 'Pendente', 'Aprovado', 'Recusado'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                filter === f
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-900/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <button
          onClick={downloadBudgetsJson}
          className="px-6 py-4 bg-slate-950 border border-slate-800 hover:border-amber-500/40 text-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
        >
          Exportar backup JSON
        </button>
      </section>

      {filteredBudgets.length === 0 ? (
        <div className="rounded-[2.5rem] border border-slate-800 bg-slate-950 p-16 text-center">
          <div className="mx-auto h-20 w-20 rounded-full bg-white/5 flex items-center justify-center text-4xl mb-5">📑</div>
          <p className="text-white text-lg font-black tracking-tight">Nenhum orçamento encontrado</p>
          <p className="text-slate-400 mt-2">Quando o Klaus gerar novas propostas, elas vão aparecer aqui com preview executivo, PDF e fluxo de aprovação.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {filteredBudgets.map((b) => {
            const statusTone =
              b.status === 'Aprovado'
                ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300'
                : b.status === 'Recusado'
                  ? 'border-rose-500/20 bg-rose-500/5 text-rose-300'
                  : 'border-amber-500/20 bg-amber-500/5 text-amber-200';

            return (
              <article
                key={b.id}
                className="overflow-hidden rounded-[2.5rem] border border-slate-800 bg-slate-950 shadow-xl"
              >
                <div className="border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-7 py-6 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`inline-flex items-center rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] ${statusTone}`}>
                        {b.status}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
                        {getCompanyLabel(b.company)}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-slate-800 bg-slate-950 px-4 py-2 text-[10px] font-mono text-slate-500">
                        ID {b.id}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-2xl font-black text-white tracking-tight">{b.cliente}</h3>
                      <p className="text-slate-300 mt-1 text-sm">{b.servico}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Contato</p>
                        <p className="text-white mt-2 text-sm font-medium break-all">{b.contato || 'Não informado'}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Data</p>
                        <p className="text-white mt-2 text-sm font-medium">{b.data}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Valor</p>
                        <p className="text-2xl font-black text-white mt-1">R$ {currency(Number(b.valor || 0))}</p>
                      </div>
                    </div>
                  </div>

                  <div className="w-full lg:w-[320px] rounded-[2rem] border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-transparent p-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-200">Resumo executivo</p>
                    <p className="text-slate-200 text-sm mt-3 leading-relaxed">
                      Proposta comercial pronta para geração de PDF e fluxo de aprovação. Ideal para o Klaus enviar ao Master e, depois de aprovado, entregar ao cliente com acabamento mais profissional.
                    </p>
                  </div>
                </div>

                <div className="px-7 py-5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                  <div className="text-xs text-slate-500">
                    Documento disponível para download imediato em PDF. O fluxo de aprovação continua oficial pelo backend.
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => downloadBudgetPdf(b.id)}
                      className="px-6 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border border-slate-700"
                    >
                      Baixar PDF
                    </button>

                    {b.status === 'Pendente' && (
                      <>
                        <button
                          onClick={() => updateStatus(b.id, 'Aprovado')}
                          className="px-6 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-emerald-900/20"
                        >
                          Aprovar
                        </button>
                        <button
                          onClick={() => updateStatus(b.id, 'Recusado')}
                          className="px-6 py-4 bg-slate-900 hover:bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border border-slate-700"
                        >
                          Recusar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BudgetsModule;
