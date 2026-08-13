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

## 📋 1C. Painel de Turmas (nº de pessoas por turma)
**Script:** `Painel-Vitoria.ps1` · **App:** aba Comandos (categoria `📋 Painel`, id `painel`, campo **Turmas**).

| Comando | O que faz |
|---|---|
| `Painel` (padrão) | **Próximas turmas** (de hoje p/ frente, inclui o resto deste mês): tabela `# · Turma · Início · Fim · Pessoas` + total, ordenada pela data de início |
| `Painel -Status scheduled` | Todas as agendadas (inclui as já passadas não encerradas) |
| `Painel -Status completed` | Turmas concluídas |
| `Painel -Status todas` | Todos os status (agendadas + em andamento + concluídas + canceladas), com coluna Status |

Fonte: MCP **`list_classes`** — cada turma já traz `enrolled_count` (nº de pessoas matriculadas). Padrão `proximas` = junta `scheduled`+`active` e mantém só `end_date >= hoje` (descarta agendadas antigas nunca fechadas). Saída inclui o marcador oculto `<!--PAINEL:{…}-->` que alimenta o **card de imagem** (`renderPainel`/`drawPainelCard`): barra por lotação, turmas com 0 inscritos em vermelho, total em destaque — Copiar imagem / Baixar PNG (mesmo modal dos cards de Meta/Negociações).

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
| `Atualizar Meta Consultor <nome>` | **Fluxo guiado enxuto** que edita **só 1 consultor** (não passa pela unidade nem pela equipe toda). Ao final mostra a **Meta desse consultor** (realizado × meta) e faz **Deploy** |
| `Cadastro/edição de metas` | Sinônimo do `Atualizar Meta` (mesmo fluxo guiado, sem script) |

**Fluxo do `Atualizar Meta` (uma pergunta por vez, tabela de prévia sempre visível):**
1. **Mês** — Enter = mês atual; ou digita outra competência `AAAA-MM`.
2. **Unidade** — digita os **3 níveis manuais**: `mínima`, `básica`, `master`. (Atalho: o padrão histórico é básica = mínima ×20/17 e master = básica ×10/9, caso queira conferir.)
3. **Consultores** — percorro a equipe atual (lista do `Consultores Vitória`), um a um, mostrando o valor atual: digita os 3 níveis novos · Enter mantém · "pular" deixa sem meta.
4. **Prévia** — tabela antes→depois (unidade + cada consultor, 3 níveis).
5. **Confirmar** → grava no `metas-vitoria.json`.
6. **Mostra a Meta Geral** (realizado × meta) e em seguida faz **Deploy** (commit + push).

**Fluxo do `Atualizar Meta Consultor` (só 1 consultor, uma pergunta por vez, prévia sempre visível):**
1. **Mês** — Enter = mês atual; ou outra competência `AAAA-MM`.
2. **Consultor** — se o nome já veio no comando, uso ele; senão mostro a **lista numerada** da equipe atual (`Consultores Vitória`) e você responde só o **número** (ou nome parcial que case com 1 só).
3. **3 níveis** — mostro o valor atual do consultor e você digita `mínima / básica / master`. Enter = mantém. Atalho: básica = mínima ×20/17 · master = básica ×10/9 (digite só a mínima que eu calculo).
4. **Prévia** — tabela antes→depois só desse consultor (3 níveis).
5. **Confirmar** → grava no `metas-vitoria.json` (a **unidade e os demais consultores não são tocados**).
6. **Mostra a Meta desse consultor** (realizado × meta) e em seguida faz **Deploy** (commit + push).

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
| `Transferência de Leads` | Reatribui N leads de um consultor **origem** para 1+ **destinos** (round-robin). Etapa origem→destino (move de etapa se diferente). Ordem: mais antigos / mais recentes. Mostra a **carteira atual** (matriz consultor × etapa + campanhas) no topo antes do fluxo |
| `Transferência de Leads campanha` | Igual à Transferência, mas só dos leads de **uma ou mais campanhas somadas** (MCIS / TCE / Outros). Também mostra a carteira atual no topo |
| `Equilíbrio de Leads` | Redistribui leads **igualmente** entre os consultores escolhidos, **movendo só o excedente** (quem está acima da média cede p/ quem está abaixo; sobra por ordem alfabética). Base: Ativos 1–4 ou etapa específica. Padrão = pipeline atual (todas as datas) |
| `Equilíbrio de Leads campanha [mês]` | Igual ao Equilíbrio, mas só dos leads de **uma ou mais campanhas somadas** (MCIS / TCE / Outros). Base com atalho extra "Só Novo Lead" |

