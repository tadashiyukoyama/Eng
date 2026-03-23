# Klaus OS — Blueprint Completo do Estado Atual (2026-03-16)

## Objetivo
Este blueprint congela o estado atual real do Klaus OS Local 3.0 e serve como referência de continuidade para:
- arquitetura
- módulos
- regras de negócio
- rotas
- runtime MCP
- WhatsApp Web e Meta
- Jarvis/Voice
- CRM
- agenda
- orçamentos
- documentos
- documentação operacional

---

## 1. Estado atual do app
Klaus OS Local 3.0 é um sistema local com frontend React/Vite e backend Node/Express, focado em atendimento, CRM, agendamento, orçamento, suporte e operação via WhatsApp.

### Endereços
#### Local
- Painel: `http://localhost:5173`
- API: `http://localhost:3001`
- MCP: `http://localhost:3001/mcp`

#### Remoto
Quando o túnel está ativo:
- Painel remoto: domínio ngrok configurado no runtime
- MCP remoto: `<dominio>/mcp`
- Webhook Meta: `<dominio>/api/whatsapp/meta/webhook`

### Stack
- Frontend: React + Vite
- Backend: Node + Express
- Core IA: OpenAI Responses
- Suporte IA: OpenAI Responses
- Voz/Jarvis: Gemini Live no browser
- WhatsApp Web: whatsapp-web.js
- WhatsApp Meta: Graph API / Webhook HTTP
- Túnel: ngrok embutido
- Persistência: JSON local em `bd/`

---

## 2. Estrutura principal do projeto
### Entradas e base
- `App.tsx`
- `index.tsx`
- `index.html`
- `types.ts`
- `vite.config.ts`
- `tsconfig.json`

### Backend
- `server.ts`
- `mcpRuntime.js`
- `ngrokRuntime.js`

### Contexto e componentes globais
- `context/AppContext.tsx`
- `components/Sidebar.tsx`

### Serviços do frontend
- `services/runtimeBase.ts`
- `services/apiService.ts`
- `services/coreService.ts`
- `services/geminiService.ts`

### Módulos do painel
- `modules/Dashboard/DashboardModule.tsx`
- `modules/IAConfig/IAConfigModule.tsx`
- `modules/Clients/ClientsModule.tsx`
- `modules/Budgets/BudgetsModule.tsx`
- `modules/Finance/FinanceModule.tsx`
- `modules/Models/ModelsModule.tsx`
- `modules/WhatsApp/WhatsAppModule.tsx`
- `modules/Voice/VoiceModule.tsx`
- `modules/SupportAI/SupportAIModule.tsx`
- `modules/Runtime/RuntimeModule.tsx`

### Persistência e runtime
- `bd/db.json`
- `bd/conversations/`
- `bd/support_conversations/`
- `bd/templates/`
- `logs/klaus.log`
- `logs/support.log`
- `logs/mcp-runtime.log`
- `logs/ngrok.log`

---

## 3. Navegação visual do painel
Labels reais da sidebar:
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

Mapeamento:
- Dashboard → visão geral do sistema
- Cérebro IA → prompts, perfis, DNA operacional
- Suporte IA → diagnóstico e mutação assistida do projeto
- CRM Leads → clientes e leads
- Orçamentos → pipeline comercial, PDFs e decisão
- Financeiro → lançamentos e saldo
- Doc Studio → documentos/modelos
- Klaus Pocket → WhatsApp Web/Meta
- Jarvis → voz e visão
- Runtime → MCP, auth, túnel, proxy, URLs

---

## 4. Arquitetura lógica
### Camada 1 — Canais de entrada
- WhatsApp Web
- WhatsApp Meta
- Painel local/remoto
- Jarvis/Voice
- Suporte IA

### Camada 2 — Orquestração
- `server.ts`
- OpenAI Responses API
- memória persistente por sessão
- regras duras no backend
- tools de negócio executadas no backend

### Camada 3 — Ferramentas de negócio
- clientes
- orçamento
- financeiro
- agenda
- templates
- envio WhatsApp

