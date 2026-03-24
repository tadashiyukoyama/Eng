# Arquitetura do Klaus OS

Este documento descreve a arquitetura completa do sistema, o fluxo de dados entre camadas, as decisões técnicas tomadas e como cada componente se conecta.

---

## Visão Geral

O Klaus OS segue uma arquitetura **monolítica full-stack** com separação clara entre frontend e backend, comunicando-se exclusivamente via **tRPC** (Remote Procedure Call tipado). O servidor Express serve tanto a API quanto os arquivos estáticos do frontend em produção.

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  React 19 + Tailwind 4 + shadcn/ui                   │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │   │
│  │  │Dashboard│ │  CRM   │ │Finance │ │Budgets │  ...   │   │
│  │  └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘        │   │
│  │      │          │          │          │               │   │
│  │      └──────────┴──────────┴──────────┘               │   │
│  │                     │                                  │   │
│  │              trpc.*.useQuery()                         │   │
│  │              trpc.*.useMutation()                      │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                          │ HTTP (JSON-RPC over fetch)        │
│  ┌──────────────────────┴───────────────────────────────┐   │
│  │  Jarvis (Gemini Live)                                 │   │
│  │  WebSocket direto → ai.live.connect()                 │   │
│  │  Audio PCM 16kHz ↔ Base64 chunks                      │   │
│  │  Screen capture → JPEG frames a cada 2s               │   │
│  └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           │
                    /api/trpc/*
                           │
┌──────────────────────────┴──────────────────────────────────┐
│                     EXPRESS SERVER                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  tRPC Router (server/routers.ts)                      │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐          │   │
│  │  │ companies  │ │  clients  │ │transactions│  ...    │   │
│  │  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘          │   │
│  │        └──────────────┴─────────────┘                 │   │
│  │                       │                                │   │
│  │              server/db.ts (Drizzle ORM)                │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                          │                                    │
│  ┌──────────────────────┴───────────────────────────────┐   │
│  │  _core/ (Framework Manus — NÃO EDITAR)                │   │
│  │  • OAuth flow    • JWT session    • LLM helper        │   │
│  │  • S3 storage    • Notifications  • Image gen         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           │
                    DATABASE_URL
                           │
┌──────────────────────────┴──────────────────────────────────┐
│                    MySQL / TiDB                               │
│  10 tabelas: users, companies, clients, transactions,        │
│  budgets, budget_items, agenda_events, doc_templates,        │
│  ai_profiles, support_logs                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Fluxo de Dados

### Autenticação

O fluxo de autenticação segue o padrão OAuth 2.0 com o servidor Manus:

1. O frontend redireciona para `VITE_OAUTH_PORTAL_URL` com `state` contendo a `origin` e o `returnPath`.
2. O usuário faz login no portal Manus (Google, email, etc.).
3. O portal redireciona de volta para `/api/oauth/callback` com um `code`.
4. O backend troca o `code` por um token no `OAUTH_SERVER_URL`.
5. O backend cria/atualiza o usuário no banco via `upsertUser()`.
6. Um cookie JWT (`app_session_id`) é emitido com validade de 1 ano.
7. Cada request subsequente passa pelo middleware que decodifica o JWT e injeta `ctx.user`.

### Request tRPC

1. O frontend chama `trpc.feature.useQuery(params)` ou `trpc.feature.useMutation()`.
2. O TanStack React Query serializa via SuperJSON e envia para `/api/trpc/feature.method`.
3. O Express recebe e roteia para o handler tRPC correspondente.
4. O `protectedProcedure` verifica se `ctx.user` existe (senão retorna 401).
5. O handler chama funções do `server/db.ts` que executam queries Drizzle.
6. O resultado é serializado via SuperJSON e retornado ao frontend.

### Jarvis (Gemini Live Audio)

O módulo Jarvis opera **inteiramente no frontend**, sem passar pelo backend:

1. O SDK `@google/genai` é importado dinamicamente via `esm.sh`.
2. Uma sessão WebSocket é aberta com `ai.live.connect()` usando o modelo `gemini-2.5-flash-preview-native-audio-dialog`.
3. O microfone é capturado via `navigator.mediaDevices.getUserMedia()`.
4. Um `AudioWorkletNode` processa o áudio em chunks PCM 16kHz e envia via `session.sendRealtimeInput()`.
5. A tela é capturada via `navigator.mediaDevices.getDisplayMedia()` a 5fps, convertida em JPEG e enviada como frames a cada 2 segundos.
6. As respostas de áudio da IA chegam como chunks base64 e são decodificados e reproduzidos via `AudioContext`.

---

## Decisões Técnicas

### Por que tRPC em vez de REST?

O tRPC elimina a necessidade de definir contratos de API manualmente. Os tipos fluem do backend para o frontend automaticamente, garantindo type-safety end-to-end. Isso reduz bugs e acelera o desenvolvimento.

### Por que Drizzle ORM em vez de Prisma?

O Drizzle é mais leve, tem melhor performance em cold starts e permite queries SQL raw quando necessário. O schema é definido em TypeScript puro, sem necessidade de um arquivo `.prisma` separado.

### Por que o Jarvis roda no frontend?

O Gemini Live Audio exige uma conexão WebSocket persistente com streaming bidirecional de áudio. Rotear isso pelo backend adicionaria latência inaceitável para uma experiência de voz em tempo real. A chave API é armazenada no `localStorage` do usuário.

### Por que tema dark por padrão?

O Klaus OS é uma ferramenta de trabalho para uso prolongado. O tema dark reduz fadiga visual e é preferido por profissionais que passam horas no sistema.

---

## Camadas de Segurança

| Camada | Mecanismo |
| :--- | :--- |
| Autenticação | OAuth 2.0 via Manus + cookie JWT HttpOnly |
| Autorização | `protectedProcedure` verifica `ctx.user` em toda rota |
| Admin | `ctx.user.role === 'admin'` para operações privilegiadas |
| CSRF | Cookie SameSite=None + Secure + HttpOnly |
| Input | Validação Zod em todos os inputs tRPC |
| XSS | React escapa HTML por padrão |

---

## Pontos de Extensão

Para adicionar um novo módulo ao Klaus OS, siga estes passos:

1. Adicione a tabela em `drizzle/schema.ts` e gere a migração com `pnpm db:push`.
2. Adicione os helpers de query em `server/db.ts`.
3. Crie o router tRPC em `server/routers.ts` e registre no `appRouter`.
4. Crie a página em `client/src/pages/NomeModulo.tsx`.
5. Adicione a rota em `client/src/App.tsx`.
6. Adicione o item no menu em `client/src/components/DashboardLayout.tsx`.
7. Escreva testes em `server/routers.test.ts`.