**Mapa de consultores → user_id** (no topo do script): Gabriela 76 · Natalia 77 · Karla 16314 · Pablo 28 · Heverton 79.

---

## 🎓 4B. Treinamento (aba própria "Treinamento")
**Script:** `Buscar-Treinamento.ps1` (token → gitignore) · **App:** aba **Treinamento** do Meta Master (rota `/api/treinamento`).

Fluxo: **Passo 1** busca o treinamento por nome (`list_products`) → **Passo 2** escolhe o modo:

| Modo | O que faz |
|---|---|
| **💰 Vendas (quem lançou)** | Quem comprou o treinamento: Cliente · Turma · Consultor · Situação · Valor + ranking por consultor + total. Filtros: só ganhas (padrão) / todas · consultor |
| **🔀 Cross-sell por turma** | Cola o link/ID de uma turma do Sales Cube → cruza quem dela **JÁ tem** o treinamento × quem **NÃO tem** (lista de oportunidade) |

**Como lê:** report `enrollments-with-students-and-opportunity` (liga cliente↔produto↔oportunidade: consultor, situação/outcome, valor) filtrado por **`product__id`** (ID do produto — evita mojibake de acento na URL). Cross-sell soma `list_class_enrollments` da turma. Resultado renderizado na **camada de tabela rica** (modal + busca + exportar Imprimir/HTML/Excel/PDF). **Pegadinhas:** `list_class_enrollments` tem `limit` máx **200**; no Servir.ps1 **não usar `$pid`** (colide com o `$PID` read-only) — usar `$qProdId`.

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
**Script:** `Relatorio-Turma.ps1` · **App:** aba Comandos do Meta Master (**executa aqui** via `/api/cmd?id=relatorioTurma`). Planilha DIFERENTE da Leitura de Turma: aqui cada aba é uma **turma de treinamento** (ex.: `BHP-18`, `CEOP16`, `TAV-03`, `FCIS-31`) com resumo + lista `NOME · CPF · STATUS · OBSERVAÇÃO` (STATUS = Confirmado / Sem retorno / Transferência de turma-titularidade-unidade / Aguardando / Cancelamento / Contato errado).

| Comando | O que faz |
|---|---|
| `Relatório de Turma <link>` | Lê **TODAS as abas** da planilha (não só o gid do link) e devolve o relatório consolidado das turmas + detalhe de cada uma. Roda no app (card com campo de link + botão Executar) ou no chat. **A última leitura fica guardada** (`localStorage` `rt_ultima`): ao reabrir o comando a tabela reaparece automaticamente; botões **📌 Última tabela** (reexibe) e **🗑 Limpar** (apaga a guardada). Cada nova execução substitui a anterior |

**Como lê (robusto):** extrai o ID do link e baixa a planilha inteira em **`.xlsx`** (`…/export?format=xlsx`) — **NÃO** usa `gviz`/CSV por aba, que falha em abas com células mescladas (ex.: FCIS-31 vinha achatada). Parseia o xlsx (zip → `sharedStrings.xml` + `workbook.xml` + `worksheets/sheetN.xml` via rels). Colunas: `A`=resumo, `D`=NOME, `E`=CPF, `F`=STATUS, `G`=OBSERVAÇÃO. **Pegadinhas:** os números do resumo são **fórmulas COUNTIF** (`<c><f>…</f><v>N</v></c>`) → o regex de célula precisa ler o `<v>` mesmo com `<f>`; a **Meta 70%** vem vazia na planilha, então é **calculada** = `round(Total × 0,7)`. Normaliza status tolerando typos ("Agurdando", "Titularidae").

