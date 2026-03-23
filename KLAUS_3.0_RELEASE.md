# Klaus OS Local 3.0 RELEASE (PRO)

Este documento descreve **como o Klaus funciona hoje**, com foco no comportamento operacional real do sistema, seus fluxos, APIs, regras e no novo suporte a **WhatsApp com provider configurável (`web` ou `meta`)**.

---

## 1) Visão geral

**Klaus OS Local** é um sistema local composto por:

- **Backend (Node + Express)**
  - API principal
  - Core IA (OpenAI Responses)
  - Suporte IA
  - Runtime MCP embutido
  - Gerenciador de túnel ngrok
  - WhatsApp provider `web` ou `meta`

- **Painel Web (React + Vite)**
  - CRM
  - Orçamentos
  - Financeiro
  - Agenda
  - Configuração IA
  - Runtime
  - Suporte IA
  - Voice
  - WhatsApp

- **Persistência local**
  - `bd/db.json`
  - memórias persistentes em `bd/conversations/` e `bd/support_conversations/`
  - templates em `bd/templates/`

---

## 2) Regras inquebráveis (HARD RULES)

1. **Orçamento nasce sempre PENDENTE**.
2. **Nunca enviar orçamento ao cliente sem aprovação do Master**.
3. **Cliente nunca recebe detalhes de sistema interno, painel ou desenvolvimento**.
4. **Ações reais devem passar por tools/rotas reais**.
5. **Klaus é operador/gerente**, não “dev”, exceto quando o canal é o Suporte IA.

---

## 3) Dados e persistência

### Banco principal
- Arquivo: `bd/db.json`
- Escrita atômica via `.tmp + rename`

Estruturas principais:
- `clients`
- `transactions`
- `budgets`
- `agenda`
- `templates`
- `activeProfile`
- `companies`
- `config`

### Memória persistente do Core (30 dias)
- Pasta: `bd/conversations/`
- Sessões como:
  - `whatsapp:<jid>`
  - `panel:<id>`
  - `jarvis:<id>`
- Guarda:
  - `previousResponseId`
  - histórico de mensagens resumido

### Memória persistente do Suporte IA (30 dias)
- Pasta: `bd/support_conversations/`
- Guarda:
  - histórico do suporte
  - `pins` de memória selecionada
  - `previousResponseId`

---

## 4) Perfis e personalidade

### Master
Identificado principalmente por `CESAR_NUMBER`.

Pode:
- aprovar/recusar orçamento
- trocar perfil ativo
- receber relatórios/resumos
- operar o fluxo interno do sistema

### Cliente
Perfis possíveis:
- `PROSPECTING_ALFA`
- `PROSPECTING_CUSTOM`
- `ATTENDANT`

Regras:
- não falar sobre painel
- não expor sistema interno
- foco em atendimento ou prospecção conforme perfil ativo

---

## 5) Providers de IA

### Core principal
- Provider: **OpenAI**
- API: **Responses API**
- Modelo padrão: `gpt-4o-mini`

### Suporte IA
- Provider: **OpenAI**
- Modelo: `OPENAI_MODEL_SUPPORT` ou fallback de `OPENAI_MODEL`

### Jarvis / Voice
- Provider: **Gemini**
- Execução no browser
- Chave: `VITE_GEMINI_API_KEY`

---

## 6) WhatsApp — visão geral atual

O sistema foi organizado para operar em **dois modos** de WhatsApp.

### Provider `web`
Usa `whatsapp-web.js`.

Características:
- QR code no painel
- sessão local em `.wwebjs_auth`
- eventos `qr`, `ready`, `message`
- suporta:
  - texto
  - áudio/PTT com transcrição
  - imagem com input multimodal

### Provider `meta`
Usa **WhatsApp Cloud API da Meta**.

Características:
- sem QR code
- webhook HTTP
- envio via Graph API
- foco atual do fluxo: **texto**
- usa o mesmo pipeline principal de texto do Klaus

### Config do Meta
A configuração do provider Meta é armazenada em:
- `db.config.whatsappMeta`

Campos:
- `provider`
- `enabled`
- `apiVersion`
- `appId`
- `businessAccountId`
- `phoneNumberId`
- `verifyToken`
- `accessToken`

---

## 7) Fluxo do WhatsApp

### 7.1 Entrada de texto
Todo texto do WhatsApp deve convergir para o mesmo fluxo principal:

1. identifica `from`
2. decide se é Master ou cliente
3. intercepta comandos duros do Master:
   - `APROVAR <id>`
   - `RECUSAR <id>`
   - `klaus, mude para ...`
4. se não for comando duro, chama `runCoreAgent(...)`
5. devolve resposta pelo provider ativo

### 7.2 Entrada por `web`
Origem:
- `wwClient.on('message')`

Regras:
- ignora `status@broadcast`
- ignora grupos `@g.us`
- usa fila por `jid`

### 7.3 Entrada por `meta`
Origem:
- `POST /api/whatsapp/meta/webhook`

No escopo atual:
- mensagens de texto são convertidas para o mesmo fluxo principal de texto do WhatsApp

### 7.4 Saída
A saída é abstraída por um helper único de envio:

- `provider=web` → `wwClient.sendMessage(...)`
- `provider=meta` → Graph API da Meta

---

## 8) Mídia no WhatsApp

### Áudio / PTT
- baixa mídia
- salva arquivo temporário
- transcreve com `whisper-1`
- envia texto transcrito ao Core

### Imagem
- transforma em `dataUrl`
- chama o Core com `input_image`

### Documento / PDF / outros
- no provider `web`, documentos são reconhecidos
- no fluxo atual, documentos recebidos não entram no Core; o sistema responde com confirmação/fallback

