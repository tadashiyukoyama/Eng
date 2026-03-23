# Klaus OS Local 3.0 — Documentação Atualizada

## Visão geral
Klaus OS Local 3.0 é um sistema local com painel React/Vite e backend Node/Express para operação comercial, CRM, agenda, orçamento, suporte e automação via WhatsApp.

O app combina:
- painel local e remoto
- runtime MCP embutido
- túnel ngrok embutido
- Core IA via OpenAI Responses
- Jarvis/Voice via Gemini no browser
- WhatsApp com dois providers: QR/Web e Meta Cloud API
- persistência local em JSON

## Endereços base
### Local
- Painel: `http://localhost:5173`
- API: `http://localhost:3001`
- MCP: `http://localhost:3001/mcp`

### Remoto
Quando o túnel está ativo:
- Painel remoto: domínio ngrok configurado
- MCP remoto: `/mcp`
- Webhook Meta: `/api/whatsapp/meta/webhook`

## Stack
### Frontend
- React
- Vite
- Tailwind/estilo utilitário
- módulos renderizados por `App.tsx`

### Backend
- Node
- Express
- OpenAI SDK
- whatsapp-web.js
- PDFKit
- Multer
- ngrok

### IA
- Core principal: OpenAI Responses
- suporte: OpenAI Responses
- voz/Jarvis: Gemini Live no browser
- transcrição de áudio WhatsApp: Whisper

## Estrutura principal do projeto
- `App.tsx`
- `server.ts`
- `mcpRuntime.js`
- `ngrokRuntime.js`
- `context/AppContext.tsx`
- `services/`
- `modules/`
- `bd/db.json`
- `bd/conversations/`
- `bd/support_conversations/`
- `bd/templates/`
- `logs/`

## Módulos visíveis do painel
Rótulos visíveis na sidebar:
- Dashboard
- Cérebro IA
- Suporte IA
- CRM Leads
- Orçamentos
- Financeiro
- Doc Studio
- Klaus Pocket
- Jarvis
- Runtime

Mapeamento técnico:
- Dashboard → `modules/Dashboard`
- Cérebro IA → `modules/IAConfig`
- Suporte IA → `modules/SupportAI`
- CRM Leads → `modules/Clients`
- Orçamentos → `modules/Budgets`
- Financeiro → `modules/Finance`
- Doc Studio → `modules/Models`
- Klaus Pocket → `modules/WhatsApp`
- Jarvis → `modules/Voice`
- Runtime → `modules/Runtime`

## Serviços do frontend
### `services/runtimeBase.ts`
Resolve a base da API:
- usa `VITE_API_BASE_URL` se existir
- em localhost aponta para `http://localhost:3001`
- fora de localhost reaproveita a mesma origin

### `services/apiService.ts`
Responsável por:
- testar saúde do backend
- buscar snapshot completo do sistema
- sincronizar dados do frontend com o backend

Rotas usadas:
- `GET /health`
- `GET /api/system/data`
- `POST /api/system/sync`

### `services/coreService.ts`
Canal simples para chamar o Core pelo painel:
- `POST /api/ai/dispatch`
- contexto: `channel=panel`, `from=panel:master`

### `services/geminiService.ts`
Mantém o nome histórico, mas já opera o Core do Klaus pelo backend:
- chama `POST /api/ai/dispatch`
- suporte a instrução de sistema
- reset de memória com `POST /api/system/clear-sessions`

## Banco local
Arquivo principal:
- `bd/db.json`

Coleções principais:
- `clients`
- `transactions`
- `budgets`
- `agenda`
- `templates`
- `companies`
- `config`
- `activeProfile`

## Perfis de IA
- `PROSPECTING_ALFA`
- `PROSPECTING_CUSTOM`
- `ATTENDANT`
- `FULL` (interno)

Prompts persistidos no banco:
- `klausPrompt`
- `prospectingAlfaPrompt`
- `prospectingCustomPrompt`
- `attendantPrompt`

## WhatsApp
## Providers suportados
### QR/Web
- usa `whatsapp-web.js`
- QR code no painel
- sessão local em `.wwebjs_auth`
- texto, áudio e imagem

### Meta Cloud API
- webhook HTTP
- envio via Graph API
- respostas interativas
- áudio com transcrição
- imagem com entrada multimodal

## Regras operacionais do WhatsApp
### Master
Master é reconhecido por `CESAR_NUMBER`.

Pode:
- aprovar orçamento
- recusar orçamento
- trocar perfil com `klaus, mude para ...`
- usar ações internas dos botões operacionais

### Cliente
Cliente:
- não recebe privilégios de Master
- não deve acessar banco, painel ou comandos de dev
- não recebe `add_budget`
- deve ser conduzido para visita/orçamento sem compromisso

## Fluxo atual de visita/orçamento
### Regra atual
Quando cliente pede orçamento:
- não gera orçamento
- não usa `add_budget`
- coleta:
  - nome
  - serviço
  - data
  - hora
  - endereço
- só então usa `add_event`

### Efeito operacional
Ao marcar visita:
- cria evento real na agenda
- salva telefone do contato
- salva nome do cliente
- salva endereço
- salva observações
- cria ou atualiza o cliente no CRM
- envia aviso ao número dev com botões Meta

### Estado do cliente criado/atualizado
- telefone normalizado
- empresa inferida pelo perfil/empresa ativa
- status: `Interessado`
- observações com data/hora/endereço

## Fluxo de orçamento aprovado
### Regras duras
- orçamento nasce `Pendente`
- nunca vai ao cliente sem aprovação do Master
- aprovação por WhatsApp com `APROVAR <id>`
- recusa por WhatsApp com `RECUSAR <id>`

