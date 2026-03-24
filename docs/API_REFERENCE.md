# API Reference — Klaus OS

Todas as chamadas de API são feitas via **tRPC** no path `/api/trpc/*`. O frontend utiliza hooks tipados (`trpc.*.useQuery()` e `trpc.*.useMutation()`). Abaixo está a referência completa de cada procedimento, seus inputs (validados via Zod) e outputs.

Procedimentos marcados como **protected** exigem autenticação (cookie JWT). Procedimentos **public** são acessíveis sem login.

---

## Auth

| Procedimento | Tipo | Acesso | Descrição |
| :--- | :--- | :--- | :--- |
| `auth.me` | query | public | Retorna o usuário autenticado ou `null` |
| `auth.logout` | mutation | public | Limpa o cookie de sessão e retorna `{ success: true }` |

### `auth.me`

Retorna o objeto `User` completo se autenticado, ou `null` se não.

```typescript
// Output
{
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: "user" | "admin";
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
} | null
```

### `auth.logout`

Limpa o cookie `app_session_id` e retorna confirmação.

```typescript
// Output
{ success: true }
```

---

## Companies (Empresas)

| Procedimento | Tipo | Acesso | Descrição |
| :--- | :--- | :--- | :--- |
| `companies.list` | query | protected | Lista todas as empresas |
| `companies.upsert` | mutation | protected | Cria ou atualiza uma empresa |

### `companies.list`

Retorna array de todas as empresas cadastradas. Sem input.

```typescript
// Output: Company[]
[{
  id: number;
  name: string;
  slug: string;          // Identificador único (ex: "bellarte", "alfa")
  cnpj: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  pix: string | null;
  logoUrl: string | null;
  primaryColor: string;  // Default: "#059669"
  active: boolean;
  createdAt: Date;
}]
```

### `companies.upsert`

Cria uma nova empresa ou atualiza uma existente (se `id` for fornecido).

```typescript
// Input
{
  id?: number;           // Se presente, atualiza; senão, cria
  name: string;          // Obrigatório, min 1 char
  slug: string;          // Obrigatório, min 1 char, deve ser único
  cnpj?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  pix?: string;
  primaryColor?: string;
}
```

---

## Clients (CRM)

| Procedimento | Tipo | Acesso | Descrição |
| :--- | :--- | :--- | :--- |
| `clients.list` | query | protected | Lista clientes com filtros opcionais |
| `clients.get` | query | protected | Busca um cliente por ID |
| `clients.upsert` | mutation | protected | Cria ou atualiza um cliente |
| `clients.delete` | mutation | protected | Remove um cliente por ID |
| `clients.updateStatus` | mutation | protected | Atualiza o status de um cliente (usado pelo Kanban drag-and-drop) |
| `clients.financialSummary` | query | protected | Resumo financeiro do cliente (recebido, gasto, saldo devedor) |
| `clients.transactions` | query | protected | Lista transações vinculadas ao cliente |
| `clients.budgets` | query | protected | Lista orçamentos vinculados ao cliente |
| `clients.events` | query | protected | Lista eventos de agenda vinculados ao cliente |

### `clients.list`

```typescript
// Input
{
  companyId?: number;    // Filtrar por empresa
  status?: string;       // Filtrar por status: "lead" | "prospect" | "active" | "inactive" | "lost"
  search?: string;       // Busca textual no nome
}

// Output: Client[]
[{
  id: number;
  companyId: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  status: "lead" | "prospect" | "active" | "inactive" | "lost";
  notes: string | null;
  source: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}]
```

### `clients.get`

```typescript
// Input: number (client ID)
// Output: Client | undefined
```

### `clients.upsert`

```typescript
// Input
{
  id?: number;
  companyId: number;     // Obrigatório
  name: string;          // Obrigatório, min 1 char
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  status?: "lead" | "prospect" | "active" | "inactive" | "lost";
  notes?: string;
  source?: string;
  tags?: string[];
}
```

### `clients.delete`

```typescript
// Input: number (client ID)
// Output: void
```

### `clients.updateStatus`

Atualiza o status de um cliente. Usado pelo Kanban quando o usuário arrasta um card entre colunas.

```typescript
// Input
{
  id: number;              // ID do cliente
  status: "lead" | "prospect" | "active" | "inactive" | "lost";
}
// Output: void
```

