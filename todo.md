# Klaus OS — TODO

## Fase 1: Banco de Dados
- [x] Schema: users (já existe)
- [x] Schema: companies (Bellarte, Alfa, Vida Pessoal)
- [x] Schema: clients (CRM leads/clientes)
- [x] Schema: transactions (financeiro)
- [x] Schema: budgets (orçamentos)
- [x] Schema: budget_items (itens do orçamento)
- [x] Schema: agenda_events (agenda)
- [x] Schema: doc_templates (templates Doc Studio)
- [x] Schema: ai_profiles (perfis de IA)
- [x] Schema: support_logs (logs suporte IA)
- [x] Aplicar migração SQL

## Fase 2: Backend (tRPC Routers)
- [x] Router: companies
- [x] Router: clients (CRM)
- [x] Router: transactions (financeiro)
- [x] Router: budgets + geração com IA
- [x] Router: agenda
- [x] Router: docStudio
- [x] Router: aiConfig (perfis IA)
- [x] Router: dashboard (métricas)
- [x] Router: support (suporte IA)

## Fase 3: Frontend — Layout e Módulos Principais
- [x] Tema dark premium (index.css)
- [x] DashboardLayout com sidebar completo (9 módulos)
- [x] Página: Dashboard executivo com métricas e terminal IA
- [x] Página: CRM (leads/clientes, filtros por empresa)
- [x] Página: Financeiro (transações, saldo, filtros)
- [x] Página: Orçamentos (lista, criar, geração IA)

## Fase 4: Frontend — Módulos Avançados
- [x] Página: Agenda (lista agrupada por data, campos completos)
- [x] Página: Doc Studio (templates + variáveis dinâmicas + gerador IA)
- [x] Página: Config IA (perfis, templates por tipo)
- [x] Página: Suporte IA (chat contextual)

## Fase 5: Jarvis
- [x] Página: Jarvis (Gemini Live Audio bidirecional)
- [x] Integração: visão via screen share (5fps / 2s)
- [x] Integração: escuta contínua (PCM 16kHz)
- [x] Chave API configurável pelo usuário no localStorage

## Fase 6: Finalização
- [x] Testes vitest (9 testes passando)
- [x] Classes premium CSS (gradient-text, glass-card, pulse-dot)
- [x] Checkpoint final
- [x] Relatório de status por módulo

## Bugs
- [x] Fix: Query falha na tabela `transactions` — 5 tabelas faltavam no banco (companies, clients, transactions, doc_templates, support_logs) — criadas manualmente via SQL

## Fase 7: Documentação e GitHub
- [ ] Criar README.md completo do projeto
- [ ] Criar docs/ARCHITECTURE.md (arquitetura, stack, fluxo de dados)
- [ ] Criar docs/API_REFERENCE.md (todas as rotas tRPC com inputs/outputs)
- [ ] Criar docs/DATABASE.md (schema completo, tabelas, campos, relações)
- [ ] Criar docs/MODULES.md (cada módulo frontend com funcionalidades)
- [ ] Criar docs/SETUP.md (como rodar, configurar, deploy)
- [ ] Criar docs/ENV_VARIABLES.md (todas as variáveis de ambiente)
- [ ] Push completo para o repositório GitHub tadashiyukoyama/Eng
