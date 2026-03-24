# Variáveis de Ambiente — Klaus OS

Este documento lista todas as variáveis de ambiente utilizadas pelo sistema, separadas por camada (servidor e frontend).

---

## Variáveis do Servidor (server-side)

Estas variáveis são acessadas via `process.env` no backend e estão tipadas em `server/_core/env.ts`.

| Variável | Obrigatória | Descrição | Exemplo |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Sim | Connection string MySQL/TiDB | `mysql://user:pass@host:4000/db?ssl=...` |
| `JWT_SECRET` | Sim | Chave para assinar cookies JWT de sessão | `random-64-char-string` |
| `OAUTH_SERVER_URL` | Sim | URL base do servidor OAuth Manus | `https://api.manus.im` |
| `OWNER_OPEN_ID` | Sim | OpenID do dono do projeto (auto admin) | `U4wXMGvNHKStrardPj8d6R` |
| `OWNER_NAME` | Não | Nome do dono do projeto | `Tadashi` |
| `BUILT_IN_FORGE_API_URL` | Sim | URL da API Forge do Manus (LLM, storage, etc.) | `https://forge.manus.im` |
| `BUILT_IN_FORGE_API_KEY` | Sim | Bearer token para a API Forge (server-side) | `sk-...` |
| `NODE_ENV` | Não | Ambiente de execução | `development` ou `production` |

---

## Variáveis do Frontend (client-side)

Variáveis prefixadas com `VITE_` são expostas ao frontend via Vite e acessíveis via `import.meta.env`.

| Variável | Obrigatória | Descrição | Exemplo |
| :--- | :--- | :--- | :--- |
| `VITE_APP_ID` | Sim | ID da aplicação OAuth Manus | `app-uuid-here` |
| `VITE_APP_TITLE` | Não | Título exibido no navegador | `Klaus OS` |
| `VITE_APP_LOGO` | Não | URL do logo da aplicação | `https://cdn.../logo.png` |
| `VITE_OAUTH_PORTAL_URL` | Sim | URL do portal de login Manus | `https://auth.manus.im` |
| `VITE_FRONTEND_FORGE_API_KEY` | Não | Token para acesso frontend à API Forge | `vk-...` |
| `VITE_FRONTEND_FORGE_API_URL` | Não | URL da API Forge para o frontend | `https://forge.manus.im` |
| `VITE_ANALYTICS_ENDPOINT` | Não | Endpoint de analytics | `https://analytics.manus.im` |
| `VITE_ANALYTICS_WEBSITE_ID` | Não | ID do website para analytics | `uuid` |

---

## Variáveis Específicas do Jarvis

O módulo Jarvis (Gemini Live Audio) utiliza uma chave API armazenada no `localStorage` do navegador, e não em variáveis de ambiente do servidor. Isso porque a conexão WebSocket é feita diretamente do browser para o Google.

| Chave localStorage | Descrição |
| :--- | :--- |
| `gemini_api_key` | Chave API do Google Gemini para o módulo Jarvis |

Para obter a chave: acesse [Google AI Studio](https://aistudio.google.com/apikey) e crie uma API key com acesso ao modelo `gemini-2.5-flash-preview-native-audio-dialog`.

---

## Mapeamento no Código

O objeto `ENV` em `server/_core/env.ts` centraliza o acesso às variáveis do servidor:

```typescript
export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
```

---

## Notas para o Próximo Agente

Ao trabalhar no projeto via Manus, as variáveis de ambiente são injetadas automaticamente pela plataforma. Para adicionar ou atualizar variáveis, use a ferramenta `webdev_request_secrets`. As variáveis listadas na seção `<webdev_project_config>` do contexto do agente já estão configuradas e disponíveis.

Para desenvolvimento local fora do Manus, crie um arquivo `.env` na raiz do projeto com todas as variáveis listadas acima. O arquivo `.env` está no `.gitignore` e nunca deve ser commitado.
