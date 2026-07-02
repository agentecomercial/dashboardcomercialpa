# 🗂️ Comandos do Projeto — Vitória (Sales Cube / MCP)

Todos os scripts `.ps1` ficam na raiz do projeto e rodam contra o **MCP Sales Cube**.
Sintaxe dos parâmetros: `[mês]` = nome ("junho") ou `-Periodo AAAA-MM`; `<nome>` = parte do nome do consultor.

---

## 📊 1. Faturamento / Vendas
**Script:** `Faturamento-Vitoria.ps1`

| Comando | O que faz |
|---|---|
| `Faturamento Vitória [mês]` | Relatório completo da unidade (todos os consultores). Ex.: "junho" → `-Periodo 2026-06` |
| `Vendas Vitória [mês]` | Idem (sinônimo). Por padrão mostra só o **Resumo por consultor** (ranking) |
| `Vendas Vitória [mês] Detalhe` | Mostra a **tabela detalhada** de cada venda (Data \| Cliente \| Financeiro \| Valor) **+ as negociações do mês acopladas à direita** (Neg. Data \| Neg. Cliente \| Etapa \| Neg. Valor), separadas por ┃. Negociação = etapa 4 criada no mês; lado direito vazio quando o consultor não tem negociação. Inclui coluna **Anotação** (anotação **mais recente** do cliente via `list_opportunity_notes`, HTML limpo em texto simples; `-` se não houver). Título traz os dois totais (vendas + negociação) e o **Resumo** ganha as colunas **Negoc.** (qtd) e **Em negociação** (R$) |
| `Vendas Vitória <consultor> [mês]` | Filtra um consultor (ex.: "Gabriela") |

**Modificadores:** `por fechamento` (padrão) / `por faturamento` · exporta → `-Csv -Abrir`.
Saída sempre ordenada por **faturamento decrescente**.

---

## 🤝 1B. Negociações (pipeline em aberto)
**Script:** `Negociacoes-Vitoria.ps1`

| Comando | O que faz |
|---|---|
| `Negociações Vitória` | **Pipeline atual:** todas as oportunidades que estão **agora** na etapa 4 (Negociação), de qualquer data de criação |
| `Negociações Vitória [mês]` | Só as negociações **criadas no mês** (ex.: "junho" → `-Periodo 2026-06`) |
| `Negociações Vitória <consultor> [mês]` | Filtra um consultor (ex.: "Gabriela") |

Saída sempre em 2 blocos: **1)** Detalhe por consultor (Criado \| Cliente \| Valor \| **Anotação** mais recente via `list_opportunity_notes`); **2)** Resumo/ranking por **valor em negociação** (qtd + R$ + ticket + %). Ordenado por valor decrescente. Exporta → `-Csv -Abrir`.

**Leitura rápida (5 blocos fixos, gerados pela IA após as tabelas):** **1)** Onde está o dinheiro (top deals ≥ ~R$45k = % do pipeline; quem detém) · **2)** ⚠️ Risco de CRM (negociações sem anotação, R$ somado, deals grandes sem próximo passo) · **3)** 📞 Follow-up (retornos de hoje · 🔴 atrasados · esfriando) · **4)** Pendências de cadastro (R$ 0,00 a precificar; cruzar c/ faturamento p/ duplicado/upsell) · **5)** Perfil por consultor (alto valor vs volume de entrada).

---

## 🎯 2. Metas
**Script:** `Meta-Vitoria.ps1` + cadastro em `metas-vitoria.json`

| Comando | O que faz |
|---|---|
| `Meta Vitória Unidade [mês]` | Realizado da unidade × meta (3 níveis: mín/básica/master) × % × falta × projeção |
| `Meta Vitória Consultores [mês]` | Por consultor: Realizado \| Projeção \| %+Falta dos 3 níveis (+ linha TOTAL) |
| `Meta Vitória Consultor <nome>` | Filtra um consultor (ex.: "Gabriela") |
| `Meta Geral` | Consultores + Unidade + bloco "quanto falta para a unidade bater a meta" (R$ por nível + R$/dia) |
| `Atualizar Meta` | **Fluxo guiado de edição** dos alvos de **unidade + consultores** (3 níveis manuais) no `metas-vitoria.json`; ao final **mostra a Meta Geral** e faz **Deploy** (commit+push) |
| `Cadastro/edição de metas` | Sinônimo do `Atualizar Meta` (mesmo fluxo guiado, sem script) |

**Fluxo do `Atualizar Meta` (uma pergunta por vez, tabela de prévia sempre visível):**
1. **Mês** — Enter = mês atual; ou digita outra competência `AAAA-MM`.
2. **Unidade** — digita os **3 níveis manuais**: `mínima`, `básica`, `master`. (Atalho: o padrão histórico é básica = mínima ×20/17 e master = básica ×10/9, caso queira conferir.)
3. **Consultores** — percorro os 7, um a um, mostrando o valor atual: digita os 3 níveis novos · Enter mantém · "pular" deixa sem meta.
4. **Prévia** — tabela antes→depois (unidade + cada consultor, 3 níveis).
5. **Confirmar** → grava no `metas-vitoria.json`.
6. **Mostra a Meta Geral** (realizado × meta) e em seguida faz **Deploy** (commit + push).

