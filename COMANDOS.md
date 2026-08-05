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
**Sincronizados para a Pipeline Comercial:** só **Gabriela** e **Karla** (mapa `CONSULTORES` no `58-frz-sync.js`; incluir outro = uma linha nova).
**Regras do sync:** só o **mês vigente** · `FECHADO`→PAGO, `ABERTO`→ABERTO, **PROJEÇÃO não entra** · espelho fiel (edita/apaga lá → reflete aqui) · id `frz_<id>` evita duplicar · valor vai cheio (a divisão de "C.I" pela metade é regra do gauge deles) · `und > 1` vira sufixo no produto ("MASTER COACHING ×2").
**⚠️ Segurança:** o login do HUD é client-side — usuário e senha de todos os consultores estão em texto claro no fonte da página, e a tabela aceita leitura anônima.

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