**Saída (consolidado + todas as abas):**
1. **Panorama consolidado** — tabela comparativa das turmas: `Total · Confirmados · Sem retorno · Transf. turma · Meta 70% · Faltam · Termômetro` (🟢/🟡/🔴).
2. **Por turma** — painel de status + termômetro da meta 70% **com alerta de margem** (ex.: TAV-03 = confirmados + transferências deixam margem zero → todo "sem retorno" precisa confirmar).
3. **Follow-up prioritário** — lista dos "Sem retorno" (com observação) por turma.
4. **Fila de transferências com motivo** — agrupada por motivo recorrente (demanda profissional/safra, já inscrito em outro curso, gestação, fora da cidade).
5. **🔗 Cruzamento por CPF** — mesmo aluno em +1 turma (remarcações/duplicidades entre abas).
6. **⚠️ Qualidade de dados** — status vazio/typo, duplicatas, divergência resumo×lista, aba com resumo mas lista nominal vazia.

**➕ Segundo tipo de link — CONFIRMAÇÃO WS (turma do Sales Cube):** o **mesmo card** "Relatório de Turma" também aceita o link de uma **turma do Sales Cube** (`https://app.zsales.com.br/organization/2/classes/<ID>#students`). Quando o link contém `zsales.com.br` + `/classes/<ID>`, o `Servir.ps1` roteia para **`Confirmacao-WS.ps1`** em vez do `Relatorio-Turma.ps1`. Esse script lê a turma via **MCP do Sales Cube** (`get_class` + `list_class_enrollments` + `get_customer` por matrícula) e devolve:
- Cabeçalho da turma (nome · data · modalidade · matriculados · pendentes de confirmação);
- Tabela **`# · Nome · Telefone · CPF · Status · Responsável`** (telefone e CPF formatados; ⚠️ marca sem telefone/CPF e telefones possivelmente incompletos);
- **Pontos de atenção** (sem telefone, sem CPF, telefone incompleto, sem consultor ativo/"Migração").

A saída começa com o marcador `<!--CONFIRMACAO-WS-->`; o front (`renderTurma` → `renderConfirmacaoWS`) renderiza a tabela com um menu **⋮** de exportação: **Imprimir · Baixar HTML · Baixar Excel (.xls) · Baixar PDF**. Também **fica guardada** na mesma "última tabela" (`rt_ultima`) do Relatório de Turma — os botões **📌 Última tabela** e **🗑 Limpar** funcionam para os dois tipos. Token/URL do MCP em `Confirmacao-WS.ps1` (mesmo do `Leads-Vitoria.ps1`). Não passar `organization_id` nas chamadas — o token já é vinculado à org.

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
**Script:** `Consultores-Vitoria.ps1` — atualiza a equipe em **todos** os scripts de uma vez (`$Consultores` nos 7 relatórios + `$Equipe` com user_id no `Acoes-Leads-Vitoria.ps1` + `const CONSULTORES` da aba Comandos no `meta-master/index.html` + mapa do COMANDOS.md).

| Comando | O que faz |
|---|---|
| `Consultores Vitória` | Lista a equipe atual (nome, apelido, user_id) e **confere se todos os scripts estão iguais** |
| `Incluir consultor <nome>` | **Fluxo guiado:** peço o nome EXATO do Sales Cube + user_id (busco no Sales Cube se não souber) → prévia antes→depois → só grava após confirmar |
| `Excluir consultor` | **Fluxo guiado:** mostro a lista numerada (1..N) → **você responde só o número** → prévia antes→depois → só grava após confirmar. Também aceita nome parcial direto (precisa casar com 1 só) |