---

## 🎯 3. Leads — Relatórios
**Scripts:** `Leads-Vitoria.ps1`, `Leads-Vitoria-Campanha.ps1`, `Movimentacao-Leads.ps1`

| Comando | O que faz |
|---|---|
| `Leads Vitória [mês] [etapa]` | Resumo por consultor numa etapa. Sem mês = mês vigente; sem etapa = matriz completa. **Etapas:** 1 Novo Lead · 2 Farmer · 3 Conversa Ativa · 4 Negociação · 5 Venda Feita · 6 Nutrição |
| `Leads Vitória campanha [mês]` | 2 tabelas: consultor × etapas 1–6 (+ Total) × campanhas (MCIS / TCE / Outros); e campanha × etapa |
| `Movimentação de Leads [período]` | Leads criados no período × etapa atual → "recebeu vs movimentou" + % conversão + alerta de leads parados. Fluxo guiado (mês vigente / mês específico / intervalo de datas) |

---

## 🔁 4. Leads — Ações (escrita no CRM)
**Script:** `Acoes-Leads-Vitoria.ps1` (modos `-Modo preview` / `-Modo apply`) · **App:** aba Comandos do Meta Master (rota `/api/acao`).

Executam **direto no app** (não no chat): formulário → botão **👁 Pré-visualizar** (antes/depois + lista das movimentações, sem gravar) → botão **✅ Aplicar no CRM** (grava com confirmação). Escrita via `assign_opportunity` (+ `move_opportunity_stage` quando muda etapa). Também podem ser conduzidos no chat se preferir.

| Comando | O que faz |
|---|---|
| `Transferência de Leads` | Reatribui N leads de um consultor **origem** para 1+ **destinos** (round-robin). Etapa origem→destino (move de etapa se diferente). Ordem: mais antigos / mais recentes |
| `Equilíbrio de Leads` | Redistribui leads **igualmente** entre os consultores escolhidos, **movendo só o excedente** (quem está acima da média cede p/ quem está abaixo; sobra por ordem alfabética). Base: Ativos 1–4 ou etapa específica. Padrão = pipeline atual (todas as datas) |
| `Equilíbrio de Leads campanha [mês]` | Igual ao Equilíbrio, mas só dos leads de **uma ou mais campanhas somadas** (MCIS / TCE / Outros). Base com atalho extra "Só Novo Lead" |

**Mapa de consultores → user_id** (no topo do script): Gabriela 76 · Natalia 77 · Karla 16314.

---

## 🚀 5. Deploy / Publicação

| Comando | O que faz |
|---|---|
| `Deploy` | Sobe e atualiza o `dashboard.html` no GitHub Pages: **1)** `scripts/bump-cache.ps1` (renova os `?v=`) → **2)** `git add -A` + `git commit` → **3)** `git push origin main` (só o remote **origin** / dashboardcomercialpa) |

**Destinos de visualização do dashboard** (mesmo arquivo): **Local** `http://127.0.0.1:5500` (via `serve-agenda.ps1`) · **Servidor Desktop** `file:///.../dashboard.html` · **GitHub** (Pages, atualizado pelo `Deploy`).

---

## 📚 6. Leitura de Turma (treinamentos ADQUIRIDO × PENDENTE)
**Script:** `Leitura-Turma.ps1`

| Comando | O que faz |
|---|---|
| `Leitura de Turma <link>` | Lê a planilha de turma (Google Sheets, **aba do gid no link**) e devolve o fluxo de 3 passos abaixo. Detecta sozinho as colunas de treinamento (células ADQUIRIDO/PENDENTE) e a coluna de nome do aluno |

**Fluxo de 3 passos:**
1. **Inserir o link** da planilha (precisa estar pública — "qualquer pessoa com o link pode ver"). O `gid` do link define a aba lida.
2. **2 tabelas:**
   - **Tabela 1 — Leitura por coluna**, ordenada por PENDENTE (maior → menor): colunas `TREINAMENTO · PENDENTE · NÃO POSSUI O TREINAMENTO (%) · ADQUIRIDO · JÁ POSSUI O TREINAMENTO (%)`.
   - **Tabela 2 — Leitura dos alunos:** por aluno, quais treinamentos `JÁ POSSUI` e quais `NÃO POSSUI`.
3. **Leitura rápida:** maiores oportunidades (mais pendentes), saturados (toda a turma já possui) e total de pendências.

---