### Camada 4 — Persistência
- banco local JSON
- conversas persistidas
- templates PDF
- logs

### Camada 5 — Runtime e exposição
- MCP embutido no backend
- ngrok embutido
- proxy do painel

---

## 5. Serviços frontend
### `runtimeBase.ts`
Resolve a base URL do backend.

Regras:
- usa `VITE_API_BASE_URL` se existir
- em localhost aponta para `http://localhost:3001`
- em domínio remoto usa a própria `origin`

### `apiService.ts`
Funções:
- `isServerOnline()`
- `fetchAllData()`
- `syncData(payload)`

Rotas usadas:
- `GET /health`
- `GET /api/system/data`
- `POST /api/system/sync`

### `coreService.ts`
Canal direto do painel para o Core:
- `askCore(text)`
- envia para `POST /api/ai/dispatch`
- contexto fixo: `channel=panel`, `from=panel:master`

### `geminiService.ts`
Apesar do nome histórico, é a interface atual do painel com o Core local.

Funções:
- `askKlaus(moduleName, prompt, systemInstruction)`
- `resetKlausMemory()`

Usa:
- `POST /api/ai/dispatch`
- `POST /api/system/clear-sessions`

---

## 6. Tipos e entidades principais
### `Client`
Campos principais:
- `id`
- `nome`
- `telefone`
- `empresa`
- `status`
- `observacoes`

Status possíveis:
- `Ativo`
- `Inativo`
- `Lead`
- `Interessado`
- `Desqualificado`

### `Budget`
- `id`
- `cliente`
- `contato`
- `servico`
- `valor`
- `data`
- `status`
- `company`

Status:
- `Pendente`
- `Aprovado`
- `Recusado`

### `Transaction`
- `id`
- `tipo`
- `categoria`
- `empresa`
- `valor`
- `descricao`
- `data`
- `status`
- `clienteId?`

### `AgendaEvent`
- `id`
- `title`
- `date`
- `time`
- `company`
- `reminderSent`

Na implementação atual do backend, eventos de visita também podem carregar:
- `clientName`
- `address`
- `notes`
- `contactPhone`

---

## 7. Banco local
Arquivo principal:
- `bd/db.json`

Estruturas persistidas:
- `config`
- `activeProfile`
- `companies`
- `clients`
- `transactions`
- `budgets`
- `agenda`
- `templates`

### Configuração importante persistida
- modelo do Core
- prompts operacionais
- detalhes das empresas
- templates documentais
- configuração WhatsApp Meta

### Conversas
- `bd/conversations/` → sessões do Core comercial
- `bd/support_conversations/` → sessões do Suporte IA

---

## 8. Perfis e prompts
Perfis conhecidos:
- `PROSPECTING_ALFA`
- `PROSPECTING_CUSTOM`
- `ATTENDANT`
- `FULL`

Prompts persistidos no banco:
- `klausPrompt`
- `prospectingAlfaPrompt`
- `prospectingCustomPrompt`
- `attendantPrompt`

### Regras de construção da instrução
#### Master
- perfil executivo/operacional
- pode usar ferramentas
- orçamento só vai ao cliente após aprovação

#### Cliente
- não pode mencionar painel/dev/sistema
- não usa `add_budget`
- deve ser conduzido para visita/orçamento sem compromisso
- agora precisa coletar também o endereço antes de concluir a visita

---

## 9. WhatsApp — visão geral
O Klaus opera com dois providers:
- `web`
- `meta`

### Provider Web
Baseado em:
- `whatsapp-web.js`
- QR code
- sessão local

Suporta:
- texto
- áudio
- imagem
- documentos
- fila por chat

### Provider Meta
Baseado em:
- webhook HTTP
- Graph API
- `phone_number_id`
- `access_token`
- `verify_token`

Suporta hoje:
- texto
- áudio com transcrição
- imagem multimodal
- respostas interativas
- envio de botões/lista
- envio de documento por link público quando aplicável

