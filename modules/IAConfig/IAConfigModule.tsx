
import React, { useEffect, useState } from 'react';
import { IAProfile, CompanyNames } from '../../types';
import { useApp } from '../../context/AppContext';
import { apiUrl } from '../../services/runtimeBase';

const IAConfigModule: React.FC = () => {
  const { config, setConfig, activeProfile, setActiveProfile, companies, setCompanies } = useApp();

  const companyDetails = config.companyDetails || {};
  const docTemplates = config.docTemplates || {};

  const updateCompanyDetail = (key: string, field: string, value: string) => {
    setConfig({
      ...config,
      companyDetails: {
        ...companyDetails,
        [key]: { ...(companyDetails as any)[key], [field]: value }
      }
    });
  };

  const updateTemplate = (key: string, field: string, value: string) => {
    setConfig({
      ...config,
      docTemplates: {
        ...docTemplates,
        [key]: { ...(docTemplates as any)[key], [field]: value }
      }
    });
  };

  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiModel, setOpenaiModel] = useState('');
  const [envInfo, setEnvInfo] = useState<{ openai?: string; gemini?: string; model?: string } | null>(null);
  const [savingKeys, setSavingKeys] = useState(false);

  // Upload de modelos (PDFs/arquivos) para envio no WhatsApp
  const [templates, setTemplates] = useState<any[]>([]);
  const [tplCompany, setTplCompany] = useState<'bellarte' | 'alfa' | 'personal'>('bellarte');
  const [tplDocType, setTplDocType] = useState<'proposal' | 'contract' | 'budget' | 'other'>('proposal');
  const [tplFile, setTplFile] = useState<File | null>(null);
  const [uploadingTpl, setUploadingTpl] = useState(false);

  useEffect(() => {
    fetch(apiUrl('/api/system/env'))
      .then(r => r.json())
      .then(d => {
        setEnvInfo(d);
        if (d?.model) setOpenaiModel(d.model);
      })
      .catch(() => setEnvInfo(null));
  }, []);

  const refreshTemplates = () => {
    fetch(apiUrl('/api/templates/list'))
      .then(r => r.json())
      .then(d => setTemplates(Array.isArray(d?.templates) ? d.templates : []))
      .catch(() => setTemplates([]));
  };

  useEffect(() => {
    refreshTemplates();
  }, []);

  const uploadTemplate = async () => {
    if (!tplFile) return;
    setUploadingTpl(true);
    try {
      const fd = new FormData();
      fd.append('company', tplCompany);
      fd.append('docType', tplDocType);
      fd.append('file', tplFile);
      const res = await fetch(apiUrl('/api/templates/upload'), { method: 'POST', body: fd });
      if (res.ok) {
        setTplFile(null);
        refreshTemplates();
      }
    } finally {
      setUploadingTpl(false);
    }
  };

  const saveKeys = async () => {
    setSavingKeys(true);
    try {
      const res = await fetch(apiUrl('/api/system/update-env'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openaiKey, geminiKey, openaiModel })
      });
      if (res.ok) {
        const fresh = await fetch(apiUrl('/api/system/env')).then(r => r.json());
        setEnvInfo(fresh);
        setOpenaiKey('');
        setGeminiKey('');
      }
    } finally {
      setSavingKeys(false);
    }
  };
  
  const profiles = [
    { 
      id: IAProfile.PROSPECTING_ALFA, 
      name: 'Prospecção AlfaDDT', 
      icon: '🐜', 
      desc: 'Funil Automático 89.90.' 
    },
    { 
      id: IAProfile.PROSPECTING_CUSTOM, 
      name: 'Prospecção Custom', 
      icon: '🎯', 
      desc: 'Perfil Editável para Campanhas.' 
    },
    { 
      id: IAProfile.ATTENDANT, 
      name: 'Atendente Suporte', 
      icon: '🎧', 
      desc: 'Foco em Atendimento e Retenção.' 
    },
  ];

  const getPromptValue = () => {
    switch(activeProfile) {
      case IAProfile.PROSPECTING_ALFA: return config.prospectingAlfaPrompt;
      case IAProfile.PROSPECTING_CUSTOM: return config.prospectingCustomPrompt;
      case IAProfile.ATTENDANT: return config.attendantPrompt;
      default: return config.attendantPrompt;
    }
  };

  const setPromptValue = (val: string) => {
    const newConfig = { ...config };
    if (activeProfile === IAProfile.PROSPECTING_ALFA) newConfig.prospectingAlfaPrompt = val;
    else if (activeProfile === IAProfile.PROSPECTING_CUSTOM) newConfig.prospectingCustomPrompt = val;
    else newConfig.attendantPrompt = val;
    setConfig(newConfig);
  };

  return (
    <div className="space-y-10 animate-fadeIn pb-20">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-5xl font-black tracking-tighter text-white italic uppercase">Neural <span className="text-emerald-500">Center</span></h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] mt-2">Configuração de DNA e Comportamento Autônomo</p>
        </div>
      </header>

      {/* Cards de Perfil Ativo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {profiles.map(p => (
          <button
            key={p.id}
            onClick={() => setActiveProfile(p.id)}
            className={`p-8 rounded-[2.5rem] border text-left transition-all relative overflow-hidden group ${
              activeProfile === p.id 
                ? 'bg-emerald-600 border-emerald-400 shadow-[0_20px_40px_rgba(16,185,129,0.2)]' 
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex justify-between items-start mb-4">
              <span className="text-4xl">{p.icon}</span>
              {activeProfile === p.id && (
                <span className="bg-white/20 text-white text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest animate-pulse">
                  Ativo no Nexus
                </span>
              )}
            </div>
            <h3 className={`text-xl font-black ${activeProfile === p.id ? 'text-white' : 'text-slate-300'}`}>{p.name}</h3>
            <p className={`text-[10px] mt-2 font-medium uppercase tracking-widest ${activeProfile === p.id ? 'text-emerald-100' : 'text-slate-500'}`}>{p.desc}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Painel Esquerdo: Master e Nomes */}
        <div className="lg:col-span-4 space-y-8">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-xl">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-6 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              Chaves & Modelos (Salvar direto no .env)
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-black text-slate-600 uppercase ml-1">OpenAI Key (Core)</label>
                <input
                  value={openaiKey}
                  onChange={e => setOpenaiKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-blue-500 outline-none"
                  placeholder={envInfo?.openai ? `Atual: ${envInfo.openai}` : 'cole sua OPENAI_API_KEY'}
                />
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-600 uppercase ml-1">OpenAI Model</label>
                <input
                  value={openaiModel}
                  onChange={e => setOpenaiModel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-blue-500 outline-none"
                  placeholder={envInfo?.model || 'gpt-4o-mini'}
                />
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-600 uppercase ml-1">Gemini Key (Jarvis)</label>
                <input
                  value={geminiKey}
                  onChange={e => setGeminiKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-emerald-500 outline-none"
                  placeholder={envInfo?.gemini ? `Atual: ${envInfo.gemini}` : 'cole sua VITE_GEMINI_API_KEY'}
                />
              </div>

              <button
                onClick={saveKeys}
                disabled={savingKeys}
                className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-2xl py-3 text-[10px] font-black uppercase tracking-widest"
              >
                {savingKeys ? 'Salvando...' : 'Salvar (função única)'}
              </button>

              <p className="text-[8px] text-slate-600 mt-2 uppercase font-bold tracking-tighter italic">
                * Core (WhatsApp + Painel) usa OpenAI via servidor local. Jarvis (voz) usa Gemini no navegador.
              </p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-xl">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-6 flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
              Klaus Full DNA (Apenas Mestre)
            </h3>
            <textarea 
              value={config.klausPrompt}
              onChange={e => setConfig({...config, klausPrompt: e.target.value})}
              rows={5}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-emerald-500 outline-none focus:border-emerald-500 font-mono resize-none"
              placeholder="Instruções para o modo administrador..."
            />
            <p className="text-[8px] text-slate-600 mt-2 uppercase font-bold tracking-tighter italic">
              * Este DNA é ativado apenas quando o remetente é o Master César.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-xl">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-6">Empresas do Ecossistema</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-black text-slate-600 uppercase ml-1">Pintura</label>
                <input 
                  value={companies.bellarte}
                  onChange={e => setCompanies({...companies, bellarte: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-600 uppercase ml-1">Dedetização</label>
                <input 
                  value={companies.alfa}
                  onChange={e => setCompanies({...companies, alfa: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-emerald-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Dados e Modelos de Documento por Empresa */}
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-xl">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-6">
              Modelos de Documentos (por empresa)
            </h3>

            {[{ key: 'bellarte', label: companies.bellarte, color: 'blue' }, { key: 'alfa', label: companies.alfa, color: 'emerald' }].map((c) => (
              <div key={c.key} className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                  <span className={`w-2 h-2 rounded-full ${c.color === 'blue' ? 'bg-blue-500' : 'bg-emerald-500'}`}></span>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">{c.label}</p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <input
                    value={(companyDetails as any)[c.key]?.cnpj || ''}
                    onChange={e => updateCompanyDetail(c.key, 'cnpj', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none"
                    placeholder="CNPJ"
                  />
                  <input
                    value={(companyDetails as any)[c.key]?.endereco || ''}
                    onChange={e => updateCompanyDetail(c.key, 'endereco', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none"
                    placeholder="Endereço"
                  />
                  <input
                    value={(companyDetails as any)[c.key]?.telefone || ''}
                    onChange={e => updateCompanyDetail(c.key, 'telefone', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none"
                    placeholder="Telefone"
                  />
                  <input
                    value={(companyDetails as any)[c.key]?.email || ''}
                    onChange={e => updateCompanyDetail(c.key, 'email', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none"
                    placeholder="E-mail"
                  />
                  <input
                    value={(companyDetails as any)[c.key]?.pix || ''}
                    onChange={e => updateCompanyDetail(c.key, 'pix', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none"
                    placeholder="Chave PIX"
                  />
                </div>

                <div className="mt-4">
                  <label className="text-[9px] font-black text-slate-600 uppercase ml-1">Template WhatsApp (Orçamento)</label>
                  <textarea
                    value={(docTemplates as any)[c.key]?.budgetMessage || ''}
                    onChange={e => updateTemplate(c.key, 'budgetMessage', e.target.value)}
                    rows={6}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-slate-200 font-mono resize-none outline-none"
                    placeholder="Use variáveis: {{COMPANY_NAME}}, {{CLIENT_NAME}}, {{SERVICE}}, {{VALUE}}, {{DATE}}, {{COMPANY_PHONE}}, {{COMPANY_EMAIL}}, {{COMPANY_CNPJ}}, {{COMPANY_ADDRESS}}"
                  />
                </div>

                <div className="mt-4">
                  <label className="text-[9px] font-black text-slate-600 uppercase ml-1">Template Proposta (Documento)</label>
                  <textarea
                    value={(docTemplates as any)[c.key]?.proposal || ''}
                    onChange={e => updateTemplate(c.key, 'proposal', e.target.value)}
                    rows={10}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-slate-200 font-mono resize-none outline-none"
                    placeholder="Template do documento. Use variáveis como acima."
                  />
                </div>
              </div>
            ))}

            <p className="text-[8px] text-slate-600 uppercase font-bold tracking-tighter italic">
              * Esses modelos eliminam geração aleatória: o sistema apenas preenche dados.
            </p>

            {/* Upload de modelos prontos (PDF/arquivo) */}
            <div className="mt-8 border-t border-slate-800 pt-8">
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-4">Upload de Modelos (PDF/Arquivo)</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="text-[9px] font-black text-slate-600 uppercase ml-1">Empresa</label>
                  <select
                    value={tplCompany}
                    onChange={(e) => setTplCompany(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none"
                  >
                    <option value="bellarte">{companies.bellarte}</option>
                    <option value="alfa">{companies.alfa}</option>
                    <option value="personal">Vida Pessoal</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-600 uppercase ml-1">Tipo</label>
                  <select
                    value={tplDocType}
                    onChange={(e) => setTplDocType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none"
                  >
                    <option value="proposal">Proposta</option>
                    <option value="contract">Contrato</option>
                    <option value="budget">Orçamento</option>
                    <option value="other">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-600 uppercase ml-1">Arquivo</label>
                  <input
                    type="file"
                    accept="application/pdf,image/*,.doc,.docx,.txt"
                    onChange={(e) => setTplFile(e.target.files?.[0] || null)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-slate-300 outline-none"
                  />
                </div>
                <button
                  onClick={uploadTemplate}
                  disabled={!tplFile || uploadingTpl}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  {uploadingTpl ? 'Enviando...' : 'Enviar'}
                </button>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.25em]">Modelos enviados</p>
                  <button
                    onClick={refreshTemplates}
                    className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white"
                  >
                    Atualizar
                  </button>
                </div>
                {templates.length === 0 ? (
                  <p className="text-xs text-slate-600">Nenhum modelo enviado ainda.</p>
                ) : (
                  <div className="space-y-2">
                    {templates.slice(0, 12).map((t) => (
                      <div key={t.id} className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-2xl p-3">
                        <div className="text-xs text-slate-200">
                          <p className="font-bold">{t.originalName || t.name}</p>
                          <p className="text-[10px] text-slate-500">{t.company} • {t.docType}</p>
                        </div>
                        <a
                          href={apiUrl(`/api/templates/${t.id}/download`)}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest"
                        >
                          Baixar
                        </a>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[8px] text-slate-600 uppercase font-bold tracking-tighter italic mt-3">
                  * No WhatsApp você pode pedir: "listar modelos" ou "enviar modelo &lt;ID&gt; para master".
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Painel Direito: Prompt do Perfil Ativo */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 p-10 rounded-[3rem] relative shadow-2xl">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">
              DNA de Instrução Ativo: <span className="text-emerald-500">{activeProfile}</span>
            </h3>
            <span className="text-[9px] font-mono text-slate-700">MODO: PERSISTÊNCIA ATIVA</span>
          </div>
          <textarea 
            value={getPromptValue()}
            onChange={e => setPromptValue(e.target.value)}
            rows={15}
            placeholder="Defina o comportamento detalhado para este perfil de atendimento/venda..."
            className="w-full bg-slate-950 border border-slate-800 rounded-3xl p-8 text-sm text-slate-300 font-mono outline-none focus:border-emerald-500 scrollbar-hide resize-none leading-relaxed"
          />
          <div className="mt-6 flex items-center gap-4 text-slate-600">
             <span className="text-xl">⚠️</span>
             <p className="text-[9px] font-bold uppercase tracking-widest">
               Alterações feitas aqui serão sincronizadas com o Nexus Bridge instantaneamente.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IAConfigModule;