### `clients.financialSummary`

Retorna o resumo financeiro de um cliente específico, calculando totais a partir das transações vinculadas.

```typescript
// Input: number (client ID)
// Output
{
  totalIncome: number;      // Total recebido do cliente
  totalExpense: number;     // Total gasto com o cliente
  totalReceivable: number;  // Total a receber (não pago)
  totalPayable: number;     // Total a pagar (não pago)
  balance: number;          // Saldo (income - expense)
  owes: number;             // Quanto o cliente me deve (receivables não pagos)
}
```

### `clients.transactions`

Lista todas as transações vinculadas a um cliente específico.

```typescript
// Input: number (client ID)
// Output: Transaction[] (filtrado por clientId, ordenado por createdAt desc)
```

### `clients.budgets`

Lista todos os orçamentos vinculados a um cliente específico.

```typescript
// Input: number (client ID)
// Output: Budget[] (filtrado por clientId, ordenado por createdAt desc)
```

### `clients.events`

Lista todos os eventos de agenda vinculados a um cliente específico.

```typescript
// Input: number (client ID)
// Output: AgendaEvent[] (filtrado por clientId, ordenado por startAt desc)
```

---

## Transactions (Financeiro)

| Procedimento | Tipo | Acesso | Descrição |
| :--- | :--- | :--- | :--- |
| `transactions.list` | query | protected | Lista transações com filtros |
| `transactions.summary` | query | protected | Resumo financeiro (saldos) |
| `transactions.upsert` | mutation | protected | Cria ou atualiza transação |
| `transactions.delete` | mutation | protected | Remove transação |
| `transactions.markPaid` | mutation | protected | Marca como pago/não pago |

### `transactions.list`

```typescript
// Input
{
  companyId?: number;
  type?: string;         // "income" | "expense" | "receivable" | "payable"
  startDate?: Date;      // Filtro de período (início)
  endDate?: Date;        // Filtro de período (fim)
}

// Output: Transaction[]
[{
  id: number;
  companyId: number;
  type: "income" | "expense" | "receivable" | "payable";
  category: string | null;
  description: string;
  amount: string;        // decimal(12,2) como string
  dueDate: Date | null;
  paidAt: Date | null;
  paid: boolean;
  clientId: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}]
```

### `transactions.summary`

Retorna o resumo financeiro calculado a partir de todas as transações.

```typescript
// Input
{ companyId?: number }

// Output
{
  totalIncome: number;
  totalExpense: number;
  totalReceivable: number;
  totalPayable: number;
  balance: number;       // income - expense
  liquidBalance: number; // balance + receivable - payable
}
```

### `transactions.upsert`

```typescript
// Input
{
  id?: number;
  companyId: number;
  type: "income" | "expense" | "receivable" | "payable";
  category?: string;
  description: string;   // Obrigatório, min 1 char
  amount: string;        // Valor como string decimal
  dueDate?: string;      // ISO date string
  paidAt?: string;       // ISO date string
  paid?: boolean;
  clientId?: number;
  notes?: string;
}
```

### `transactions.markPaid`

```typescript
// Input
{
  id: number;
  paid: boolean;         // true = marca como pago (seta paidAt = now())
}
```

---

## Budgets (Orçamentos)

| Procedimento | Tipo | Acesso | Descrição |
| :--- | :--- | :--- | :--- |
| `budgets.list` | query | protected | Lista orçamentos com filtros |
| `budgets.get` | query | protected | Busca orçamento por ID (com itens) |
| `budgets.create` | mutation | protected | Cria orçamento com itens |
| `budgets.updateStatus` | mutation | protected | Atualiza status do orçamento |
| `budgets.delete` | mutation | protected | Remove orçamento e seus itens |
| `budgets.generateWithAI` | mutation | protected | Gera orçamento completo via IA |

### `budgets.list`

```typescript
// Input
{ companyId?: number; status?: string }

// Output: Budget[]
```

### `budgets.get`

```typescript
// Input: number (budget ID)
// Output: { budget: Budget; items: BudgetItem[] }
```

### `budgets.create`

```typescript
// Input
{
  companyId: number;
  clientId?: number;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  title: string;
  description?: string;
  totalAmount: string;
  validUntil?: string;
  notes?: string;
  items: [{
    description: string;
    quantity: string;
    unitPrice: string;
    totalPrice: string;
    order?: number;
  }];
}
```

