# Database Schema — Klaus OS

O Klaus OS utiliza **MySQL** (TiDB via Manus) com **Drizzle ORM**. O schema é definido em `drizzle/schema.ts` e as migrações são geradas via `drizzle-kit`. Este documento descreve todas as tabelas, campos, tipos e relações.

---

## Visão Geral das Tabelas

| Tabela | Descrição | Registros Típicos |
| :--- | :--- | :--- |
| `users` | Usuários autenticados via OAuth | Poucos (admin + colaboradores) |
| `companies` | Empresas gerenciadas (Bellarte, Alfa, etc.) | 2-5 |
| `clients` | Leads e clientes do CRM | Centenas a milhares |
| `transactions` | Movimentações financeiras | Centenas a milhares |
| `budgets` | Orçamentos emitidos | Dezenas a centenas |
| `budget_items` | Itens de cada orçamento | Múltiplos por orçamento |
| `agenda_events` | Eventos da agenda | Dezenas a centenas |
| `doc_templates` | Templates de documentos | Dezenas |
| `ai_profiles` | Perfis de configuração da IA | Poucos (5-10) |
| `support_logs` | Histórico de conversas com suporte IA | Centenas |

---

## Tabela: `users`

Gerenciada automaticamente pelo fluxo OAuth. O primeiro usuário recebe `role = 'admin'`.

| Campo | Tipo | Nullable | Default | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `id` | int | NOT NULL | AUTO_INCREMENT | Chave primária |
| `openId` | varchar(64) | NOT NULL | — | ID único do OAuth Manus (UNIQUE) |
| `name` | text | NULL | — | Nome do usuário |
| `email` | varchar(320) | NULL | — | Email |
| `loginMethod` | varchar(64) | NULL | — | Método de login (google, email, etc.) |
| `role` | enum('user','admin') | NOT NULL | 'user' | Papel no sistema |
| `createdAt` | timestamp | NOT NULL | CURRENT_TIMESTAMP | Data de criação |
| `updatedAt` | timestamp | NOT NULL | CURRENT_TIMESTAMP ON UPDATE | Última atualização |
| `lastSignedIn` | timestamp | NOT NULL | CURRENT_TIMESTAMP | Último login |

---

## Tabela: `companies`

Representa as empresas gerenciadas pelo sistema. Cada empresa tem seu próprio conjunto de clientes, transações, orçamentos e eventos.

| Campo | Tipo | Nullable | Default | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `id` | int | NOT NULL | AUTO_INCREMENT | Chave primária |
| `name` | varchar(120) | NOT NULL | — | Nome da empresa |
| `slug` | varchar(60) | NOT NULL | — | Identificador único (UNIQUE) |
| `cnpj` | varchar(20) | NULL | — | CNPJ |
| `address` | text | NULL | — | Endereço completo |
| `phone` | varchar(30) | NULL | — | Telefone |
| `email` | varchar(320) | NULL | — | Email |
| `website` | varchar(255) | NULL | — | Website |
| `pix` | varchar(120) | NULL | — | Chave PIX |
| `logoUrl` | text | NULL | — | URL do logo |
| `primaryColor` | varchar(10) | NULL | '#059669' | Cor primária (hex) |
| `active` | boolean | NOT NULL | true | Se está ativa |
| `createdAt` | timestamp | NOT NULL | CURRENT_TIMESTAMP | Data de criação |

---

## Tabela: `clients`

Leads e clientes do CRM, vinculados a uma empresa.

| Campo | Tipo | Nullable | Default | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `id` | int | NOT NULL | AUTO_INCREMENT | Chave primária |
| `companyId` | int | NOT NULL | — | FK para `companies.id` |
| `name` | varchar(200) | NOT NULL | — | Nome do cliente |
| `phone` | varchar(30) | NULL | — | Telefone |
| `email` | varchar(320) | NULL | — | Email |
| `address` | text | NULL | — | Endereço |
| `city` | varchar(100) | NULL | — | Cidade |
| `status` | enum | NOT NULL | 'lead' | Status: lead, prospect, active, inactive, lost |
| `notes` | text | NULL | — | Observações |
| `source` | varchar(100) | NULL | — | Origem do lead |
| `tags` | json | NULL | '[]' | Tags como array de strings |
| `createdAt` | timestamp | NOT NULL | CURRENT_TIMESTAMP | Data de criação |
| `updatedAt` | timestamp | NOT NULL | CURRENT_TIMESTAMP ON UPDATE | Última atualização |