## 📋 6B. Relatório de Turma (confirmação de presença × meta 70%)
**Sem script — fluxo no chat.** Planilha DIFERENTE da Leitura de Turma: aqui cada aba é uma **turma de treinamento** (ex.: `BHP-18`, `CEOP16`, `TAV-03`, `FCIS-31`) com resumo + lista `NOME · CPF · STATUS · OBSERVAÇÃO` (STATUS = Confirmado / Sem retorno / Transferência de turma-titularidade-unidade / Aguardando / Cancelamento / Contato errado).

| Comando | O que faz |
|---|---|
| `Relatório de Turma <link>` | Lê **TODAS as abas** da planilha (não só o gid do link) e devolve o relatório consolidado das turmas + detalhe de cada uma |

**Como leio (robusto):** extraio o ID do link e baixo a planilha inteira em **`.xlsx`** (`…/export?format=xlsx`) — **NÃO** uso `gviz`/CSV por aba, que falha em abas com células mescladas (ex.: FCIS-31 vinha achatada/vazia). Parseio o xlsx (zip → `sharedStrings.xml` + `workbook.xml` + `worksheets/sheetN.xml` via rels). Colunas: `A`=resumo, `D`=NOME, `E`=CPF, `F`=STATUS, `G`=OBSERVAÇÃO (cabeçalho na linha 1 **ou** 2); normalizo status tolerando typos ("Agurdando", "Titularidae").

**Saída (consolidado + todas as abas):**
1. **Panorama consolidado** — tabela comparativa das turmas: `Total · Confirmados · Sem retorno · Transf. turma · Meta 70% · Faltam · Termômetro` (🟢/🟡/🔴).
2. **Por turma** — painel de status + termômetro da meta 70% **com alerta de margem** (ex.: TAV-03 = confirmados + transferências deixam margem zero → todo "sem retorno" precisa confirmar).
3. **Follow-up prioritário** — lista dos "Sem retorno" (com observação) por turma.
4. **Fila de transferências com motivo** — agrupada por motivo recorrente (demanda profissional/safra, já inscrito em outro curso, gestação, fora da cidade).
5. **🔗 Cruzamento por CPF** — mesmo aluno em +1 turma (remarcações/duplicidades entre abas).
6. **⚠️ Qualidade de dados** — status vazio/typo, duplicatas, divergência resumo×lista, aba com resumo mas lista nominal vazia.

---

## 🏆 7. Meta Master
**Gerador:** `meta-master/index.html` · **Script de dados:** `meta-master/Gerar-Dados-MetaMaster.ps1` → gera `meta-master/dados.js`

| Comando | O que faz |
|---|---|
| `Meta Master` | Abro o gerador (`meta-master/index.html`) no navegador |
| `Meta Master atualizar` | Rodo `meta-master/Gerar-Dados-MetaMaster.ps1` (realizado **won** do Sales Cube × metas do `metas-vitoria.json` + fotos da pasta `meta-master/fotos/` em base64, **mês atual**) → regenera `dados.js` e **depois** abro o gerador |
| `Meta Master [mês]` | Idem com `-Periodo AAAA-MM` daquele mês (ex.: "Meta Master julho" → `-Periodo 2026-07`) e abro |

Modificador: `por fechamento` (padrão) / `por faturamento` (`-Por`). Atalhos prontos: `meta-master/Atualizar-MetaMaster.bat` e `meta-master/Servir.bat`.

---

## 👥 8. Consultores de Vitória (incluir / excluir)
**Script:** `Consultores-Vitoria.ps1` — atualiza a equipe em **todos** os scripts de uma vez (`$Consultores` nos 7 relatórios + `$Equipe` com user_id no `Acoes-Leads-Vitoria.ps1` + mapa do COMANDOS.md).

| Comando | O que faz |
|---|---|
| `Consultores Vitória` | Lista a equipe atual (nome, apelido, user_id) e **confere se todos os scripts estão iguais** |
| `Incluir consultor <nome>` | **Fluxo guiado:** peço o nome EXATO do Sales Cube + user_id (busco no Sales Cube se não souber) → prévia antes→depois → só grava após confirmar |
| `Excluir consultor` | **Fluxo guiado:** mostro a lista numerada (1..N) → **você responde só o número** → prévia antes→depois → só grava após confirmar. Também aceita nome parcial direto (precisa casar com 1 só) |

**Parâmetros diretos:** `-Incluir 'Nome Exato' -Id <user_id> [-Val Apelido]` · `-Excluir <número da lista ou parte do nome>` · sem `-Aplicar` = só prévia.
Metas não são tocadas (`metas-vitoria.json`): consultor novo entra sem meta ("—") — cadastrar depois com `Atualizar Meta`.

---

## 🔧 Utilitários (não-Vitória, execução direta, sem gatilho de chat)

| Script | O que faz |
|---|---|
| `serve-agenda.ps1` | Servidor HTTP local em `http://127.0.0.1:5500` para servir o HTML |
| `scripts/bump-cache.ps1` | Bump de cache (renova `?v=` no dashboard.html) — usado pelo `Deploy` |
| `scripts/check-js-syntax.ps1` | Checagem de sintaxe JS |
