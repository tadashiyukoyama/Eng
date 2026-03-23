
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { IAConfig, Client, Transaction, SystemStatus, Budget, AgendaEvent, CompanyNames, IAProfile } from '../types';
import { apiService } from '../services/apiService';
import { apiUrl } from '../services/runtimeBase';
import { resetKlausMemory } from '../services/geminiService';

interface PanelCapabilities {
  canUseJarvis: boolean;
  canManualSend: boolean;
  canUseSupportAI: boolean;
  canEditSensitive: boolean;
  canModifyData: boolean;
}

interface PanelSessionState {
  authenticated: boolean;
  role: 'admin' | 'tester' | null;
  email: string | null;
  remote: boolean;
  capabilities: PanelCapabilities;
}

interface AppContextType {
  panelSession: PanelSessionState;
  refreshPanelSession: () => Promise<void>;
  denyMessage: (message?: string) => void;
  config: IAConfig;
  setConfig: (config: IAConfig) => void;
  activeProfile: IAProfile;
  setActiveProfile: (p: IAProfile) => void;
  companies: CompanyNames;
  setCompanies: (c: CompanyNames) => void;
  clients: Client[];
  setClients: (clients: Client[]) => void;
  transactions: Transaction[];
  setTransactions: (transactions: Transaction[]) => void;
  budgets: Budget[];
  setBudgets: (budgets: Budget[]) => void;
  agenda: AgendaEvent[];
  setAgenda: (a: AgendaEvent[]) => void;
  status: SystemStatus;
  setStatus: (status: SystemStatus) => void;
  isSyncing: boolean;
  executeAction: (name: string, args: any) => Promise<void>;
  // Sincroniza o estado inteiro (ou parcialmente) com o server/db.json
  syncAll: (partial?: Partial<{ 
    config: IAConfig;
    activeProfile: IAProfile;
    companies: CompanyNames;
    clients: Client[];
    transactions: Transaction[];
    budgets: Budget[];
    agenda: AgendaEvent[];
  }>) => Promise<void>;
  refreshData: () => Promise<void>;
  resetSession: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [panelSession, setPanelSession] = useState<PanelSessionState>({
    authenticated: false,
    role: null,
    email: null,
    remote: false,
    capabilities: {
      canUseJarvis: true,
      canManualSend: true,
      canUseSupportAI: false,
      canEditSensitive: false,
      canModifyData: false,
    },
  });
  const [activeProfile, setActiveProfile] = useState<IAProfile>(IAProfile.PROSPECTING_ALFA);
  const [companies, setCompanies] = useState<CompanyNames>({
    bellarte: 'Bellarte Pinturas',
    alfa: 'Alfa DDT',
    personal: 'Vida Pessoal'
  });
  const [config, setConfig] = useState<IAConfig>({
    model: 'gemini-3-flash-preview',
    temperature: 0.7,
    klausPrompt: 'Yukoyama Engine: Controle Total para César.',
    prospectingAlfaPrompt: 'Prospecção AlfaDDT: Abordagem agressiva 89.90.',
    prospectingCustomPrompt: 'Perfil de Prospecção Customizável.',
    attendantPrompt: 'Suporte focado na satisfação do cliente.'
    ,
    companyDetails: {
      bellarte: { nome: 'Bellarte Pinturas', telefone: '11 96124-0197' },
      alfa: { nome: 'Alfa DDT', telefone: '11 97503-7750' },
      personal: { nome: 'Vida Pessoal' }
    },
    docTemplates: {
      bellarte: {
        budgetMessage:
`🧾 *ORÇAMENTO — {{COMPANY_NAME}}*\n\nCliente: {{CLIENT_NAME}}\nServiço: {{SERVICE}}\nValor: R$ {{VALUE}}\nData: {{DATE}}\n\n{{COMPANY_PHONE}}\n{{COMPANY_EMAIL}}`,
        proposal:
`PROPOSTA COMERCIAL — {{COMPANY_NAME}}\n\nDADOS DA EMPRESA\nNome: {{COMPANY_NAME}}\nCNPJ: {{COMPANY_CNPJ}}\nEndereço: {{COMPANY_ADDRESS}}\nTelefone: {{COMPANY_PHONE}}\nE-mail: {{COMPANY_EMAIL}}\n\nDADOS DO CLIENTE\nCliente: {{CLIENT_NAME}}\nContato: {{CLIENT_PHONE}}\n\nSERVIÇO\n{{SERVICE}}\n\nVALOR\nR$ {{VALUE}}\n\nCONDIÇÕES\n- Validade: 7 dias\n- Forma de pagamento: a combinar\n\nData: {{DATE}}`,
      },
      alfa: {
        budgetMessage:
`🧾 *ORÇAMENTO — {{COMPANY_NAME}}*\n\nCliente: {{CLIENT_NAME}}\nServiço: {{SERVICE}}\nValor: R$ {{VALUE}}\nData: {{DATE}}\n\nAtendimento 24h\n{{COMPANY_PHONE}}`,
        proposal:
`PROPOSTA COMERCIAL — {{COMPANY_NAME}}\n\nEMPRESA\n{{COMPANY_NAME}}\nCNPJ: {{COMPANY_CNPJ}}\nContato: {{COMPANY_PHONE}}\n\nCLIENTE\n{{CLIENT_NAME}} ({{CLIENT_PHONE}})\n\nSERVIÇO\n{{SERVICE}}\n\nVALOR\nR$ {{VALUE}}\n\nData: {{DATE}}`,
      },
      personal: {
        budgetMessage: `{{TEXT}}`,
        proposal: `{{TEXT}}`
      }
    }
  });
  