### `budgets.updateStatus`

```typescript
// Input
{
  id: number;
  status: "draft" | "pending" | "approved" | "rejected" | "expired";
}
```

### `budgets.generateWithAI`

Usa o LLM integrado para gerar um orçamento completo baseado em descrição textual.

```typescript
// Input
{
  description: string;   // Descrição do serviço/produto
  clientName: string;
  companyName?: string;
}

// Output
{
  title: string;
  description: string;
  items: [{ description: string; quantity: number; unitPrice: number; totalPrice: number }];
  totalAmount: number;
  notes: string;
}
```

---

## Agenda

| Procedimento | Tipo | Acesso | Descrição |
| :--- | :--- | :--- | :--- |
| `agenda.list` | query | protected | Lista eventos com filtros |
| `agenda.upsert` | mutation | protected | Cria ou atualiza evento |
| `agenda.delete` | mutation | protected | Remove evento |
| `agenda.updateStatus` | mutation | protected | Atualiza status do evento |

### `agenda.list`

```typescript
// Input
{
  companyId?: number;
  startDate?: Date;
  endDate?: Date;
}

// Output: AgendaEvent[]
[{
  id: number;
  companyId: number;
  clientId: number | null;
  clientName: string | null;
  title: string;
  description: string | null;
  address: string | null;
  notes: string | null;
  startAt: Date;
  endAt: Date | null;
  allDay: boolean;
  status: "scheduled" | "confirmed" | "done" | "cancelled";
  reminderSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}]
```

### `agenda.upsert`

```typescript
// Input
{
  id?: number;
  companyId: number;
  clientId?: number;
  clientName?: string;
  title: string;
  description?: string;
  address?: string;
  notes?: string;
  startAt: string;       // ISO date string
  endAt?: string;
  allDay?: boolean;
  status?: "scheduled" | "confirmed" | "done" | "cancelled";
}
```

### `agenda.updateStatus`

```typescript
// Input
{
  id: number;
  status: "scheduled" | "confirmed" | "done" | "cancelled";
}
```

---

## Doc Studio (Templates)

| Procedimento | Tipo | Acesso | Descrição |
| :--- | :--- | :--- | :--- |
| `docStudio.list` | query | protected | Lista templates |
| `docStudio.upsert` | mutation | protected | Cria ou atualiza template |
| `docStudio.delete` | mutation | protected | Remove template |
| `docStudio.render` | mutation | protected | Renderiza template com variáveis |
| `docStudio.generateWithAI` | mutation | protected | Gera documento via IA |

### `docStudio.render`

Substitui as variáveis `{{variavel}}` no conteúdo do template pelos valores fornecidos.

```typescript
// Input
{
  templateId: number;
  variables: Record<string, string>;  // Ex: { "nome_cliente": "João", "valor": "5000" }
}

// Output: string (conteúdo renderizado)
```

### `docStudio.generateWithAI`

Gera um documento completo usando o LLM.

```typescript
// Input
{
  type: string;          // "proposal" | "contract" | "whatsapp" | "email" | "other"
  clientName?: string;
  service?: string;
  context?: string;
  companyName?: string;
}

// Output
{
  name: string;
  content: string;
  variables: string[];
}
```

---

## AI Config (Perfis de IA)

| Procedimento | Tipo | Acesso | Descrição |
| :--- | :--- | :--- | :--- |
| `aiConfig.list` | query | protected | Lista perfis de IA |
| `aiConfig.upsert` | mutation | protected | Cria ou atualiza perfil |
| `aiConfig.delete` | mutation | protected | Remove perfil |

### `aiConfig.upsert`

```typescript
// Input
{
  id?: number;
  companyId?: number;
  name: string;
  type?: "prospecting_alfa" | "prospecting_custom" | "attendant" | "full" | "jarvis";
  systemPrompt: string;
  model?: string;        // Default: "gemini-2.5-flash"
  temperature?: string;  // Default: "0.7"
  isDefault?: boolean;
}
```

---

## Dashboard

| Procedimento | Tipo | Acesso | Descrição |
| :--- | :--- | :--- | :--- |
| `dashboard.metrics` | query | protected | Métricas executivas do sistema |
| `dashboard.aiCommand` | mutation | protected | Executa comando via terminal IA |

