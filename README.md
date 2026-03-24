# Klaus OS — Plataforma de Gestão Empresarial com IA

**Klaus OS** é uma plataforma completa de gestão empresarial integrada com inteligência artificial avançada. O sistema combina CRM, controle financeiro, orçamentos, agenda, geração de documentos, suporte técnico por IA e um assistente de voz bidirecional (Jarvis) alimentado pelo Google Gemini Live Audio.

O projeto roda sobre a infraestrutura **Manus** (OAuth, banco de dados MySQL/TiDB, deploy automático) e utiliza uma stack moderna com React 19, Tailwind CSS 4, Express 4, tRPC 11 e Drizzle ORM.

---

## Stack Tecnológica

| Camada | Tecnologia | Versão |
| :--- | :--- | :--- |
| Frontend | React + TypeScript | 19.2 / 5.9 |
| Estilização | Tailwind CSS + shadcn/ui | 4.1 |
| Roteamento (client) | Wouter | 3.3 |
| Estado (server) | TanStack React Query | 5.90 |
| RPC | tRPC | 11.6 |
| Backend | Express | 4.21 |
| ORM | Drizzle ORM | 0.44 |
| Banco de Dados | MySQL (TiDB via Manus) | — |
| Autenticação | Manus OAuth + JWT | — |
| IA (LLM) | Manus Forge API (OpenAI-compatible) | — |
| IA (Voz) | Google Gemini Live Audio | 2.5-flash |
| Build | Vite + esbuild | 7.1 |
| Testes | Vitest | 2.1 |

---

## Estrutura do Projeto

```
klaus-os/
├── client/                    # Frontend React
│   ├── index.html             # HTML entry point
│   ├── public/                # Arquivos estáticos (favicon, robots.txt)
│   └── src/
│       ├── App.tsx            # Rotas e layout principal
│       ├── main.tsx           # Providers (tRPC, React Query, Theme)
│       ├── index.css          # Tema dark premium (OKLCH) + utilitários
│       ├── const.ts           # Constantes frontend (login URL)
│       ├── lib/
│       │   ├── trpc.ts        # Cliente tRPC tipado
│       │   └── utils.ts       # Utilitário cn() para classes
│       ├── pages/             # Páginas dos módulos
│       │   ├── Dashboard.tsx  # Dashboard executivo + terminal IA
│       │   ├── CRM.tsx        # Gestão de leads/clientes
│       │   ├── Finance.tsx    # Controle financeiro
│       │   ├── Budgets.tsx    # Orçamentos
│       │   ├── Agenda.tsx     # Agenda de eventos
│       │   ├── DocStudio.tsx  # Gerador de documentos
│       │   ├── AIConfig.tsx   # Configuração de perfis IA
│       │   ├── Support.tsx    # Chat de suporte IA
│       │   ├── Jarvis.tsx     # Assistente voz Gemini Live
│       │   ├── Home.tsx       # Redirect para Dashboard
│       │   └── NotFound.tsx   # 404
│       ├── components/
│       │   ├── DashboardLayout.tsx  # Layout sidebar com 9 módulos
│       │   ├── AIChatBox.tsx        # Componente de chat reutilizável
│       │   ├── Map.tsx              # Google Maps (proxy Manus)
│       │   └── ui/                  # shadcn/ui components (60+)
│       ├── contexts/
│       │   └── ThemeContext.tsx      # Provider de tema dark/light
│       └── hooks/
│           ├── useAuth.ts           # Hook de autenticação
│           ├── useMobile.tsx        # Detecção de mobile
│           └── usePersistFn.ts      # Ref estável para callbacks
├── server/                    # Backend Express + tRPC
│   ├── routers.ts             # TODOS os routers tRPC (430+ linhas)
│   ├── db.ts                  # Helpers de banco de dados (30+ funções)
│   ├── storage.ts             # Helpers S3 (storagePut, storageGet)
│   ├── routers.test.ts        # Testes vitest dos routers
│   ├── auth.logout.test.ts    # Teste de logout
│   └── _core/                 # Framework Manus (NÃO EDITAR)
│       ├── index.ts           # Entry point do servidor
│       ├── env.ts             # Variáveis de ambiente tipadas
│       ├── trpc.ts            # Setup tRPC (public/protected procedures)
│       ├── context.ts         # Contexto de request (user, req, res)
│       ├── oauth.ts           # Fluxo OAuth Manus
│       ├── cookies.ts         # Gestão de cookies JWT
│       ├── llm.ts             # Helper invokeLLM (OpenAI-compatible)
│       ├── notification.ts    # notifyOwner()
│       ├── imageGeneration.ts # generateImage()
│       ├── voiceTranscription.ts # transcribeAudio() (Whisper)
│       ├── map.ts             # Google Maps proxy
│       ├── sdk.ts             # SDK interno Manus
│       └── dataApi.ts         # Data API helper
├── drizzle/                   # Schema e migrações
│   ├── schema.ts              # Definição de TODAS as tabelas
│   ├── relations.ts           # Relações entre tabelas
│   ├── 0000_youthful_hemingway.sql  # Migração inicial (users)
│   ├── 0001_nasty_scream.sql        # Migração das tabelas do Klaus OS
│   └── meta/                  # Metadados do drizzle-kit
├── shared/                    # Tipos e constantes compartilhados
│   ├── const.ts               # COOKIE_NAME, timeouts, mensagens de erro
│   └── types.ts               # Re-exporta tipos do schema
├── docs/                      # Documentação técnica
│   ├── ARCHITECTURE.md        # Arquitetura e fluxo de dados
│   ├── API_REFERENCE.md       # Referência completa de endpoints tRPC
│   ├── DATABASE.md            # Schema, tabelas, campos e relações
│   ├── MODULES.md             # Descrição de cada módulo frontend
│   ├── SETUP.md               # Como rodar, configurar e fazer deploy
│   └── ENV_VARIABLES.md       # Todas as variáveis de ambiente
├── package.json               # Dependências e scripts
├── tsconfig.json              # Configuração TypeScript
├── vite.config.ts             # Configuração Vite (build frontend)
├── vitest.config.ts           # Configuração Vitest (testes)
├── drizzle.config.ts          # Configuração Drizzle Kit
├── components.json            # Configuração shadcn/ui
└── todo.md                    # Tracking de features e bugs
```

