# Klaus Site Público

Este diretório contém o site público comercial do Klaus, separado do painel interno.

## Objetivo
- rodar localmente
- ser exposto por ngrok
- vender os apps/serviços
- captar leads
- permitir cadastro/login
- simular compra e liberação de acesso ao portal
- hospedar páginas legais e materiais para Meta

## Estrutura
- `index.html` → home / landing principal
- `login.html` → login
- `cadastro.html` → criação de conta
- `portal.html` → portal do cliente
- `termos.html` → termos de uso
- `privacidade.html` → política de privacidade
- `cookies.html` → política de cookies
- `contato.html` → suporte e contato
- `server.js` → servidor local do site
- `package.json` → scripts do site
- `assets/css/styles.css` → estilos globais
- `assets/js/app.js` → frontend do site
- `data/site-db.json` → dados locais do site
- `docs/meta-readme.md` → material base para Meta/App Review

## Rodar localmente
Na pasta `site`:

```bash
npm install
npm start
```

O site sobe em:
- `http://localhost:8080`

## Observações
- Este site é separado do painel interno do Klaus.
- O checkout atual é local/simulado para o fluxo de demo e operação inicial.
- A estrutura já foi preparada para futura integração com VM, domínio e gateway de pagamento/webhook.