### Ações de orçamento
- criação via tool `add_budget` (restrita ao Master no fluxo atual)
- PDF gerado no backend
- envio ao cliente só após aprovação

## Botões operacionais do aviso Meta
O aviso enviado ao número dev usa botões com ações reais tratadas no backend:
- `FALAR_CLIENTE_<telefone>`
- `VER_CONVERSA_<telefone>`
- `VER_ENDERECO_<telefone>`

### Comportamento atual
- Falar cliente → responde com telefone pronto para contato
- Ver conversa → traz últimas mensagens salvas do contato
- Ver endereço → traz endereço e data/hora da visita mais recente

## Jarvis
Módulo visual: `Jarvis`
Arquivo: `modules/Voice/VoiceModule.tsx`

Funções principais:
- captura microfone
- conecta em Gemini Live
- transcrição de entrada e saída
- compartilhamento de tela
- envio de frames de tela para Gemini
- logs frontend enviados para `POST /api/support/frontend-log`

Dados de contexto usados no prompt do Jarvis:
- clientes
- transações
- agenda
- `config.klausPrompt`

## Runtime
Módulo visual: `Runtime`
Arquivo: `modules/Runtime/RuntimeModule.tsx`

Funções:
- configurar MCP
- configurar auth/token MCP
- permitir ou bloquear comandos shell
- ligar/desligar read-only
- configurar ngrok
- configurar proxy do painel
- iniciar/parar túnel
- exibir URLs locais e remotas

## Klaus Pocket
Módulo visual: `Klaus Pocket`
Arquivo: `modules/WhatsApp/WhatsAppModule.tsx`

Funções:
- visualizar QR (provider web)
- alternar provider `web` / `meta`
- editar configuração Meta
- exibir webhook montado
- controlar start/stop/restart do WhatsApp
- enviar mensagem direta de teste
- ver logs de telemetria do WhatsApp

## Orçamentos
Módulo visual: `Orçamentos`
Arquivo: `modules/Budgets/BudgetsModule.tsx`

Funções:
- filtrar por status
- aprovar ou recusar pelo painel
- baixar PDF
- exportar backup JSON
- transformar aprovado em transação a receber

## Doc Studio
Módulo visual: `Doc Studio`
Função documental atual:
- catálogo de documentos/modelos
- base para templates enviados via WhatsApp
- parte do ecossistema de geração e entrega de documentos

## Rotas HTTP confirmadas
### Saúde e sistema
- `GET /health`
- `GET /status`
- `GET /api/system/data`
- `POST /api/system/sync`
- `POST /api/system/clear-sessions`
- `GET /api/system/env`
- `POST /api/system/update-env`
- `GET /api/system/runtime-config`
- `POST /api/system/runtime-config`

### WhatsApp
- `POST /api/whatsapp/send`
- `GET /api/whatsapp/meta/config`
- `POST /api/whatsapp/meta/config`
- `GET /api/whatsapp/meta/webhook`
- `POST /api/whatsapp/meta/webhook`
- `POST /api/system/start-whatsapp`
- `POST /api/system/stop-whatsapp`
- `POST /api/system/restart-whatsapp`

### Túnel
- `GET /api/system/tunnel-status`
- `POST /api/system/start-tunnel`
- `POST /api/system/stop-tunnel`

### IA e suporte
- `POST /api/ai/dispatch`
- `POST /api/support/chat`
- `POST /api/support/frontend-log`
- `GET /api/support/scan`
- `POST /api/support/clear-session`

### Templates e orçamento
- `GET /api/templates/list`
- `POST /api/templates/upload`
- `GET /api/templates/:id/download`
- `GET /api/budgets/:id/pdf`
- `POST /api/budgets/decision`

## Runtime MCP
Endpoint:
- `/mcp`

Ferramentas expostas incluem:
- `health.get`
- `registry.get`
- `state.get`
- `state.reload`
- `runtime.reload`
- `fs.list`
- `fs.read`
- `fs.write`
- `fs.patch`
- `fs.mkdir`
- `fs.delete`
- `log.read`
- `trace.list`
- `db.read`
- `db.write`
- `config.get`
- `config.patch`
- `cmd.run`
- `simulator.run`
- `prompts.list`
- `prompt.get`
- `support.state`
- `support.audit`
- `support.scan`
- `whatsapp.control`

## Logs
Arquivos principais:
- `logs/klaus.log`
- `logs/support.log`
- `logs/mcp-runtime.log`
- `logs/ngrok.log`

## Documentação complementar
- `APP_BLUEPRINT_2026-03-16.md`
- `CURRENT_ARCHITECTURE_AND_MODULES_2026-03-16.md`
- `WHATSAPP_META_SETUP.md`
- `MCP_RUNTIME_SETUP.md`
- `KLAUS_3.0_RELEASE.md`

## Estado atual resumido
O estado atual do app já suporta:
- painel modular funcional
- Core IA funcional
- CRM básico
- agenda operacional
- visita/orçamento sem compromisso com endereço obrigatório
- criação/atualização automática do cliente ao agendar visita
- orçamento pendente com aprovação do Master
- PDF de orçamento
- WhatsApp Web e Meta no mesmo backend
- Jarvis com voz e visão
- Runtime MCP com túnel embutido

## Próxima etapa recomendada
- lembrete automático de 1 dia antes
- ações mais profundas para os botões do aviso Meta
- evolução visual premium do setor de orçamento e documentos