**Parâmetros diretos:** `-Incluir 'Nome Exato' -Id <user_id> [-Val Apelido]` · `-Excluir <número da lista ou parte do nome>` · sem `-Aplicar` = só prévia.
Metas não são tocadas (`metas-vitoria.json`): consultor novo entra sem meta ("—") — cadastrar depois com `Atualizar Meta`.

---

## 📇 9. Buscar clientes (lista) — telefone · CPF · consultor
**Script:** `Buscar-Clientes-Vitoria.ps1` · **App:** card **"Buscar clientes (lista)"** na aba Comandos (`/api/cmd?id=buscarClientes`).

Cole uma **lista** (um por linha) de **nomes, CPFs ou telefones** no campo → tabela **`Cliente · Telefone · CPF · Consultor · Situação`**. Detecta o tipo de cada linha:
- **Nome** → `list_customers(search)` (traz tel/CPF/consultor) + fallback `search_contacts`;
- **CPF** (valida dígito verificador) → `list_customers(search=cpf só dígitos)` — busca reversa por documento;
- **Telefone** → `search_contacts(telefone)` → nome → `list_customers` p/ CPF/consultor.

Situação: ✅ exato · ⚠️ aproximado · ⚠️ só contato (sem CPF) · ❌ não localizado. Resultado na **camada rica** (busca, copiar, exportar ⋮). **Pegadinha:** o `lista` (querystring) chega em Latin1 no HttpListener → ler da query bruta com `[Uri]::UnescapeDataString(...Replace('+','%20'))` e passar via arquivo temp UTF-8 (`-ListaFile`). Script tem o token → `.gitignore`.

---

## 🟠 10. FRZ HUD (pipeline individual do consultor)
**Fonte:** `frz-pipeline-hud.vercel.app` → Supabase `pipeline_entries` (leitura anônima, **não precisa de login**) · **App:** botão **⟳ Sincronizar FRZ** na aba Vendas (`assets/js/58-frz-sync.js`).

| Comando | O que faz |
|---|---|
| `FRZ <consultor>` | Lançamentos do consultor no **mês vigente**: `Data · Aluno · Curso · Valor · Status · Origem` + totais por status |
| `FRZ <consultor> [mês]` | Idem num mês específico (ex.: "FRZ Karla julho") |
| `FRZ todos [mês]` | **Equipe Vitória**, agrupada por pessoa: **Gabriela · Karla · Heverton · Natália** (definido em 03/08/2026). Quem não tiver lançamento no mês aparece como "sem lançamentos" |
| `FRZ geral [mês]` | Aí sim os **9 consultores** do HUD (inclui Teresina/Belém) |
| `FRZ resumo [mês]` | Só os totais (Fechado / Aberto / Projeção) por consultor, sem listar lançamento |
| `FRZ metas <consultor> [mês]` | As metas mínima/básica/master lançadas no HUD (tabela `pipeline_metas`) |

**Consultores no HUD:** Darley · Daniel · Carlos · Natália · Gabriela · Karla · Iara · Cairo · Maria Clara (Rudinei é gestor de Iara/Cairo/Maria Clara). **Heverton ainda não tem acesso criado no HUD** — está no escopo do `FRZ todos`, mas só vai retornar dados quando o login dele for criado lá.
**Sincronizados para a Pipeline Comercial:** **Gabriela**, **Karla** e **Heverton** (mapa `CONSULTORES` no `58-frz-sync.js`; incluir outro = uma linha nova). ⚠️ A chave tem que ser **idêntica** ao campo `consultant` do Supabase — a maioria é só o primeiro nome, mas o Heverton está como `Heverton Leonardo`. Chave errada = consultor sumido do sync, **sem erro nenhum**. Falta a **Natália** (nome no HUD: `Natália`).
**Regras do sync:** só o **mês vigente** · `FECHADO`→PAGO, `ABERTO`→ABERTO, `PROJEÇÃO`→**NEGOCIAÇÃO** (entra no KPI *Potencial total*; sem data no HUD, usa o `created_at`) · espelho fiel (edita/apaga/muda status lá → reflete aqui) · id `frz_<id>` evita duplicar · valor vai cheio (a divisão de "C.I" pela metade é regra do gauge deles) · `und > 1` vira sufixo no produto ("MASTER COACHING ×2").
**⚠️ Segurança:** o login do HUD é client-side — usuário e senha de todos os consultores estão em texto claro no fonte da página, e a tabela aceita leitura anônima.