### Configuração Meta persistida
`config.whatsappMeta` contém:
- `provider`
- `enabled`
- `apiVersion`
- `appId`
- `businessAccountId`
- `phoneNumberId`
- `verifyToken`
- `accessToken`
- `webhookPath`

---

## 10. Fluxo unificado do WhatsApp
### Entrada de texto
1. identifica remetente
2. decide Master vs cliente
3. processa comandos duros do Master
4. se não for hard rule, envia ao Core
5. devolve resposta pelo provider ativo

### Entrada de áudio
1. baixa mídia
2. transcreve com Whisper
3. cai no mesmo fluxo textual

### Entrada de imagem
1. baixa ou recebe imagem
2. envia para o Core com multimodal
3. aplica o mesmo modelo de sessão

### Saída
Helper único:
- Web → `wwClient.sendMessage`
- Meta → Graph API

---

## 11. Regras de Master
Master é reconhecido por `CESAR_NUMBER`.

Comandos duros já implementados:
- `APROVAR <id>`
- `RECUSAR <id>`
- `klaus, mude para ...`

### Ações reais dos botões operacionais do Meta
Tratadas antes do agente:
- `FALAR_CLIENTE_<telefone>`
- `VER_ENDERECO_<telefone>`
- `VER_CONVERSA_<telefone>`

Comportamento:
- Falar cliente → retorna telefone pronto para contato
- Ver endereço → retorna endereço + data/hora da visita mais recente
- Ver conversa → retorna últimas mensagens persistidas daquele contato

---

## 12. Regras de cliente
### O que o cliente não pode fazer
- virar Master por fala natural
- listar base de dados
- acessar o banco
- usar `add_budget`
- executar hard rules do Master

### O que o cliente pode fazer
- conversar normalmente
- pedir atendimento
- pedir visita/orçamento sem compromisso
- informar dados operacionais
- ter visita marcada
- ser criado/atualizado no CRM

---

## 13. Fluxo atual de visita/orçamento sem compromisso
### Regra operacional vigente
Cliente que pede orçamento:
- não gera orçamento
- não usa `add_budget`
- coleta:
  - nome
  - serviço
  - data
  - hora
  - endereço
- só então usa `add_event`

### Efeito do `add_event` atual
Quando o agendamento vem de cliente WhatsApp:
- cria evento real na agenda
- salva `clientName`
- salva `address`
- salva `notes`
- salva `contactPhone`
- faz upsert do cliente no CRM
- status do cliente fica `Interessado`
- observações recebem data/hora/endereço
- envia aviso Meta ao número dev

### Aviso Meta ao número dev
Conteúdo essencial:
- nome
- telefone
- canal
- ação
- data
- hora
- endereço

Formato:
- mensagem interativa com botões

Botões atuais:
- Falar cliente
- Ver conversa
- Ver endereço

### Trava estrutural atual
Se o modelo tentar agendar sem endereço, o `add_event` devolve erro:
- `Endereço obrigatório para agendar visita.`

---

## 14. CRM atual
### Onde vive
- módulo visual: `CRM Leads`
- coleção persistida: `clients`

### Criação/atualização automática
Na visita agendada via cliente WhatsApp:
- o telefone é normalizado
- se cliente já existir, ele é atualizado
- se não existir, ele é criado

### Estado atual usado
- `Interessado`

### Observações automáticas
Incluem:
- data da visita
- hora da visita
- endereço
- observações complementares

---

## 15. Agenda atual
Tools implementadas:
- `add_event`
- `list_events`
- `update_event`
- `remove_event`
- `get_schedule_summary`

### Capacidade atual
- criar agendamento
- listar por data/período/empresa
- atualizar
- remover
- resumir agenda

### Estado atual do lembrete
Existe o campo:
- `reminderSent`

Mas o lembrete automático de 1 dia antes ainda não foi implementado no backend.

---

## 16. Sistema de orçamentos
### Ferramenta
- `add_budget`

### Regra principal
- nasce `Pendente`
- nunca vai ao cliente sem aprovação do Master

### Aprovação
Via WhatsApp:
- `APROVAR <id>`
- `RECUSAR <id>`

