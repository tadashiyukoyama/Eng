# Klaus OS — Plano Profissional do Setor de Orçamentos (2026-03-16)

## Objetivo
Transformar o setor de orçamentos/gerador em um módulo premium, visualmente forte e operacionalmente robusto, com foco em:
- aparência profissional,
- identidade visual da marca,
- PDF executivo com logotipo e acabamento comercial,
- fluxo de aprovação mais elegante,
- envio automático do próprio PDF pelo Klaus no WhatsApp.

Este plano usa como referência:
- o estado atual do Klaus OS,
- o blueprint externo recebido em `v2.zip`,
- os assets Bellarte identificados no pacote `v2`.

---

## 1. Diagnóstico do setor atual

### O que já existe
- módulo de orçamentos funcional no painel
- geração de orçamento pelo Core
- orçamento nasce como `Pendente`
- PDF gerado no backend
- aprovação do Master por WhatsApp
- envio posterior ao cliente
- configuração textual por empresa em `config.docTemplates`

### O que falta para parecer produto premium
- visual mais executivo no painel
- identidade de marca mais forte
- estrutura de orçamento mais elegante
- melhor hierarquia visual no PDF
- narrativa comercial mais profissional
- melhor apresentação no WhatsApp
- separação clara entre resumo executivo e conteúdo técnico

### Gargalos atuais
- PDF ainda funcional demais e pouco institucional
- gerador ainda não parece “sistema premium de proposta comercial”
- ausência de experiência visual forte com logotipo/branding
- falta de trilha clara entre rascunho, pendência, aprovação e entrega final

---

## 2. North star do novo módulo de orçamentos

O setor de orçamentos deve passar a parecer um **estúdio comercial executivo** da empresa, não apenas um formulário operacional.

### Resultado desejado
Quando o usuário gerar um orçamento, o sistema deve entregar:
1. uma experiência visual premium no painel,
2. conteúdo comercial melhor estruturado,
3. PDF com assinatura visual da marca,
4. fluxo claro de aprovação,
5. envio profissional ao cliente via WhatsApp,
6. possibilidade de o Klaus operar isso conversando naturalmente.

---

## 3. Direção de design

## 3.1 Identidade visual

### Bellarte como referência principal
Do material `v2.zip`, foi identificado:
- `assets/branding/bellarte/logo-primary.png`
- `assets/branding/bellarte/hero-predial.jpg`

Esses assets devem orientar a nova experiência visual do orçamento.

### Linguagem visual desejada
- premium
- corporativa
- limpa
- alta legibilidade
- elegante
- comercialmente persuasiva

### Elementos visuais recomendados
- logotipo institucional no topo do módulo
- capa/hero visual Bellarte no cabeçalho do gerador
- cards com acabamento mais executivo
- tipografia com hierarquia clara
- blocos com bordas suaves, sombras discretas e layout respirado
- destaque para valor, escopo e CTA de aprovação

---

## 3.2 Nova experiência do painel de orçamentos

### Meta UX
O módulo de orçamentos deve se comportar como um mini workspace comercial com 4 zonas:

1. **Cabeçalho institucional**
   - logo da marca
   - nome da empresa ativa
   - frase de posicionamento
   - contexto visual/hero

2. **Gerador/edição do orçamento**
   - cliente
   - serviço
   - valor
   - escopo
   - narrativa comercial
   - itens do serviço
   - memorial opcional
   - pagamento/condições

3. **Preview executivo**
   - visualização próxima do PDF final
   - resumo executivo destacado
   - hierarquia clara de blocos

4. **Ações operacionais**
   - salvar rascunho
   - gerar orçamento pendente
   - gerar PDF
   - enviar ao Master
   - aprovar e enviar ao cliente

---

## 4. Estrutura funcional proposta

## 4.1 Estados do orçamento

O orçamento deve ter estados mais claros:
- `Rascunho`
- `Pendente`
- `Aguardando aprovação`
- `Aprovado`
- `Enviado ao cliente`
- `Recusado`

### Benefício
Isso separa melhor:
- criação
- revisão interna
- aprovação
- entrega final

---

## 4.2 Conteúdo estruturado do orçamento

Além dos campos atuais, o orçamento deve suportar estrutura mais rica:

### Campos principais
- `cliente`
- `contato`
- `company`
- `title`
- `service`
- `description`
- `quoteNarrative`
- `serviceItems[]`
- `memorialText`
- `paymentTerms`
- `commercialConditions`
- `validityDays`
- `status`
- `internalNotes`
- `deliveryMessage`

### Objetivo
Separar:
- resumo comercial,
- escopo objetivo,
- itens do serviço,
- memorial técnico,
- regras de pagamento,
- condições comerciais.

---

## 5. PDF premium — proposta de evolução

## 5.1 Estrutura visual do PDF

### Página 1 — Resumo Executivo
Deve conter:
- logotipo forte
- cabeçalho institucional
- nome da empresa
- cliente
- data
- referência do orçamento
- resumo do serviço
- valor em destaque
- narrativa comercial curta
- condições rápidas
- assinatura visual premium

### Página 2 — Detalhamento Técnico (quando necessário)
Deve conter:
- itens de serviço
- memorial técnico
- observações adicionais
- condições detalhadas

### Rodapé recomendado
- telefone
- e-mail
- site
- CNPJ
- PIX ou forma comercial, se aplicável

---

## 5.2 Regras de design do PDF

- evitar sobreposição
- preservar respiro visual
- logo com presença real
- valor com destaque forte
- bloco executivo mais nobre na página 1
- parte técnica só entrar quando houver conteúdo suficiente
- linguagem visual consistente com a marca