---

## 🎒 10B. Pipeline → Turma (lançar o que está no HUD nas vendas da turma)
**Script:** `Turma-Lancar-FRZ.ps1` (raiz) · **De:** `frz-pipeline-hud.vercel.app` (tabela `pipeline_entries`) · **Para:** `frz-sistema-v2.vercel.app` (tabela `vendas`, por turma). Mesmo projeto Supabase, leitura e escrita anônimas — **não precisa de login nem do Servir.ps1**.

| Comando | O que faz |
|---|---|
| `Turmas` | Lista as turmas cadastradas no sistema (id · nome · tipo · cidade · início · meta) |
| `Lançar turma <turma>` | **Prévia** dos lançamentos de **hoje** que iriam para a turma (aceita id ou nome: `10` ou `"CIS 251"`) |
| `Lançar turma <turma> <AAAA-MM-DD>` | Prévia de um dia específico |
| `Lançar turma <turma> <AAAA-MM>` | Prévia do mês inteiro |
| `Lançar turma <turma> <data> aplicar` | **Grava** as vendas na turma (só depois de você ver a prévia) |

**Parâmetros:** `-Turma` (id ou nome) · `-Data` (`AAAA-MM-DD` ou `AAAA-MM`; vazio = hoje) · `-Consultores` (CSV; default **Gabriela · Karla · Natália · Heverton Leonardo** = Pipeline Vitória) · `-Todos` (os 9 do HUD) · `-Aplicar` (grava).

**Regras:**
- **Nada é gravado sem `-Aplicar`.** Sem o switch é só prévia, com a coluna `Ação` dizendo o que aconteceria.
- **Não duplica e não sobrescreve:** compara `aluno+curso+valor` com o que já está na turma e só insere o que falta — inclusive contra o que foi lançado **à mão** no sistema. O script nunca faz UPDATE nem DELETE, então ajuste manual na turma fica de pé (é o contrário do `58-frz-sync.js`, que é espelho fiel).
- **Status:** `FECHADO`→**PAGAMENTO FINALIZADO** · `ABERTO`→**PAGO COM ENTRADA** · `PROJEÇÃO`→**NEGOCIAÇÃO**.
- **Liquidez:** igual ao valor, exceto `Coaching Individual*`, que entra **pela metade** — mesma conta do `calcLiq` do sistema da turma. Por isso o de-para de `CI` tem que continuar começando com "Coaching Individual", senão a liquidez sai dobrada.
- **De-para de curso:** o HUD é campo livre ("tce bronze", "Livrão", "CI"), o sistema tem nomes canônicos. A tabela `$DE_PARA` no script faz a tradução; curso sem correspondência passa com o texto original e sai marcado `⚠ curso sem de-para` na prévia — é o sinal de que falta uma linha lá.
- **Sem data no HUD não entra** (lançamento em PROJEÇÃO costuma vir sem data): aparece listado no rodapé como ignorado.
- CPF e link do Salesforce ficam **vazios** — o HUD não guarda esses campos.

**Pegadinha:** `data_iso` é coluna `date` no Postgres, então filtro de mês tem que ser `gte`/`lte`; `like.2026-08*` devolve **404**.

---

## 🔍 10D. Conferir Pipeline × ZS (rotina de batimento por consultor)
**Script:** `Conferir-Pipeline-ZS.ps1` (raiz) · **Gatilho:** `Conferir <consultor>` / `Pipeline x ZS <consultor> [mês]`