### PDF
- gerado no backend
- enviado ao Master
- entregue ao cliente apenas após aprovação

### Módulo visual
- `Orçamentos`

Funções do módulo:
- filtrar por status
- baixar PDF
- aprovar/recusar pelo painel
- exportar JSON
- lançar transação a receber quando aprovado

---

## 17. Doc Studio / documentos
Módulo visual:
- `Doc Studio`

Finalidade atual:
- catálogo de documentos/modelos
- base documental da empresa
- parte do ecossistema de envio via WhatsApp
- suporte aos fluxos de proposal/budget/contract quando configurados

Templates persistidos em:
- `bd/templates/`

Metadados no banco:
- `templates`

---

## 18. Jarvis / Voice
Módulo visual:
- `Jarvis`

Arquivo:
- `modules/Voice/VoiceModule.tsx`

Funções:
- conexão Gemini Live
- microfone
- transcrição de voz
- compartilhamento de tela
- envio periódico de frames da tela
- logs frontend para o suporte

Contexto usado no prompt do Jarvis:
- quantidade de clientes
- quantidade de transações
- quantidade de itens da agenda
- `config.klausPrompt`

---

## 19. Runtime
Módulo visual:
- `Runtime`

Funções:
- configurar MCP
- exigir ou remover auth por token
- permitir ou bloquear shell
- ligar modo read-only
- configurar ngrok
- autostart
- domínio fixo
- proxy do painel
- iniciar/parar túnel
- exibir URLs locais e remotas

---

## 20. Suporte IA
Canal dedicado para:
- leitura de arquivos
- busca no código
- leitura do banco
- leitura de logs
- diagnóstico multimodal
- proposals de alteração
- confirmação de mutações destrutivas

Funciona com tools separadas do Core comercial.

---

## 21. Rotas HTTP confirmadas
### Saúde e status
- `GET /health`
- `GET /status`

### Sistema e sincronização
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

---

## 22. Runtime MCP
Endpoint principal:
- `/mcp`

Ferramentas confirmadas:
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

---

## 23. Logs e observabilidade
Arquivos principais:
- `logs/klaus.log`
- `logs/support.log`
- `logs/mcp-runtime.log`
- `logs/ngrok.log`

Eventos importantes observáveis:
- entrada Meta/Web
- tools executadas
- respostas do Klaus
- erros de runtime
- erros de túnel
- erros de credencial Meta

---

## 24. Regras duras atuais
1. Cliente não recebe `add_budget`
2. Orçamento nunca vai ao cliente sem aprovação
3. Cliente não vira Master por texto natural
4. Visita não pode ser salva sem endereço
5. Ações críticas do Master passam por handlers determinísticos
6. CRM e agenda devem refletir operações reais do WhatsApp

---

## 25. Estado funcional atual
### Já funcional
- WhatsApp Web
- WhatsApp Meta
- Core com sessão persistida
- Master vs cliente
- visita/orçamento sem compromisso
- endereço obrigatório para visita
- criação/atualização do cliente ao agendar
- aviso Meta com botões
- botões do aviso com ações reais
- orçamento pendente com aprovação do Master
- PDF de orçamento
- Jarvis com voz/visão
- Runtime MCP e ngrok

### Ainda pendente
- lembrete automático de 1 dia antes
- ações mais profundas no botão “Falar cliente”
- abrir conversa diretamente a partir do aviso
- localização/mapa de endereço
- refinamento visual premium dos documentos e do Doc Studio

---

## 26. Conclusão
O estado atual do Klaus já representa um sistema operacional completo em base local, com painel, runtime, WhatsApp Web/Meta, CRM básico, agenda, fluxo de visita real, orçamento controlado, suporte técnico e voz/visão.

O núcleo estrutural mais importante já está consolidado:
- cliente não cria orçamento
- visita exige endereço
- visita cria/atualiza cliente
- aviso do dev é operacional
- botões do aviso têm comportamento real

A próxima etapa natural é consolidar lembretes, localização e acabamento premium dos fluxos comerciais e documentais.
