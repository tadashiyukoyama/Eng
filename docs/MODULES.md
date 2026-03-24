# Módulos Frontend — Klaus OS

Este documento descreve cada módulo (página) do frontend, suas funcionalidades, componentes utilizados, hooks tRPC chamados e o que está implementado versus o que ainda precisa ser feito.

---

## Layout Geral

**Arquivo:** `client/src/components/DashboardLayout.tsx`

O layout utiliza o componente `SidebarProvider` + `Sidebar` do shadcn/ui. A sidebar contém 9 itens de navegação com ícones do Lucide React. O layout é responsivo e colapsa em mobile. O usuário autenticado aparece no rodapé da sidebar com nome, email e botão de logout.

**Menu Items:**

| Ícone | Label | Rota | Página |
| :--- | :--- | :--- | :--- |
| LayoutDashboard | Dashboard | `/` | Dashboard.tsx |
| Users | CRM | `/crm` | CRM.tsx |
| DollarSign | Financeiro | `/finance` | Finance.tsx |
| FileText | Orçamentos | `/budgets` | Budgets.tsx |
| Calendar | Agenda | `/agenda` | Agenda.tsx |
| Cpu | Doc Studio | `/doc-studio` | DocStudio.tsx |
| Settings | Config IA | `/ai-config` | AIConfig.tsx |
| MessageSquare | Suporte IA | `/support` | Support.tsx |
| Mic | Jarvis | `/jarvis` | Jarvis.tsx |

---

## 1. Dashboard (`/`)

**Arquivo:** `client/src/pages/Dashboard.tsx`

O Dashboard é a tela principal do sistema, exibindo métricas executivas e um terminal de comandos IA.

**Funcionalidades implementadas:**
- Cards de métricas: total de clientes, leads, orçamentos pendentes, saldo financeiro
- Resumo financeiro: receitas, despesas, a receber, a pagar, saldo líquido
- Terminal de comandos IA: campo de input onde o usuário digita comandos em linguagem natural e recebe respostas do LLM com contexto do sistema
- Filtro por empresa (select no topo)

**Hooks tRPC utilizados:**
- `trpc.dashboard.metrics.useQuery({ companyId })`
- `trpc.companies.list.useQuery()`
- `trpc.dashboard.aiCommand.useMutation()`

---

## 2. CRM (`/crm`)

**Arquivo:** `client/src/pages/CRM.tsx`

Módulo completo de gestão de leads e clientes.

**Funcionalidades implementadas:**
- Listagem de clientes com cards informativos
- Filtro por empresa e por status (lead, prospect, active, inactive, lost)
- Busca textual por nome
- Dialog de criação/edição de cliente com todos os campos
- Botão de deletar com confirmação
- Badges coloridos por status
- Exibição de tags, telefone, email, cidade, notas e origem

**Hooks tRPC utilizados:**
- `trpc.clients.list.useQuery({ companyId, status, search })`
- `trpc.companies.list.useQuery()`
- `trpc.clients.upsert.useMutation()`
- `trpc.clients.delete.useMutation()`

---

## 3. Financeiro (`/finance`)

**Arquivo:** `client/src/pages/Finance.tsx`

Controle financeiro completo com transações e saldo.

**Funcionalidades implementadas:**
- Cards de resumo: receitas, despesas, a receber, a pagar, saldo, saldo líquido
- Listagem de transações em tabela
- Filtro por empresa e por tipo (income, expense, receivable, payable)
- Dialog de criação/edição de transação
- Botão "Marcar como pago" para transações a receber/pagar
- Botão de deletar com confirmação
- Formatação de valores em BRL (R$)
- Cores diferenciadas por tipo de transação

**Hooks tRPC utilizados:**
- `trpc.transactions.list.useQuery({ companyId, type })`
- `trpc.transactions.summary.useQuery({ companyId })`
- `trpc.companies.list.useQuery()`
- `trpc.transactions.upsert.useMutation()`
- `trpc.transactions.delete.useMutation()`
- `trpc.transactions.markPaid.useMutation()`

---

## 4. Orçamentos (`/budgets`)

**Arquivo:** `client/src/pages/Budgets.tsx`

Sistema de orçamentos com criação manual e geração via IA.

**Funcionalidades implementadas:**
- Listagem de orçamentos com status colorido
- Filtro por empresa e por status
- Dialog de criação manual com itens dinâmicos (adicionar/remover)
- Cálculo automático de total por item e total geral
- Geração de orçamento via IA (descreve o serviço e a IA gera título, itens e valores)
- Atualização de status (draft → pending → approved/rejected/expired)
- Visualização detalhada com itens
- Botão de deletar
- Botão de imprimir (`window.print()`)

**Hooks tRPC utilizados:**
- `trpc.budgets.list.useQuery({ companyId, status })`
- `trpc.budgets.get.useQuery(budgetId)`
- `trpc.companies.list.useQuery()`
- `trpc.budgets.create.useMutation()`
- `trpc.budgets.updateStatus.useMutation()`
- `trpc.budgets.delete.useMutation()`
- `trpc.budgets.generateWithAI.useMutation()`

**O que falta:**
- Geração de PDF premium com layout executivo (atualmente usa `window.print()`)
- Envio automático por email/WhatsApp

---

