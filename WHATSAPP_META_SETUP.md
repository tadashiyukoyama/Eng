# WhatsApp Meta API - Guia de Integração do Klaus OS

Este documento descreve o foco atual da integração do **WhatsApp Meta Cloud API** dentro do Klaus OS Local 3.0.

Objetivo do foco atual:
- encaixar o provider **Meta** no mesmo fluxo principal do WhatsApp que antes passava pelo QR/Web
- manter o restante do app intacto
- permitir configuração pelo painel
- permitir teste de entrada e saída sem depender do `whatsapp-web.js`

---

## 1. Providers de WhatsApp no Klaus

O sistema foi organizado para suportar dois providers:

### `web`
Provider clássico usando `whatsapp-web.js`.

Características:
- exige QR code
- usa sessão local em `.wwebjs_auth`
- recebe texto, áudio, imagem
- responde pelo cliente web do WhatsApp

### `meta`
Provider usando **WhatsApp Cloud API da Meta**.

Características:
- não usa QR
- recebe eventos por webhook HTTP
- envia mensagens pela Graph API
- foco atual: **texto** no mesmo pipeline principal do WhatsApp

---

## 2. Onde a configuração fica

A configuração do Meta fica em:
- `bd/db.json`
- caminho: `config.whatsappMeta`

Estrutura esperada:

```json
{
  "provider": "meta",
  "enabled": true,
  "apiVersion": "v23.0",
  "appId": "...",
  "businessAccountId": "...",
  "phoneNumberId": "...",
  "verifyToken": "...",
  "accessToken": "..."
}
```

---

## 3. Rotas do backend relacionadas ao Meta

### Configuração
- `GET /api/whatsapp/meta/config`
- `POST /api/whatsapp/meta/config`

### Webhook
- `GET /api/whatsapp/meta/webhook`
- `POST /api/whatsapp/meta/webhook`

### Envio manual compartilhado
- `POST /api/whatsapp/send`

### Estado geral do canal
- `GET /status`

---

## 4. Fluxo compartilhado com o WhatsApp principal

A ideia central do foco atual é:

1. o webhook Meta recebe a mensagem
2. extrai `from` e `text`
3. passa para o mesmo pipeline principal de texto do WhatsApp
4. o Klaus decide se é comando duro do Master ou texto normal
5. o Core responde
6. a resposta sai pelo provider ativo

Isso reaproveita a mesma lógica já usada pelo fluxo do QR/Web para:
- `APROVAR <id>`
- `RECUSAR <id>`
- `klaus, mude para ...`
- respostas normais do Core

---

## 5. Estado público esperado

O endpoint `GET /status` deve refletir o provider ativo.

### Quando `provider=web`
Espera-se algo como:
- `provider: "web"`
- `qr` quando houver QR disponível
- `status: qr_ready | connected | starting | stopped`

### Quando `provider=meta`
Espera-se algo como:
- `provider: "meta"`
- `qr: null`
- `meta` com detalhes do estado/config
- `status: connected | config_required | disabled | stopped`

---

## 6. Painel - aba WhatsApp

O módulo WhatsApp do painel deve permitir:

### Se provider = `web`
- exibir QR code
- start/stop/restart do canal
- envio direto de teste

### Se provider = `meta`
- editar:
  - API version
  - App ID
  - Business Account ID
  - Phone Number ID
  - Verify Token
  - Access Token
- salvar a configuração
- exibir a URL do webhook
- exibir status da integração
- fazer envio direto de teste

---

## 7. Webhook da Meta

### Verificação
A Meta usa `GET` com:
- `hub.mode`
- `hub.verify_token`
- `hub.challenge`

O backend deve:
- comparar `hub.verify_token` com o `verifyToken` salvo
- responder o `hub.challenge` se estiver válido

### Entrada de mensagens
No foco atual, o backend lê o payload e procura mensagens de texto.

Se encontrar:
- `from`
- `text.body`

então envia isso para o mesmo fluxo principal do WhatsApp do Klaus.

---

## 8. Envio pela Meta

O backend envia pela Graph API usando:
- `apiVersion`
- `phoneNumberId`
- `accessToken`

Formato de saída atual priorizado:
- mensagem de texto

Observação do foco atual:
- anexos/documentos no Meta ainda são etapa posterior
- quando o fluxo gerar anexo em um transporte Meta, o fallback atual pode ser textual

---

## 9. Limitações atuais do foco Meta

No escopo atual da integração, o objetivo principal é validar:
- configuração correta
- entrada por webhook
- saída por texto
- reaproveitamento do mesmo pipeline principal do WhatsApp

Ainda não é o foco deste momento:
- expandir anexos avançados da Cloud API
- refatorar todo o pipeline multimodal para Meta
- reestruturar outras áreas do sistema

---

## 10. Fluxo de teste recomendado

### Etapa 1 - escolher provider
No painel, escolher `meta`.

### Etapa 2 - salvar config
Preencher e salvar:
- `apiVersion`
- `appId`
- `businessAccountId`
- `phoneNumberId`
- `verifyToken`
- `accessToken`

### Etapa 3 - validar webhook
Na plataforma Meta:
- apontar o webhook para:
  - `https://SEU-DOMINIO-NGROK/api/whatsapp/meta/webhook`
- usar o mesmo `verifyToken`
- confirmar que o challenge responde corretamente

### Etapa 4 - testar saída
Usar:
- formulário “Disparo direto” no painel
ou
- `POST /api/whatsapp/send`

### Etapa 5 - testar entrada
Mandar texto para o número conectado à Meta e confirmar:
- o webhook recebe
- o backend processa
- o Klaus responde

### Etapa 6 - testar regras do Master
Enviar:
- `APROVAR <id>`
- `RECUSAR <id>`
- `klaus, mude para atendimento`

---

## 11. Checklist objetivo

- [ ] provider `meta` configurado no painel
- [ ] webhook validado na Meta
- [ ] `GET /api/whatsapp/meta/config` respondendo
- [ ] `GET /api/whatsapp/meta/webhook` respondendo challenge
- [ ] `POST /api/whatsapp/send` enviando via Meta
- [ ] texto de entrada passando pelo mesmo pipeline do WhatsApp principal
- [ ] comando duro do Master funcionando

---

## 12. Escopo protegido

Este guia existe para manter o foco da implementação.

O foco atual é somente:
- **WhatsApp Meta entrar no mesmo fluxo do QR/Web**
- **ter configuração no painel**
- **ser testável ponta a ponta**

Sem expandir outras áreas do sistema enquanto isso não estiver validado.