### Observação importante sobre o provider Meta
No foco atual da implementação:
- o Meta entrou primeiro no **fluxo de texto**
- envio de anexos/documentos no Meta ainda depende de expansão posterior
- o helper atual cai para fallback textual quando o transporte for Meta e o payload for anexo

---

## 9) Core IA (OpenAI Responses)

### Sessão
Cada sessão do Core usa:
- RAM (`coreSessions`)
- disco (`bd/conversations/...`)

### Tools do Core
- `add_client`
- `add_budget`
- `add_transaction`
- `add_event`
- `get_finance_summary`
- `list_recent_clients`
- `list_templates`
- `send_template`

### Instruções
O Core monta instruções diferentes para:
- Master
- cliente
- canal (`whatsapp`, `panel`, `jarvis`)

---

## 10) Orçamentos (fluxo definitivo)

1. cliente pede orçamento
2. Core chama `add_budget`
3. cria orçamento **Pendente**
4. Master recebe resumo e, quando possível, PDF
5. Master decide:
   - `APROVAR <id>`
   - `RECUSAR <id>`
6. se aprovado, sistema envia ao cliente

### Regra crítica
Cliente **nunca** recebe orçamento antes da aprovação do Master.

---

## 11) Templates (documentos)

- Upload via painel
- Arquivo físico em `bd/templates/`
- Metadata em `db.json`
- Envio via tool `send_template`

No provider `web`, o envio usa mídia/anexo.
No provider `meta`, o fluxo atual deve ser tratado como etapa incremental e pode cair em fallback textual, dependendo do payload.

---

## 12) API principal do backend

### Gerais
- `GET /health`
- `GET /status`
- `GET /api/system/data`
- `POST /api/system/sync`

### Core
- `POST /api/ai/dispatch`

### Templates
- `GET /api/templates/list`
- `POST /api/templates/upload`
- `GET /api/templates/:id/download`

### Orçamentos
- `GET /api/budgets/:id/pdf`
- `POST /api/budgets/decision`

### Suporte IA
- `POST /api/support/chat`
- `POST /api/support/frontend-log`
- `GET /api/support/scan`
- `POST /api/support/clear-session`

### Runtime / ambiente
- `GET /api/system/env`
- `POST /api/system/update-env`
- `GET /api/system/runtime-config`
- `POST /api/system/runtime-config`
- `GET /api/system/tunnel-status`
- `POST /api/system/start-tunnel`
- `POST /api/system/stop-tunnel`

### WhatsApp
- `POST /api/system/start-whatsapp`
- `POST /api/system/stop-whatsapp`
- `POST /api/system/restart-whatsapp`
- `POST /api/system/clear-sessions`
- `POST /api/whatsapp/send`

### Meta API (fluxo novo)
- `GET /api/whatsapp/meta/config`
- `POST /api/whatsapp/meta/config`
- `GET /api/whatsapp/meta/webhook`
- `POST /api/whatsapp/meta/webhook`

---

## 13) Painel — módulo WhatsApp

O módulo WhatsApp agora deve cobrir dois objetivos:

1. manter o controle do provider `web` (QR/local)
2. permitir configurar e testar o provider `meta`

### Comportamentos esperados
- se `provider=web`:
  - mostrar QR quando houver
  - manter os controles tradicionais

- se `provider=meta`:
  - mostrar formulário de configuração
  - exibir webhook público
  - mostrar estado da integração Meta
  - permitir envio direto de teste

---

## 14) Runtime MCP

O runtime MCP sobe no mesmo backend.

### Endpoint
- local: `http://localhost:3001/mcp`
- remoto: `https://SEU-DOMINIO-NGROK/mcp`

### Ferramentas relevantes
- leitura/escrita de arquivo
- leitura/escrita do db
- leitura de logs
- config do runtime
- execução shell
- simulator HTTP
- controle do WhatsApp

---

## 15) Túnel ngrok

O túnel sobe no próprio backend.

Variáveis:
- `NGROK_ENABLED`
- `NGROK_AUTOSTART`
- `NGROK_AUTHTOKEN`
- `NGROK_DOMAIN`
- `NGROK_RESERVED_DOMAIN_ID`

Rotas:
- `GET /api/system/tunnel-status`
- `POST /api/system/start-tunnel`
- `POST /api/system/stop-tunnel`

---

## 16) Segurança

Nunca comitar:
- `.env`
- `.env.local`
- `.wwebjs_auth`

Dados locais:
- `bd/db.json`
- `bd/conversations/`
- `bd/support_conversations/`
- `bd/templates/`

Observação operacional:
- runtime MCP exposto precisa de autenticação forte
- shell remoto deve ser tratado com cuidado
- QR/Web e Meta não devem ser ativados/desenhados sem saber qual provider é o ativo

---

## 17) Checklist de QA do WhatsApp Meta

### Configuração
- salvar provider como `meta`
- preencher `apiVersion`
- preencher `phoneNumberId`
- preencher `verifyToken`
- preencher `accessToken`

### Webhook
- validar `GET /api/whatsapp/meta/webhook` com challenge da Meta

### Saída
- testar `POST /api/whatsapp/send`
- testar formulário “Disparo direto” no painel

### Entrada
- enviar mensagem de texto ao número da Meta
- confirmar entrada no webhook
- confirmar resposta do Klaus no mesmo pipeline principal

### Regras duras
- `APROVAR <id>`
- `RECUSAR <id>`
- `klaus, mude para atendimento`

---

## 18) Escopo atual do foco Meta

O foco atual do projeto está restrito a:
- encaixar o **WhatsApp Meta** no mesmo fluxo que antes passava pelo QR
- manter o restante do sistema intacto
- adicionar configuração Meta dentro da aba WhatsApp do painel

Este documento reflete esse estado e esse objetivo.