### `dashboard.metrics`

Retorna métricas agregadas de todo o sistema.

```typescript
// Input
{ companyId?: number }

// Output
{
  totalClients: number;
  totalLeads: number;
  totalBudgets: number;
  pendingBudgets: number;
  approvedBudgets: number;
  financialSummary: {
    totalIncome: number;
    totalExpense: number;
    totalReceivable: number;
    totalPayable: number;
    balance: number;
    liquidBalance: number;
  };
  upcomingEvents: number;
  totalTemplates: number;
  totalAiProfiles: number;
}
```

### `dashboard.aiCommand`

Envia um comando em linguagem natural para o LLM, que responde com contexto do sistema.

```typescript
// Input
{
  command: string;       // Ex: "Qual o saldo da Bellarte?"
  companyId?: number;
}

// Output
{
  response: string;      // Resposta do LLM em markdown
}
```

---

## Support (Suporte IA)

| Procedimento | Tipo | Acesso | Descrição |
| :--- | :--- | :--- | :--- |
| `support.history` | query | protected | Histórico de conversas |
| `support.chat` | mutation | protected | Envia mensagem e recebe resposta IA |
| `support.clearHistory` | mutation | protected | Limpa histórico do usuário |

### `support.chat`

```typescript
// Input
{
  message: string;
  history?: [{ role: "user" | "assistant"; content: string }];
}

// Output
{
  response: string;      // Resposta do LLM em markdown
}
```

---

## System (Framework Manus)

| Procedimento | Tipo | Acesso | Descrição |
| :--- | :--- | :--- | :--- |
| `system.notifyOwner` | mutation | protected | Envia notificação ao dono do projeto |

### `system.notifyOwner`

```typescript
// Input
{
  title: string;
  content: string;
}

// Output: boolean (true se enviou com sucesso)
```

---

## Funções do Banco de Dados (server/db.ts)

Todas as funções abaixo são exportadas de `server/db.ts` e utilizadas pelos routers tRPC.

| Função | Descrição |
| :--- | :--- |
| `getDb()` | Retorna instância lazy do Drizzle (singleton) |
| `upsertUser(user)` | Cria ou atualiza usuário (usado pelo OAuth) |
| `getUserByOpenId(openId)` | Busca usuário por openId |
| `getCompanies()` | Lista todas as empresas |
| `upsertCompany(data)` | Cria ou atualiza empresa |
| `getClients(companyId?, status?, search?)` | Lista clientes com filtros |
| `getClientById(id)` | Busca cliente por ID |
| `upsertClient(data)` | Cria ou atualiza cliente |
| `deleteClient(id)` | Remove cliente |
| `getTransactions(companyId?, type?, startDate?, endDate?)` | Lista transações com filtros |
| `upsertTransaction(data)` | Cria ou atualiza transação |
| `deleteTransaction(id)` | Remove transação |
| `getFinancialSummary(companyId?)` | Calcula resumo financeiro |
| `getBudgets(companyId?, status?)` | Lista orçamentos |
| `getBudgetById(id)` | Busca orçamento com itens |
| `createBudget(data)` | Cria orçamento |
| `updateBudget(id, data)` | Atualiza orçamento |
| `upsertBudgetItems(budgetId, items[])` | Insere itens do orçamento |
| `deleteBudget(id)` | Remove orçamento e itens |
| `getAgendaEvents(companyId?, startDate?, endDate?)` | Lista eventos da agenda |
| `upsertAgendaEvent(data)` | Cria ou atualiza evento |
| `deleteAgendaEvent(id)` | Remove evento |
| `getDocTemplates(companyId?, type?)` | Lista templates |
| `upsertDocTemplate(data)` | Cria ou atualiza template |
| `deleteDocTemplate(id)` | Remove template |
| `getAiProfiles(companyId?)` | Lista perfis de IA |
| `upsertAiProfile(data)` | Cria ou atualiza perfil IA |
| `deleteAiProfile(id)` | Remove perfil IA |
| `getSupportLogs(userId?, limit?)` | Busca histórico de suporte |
| `addSupportLog(data)` | Adiciona entrada no log de suporte |
| `clearSupportLogs(userId?)` | Limpa histórico de suporte |