---

## Scripts Disponíveis

| Comando | Descrição |
| :--- | :--- |
| `pnpm dev` | Inicia o servidor de desenvolvimento (hot reload) |
| `pnpm build` | Build de produção (Vite + esbuild) |
| `pnpm start` | Roda o build de produção |
| `pnpm check` | Verifica erros TypeScript sem compilar |
| `pnpm test` | Roda todos os testes Vitest |
| `pnpm format` | Formata o código com Prettier |
| `pnpm db:push` | Gera e aplica migrações do Drizzle |

---

## Módulos do Sistema

O Klaus OS possui **9 módulos funcionais** acessíveis via sidebar:

1. **Dashboard** — Métricas executivas (saldo, leads, orçamentos) + terminal de comandos IA
2. **CRM** — Gestão de leads/clientes com filtros por empresa e status
3. **Financeiro** — Transações (entrada/saída/a receber/a pagar) com saldo calculado
4. **Orçamentos** — Criação manual e com IA, itens com cálculo automático
5. **Agenda** — Eventos com cliente, endereço, notas, agrupados por data
6. **Doc Studio** — Templates com variáveis dinâmicas `{{variavel}}` + gerador IA
7. **Config IA** — Perfis de IA (prospecção, atendente, full, Jarvis) por empresa
8. **Suporte IA** — Chat contextualizado sobre o sistema
9. **Jarvis** — Assistente de voz bidirecional com Gemini Live Audio + visão por screen share

---

## Autenticação

O sistema utiliza **Manus OAuth** com sessão por cookie JWT. Após login, o usuário recebe um cookie `app_session_id` assinado com `JWT_SECRET`. Todas as rotas tRPC (exceto `auth.me` e `auth.logout`) são protegidas via `protectedProcedure` que injeta `ctx.user` automaticamente.

O primeiro usuário que faz login é automaticamente promovido a `admin`. Usuários subsequentes recebem role `user`.

---

## Documentação Detalhada

Para informações completas sobre cada aspecto do sistema, consulte os documentos na pasta `docs/`:

| Documento | Conteúdo |
| :--- | :--- |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arquitetura, stack, fluxo de dados, decisões técnicas |
| [API_REFERENCE.md](docs/API_REFERENCE.md) | Referência completa de todos os endpoints tRPC |
| [DATABASE.md](docs/DATABASE.md) | Schema completo, tabelas, campos, tipos e relações |
| [MODULES.md](docs/MODULES.md) | Descrição detalhada de cada módulo frontend |
| [SETUP.md](docs/SETUP.md) | Como rodar, configurar e fazer deploy |
| [ENV_VARIABLES.md](docs/ENV_VARIABLES.md) | Todas as variáveis de ambiente necessárias |

---

## Status Atual

| Componente | Status |
| :--- | :--- |
| TypeScript | 0 erros |
| Testes | 9/9 passando |
| Banco de dados | 10 tabelas ativas |
| Deploy | Ativo em `klausos-bgsahmqv.manus.space` |

---

## Licença

Projeto privado. Todos os direitos reservados.