| Comando | O que faz |
|---|---|
| `-Consultor Heverton` | Bate HUD × ZS do mês vigente: as duas listas, o que só existe de cada lado e o total real |
| `-Consultor Natália -Periodo 2026-07` | Mesmo batimento em outro mês |
| `-Todos` | Equipe Vitória (Gabriela · Karla · Natália · Heverton Leonardo) |
| `-Csv` | Exporta as duas listas pareadas para CSV no %TEMP% |
| *(sem parâmetro)* | Lista as grafias de consultor existentes no HUD |

**Regras:**
- **PROJEÇÃO fica fora da conta.** No HUD, projeção é negociação, não faturamento — comparar com o ZS só `FECHADO`/`ABERTO`, senão a "divergência" vira ruído de pipeline futuro. A projeção sai numa tabela à parte.
- **Pareamento = valor igual + nome compatível.** Valor sozinho **não** é prova (duas pessoas fecham o mesmo preço de tabela o tempo todo): quando só o valor bate, a linha sai como **⚠ duvidosa**, nunca como casada. Foi o que separou `Iasmin Brambilla` de `Kamila Barbara`, ambas R$ 1.997,00 em 04/08.
- **Nome:** o HUD guarda nome curto (`MAIKEL SILVA`, `SABRINA`) e o ZS o completo (`Maikel Da Silva Simão`). Casa por **token de 4+ letras em comum**, ignorando sobrenomes genéricos (Silva, Souza, Santos…) — resolve `Stéfany Godoy` × `Sté**ph**any Godoy` e `STÉFANY KUBIT` × `Sthefany Kubit Teixeira`.
- **Sem `data_iso` no HUD** entra no total, mas sai marcado: nenhuma sincronização enxerga esse lançamento.

**⚠️ PEGADINHAS (as duas custaram caro):**
1. **Acento quebra o `ilike`:** `consultant=ilike.*natal*` devolve **zero** para "Natália" — e zero parece "consultora sem vendas", não erro. O script lê as grafias reais do HUD e casa por nome normalizado.
2. **`$_` é sobrescrito:** chamar uma função que usa pipeline **dentro** de um `Where-Object` corrompe o `$_` do bloco externo (o pareamento dava 0 sempre). Calcular em variáveis antes e usar `foreach`, não `Where-Object`.

---

## 🧾 10C. Lançar venda na turma (lote guiado)
**Script:** `Lancar-Venda-Turma.ps1` (raiz) · **Gatilho:** `Lançar venda na turma` · **Destino:** `frz-sistema-v2.vercel.app` → Supabase tabela `vendas` (escrita anônima, sem login) · **Alunos:** ZS (`Painel-Vitoria.ps1` → `class_id`; `Painel-Turma.ps1 -ClassId N`).

| Comando | O que faz |
|---|---|
| `Lancar-Venda-Turma.ps1` | Lista as turmas cadastradas e sai |
| `-Turma <id>` | **Painel da turma:** totais, quantos têm Presença Confirmada e **quem já tem venda lançada** (a duplicata aparece ANTES de digitar qualquer coisa) |
| `-Turma <id> -LinhasFile lote.txt` | **Prévia** do lote — resolve aluno/curso/CPF/consultor e marca ⚠ |
| `-Turma <id> -LinhasFile lote.txt -Aplicar` | **Grava** todas as linhas de uma vez |
| `-Atualizar` | Ignora o cache e reconsulta o ZS |
| `-TodosAlunos` | Aceita também quem não está com Presença Confirmada |

**Uma linha por venda:** `nome | curso | [qtd] | valor | status`
```
isabely | IF | 2 | 2998,50 | pago
sabrina | livrao | 2000 | pago
harrison | maestria | 85000 | neg
```
- **nome** = qualquer pedaço/começo do nome; 2+ candidatos → a linha para com `ambíguo: A // B` (nunca escolhe sozinho).
- **curso** = apelido (`IF`, `CIS`, `GGB`, `livrao`, `TAV`, `BHP`, `CEOP`, `FGPC`…) ou pedaço do nome; catálogo vem da `TIPOS_LIST` do HTML do app + `PITCH LIVRAO` e `Coaching Individual`.
- **status** = `pago` · `entrada` · `neg`. **qtd** é opcional (default 1).
- ⚠️ **valor é o TOTAL da venda, não o unitário.**