---

## Tabela: `transactions`

Movimentações financeiras de cada empresa.

| Campo | Tipo | Nullable | Default | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `id` | int | NOT NULL | AUTO_INCREMENT | Chave primária |
| `companyId` | int | NOT NULL | — | FK para `companies.id` |
| `type` | enum | NOT NULL | — | Tipo: income, expense, receivable, payable |
| `category` | varchar(100) | NULL | — | Categoria (ex: "Material", "Serviço") |
| `description` | varchar(500) | NOT NULL | — | Descrição da transação |
| `amount` | decimal(12,2) | NOT NULL | — | Valor em reais |
| `dueDate` | timestamp | NULL | — | Data de vencimento |
| `paidAt` | timestamp | NULL | — | Data de pagamento efetivo |
| `paid` | boolean | NOT NULL | false | Se foi pago |
| `clientId` | int | NULL | — | FK opcional para `clients.id` |
| `notes` | text | NULL | — | Observações |
| `createdAt` | timestamp | NOT NULL | CURRENT_TIMESTAMP | Data de criação |
| `updatedAt` | timestamp | NOT NULL | CURRENT_TIMESTAMP ON UPDATE | Última atualização |

---

## Tabela: `budgets`

Orçamentos emitidos para clientes.

| Campo | Tipo | Nullable | Default | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `id` | int | NOT NULL | AUTO_INCREMENT | Chave primária |
| `companyId` | int | NOT NULL | — | FK para `companies.id` |
| `clientId` | int | NULL | — | FK opcional para `clients.id` |
| `clientName` | varchar(200) | NOT NULL | — | Nome do cliente (snapshot) |
| `clientPhone` | varchar(30) | NULL | — | Telefone do cliente |
| `clientEmail` | varchar(320) | NULL | — | Email do cliente |
| `title` | varchar(300) | NOT NULL | — | Título do orçamento |
| `description` | text | NULL | — | Descrição geral |
| `status` | enum | NOT NULL | 'pending' | Status: draft, pending, approved, rejected, expired |
| `totalAmount` | decimal(12,2) | NOT NULL | — | Valor total |
| `validUntil` | timestamp | NULL | — | Validade do orçamento |
| `notes` | text | NULL | — | Observações |
| `pdfUrl` | text | NULL | — | URL do PDF gerado (S3) |
| `sentAt` | timestamp | NULL | — | Data de envio ao cliente |
| `createdAt` | timestamp | NOT NULL | CURRENT_TIMESTAMP | Data de criação |
| `updatedAt` | timestamp | NOT NULL | CURRENT_TIMESTAMP ON UPDATE | Última atualização |

---

## Tabela: `budget_items`

Itens individuais de cada orçamento.

| Campo | Tipo | Nullable | Default | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `id` | int | NOT NULL | AUTO_INCREMENT | Chave primária |
| `budgetId` | int | NOT NULL | — | FK para `budgets.id` |
| `description` | varchar(500) | NOT NULL | — | Descrição do item |
| `quantity` | decimal(8,2) | NULL | '1' | Quantidade |
| `unitPrice` | decimal(12,2) | NOT NULL | — | Preço unitário |
| `totalPrice` | decimal(12,2) | NOT NULL | — | Preço total (qty * unit) |
| `order` | int | NULL | 0 | Ordem de exibição |

---

## Tabela: `agenda_events`

Eventos da agenda, vinculados a uma empresa e opcionalmente a um cliente.

| Campo | Tipo | Nullable | Default | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `id` | int | NOT NULL | AUTO_INCREMENT | Chave primária |
| `companyId` | int | NOT NULL | — | FK para `companies.id` |
| `clientId` | int | NULL | — | FK opcional para `clients.id` |
| `clientName` | varchar(200) | NULL | — | Nome do cliente (snapshot) |
| `title` | varchar(300) | NOT NULL | — | Título do evento |
| `description` | text | NULL | — | Descrição |
| `address` | text | NULL | — | Endereço do evento |
| `notes` | text | NULL | — | Observações |
| `startAt` | timestamp | NOT NULL | — | Data/hora de início |
| `endAt` | timestamp | NULL | — | Data/hora de término |
| `allDay` | boolean | NULL | false | Se é evento de dia inteiro |
| `status` | enum | NOT NULL | 'scheduled' | Status: scheduled, confirmed, done, cancelled |
| `reminderSent` | boolean | NULL | false | Se o lembrete foi enviado |
| `createdAt` | timestamp | NOT NULL | CURRENT_TIMESTAMP | Data de criação |
| `updatedAt` | timestamp | NOT NULL | CURRENT_TIMESTAMP ON UPDATE | Última atualização |

