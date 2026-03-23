
export enum ModuleType {
  DASHBOARD = 'DASHBOARD',
  IA_CONFIG = 'IA_CONFIG',
  CLIENTS = 'CLIENTS',
  BUDGETS = 'BUDGETS',
  FINANCE = 'FINANCE',
  MODELS = 'MODELS',
  WHATSAPP = 'WHATSAPP',
  VOICE = 'VOICE',
  AGENDA = 'AGENDA',
  SUPPORT_AI = 'SUPPORT_AI',
  RUNTIME = 'RUNTIME'
}

export interface CompanyNames {
  bellarte: string;
  alfa: string;
  personal: string;
}

export interface IAConfig {
  model: string;
  temperature: number;
  klausPrompt: string; // DNA para Klaus Full (Master Only)
  prospectingAlfaPrompt: string; // DNA AlfaDDT
  prospectingCustomPrompt: string; // DNA Customizável
  attendantPrompt: string; // DNA Suporte Empresa

  // Dados e modelos de documentos por empresa (para evitar geração aleatória)
  companyDetails?: Record<string, {
    nome?: string;
    cnpj?: string;
    endereco?: string;
    telefone?: string;
    email?: string;
    site?: string;
    pix?: string;
    observacoes?: string;
  }>;
  docTemplates?: Record<string, {
    budgetMessage?: string;   // template curto para WhatsApp
    proposal?: string;        // proposta/orçamento detalhado
    contract?: string;
  }>;
}

export enum IAProfile {
  PROSPECTING_ALFA = 'PROSPECTING_ALFA',
  PROSPECTING_CUSTOM = 'PROSPECTING_CUSTOM',
  ATTENDANT = 'ATTENDANT',
  FULL = 'FULL' // Perfil interno automático para o César
}

export interface AgendaEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  clientId?: string;
  company: 'bellarte' | 'alfa' | 'personal';
  reminderSent: boolean;
}

export interface SystemStatus {
  server: 'ok' | 'error';
  database: 'ok' | 'error';
  ia: 'ok' | 'error';
  whatsapp: 'connected' | 'disconnected' | 'connecting';
}

export interface Client {
  id: string;
  nome: string;
  telefone: string;
  empresa: string; // Changed to string to allow dynamic company names
  status: 'Ativo' | 'Inativo' | 'Lead' | 'Interessado' | 'Desqualificado';
  observacoes: string;
}

export interface Budget {
  id: string;
  cliente: string;
  contato: string;
  servico: string;
  valor: number;
  data: string;
  status: 'Pendente' | 'Aprovado' | 'Recusado';
  company: string;
}

export interface Transaction {
  id: string;
  tipo: 'Pagar' | 'Receber' | 'Entrada' | 'Saída';
  categoria: 'Fixo' | 'Variável' | 'Emergencial';
  empresa: string;
  valor: number;
  descricao: string;
  data: string;
  status: 'Pendente' | 'Concluído';
  clienteId?: string;
}