  const [clients, setClients] = useState<Client[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [agenda, setAgenda] = useState<AgendaEvent[]>([]);
  const [status, setStatus] = useState<SystemStatus>({
    server: 'error', database: 'ok', ia: 'ok', whatsapp: 'disconnected'
  });

  const denyMessage = useCallback((message = 'Acesso negado: disponível apenas para administrador.') => {
    window.alert(message);
  }, []);

  const refreshPanelSession = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/panel/session'), { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Falha ao carregar sessão do painel');
      setPanelSession({
        authenticated: !!data.authenticated,
        role: data.role || null,
        email: data.email || null,
        remote: !!data.remote,
        capabilities: {
          canUseJarvis: !!data?.capabilities?.canUseJarvis,
          canManualSend: !!data?.capabilities?.canManualSend,
          canUseSupportAI: !!data?.capabilities?.canUseSupportAI,
          canEditSensitive: !!data?.capabilities?.canEditSensitive,
          canModifyData: !!data?.capabilities?.canModifyData,
        },
      });
    } catch {
      setPanelSession((prev) => ({ ...prev, authenticated: false }));
    }
  }, []);

  const autosaveTimerRef = useRef<number | null>(null);
  const hasHydratedRef = useRef(false);

  const refreshData = useCallback(async () => {
    const data = await apiService.fetchAllData();
    if (data) {
      if (data.config && Object.keys(data.config).length > 0) setConfig(data.config);
      if (data.companies) setCompanies(data.companies);
      if (data.activeProfile) setActiveProfile(data.activeProfile);
      setClients(data.clients || []);
      setTransactions(data.transactions || []);
      setBudgets(data.budgets || []);
      setAgenda(data.agenda || []);
      hasHydratedRef.current = true;
    }
  }, []);

  const syncAll = useCallback(async (partial?: Partial<{ 
    config: IAConfig;
    activeProfile: IAProfile;
    companies: CompanyNames;
    clients: Client[];
    transactions: Transaction[];
    budgets: Budget[];
    agenda: AgendaEvent[];
  }>) => {
    if (panelSession.remote && !panelSession.capabilities.canModifyData) {
      denyMessage();
      return;
    }
    const payload = {
      config: partial?.config ?? config,
      activeProfile: partial?.activeProfile ?? activeProfile,
      companies: partial?.companies ?? companies,
      clients: partial?.clients ?? clients,
      transactions: partial?.transactions ?? transactions,
      budgets: partial?.budgets ?? budgets,
      agenda: partial?.agenda ?? agenda,
    };

    setIsSyncing(true);
    await apiService.syncData(payload);
    setIsSyncing(false);

    // mantém estado local alinhado (especialmente quando partial veio de fora)
    if (partial?.config) setConfig(partial.config);
    if (partial?.activeProfile) setActiveProfile(partial.activeProfile);
    if (partial?.companies) setCompanies(partial.companies);
    if (partial?.clients) setClients(partial.clients);
    if (partial?.transactions) setTransactions(partial.transactions);
    if (partial?.budgets) setBudgets(partial.budgets);
    if (partial?.agenda) setAgenda(partial.agenda);
  }, [config, activeProfile, companies, clients, transactions, budgets, agenda, panelSession.remote, panelSession.capabilities.canModifyData, denyMessage]);

  useEffect(() => {
    refreshPanelSession().catch(() => {});
  }, [refreshPanelSession]);

  useEffect(() => {
    let lastUpdate = 0;
    const check = async () => {
      try {
        const res = await fetch(apiUrl('/status'));
        if (res.ok) {
          const remoteStatus = await res.json();
          setStatus(prev => ({
            ...prev,
            server: 'ok',
            whatsapp: remoteStatus.connected ? 'connected' : remoteStatus.qr ? 'connecting' : 'disconnected'
          }));
          if (remoteStatus.lastDbUpdate > lastUpdate) {
            await refreshData();
            lastUpdate = remoteStatus.lastDbUpdate;
          }
        }
      } catch (e) {
        setStatus(prev => ({ ...prev, server: 'error', whatsapp: 'disconnected' }));
      }
    };
    const timer = setInterval(check, 3000);
    check();
    return () => clearInterval(timer);
  }, [refreshData]);

  const handleSetProfile = (p: IAProfile) => setActiveProfile(p);

  const executeAction = useCallback(async (name: string, args: any) => {
    if (panelSession.remote && !panelSession.capabilities.canModifyData) {
      denyMessage();
      return;
    }
    // IMPORTANTE: não sobrescrever coleções que não mudaram.
    // Antes, ao criar uma transação, reenviávamos budgets/clients antigos e isso revertia status (ex: "Aprovar" orçamento).
    if (name === 'add_client') {
      const uClients = [...clients, { ...args, id: Date.now().toString(), status: args?.status || 'Lead' }];
      await syncAll({ clients: uClients });
      setClients(uClients);
      return;
    }

    if (name === 'add_transaction') {
      const uTransactions = [{ ...args, id: Date.now().toString(), status: args?.status || 'Pendente' }, ...transactions];
      await syncAll({ transactions: uTransactions });
      setTransactions(uTransactions);
      return;
    }

    if (name === 'add_budget') {
      const uBudgets = [...budgets, { ...args, id: Date.now().toString(), data: new Date().toISOString().split('T')[0], status: 'Pendente' }];
      await syncAll({ budgets: uBudgets });
      setBudgets(uBudgets);
      return;
    }

    if (name === 'add_event') {
      const uAgenda = [...agenda, { ...args, id: Date.now().toString(), reminderSent: false }];
      await syncAll({ agenda: uAgenda });
      setAgenda(uAgenda);
      return;
    }
  }, [clients, transactions, budgets, agenda, syncAll]);

  // Autosave: garante que edições no Cérebro IA (prompts/empresas/perfil) persistam no db.json
  useEffect(() => {
    if (panelSession.remote && !panelSession.capabilities.canModifyData) return;
    if (!hasHydratedRef.current) return;
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      syncAll().catch(() => {
        // silencioso: status/server já indica queda se acontecer
      });
    }, 700);
    return () => {
      if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    };
  }, [config, companies, activeProfile, syncAll]);

  return (
    <AppContext.Provider value={{ 
      panelSession, refreshPanelSession, denyMessage,
      config, setConfig, activeProfile, setActiveProfile: handleSetProfile, companies, setCompanies,
      clients, setClients, transactions, setTransactions, budgets, setBudgets,
      agenda, setAgenda, status, setStatus, isSyncing, executeAction, syncAll, refreshData, resetSession: resetKlausMemory
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp deve ser usado dentro de AppProvider');
  return context;
};