---

## Tabela: `doc_templates`

Templates de documentos para geração automática.

| Campo | Tipo | Nullable | Default | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `id` | int | NOT NULL | AUTO_INCREMENT | Chave primária |
| `companyId` | int | NULL | — | FK opcional para `companies.id` |
| `name` | varchar(200) | NOT NULL | — | Nome do template |
| `type` | enum | NOT NULL | 'other' | Tipo: proposal, contract, whatsapp, email, other |
| `content` | text | NOT NULL | — | Conteúdo com variáveis `{{var}}` |
| `variables` | json | NULL | '[]' | Lista de variáveis disponíveis |
| `active` | boolean | NOT NULL | true | Se está ativo |
| `createdAt` | timestamp | NOT NULL | CURRENT_TIMESTAMP | Data de criação |
| `updatedAt` | timestamp | NOT NULL | CURRENT_TIMESTAMP ON UPDATE | Última atualização |

---

## Tabela: `ai_profiles`

Perfis de configuração da IA com system prompts customizados.

| Campo | Tipo | Nullable | Default | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `id` | int | NOT NULL | AUTO_INCREMENT | Chave primária |
| `companyId` | int | NULL | — | FK opcional para `companies.id` |
| `name` | varchar(200) | NOT NULL | — | Nome do perfil |
| `type` | enum | NOT NULL | 'full' | Tipo: prospecting_alfa, prospecting_custom, attendant, full, jarvis |
| `systemPrompt` | text | NOT NULL | — | System prompt completo |
| `model` | varchar(100) | NULL | 'gemini-2.5-flash' | Modelo de IA |
| `temperature` | decimal(3,2) | NULL | '0.7' | Temperatura (criatividade) |
| `active` | boolean | NOT NULL | true | Se está ativo |
| `isDefault` | boolean | NULL | false | Se é o perfil padrão |
| `createdAt` | timestamp | NOT NULL | CURRENT_TIMESTAMP | Data de criação |
| `updatedAt` | timestamp | NOT NULL | CURRENT_TIMESTAMP ON UPDATE | Última atualização |

---

## Tabela: `support_logs`

Histórico de conversas com o suporte IA.

| Campo | Tipo | Nullable | Default | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `id` | int | NOT NULL | AUTO_INCREMENT | Chave primária |
| `userId` | int | NULL | — | FK opcional para `users.id` |
| `role` | enum | NOT NULL | — | Papel: user, assistant |
| `content` | text | NOT NULL | — | Conteúdo da mensagem |
| `metadata` | json | NULL | — | Metadados adicionais |
| `createdAt` | timestamp | NOT NULL | CURRENT_TIMESTAMP | Data de criação |

---

## Relações Lógicas

As relações entre tabelas são lógicas (não há foreign keys físicas no banco para flexibilidade):

```
companies (1) ──── (N) clients
companies (1) ──── (N) transactions
companies (1) ──── (N) budgets
companies (1) ──── (N) agenda_events
companies (1) ──── (N) doc_templates
companies (1) ──── (N) ai_profiles
budgets   (1) ──── (N) budget_items
clients   (1) ──── (N) transactions (via clientId)
clients   (1) ──── (N) budgets (via clientId)
clients   (1) ──── (N) agenda_events (via clientId)
users     (1) ──── (N) support_logs (via userId)
```

---

## Migrações

As migrações estão em `drizzle/`:

| Arquivo | Descrição |
| :--- | :--- |
| `0000_youthful_hemingway.sql` | Criação da tabela `users` (gerada pelo scaffold Manus) |
| `0001_nasty_scream.sql` | Criação das tabelas do Klaus OS (parcial — 5 tabelas foram criadas manualmente via SQL) |

**Nota importante:** A migração `0001` não criou todas as tabelas corretamente. As tabelas `companies`, `clients`, `transactions`, `doc_templates` e `support_logs` foram criadas manualmente via `webdev_execute_sql`. Para garantir consistência, ao recriar o banco, execute o SQL de ambas as migrações e depois as 5 tabelas faltantes conforme documentado no `todo.md`.