---

## 5.3 Resultado desejado do PDF

O PDF deve parecer:
- proposta comercial profissional,
- institucional,
- confiável,
- pronta para ser enviada ao cliente sem vergonha,
- adequada para Bellarte e possíveis outras empresas da estrutura.

---

## 6. Klaus enviando o próprio PDF no WhatsApp

## 6.1 Objetivo
O Klaus deve conseguir gerar e enviar o PDF final pelo WhatsApp sem depender de ação manual no painel.

## 6.2 Fluxo desejado

### Fluxo A — operação via painel
1. usuário gera orçamento
2. orçamento fica pendente
3. Master aprova
4. Klaus gera PDF final
5. Klaus envia PDF + mensagem no WhatsApp

### Fluxo B — operação via conversa com o Klaus
1. Master pede orçamento pelo WhatsApp
2. Klaus monta orçamento
3. Klaus confirma estado pendente
4. Master aprova no WhatsApp
5. Klaus gera PDF
6. Klaus envia automaticamente o PDF para o cliente

---

## 6.3 Comportamento ideal da entrega

O envio ao cliente deve incluir:
- arquivo PDF
- legenda profissional
- mensagem curta, clara e comercial

### Exemplo de entrega
- saudação institucional
- referência ao serviço
- valor e validade resumidos
- PDF em anexo
- CTA de retorno

---

## 7. Mensagem de entrega profissional

### Padrão sugerido
“Olá, {{CLIENT_NAME}}. Segue em anexo sua proposta comercial da {{COMPANY_NAME}} referente ao serviço solicitado. Qualquer ajuste ou aprovação, fico à disposição para dar sequência.”

### Objetivo
Evitar mensagens frias ou robóticas e manter tom:
- profissional
- humano
- executivo
- comercial

---

## 8. Plano de implementação por fases

## Fase 1 — Congelamento e base visual

### Entregas
- revisar módulo `Budgets` do painel
- criar novo cabeçalho institucional do setor
- usar logo/hero da Bellarte como base de branding
- reorganizar cards e hierarquia visual
- melhorar preview do orçamento

### Resultado
O módulo já passa a parecer mais profissional antes mesmo da evolução completa do PDF.

---

## Fase 2 — Estrutura de dados do orçamento

### Entregas
- ampliar modelo de dados do orçamento
- incluir narrativa comercial
- incluir itens de serviço
- incluir memorial técnico opcional
- incluir pagamento/condições
- suportar estados mais claros do orçamento

### Resultado
O gerador deixa de ser só “cliente + serviço + valor”.

---

## Fase 3 — Novo renderizador de PDF premium

### Entregas
- nova composição visual do PDF
- página 1 executiva
- página 2 técnica opcional
- logo forte
- valor em destaque
- rodapé institucional
- layout sem sobreposição

### Resultado
PDF pronto para uso comercial sério.

---

## Fase 4 — Entrega automática via Klaus no WhatsApp

### Entregas
- consolidar rota/função de geração do PDF final
- padronizar legenda comercial
- garantir envio pelo provider ativo (`web` ou `meta`)
- garantir que o Klaus possa acionar esse envio por tool

### Resultado
Master aprova e o Klaus envia o PDF sem precisar sair da conversa.

---

## Fase 5 — IA comercial melhorando o conteúdo

### Entregas
- orientar a IA a montar:
  - título executivo
  - narrativa de proposta
  - descrição mais profissional
  - itens de serviço consistentes
- manter renderer como dono do layout final

### Resultado
Orçamentos mais bonitos visualmente e mais fortes comercialmente.

---

## 9. Mudanças técnicas recomendadas

## 9.1 Frontend
Arquivos prováveis:
- `modules/Budgets/BudgetsModule.tsx`
- possíveis assets em `public/` ou `assets/branding/`

### Melhorias
- header premium do módulo
- preview mais bonito
- blocos executivos e técnicos separados
- branding por empresa ativa
- componente de orçamento com layout mais editorial

---

## 9.2 Backend
Arquivos prováveis:
- `server.ts`
- função de geração de PDF
- tool de orçamento

### Melhorias
- enriquecer estrutura de `budget`
- melhorar payload do PDF
- permitir envio do PDF final via WhatsApp como ação formal
- manter regra de aprovação antes do envio ao cliente

---

## 9.3 Templates e branding

### Recomendação
Criar estrutura organizada por empresa:
- logo
- hero
- cores
- tipografia base
- assinatura comercial
- mensagens padrão

---

## 10. Resultado final esperado

Ao concluir esse plano, o setor de orçamentos deve entregar:
- interface mais bonita e profissional
- marca mais presente
- PDF realmente executivo
- Klaus operando envio do PDF no WhatsApp
- sensação de produto comercial premium

Em outras palavras:
- menos “sistema local improvisado”
- mais “plataforma comercial profissional da empresa”

---

## 11. Implementação recomendada imediata

### Ordem ideal
1. atualizar documentação e blueprint
2. congelar backup do estado atual
3. redesenhar o módulo Budgets no painel
4. evoluir o PDF
5. integrar envio profissional do PDF via Klaus
6. refinar a IA autora de orçamento

---

## 12. Decisão operacional recomendada

### Próxima etapa de execução
A próxima fase prática ideal é:
- redesenhar o módulo `Budgets`
- incorporar o branding Bellarte do modelo `v2`
- reformular o PDF
- garantir que o Klaus envie o PDF final pelo WhatsApp

Essa é a evolução com melhor impacto visual e comercial no sistema atual.
