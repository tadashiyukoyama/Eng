# Setup e Deploy — Klaus OS

Este documento explica como configurar, rodar e fazer deploy do Klaus OS em diferentes ambientes.

---

## Pré-requisitos

| Requisito | Versão Mínima |
| :--- | :--- |
| Node.js | 22.x |
| pnpm | 10.x |
| MySQL ou TiDB | 8.0+ |

---

## Instalação Local

```bash
# 1. Clonar o repositório
gh repo clone tadashiyukoyama/Eng
cd Eng

# 2. Instalar dependências
pnpm install

# 3. Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais (ver docs/ENV_VARIABLES.md)

# 4. Gerar e aplicar migrações do banco
pnpm db:push

# 5. Iniciar o servidor de desenvolvimento
pnpm dev
```

O servidor inicia em `http://localhost:3000` com hot reload habilitado.

---

## Deploy no Manus

O Klaus OS foi projetado para rodar na infraestrutura Manus. O deploy é automático:

1. Faça as alterações no código.
2. Salve um checkpoint via `webdev_save_checkpoint`.
3. Clique no botão **Publish** na interface do Manus.

O Manus cuida de: build de produção (`pnpm build`), servidor Express (`pnpm start`), banco de dados MySQL/TiDB, certificado SSL, domínio público e variáveis de ambiente.

**Domínio atual:** `klausos-bgsahmqv.manus.space`

---

## Build de Produção

```bash
# Build frontend (Vite) + backend (esbuild)
pnpm build

# Iniciar em produção
NODE_ENV=production node dist/index.js
```

O build gera:
- `dist/public/` — Arquivos estáticos do frontend (HTML, CSS, JS)
- `dist/index.js` — Bundle do servidor Express

---

## Banco de Dados

O Klaus OS utiliza MySQL/TiDB. A conexão é configurada via `DATABASE_URL`.

**Formato da connection string:**
```
mysql://user:password@host:port/database?ssl={"rejectUnauthorized":true}
```

**Criação das tabelas:** As migrações do Drizzle estão em `drizzle/`. Execute `pnpm db:push` para gerar e aplicar. Se algumas tabelas não forem criadas automaticamente, consulte `docs/DATABASE.md` para o SQL manual.

---

## Testes

```bash
# Rodar todos os testes
pnpm test

# Verificar TypeScript
pnpm check
```

Os testes estão em `server/routers.test.ts` e `server/auth.logout.test.ts`.

---

## Estrutura de Scripts

| Script | Comando | Descrição |
| :--- | :--- | :--- |
| dev | `pnpm dev` | Servidor de desenvolvimento com hot reload |
| build | `pnpm build` | Build de produção (Vite + esbuild) |
| start | `pnpm start` | Inicia o build de produção |
| check | `pnpm check` | Verifica erros TypeScript |
| test | `pnpm test` | Roda testes Vitest |
| format | `pnpm format` | Formata código com Prettier |
| db:push | `pnpm db:push` | Gera e aplica migrações Drizzle |

---

## Troubleshooting

**Erro: "Failed query: select ... from transactions"**
As tabelas podem não ter sido criadas pela migração. Execute o SQL manual conforme `docs/DATABASE.md`.

**Erro: "Failed to resolve import ./pages/Support"**
O arquivo `Support.tsx` pode não existir. Verifique se todos os arquivos em `client/src/pages/` estão presentes.

**Jarvis não conecta:**
Verifique se a chave API do Gemini está correta e se o modelo `gemini-2.5-flash-preview-native-audio-dialog` está disponível na sua conta Google Cloud.

**OAuth não funciona localmente:**
O OAuth Manus requer as variáveis `VITE_APP_ID`, `OAUTH_SERVER_URL` e `VITE_OAUTH_PORTAL_URL`. Essas são injetadas automaticamente no ambiente Manus, mas precisam ser configuradas manualmente para desenvolvimento local.