**Regras:**
- **Prévia obrigatória** — sem `-Aplicar` nada vai para o banco.
- **Nada de default em dinheiro:** valor e status são sempre explícitos. O valor que destoa (< metade ou > dobro da média do curso na turma) vira ⚠, não é corrigido sozinho.
- **Duplicata** = mesmo aluno + mesmo curso na turma, casando por **CPF** e, quando a venda antiga está sem CPF, por 2+ tokens do nome — os nomes entram abreviados ("ISABELY VICENTIM" × "Isabely Vicentim de Oliveira") e comparação exata não pega.
- **Só Presença Confirmada** entra por padrão; quem está na turma com outro status é recusado com o motivo ("Pendente de Confirmação").
- **CPF** sai do cadastro do ZS; **consultor** vem do responsável do aluno, normalizado para a grafia que a turma já pratica (`Karla Ferreira de Oliveira` → `Karla`).
- **Liquidez** = valor, exceto `Coaching Individual*` (metade) — mesma conta do `calcLiq`.
- **Cache** em `%LOCALAPPDATA%\MetaMaster\turmas`: `class-map.json` é permanente, alunos e cursos valem o dia. A idade do dado aparece no painel. **~18s a frio × ~2,5s com cache.**
- Turma do sistema ≠ turma do ZS: o nome casa ("MCIS 251 · VITÓRIA" = `class_id` 112), mas os ids são independentes.

**Escrita:** `POST /rest/v1/vendas` com `Prefer: return=representation`. Corrigir/mover venda existente = `PATCH /rest/v1/vendas?id=eq.<id>`.

---

## 💳 10E. Lançar vendas do relatório do SF no ZS (fluxo padronizado)
**Pasta:** `lancamentos-zs/` · **Script:** `Lancar-Vendas-SF.ps1` · **Atalho:** `Lancar Vendas ZS.vbs` (duplo clique) · **Destino:** Zsales Vitória (org 2).

**Gatilhos no chat:**
- `Lançar vendas do SF` — lote; sem caminho, usa o `report*.xls` mais recente de Downloads
- `Lançar vendas do SF: <caminho do .xls>` — lote de um arquivo específico
- `Lançar venda do SF: <link ou Id da Opportunity>` — **venda avulsa**, sem precisar de relatório

Entrada = o relatório de vendas exportado do Salesforce (**Exportar → Detalhes apenas → .xls**) ou o link de uma venda. Saída = clientes cadastrados + vendas lançadas e fechadas como ganhas.

| Comando | O que faz |
|---|---|
| `.\Lancar-Vendas-SF.ps1 -Arquivo "<...>.xls"` | **Etapa 1 — prévia.** Lê o relatório, cruza SF × ZS e gera `previas\previa-<data>.html`. **Nada é gravado.** Sem `-Arquivo`, pega o `report*.xls` mais recente de Downloads |
| `-Venda "<link ou Id>"` | Mesma etapa 1, para **uma venda só** — lê a Opportunity, o cliente e a turma direto do SF |
| `-Acao cadastro` / `-Acao cadastro -Aplicar` | **Etapa 2 — clientes.** Cria quem não existe e completa só campo vazio (via `Ponte-ZS.ps1`) |
| `-Acao vendas` / `-Acao vendas -Aplicar` | **Etapa 3 — vendas.** Oportunidade + produto + pagamento + anotações + fecha como ganha |
| `-Acao status` | Testa Salesforce, Zsales e API web antes de começar |
| `-Abrir` | Abre a prévia HTML no navegador |
| `-Rodada <arquivo.json>` | Usa uma rodada específica (por padrão, a mais recente) |

