# MCP Runtime - Klaus 3.0

Este documento descreve como o runtime MCP sobe, como ele se relaciona com o backend do Klaus e quais pontos de atenção existem no ambiente atual.

---

## 1. Onde o MCP sobe

O runtime MCP sobe **junto com o backend do app**.

Endpoints locais:
- Painel: `http://localhost:5173`
- Backend: `http://localhost:3001`
- MCP local: `http://localhost:3001/mcp`

Endpoints remotos (quando o túnel está ativo):
- Painel remoto: `https://SEU-DOMINIO-NGROK/`
- MCP remoto: `https://SEU-DOMINIO-NGROK/mcp`

---

## 2. Como ligar

1. Copie `.env.example` para `.env`
2. Defina as variáveis do runtime MCP
3. Rode `npm install`
4. Rode `npm run dev` ou `npm run server`

---

## 3. Variáveis principais do MCP

```env
MCP_RUNTIME_ENABLED="true"
MCP_RUNTIME_REQUIRE_AUTH="true"
MCP_RUNTIME_TOKEN="SUA_CHAVE_FORTE"
MCP_RUNTIME_ALLOW_COMMANDS="true"
MCP_RUNTIME_READONLY="false"
```

### Significado
- `MCP_RUNTIME_ENABLED`: ativa/desativa o runtime MCP
- `MCP_RUNTIME_REQUIRE_AUTH`: exige token no endpoint `/mcp`
- `MCP_RUNTIME_TOKEN`: token de autenticação do MCP
- `MCP_RUNTIME_ALLOW_COMMANDS`: permite execução de shell via MCP
- `MCP_RUNTIME_READONLY`: bloqueia ferramentas destrutivas

---

## 4. Arquivos principais

- `server.ts`
- `mcpRuntime.js`
- `ngrokRuntime.js`
- `.env.example`
- `README.md`
- `KLAUS_3.0_RELEASE.md`

---

## 5. Como o runtime é montado

O `server.ts` instala o runtime via:
- `installMcpRuntime(...)`

Esse runtime usa:
- `projectRoot`
- `dbPath`
- `envPath`
- `envLocalPath`
- `logDir`
- callbacks para:
  - ler o banco
  - salvar o banco
  - devolver o estado atual do app
  - executar scan de suporte
  - controlar o WhatsApp

---

## 6. Ferramentas MCP expostas

O runtime pode expor ferramentas como:
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

## 7. Relação entre MCP e WhatsApp

O runtime MCP não implementa a lógica do WhatsApp em si; ele controla o backend já carregado.

Hoje ele consegue:
- ler o estado atual do app
- acionar `start/stop/restart` do WhatsApp
- inspecionar arquivos/logs/banco ligados ao fluxo do WhatsApp
- fazer smoke tests nas rotas HTTP locais

Com o foco atual do projeto, o MCP pode observar um backend que opera com:
- provider `web` (QR/whatsapp-web.js)
- provider `meta` (Cloud API da Meta)

---

## 8. ngrok fixo

Este build inclui um gerenciador de túnel embutido.

Variáveis:
- `NGROK_ENABLED`
- `NGROK_AUTOSTART`
- `NGROK_AUTHTOKEN`
- `NGROK_DOMAIN`
- `NGROK_RESERVED_DOMAIN_ID`

Rotas de status:
- `GET /api/system/tunnel-status`
- `POST /api/system/start-tunnel`
- `POST /api/system/stop-tunnel`

Se `NGROK_DOMAIN` estiver vazio e `NGROK_RESERVED_DOMAIN_ID` estiver preenchido, o app resolve o hostname via API da ngrok antes de abrir o endpoint.

---

## 9. Painel remoto no mesmo domínio

O backend faz proxy do painel Vite para o mesmo domínio do túnel.

Resultado:
- `/` serve o painel remoto
- `/mcp` serve o runtime MCP remoto

---

## 10. Segurança operacional

Pontos críticos:
- nunca expor MCP remoto sem autenticação forte
- evitar shell remoto aberto sem necessidade
- preferir `READONLY=true` quando o uso for só diagnóstico
- nunca comitar `.env`, `.env.local` ou `.wwebjs_auth`

---

## 11. Fluxo recomendado de validação do MCP

1. Validar `GET /health`
2. Validar `GET /status`
3. Validar `GET /mcp`
4. Listar tools
5. Rodar `simulator.run` em rotas do sistema
6. Ler estado do WhatsApp atual
7. Se o foco for Meta API, validar também:
   - `GET /api/whatsapp/meta/config`
   - `GET /api/whatsapp/meta/webhook`
   - `POST /api/whatsapp/send`

---

## 12. Estado documental atual

Este documento foi atualizado para refletir o runtime MCP do Klaus no estado atual do projeto, incluindo o contexto do novo foco em WhatsApp com provider configurável (`web` / `meta`).
