import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Client } from '../../types';

interface DocumentTemplate {
  id: string;
  title: string;
  category: 'Comercial' | 'Jurídico' | 'WhatsApp';
  icon: string;
  templateKey: 'proposal' | 'contract' | 'budgetMessage';
  color: string;
}

const ModelsModule: React.FC = () => {
  const { clients, config, companies } = useApp();
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [context, setContext] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const templates: DocumentTemplate[] = [
    { id: 'proposal', title: 'Proposta / Orçamento (Modelo)', category: 'Comercial', icon: '📄', color: 'text-amber-500', templateKey: 'proposal' },
    { id: 'contract', title: 'Contrato (Modelo)', category: 'Jurídico', icon: '🛡️', color: 'text-blue-500', templateKey: 'contract' },
    { id: 'wa', title: 'Mensagem WhatsApp (Orçamento)', category: 'WhatsApp', icon: '💬', color: 'text-emerald-500', templateKey: 'budgetMessage' },
  ];

  const selectedCompanyKey = useMemo(() => {
    const emp = (selectedClient?.empresa || '').toLowerCase();
    if (emp.includes('alfa') || emp.includes((companies.alfa || '').toLowerCase())) return 'alfa';
    if (emp.includes('personal') || emp.includes((companies.personal || '').toLowerCase())) return 'personal';
    return 'bellarte';
  }, [selectedClient, companies]);

  const details: any = (config.companyDetails as any)?.[selectedCompanyKey] || {};
  const companyName = selectedCompanyKey === 'alfa'
    ? (companies.alfa || details.nome || 'Alfa DDT')
    : selectedCompanyKey === 'personal'
      ? (companies.personal || details.nome || 'Vida Pessoal')
      : (companies.bellarte || details.nome || 'Bellarte Pinturas');

  const renderTemplate = (tpl: string, vars: Record<string, string>) => {
    let out = tpl || '';
    for (const [k, v] of Object.entries(vars)) {
      out = out.replaceAll(`{{${k}}}`, v ?? '');
    }
    out = out.replace(/\{\{[^}]+\}\}/g, '');
    return out;
  };

  const handleGenerateDocument = async () => {
    if (!selectedTemplate) return;
    setIsGenerating(true);
    try {
      const docTpl: any = (config.docTemplates as any)?.[selectedCompanyKey] || {};
      const tpl = docTpl[selectedTemplate.templateKey] || '';

      const vars = {
        COMPANY_NAME: companyName,
        COMPANY_CNPJ: details.cnpj || '',
        COMPANY_ADDRESS: details.endereco || '',
        COMPANY_PHONE: details.telefone || '',
        COMPANY_EMAIL: details.email || '',
        COMPANY_SITE: details.site || '',
        COMPANY_PIX: details.pix || '',
        CLIENT_NAME: selectedClient?.nome || '',
        CLIENT_PHONE: selectedClient?.telefone || '',
        SERVICE: context || '(descreva o serviço)',
        VALUE: '',
        DATE: new Date().toLocaleDateString('pt-BR'),
        TEXT: context || '',
      } as Record<string, string>;

      const rendered = renderTemplate(tpl, vars).trim();
      setGeneratedText(rendered || '⚠️ Template vazio. Vá em Cérebro IA → Modelos de Documentos e configure.');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedText);
    alert('Conteúdo copiado para a área de transferência!');
  };

  const docId = useMemo(() => {
    const base = `${selectedTemplate?.id || 'doc'}-${selectedClient?.id || 'lead'}-${generatedText.length}`;
    return base.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase().slice(0, 16) || 'KLAUS-DOC';
  }, [selectedTemplate, selectedClient, generatedText]);

  const contentBlocks = useMemo(() => {
    return generatedText
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean);
  }, [generatedText]);

  const lines = useMemo(() => {
    return generatedText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }, [generatedText]);

  const previewTitle = selectedTemplate?.category === 'WhatsApp'
    ? 'Prévia de entrega no WhatsApp'
    : 'Prévia executiva do documento';

  return (
    <div className="space-y-8 animate-fadeIn pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-white">DOC <span className="text-amber-500 text-3xl">STUDIO</span></h2>
          <p className="text-slate-400 text-sm font-medium">Gerador visual de propostas, contratos e mensagens comerciais</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
              Parâmetros de geração
            </h3>

            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Vincular cliente CRM</label>
                <select
                  onChange={(e) => setSelectedClient(clients.find((c) => c.id === e.target.value) || null)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-300 outline-none focus:border-amber-500 transition-all appearance-none cursor-pointer"
                  value={selectedClient?.id || ''}
                >
                  <option value="">-- Selecione o prospect --</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.nome} ({c.empresa})</option>)}
                </select>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Marca ativa</p>
                <p className="text-white font-bold mt-2">{companyName}</p>
                <p className="text-xs text-slate-400 mt-1">O preview se adapta ao tipo de entrega selecionado.</p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Template estratégico</label>
                <div className="grid grid-cols-1 gap-2">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplate(t)}
                      className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                        selectedTemplate?.id === t.id
                          ? 'bg-amber-500/10 border-amber-500/50'
                          : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <span className="text-xl">{t.icon}</span>
                      <div>
                        <p className={`text-xs font-black uppercase ${selectedTemplate?.id === t.id ? 'text-amber-500' : 'text-slate-300'}`}>
                          {t.title}
                        </p>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">{t.category}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Contexto customizado</label>
                <textarea
                  placeholder="Ex: Pintura completa da fachada com preparação, acabamento premium e condição especial no PIX..."
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 outline-none focus:border-amber-500 transition-all h-28 resize-none"
                />
              </div>

              <button
                onClick={handleGenerateDocument}
                disabled={!selectedTemplate || isGenerating}
                className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-amber-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed group overflow-hidden relative"
              >
                <span className="relative z-10">{isGenerating ? 'PROCESSANDO REDAÇÃO...' : 'GERAR CONTEÚDO ✨'}</span>
                {isGenerating && <div className="absolute inset-0 bg-amber-400/20 animate-pulse"></div>}
              </button>
            </div>
          </section>
        </div>

        <div className="lg:col-span-8">
          <div className="bg-slate-950 rounded-[2rem] shadow-2xl min-h-[800px] flex flex-col overflow-hidden border border-slate-800">
            <div className="bg-slate-900 border-b border-slate-800 p-6 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 bg-amber-500 rounded-2xl flex items-center justify-center text-slate-950 font-black text-xl">K</div>
                <div>
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{previewTitle}</h4>
                  <p className="text-xs font-bold text-slate-300 font-mono">ID: {docId}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={copyToClipboard} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all" title="Copiar Texto">📋</button>
                <button onClick={() => window.print()} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all" title="Imprimir / Salvar PDF">🖨️</button>
              </div>
            </div>

            <div className="flex-1 p-6 sm:p-8 lg:p-10 relative overflow-hidden">
              {isGenerating ? (
                <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-400">
                  <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="font-sans text-[10px] font-black uppercase tracking-[0.4em] animate-pulse">Agente Klaus redigindo...</p>
                </div>
              ) : generatedText ? (
                <div className="animate-fadeIn animate-duration-500 h-full">
                  {selectedTemplate?.category === 'WhatsApp' ? (
                    <div className="max-w-[430px] mx-auto rounded-[2rem] border border-slate-800 bg-[#0b141a] shadow-2xl overflow-hidden">
                      <div className="px-5 py-4 bg-[#202c33] border-b border-black/20 flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-300 font-black">B</div>
                        <div>
                          <p className="text-white font-bold">{companyName}</p>
                          <p className="text-[11px] text-slate-300">Entrega comercial via WhatsApp</p>
                        </div>
                      </div>

                      <div className="p-5 bg-[#111b21] min-h-[560px]">
                        <div className="rounded-2xl bg-[#202c33] text-white p-4 max-w-[88%] shadow-lg border border-white/5">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Mensagem</span>
                            <span className="text-[10px] text-slate-400">{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div className="space-y-3">
                            {lines.map((line, idx) => (
                              <p key={idx} className={`text-sm leading-6 ${line.includes(':') ? 'text-slate-100 font-medium' : 'text-slate-200'}`}>
                                {line}
                              </p>
                            ))}
                          </div>
                        </div>

                        <div className="mt-6 rounded-2xl border border-dashed border-emerald-500/20 bg-emerald-500/5 p-4 text-emerald-100">
                          <p className="text-[10px] uppercase tracking-[0.25em] font-black text-emerald-300">Como isso vai sair</p>
                          <p className="text-sm mt-2 leading-6 text-slate-200">
                            Em vez de parecer um documento de papel, esta mensagem será entregue no estilo de conversa, com leitura mais natural para o cliente e melhor percepção de profissionalismo no WhatsApp.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-4xl mx-auto rounded-[2rem] border border-slate-800 bg-white text-slate-900 shadow-2xl overflow-hidden">
                      <div className="bg-slate-950 text-white px-8 py-8 border-b-4 border-amber-500">
                        <p className="text-[10px] uppercase tracking-[0.3em] font-black text-amber-300">Documento executivo</p>
                        <h1 className="text-3xl font-black tracking-tight mt-2">{selectedTemplate?.title}</h1>
                        <p className="text-slate-300 mt-3 max-w-2xl text-sm leading-6">
                          Layout de apresentação mais profissional para proposta comercial, orçamento ou contrato, com foco em clareza, valor percebido e leitura mais executiva.
                        </p>
                      </div>

                      <div className="px-8 py-8 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-500">Empresa</p>
                            <p className="mt-2 font-bold text-slate-900">{companyName}</p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-500">Cliente</p>
                            <p className="mt-2 font-bold text-slate-900">{selectedClient?.nome || 'Lead não vinculado'}</p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-500">Documento</p>
                            <p className="mt-2 font-bold text-slate-900">{docId}</p>
                          </div>
                        </div>

                        <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-6">
                          <p className="text-[10px] uppercase tracking-[0.25em] font-black text-amber-700">Resumo estratégico</p>
                          <p className="text-slate-800 mt-3 leading-7 text-[15px]">
                            Conteúdo estruturado para parecer uma proposta de verdade, e não apenas texto cru despejado em uma folha branca.
                          </p>
                        </div>

                        <div className="space-y-5">
                          {contentBlocks.map((block, idx) => {
                            const isHeadline = block.length < 80 && block === block.toUpperCase();
                            return (
                              <div key={idx} className="rounded-2xl border border-slate-200 p-5">
                                {isHeadline ? (
                                  <h3 className="text-lg font-black tracking-tight text-slate-900">{block}</h3>
                                ) : (
                                  <p className="text-[15px] leading-8 text-slate-700 whitespace-pre-wrap">{block}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-30 select-none">
                  <div className="text-8xl mb-4">🖋️</div>
                  <h3 className="text-4xl font-black uppercase tracking-tighter text-white">Document Studio</h3>
                  <p className="text-sm font-sans mt-2 text-slate-400">Selecione um cliente e um template para começar.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelsModule;