**Regras do lançamento (definidas em 12–13/08/2026):**
- **Nome da oportunidade = nome do cliente**, sem prefixo de turma.
- **Valor = só o que entrou pelo CISPay.** O **cashback fica fora** do produto, do valor e dos pagamentos — vira a 2ª anotação com o link do registro no SF.
- **Pagamento:** `Cartão de crédito`/`PIX` + instituição **BCO ITAUBANK S.A.** + gateway **CISPay** + data do SF; parcelas no protocolo (`4x`).
- **Anotação:** texto fixo + link da venda no SF + um bloco por forma de pagamento, campo a campo (layout da tela "Forma de Pag. Venda").
- **Responsável:** a venda herda o do cliente; cliente novo nasce com o `responsavel_padrao_id` do config.
- **Turma:** resolvida automaticamente (`FCIS31` → "FCIS 31 - 1º Módulo"); havendo módulos, usa o 1º; se ficar ambígua, **bloqueia** e você resolve no `config.json`. Quando a sigla muda entre os sistemas, use o de-para `siglas` do config — é o caso de `CIS-GL252` (SF) = `MCIS 252` (ZS), produto *Método CIS - Global* (262).
- **Venda que não existe no SF** (só comprovante, ex.: link da Rede): o script não cobre — o lançamento é manual, com `gateway: Rede` e a anotação montada a partir do comprovante, que vai anexado à oportunidade.
- **Anti-duplicidade:** consulta as vendas do cliente na API web; quem já tem venda com o mesmo valor ou a mesma turma é pulado. Rodar duas vezes não duplica.
- **Sem endereço no cliente o ZS recusa fechar** — a venda fica lançada e **aberta**, e aparece no resumo com o link.

**Config:** copie `config.exemplo.json` para `config.json` (org, responsável padrão, instituição/gateway, de-para de turmas). O `config.json` e a pasta `previas/` são gitignored.

---

## 🔧 Utilitários (não-Vitória, execução direta, sem gatilho de chat)

| Script | O que faz |
|---|---|
| `serve-agenda.ps1` | Servidor HTTP local em `http://127.0.0.1:5500` para servir o HTML |
| `scripts/bump-cache.ps1` | Bump de cache (renova `?v=` no dashboard.html) — usado pelo `Deploy` |
| `scripts/check-js-syntax.ps1` | Checagem de sintaxe JS |

---

## 🎫 APP CHAMADO — abrir chamado pelo IDE
**Script:** `chamados/Abrir-Chamado.ps1` · **App:** APP CHAMADO (servidor `chamados/Servir.ps1`, porta 8790).

| Comando | O que faz |
|---|---|
| `Abrir chamado` | **Fluxo guiado:** eu listo os usuários (`-Listar`) e **pergunto quem solicita** e **para quem enviar** (opções numeradas), além de **título · assunto · relato · prioridade**. Depois crio via API. |

Fluxo interno (o IDE monta por você):
1. `Abrir-Chamado.ps1 -Listar -Json` → devolve os usuários ativos (login/nome/perfil) para mostrar as opções.
2. `Abrir-Chamado.ps1 -De <login/nome> -Para <login/nome> -Assunto <..> -Prioridade <Baixa|Média|Alta|Urgente> -Titulo "..." -Relato "..." -Json` → cria o chamado e devolve `{ok,numero,...}`.

Detalhes: loga com conta de serviço (`adm`/`adm123`, sobrescrevível em `abrir-chamado.config.json`) e abre **em nome do solicitante escolhido** — o servidor só aceita isso quando quem loga é **ADM/Gestor** (consultor não personifica). Assunto ∈ {Comercial, CRM, Matrículas, Financeiro, Marketing, Eventos, Tecnologia, Outros}. O chamado aparece no painel na hora (auto-refresh 8s). **Pré-requisito:** APP CHAMADO rodando (`Abrir Chamados.vbs`). Script BOM UTF-8 (acentos). `.gitignore` cobre `dados/` e a config.
