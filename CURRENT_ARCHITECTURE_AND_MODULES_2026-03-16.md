# Klaus OS — Arquitetura, Módulos, Regras e Fluxos (2026-03-16)

## Finalidade
Este documento complementa o README e o blueprint principal com uma visão operacional rápida do estado atual do Klaus OS Local 3.0.

---

## 1. Mapa rápido do sistema
### Frontend
- React + Vite
- módulos renderizados por `App.tsx`
- navegação controlada por `Sidebar.tsx`
- estado global via `AppContext.tsx`

### Backend
- `server.ts` concentra API, Core, WhatsApp, orçamento, agenda, suporte, runtime e tunnel
- `mcpRuntime.js` expõe runtime MCP
- `ngrokRuntime.js` controla túnel público

### Persistência
- `bd/db.json`
- `bd/conversations/`
- `bd/support_conversations/`
- `bd/templates/`

---

## 2. Nomes visíveis do painel
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

---

## 3. Papel de cada módulo
### Dashboard
Visão geral do sistema, leituras agregadas e navegação operacional.

### Cérebro IA
Gerencia:
- modelo
- temperatura
- prompt do Master
- prompt Alfa
- prompt Custom
- prompt de atendimento
- detalhes das empresas
- templates textuais de documentos

### Suporte IA
Canal de suporte técnico e operacional para:
- leitura do projeto
- leitura do banco
- leitura de logs
- propostas de mudança
- auditoria de alterações

### CRM Leads
Gerencia clientes e leads.

Estruturas principais:
- nome
- telefone
- empresa
- status
- observações

### Orçamentos
Controla:
- pipeline comercial
- status dos orçamentos
- aprovação/recusa
- PDF
- export JSON
- criação de transação a receber após aprovação

### Financeiro
Registra e acompanha transações.

### Doc Studio
Área documental do projeto.
Hoje atua como:
- base de modelos/documentos
- integração com templates
- apoio aos envios documentais

### Klaus Pocket
Módulo do WhatsApp.
Funções:
- QR/Web
- Meta API
- status do provider
- config Meta
- webhook público
- start/stop/restart
- disparo direto
- telemetria/logs

### Jarvis
Módulo de voz e visão.
Funções:
- microfone
- transcrição
- Gemini Live
- compartilhamento de tela
- visão contextual

### Runtime
Controla:
- MCP
- token/auth
- read-only
- shell remoto
- ngrok
- proxy do painel
- URLs locais/remotas

---

## 4. Providers do WhatsApp
### Web
- `whatsapp-web.js`
- QR code
- texto
- áudio
- imagem
- documentos

### Meta
- webhook HTTP
- Graph API
- texto
- áudio com Whisper
- imagem multimodal
- mensagens interativas
- envio de documento por link quando aplicável

---

## 5. Regras de papéis
### Master
Reconhecido por `CESAR_NUMBER`.

Poderes principais:
- aprovar orçamento
- recusar orçamento
- trocar perfil ativo
- usar ações reais dos botões operacionais

### Cliente
Não pode:
- virar Master por texto natural
- acessar banco
- acessar informações de dev
- usar `add_budget`

Pode:
- conversar normalmente
- pedir visita/orçamento sem compromisso
- ser criado/atualizado no CRM
- ter visita registrada na agenda

---

## 6. Regras duras atuais
1. Cliente não usa `add_budget`
2. Orçamento não vai ao cliente sem aprovação
3. Visita não pode ser registrada sem endereço
4. Mensagens do Master com ações críticas passam por handlers determinísticos
5. CRM e agenda devem refletir operações reais do WhatsApp

---

## 7. Fluxo atual de visita/orçamento
### Entrada
Cliente pede orçamento em linguagem natural.

### Coleta obrigatória
O Klaus deve obter:
- nome
- serviço
- data
- hora
- endereço

### Ação
Quando todos os dados mínimos existem:
- usa `add_event`
- salva visita na agenda
- salva nome, telefone, endereço e observações
- cria ou atualiza o cliente no CRM
- marca status como `Interessado`
- envia aviso ao número dev

### Aviso dev
Conteúdo atual:
- nome
- telefone
- canal
- ação
- data
- hora
- endereço

Formato:
- mensagem interativa Meta com botões

Botões atuais:
- `Falar cliente`
- `Ver conversa`
- `Ver endereço`

### Ações reais dos botões
- `FALAR_CLIENTE_<telefone>` → devolve o telefone para contato
- `VER_CONVERSA_<telefone>` → devolve últimas mensagens salvas
- `VER_ENDERECO_<telefone>` → devolve endereço e data/hora da visita

---

## 8. Fluxo atual de orçamento formal
### Criação
Hoje o fluxo desejado é:
- cliente pede visita, não orçamento direto
- orçamento formal fica concentrado no Master

### Regra do backend
Quando `add_budget` é usado:
- orçamento nasce `Pendente`
- PDF pode ser gerado
- Master recebe aviso
- cliente só recebe após aprovação

### Aprovação
Comandos:
- `APROVAR <id>`
- `RECUSAR <id>`

---

## 9. Jarvis
### Contexto usado
- clientes
- transações
- agenda
- `klausPrompt`

### Capacidades atuais
- ouvir
- transcrever
- responder em áudio
- receber frames da tela
- atuar com contexto multimodal

---

## 10. Rotas confirmadas
### Sistema
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

### Tunnel
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

## 11. Runtime MCP
Ferramentas principais:
- `health.get`
- `registry.get`
- `state.get`
- `fs.*`
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
- `support.*`
- `whatsapp.control`

---

## 12. Estado funcional atual
### Já funcional
- Meta e Web no mesmo backend
- distinção Master vs cliente
- visita com endereço obrigatório
- CRM atualizado ao agendar
- agenda atualizada ao agendar
- aviso interativo para o dev
- ações reais dos botões do aviso
- orçamento com aprovação do Master
- PDF de orçamento
- Jarvis com voz e visão
- Runtime MCP e tunnel

### Ainda pendente
- lembrete automático de 1 dia antes
- integração mais profunda para “Falar cliente”
- localização/mapa a partir do endereço
- acabamento premium de Doc Studio e documentos

---

## 13. Arquivos documentais principais
- `README.md`
- `APP_BLUEPRINT_2026-03-16.md`
- `CURRENT_ARCHITECTURE_AND_MODULES_2026-03-16.md`
- `WHATSAPP_META_SETUP.md`
- `MCP_RUNTIME_SETUP.md`
- `KLAUS_3.0_RELEASE.md`

---

## 14. Conclusão
O Klaus já está em um estado operacional consistente para:
- atendimento real
- CRM básico
- agendamento real
- operação via WhatsApp
- aprovação de orçamento
- documentos/PDF
- suporte técnico
- runtime remoto

A documentação agora reflete o estado atual real do app, incluindo Meta, QR/Web, Jarvis, Orçamentos, Runtime, CRM, Doc Studio, Suporte IA, regras, fluxos e arquitetura.