## 5. Agenda (`/agenda`)

**Arquivo:** `client/src/pages/Agenda.tsx`

Agenda de eventos com campos completos.

**Funcionalidades implementadas:**
- Listagem de eventos agrupados por data
- Filtro por empresa
- Dialog de criação/edição com campos: título, cliente, endereço, notas, data/hora início e fim, dia inteiro
- Atualização de status (scheduled → confirmed → done / cancelled)
- Botão de deletar
- Badges coloridos por status
- Exibição de endereço e notas

**Hooks tRPC utilizados:**
- `trpc.agenda.list.useQuery({ companyId })`
- `trpc.companies.list.useQuery()`
- `trpc.agenda.upsert.useMutation()`
- `trpc.agenda.delete.useMutation()`
- `trpc.agenda.updateStatus.useMutation()`

**O que falta:**
- Visualização em calendário (atualmente é lista)
- Lembretes automáticos via notificação
- Integração com Google Calendar

---

## 6. Doc Studio (`/doc-studio`)

**Arquivo:** `client/src/pages/DocStudio.tsx`

Gerador de documentos baseado em templates com variáveis dinâmicas.

**Funcionalidades implementadas:**
- Listagem de templates com tipo e variáveis
- Dialog de criação/edição de template com campo de conteúdo grande
- Variáveis dinâmicas no formato `{{nome_variavel}}`
- Renderização de template: preenche as variáveis e exibe o resultado
- Gerador rápido com IA: descreve o tipo de documento e a IA gera o conteúdo
- Filtro por tipo (proposal, contract, whatsapp, email, other)
- Botão de copiar resultado para clipboard
- Botão de deletar

**Hooks tRPC utilizados:**
- `trpc.docStudio.list.useQuery({ companyId, type })`
- `trpc.companies.list.useQuery()`
- `trpc.docStudio.upsert.useMutation()`
- `trpc.docStudio.delete.useMutation()`
- `trpc.docStudio.render.useMutation()`
- `trpc.docStudio.generateWithAI.useMutation()`

---

## 7. Config IA (`/ai-config`)

**Arquivo:** `client/src/pages/AIConfig.tsx`

Configuração de perfis de IA com system prompts customizados.

**Funcionalidades implementadas:**
- Listagem de perfis com tipo, modelo e temperatura
- Dialog de criação/edição com campos: nome, tipo, empresa, system prompt, modelo, temperatura, padrão
- Tipos disponíveis: prospecting_alfa, prospecting_custom, attendant, full, jarvis
- Badge de "Padrão" para o perfil default
- Botão de deletar

**Hooks tRPC utilizados:**
- `trpc.aiConfig.list.useQuery({ companyId })`
- `trpc.companies.list.useQuery()`
- `trpc.aiConfig.upsert.useMutation()`
- `trpc.aiConfig.delete.useMutation()`

---

## 8. Suporte IA (`/support`)

**Arquivo:** `client/src/pages/Support.tsx`

Chat de suporte técnico com IA contextualizada.

**Funcionalidades implementadas:**
- Interface de chat com mensagens do usuário e do assistente
- Histórico persistido no banco de dados
- Renderização de markdown nas respostas (via Streamdown)
- Botão de limpar histórico
- Loading state durante resposta da IA
- System prompt contextualizado sobre o Klaus OS

**Hooks tRPC utilizados:**
- `trpc.support.history.useQuery({ limit: 50 })`
- `trpc.support.chat.useMutation()`
- `trpc.support.clearHistory.useMutation()`

---

## 9. Jarvis (`/jarvis`)

**Arquivo:** `client/src/pages/Jarvis.tsx`

Assistente de voz bidirecional com Google Gemini Live Audio.

**Funcionalidades implementadas:**
- Campo para inserir chave API do Gemini (salva no localStorage)
- Conexão WebSocket com `gemini-2.5-flash-preview-native-audio-dialog`
- Captura de áudio do microfone via `AudioWorkletNode` (PCM 16kHz)
- Envio de áudio em tempo real via `session.sendRealtimeInput()`
- Recepção e reprodução de áudio da IA (base64 → PCM → AudioContext)
- Compartilhamento de tela com captura de frames JPEG a cada 2 segundos
- Indicadores visuais de status: conectando, ativo, escutando, falando
- Botão de desconectar
- Log de eventos em tempo real

**Dependências externas:**
- SDK `@google/genai` carregado via `esm.sh` (import dinâmico)
- Requer chave API do Google Gemini com acesso ao modelo de áudio nativo

**O que falta:**
- Integração com perfis de IA do Config IA (atualmente usa system prompt fixo)
- Transcrição do áudio para texto (atualmente só áudio)
- Histórico de conversas por voz

---

## Componentes Reutilizáveis

| Componente | Arquivo | Descrição |
| :--- | :--- | :--- |
| DashboardLayout | `components/DashboardLayout.tsx` | Layout com sidebar, auth e navegação |
| AIChatBox | `components/AIChatBox.tsx` | Interface de chat com streaming e markdown |
| Map | `components/Map.tsx` | Google Maps com proxy Manus |
| ErrorBoundary | `components/ErrorBoundary.tsx` | Captura erros React |
| ui/* | `components/ui/*.tsx` | 60+ componentes shadcn/ui |
