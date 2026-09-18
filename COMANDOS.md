# 🗂️ Comandos do Projeto — Vitória (Sales Cube / MCP)

Todos os scripts `.ps1` ficam na raiz do projeto e rodam contra o **MCP Sales Cube**.
Sintaxe dos parâmetros: `[mês]` = nome ("junho") ou `-Periodo AAAA-MM`; `<nome>` = parte do nome do consultor.

---

## 📊 1. Faturamento / Vendas — Belém / Vitória
**Script:** `Faturamento-Vitoria.ps1` · **App:** aba Comandos (id `faturamento`, campo **Unidade**).

**Unidade:** `-Unidade VITORIA` (padrão, org 2) ou `-Unidade BELEM` (org 1). O seletor na tela **abre sempre em Vitória**, a unidade principal — a escolha não é lembrada, então Belém precisa ser marcado a cada vez. Usa o **token multi-unidade** (lido do `Lancar-Cliente.ps1`) e manda `organization_id` em toda chamada — o token antigo, só de Vitória, recusa. Vitória tem lista curada de consultores; **Belém entra sem filtro de responsável**, ou seja, aparece quem tiver venda ganha no período, e o `-Consultor` é aplicado sobre o que voltou.

| Comando | O que faz |
|---|---|
| `Faturamento Vitória [mês]` | Relatório completo da unidade (todos os consultores). Ex.: "junho" → `-Periodo 2026-06` |
| `Vendas Vitória [mês]` | Idem (sinônimo). Por padrão mostra só o **Resumo por consultor** (ranking) |
| `Vendas Vitória [mês] Detalhe` | Mostra a **tabela detalhada** de cada venda (Data \| Cliente \| Financeiro \| Valor) **+ as negociações do mês acopladas à direita** (Neg. Data \| Neg. Cliente \| Etapa \| Neg. Valor), separadas por ┃. Negociação = etapa 4 criada no mês; lado direito vazio quando o consultor não tem negociação. Inclui coluna **Anotação** (anotação **mais recente** do cliente via `list_opportunity_notes`, HTML limpo em texto simples; `-` se não houver). Título traz os dois totais (vendas + negociação) e o **Resumo** ganha as colunas **Negoc.** (qtd) e **Em negociação** (R$) |
| `Vendas Vitória <consultor> [mês]` | Filtra um consultor (ex.: "Gabriela") |

**🖼️ Ver card** — barra no topo do resultado, **igual à do comando 1D**, mais o botão ao lado de *Atualizar dados*; os dois abrem a mesma janela: transforma o **Resumo por consultor** em imagem — abre o modal de cards com uma barra **Modelo do card**, igual à do comando 1D: **📊 Tabela completa** (colorida, com zebra e TOTAL destacado) e **🪟 Janela** (o print preto e branco, só tons de cinza, `Consultor · Vendas · Bruto · Líquido`, quem não vendeu em cinza). Copiar imagem e Baixar PNG já vêm no modal. Os números vêm prontos no marcador `<!--FATVD:{…}-->`, então a imagem não recalcula nada. Prévia fiel em `_preview-card-resumo.html`, desenhada pelo mesmo `fvDrawCard`.

**Modificadores:** `por fechamento` (padrão) / `por faturamento` · exporta → `-Csv -Abrir`.
**Resumo por consultor:** O **número da coluna Vendas é clicável**: abre logo abaixo da linha o detalhe daquela pessoa — `Data · Treinamento · Cliente · Bruto · Líquido`, uma linha por venda, com os treinamentos em etiquetas (venda com vários produtos mostra todos) e o líquido em verde quando difere do bruto, sinal de Coaching Individual. Clicar de novo fecha; ordenar a tabela fecha também. Os treinamentos vêm do `list_opportunity_products` que o script **já chamava** para o cálculo do líquido, então **não há consulta a mais**; viajam no marcador oculto `<!--FATVD:{…}-->` lido pelo `renderFaturamento` do app.

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

## 🏫 1D. Leitura FRZ — Belém / Vitória (vendas da turma pelos 3 status)
**Script:** `Leitura-FRZ-Vitoria.ps1` · **App:** aba Comandos (categoria `🏫 FRZ Sistema`, id `leituraFrz`, campos **Unidade** (Belém / Vitória) + **Turma**).

| Comando | O que faz |
|---|---|
| `Leitura FRZ Vitoria` (padrão) / `Leitura FRZ Belem` | Abre na **turma mais recente** da unidade (maior `data_inicio`) e lista as vendas dela: `Data · Consultor · Aluno · Curso · Valor · Líquido · Situação` (líquido = coluna `liquidez` do FRZ; CI pela metade) |
| `-Cidade VITORIA` (padrão) · `-Cidade BELEM` | Unidade (praça do FRZ). Na tela é o seletor **Unidade**, que **abre sempre em Vitória** (a escolha não é lembrada) e recarrega a lista de turmas ao trocar |
| `-TurmaId <id>` | Uma turma específica |
| `-TurmaId todas` | Unidade inteira: uma linha por turma (`Negociação · Pago c/ entrada · Finalizado · Finalizado líq. · Vendas`) — bruto antes do líquido; o líquido é o do PAGAMENTO FINALIZADO |
| `-Consultor <nome>` | Só as vendas daquele consultor. Compara **sem acento e sem caixa**, então junta as grafias duplicadas da base ("NATÁLIA" + "Natalia" = as 31 vendas dela) |
| `-Status neg,ent,fin` | Só as situações listadas. Vazio (ou as três) = todas |
| `-Listar` | Catálogo de turmas + consultores de cada uma (com valor por situação) em JSON — alimenta o seletor e o ranking da tela (respeita `-Cidade`) |

Fonte: **frz-sistema-v2** (`https://frz-sistema-v2.vercel.app`) — mesmo Supabase do `Turma-Lancar-FRZ.ps1`, chave publishable, **leitura anônima e só leitura**. Lê `turmas` filtrando `cidade` = unidade escolhida (comparação sem acento: `VITÓRIA`/`BELÉM` no banco) e depois `vendas` por `turma_id`. Os três status vêm do próprio sistema: **NEGOCIAÇÃO · PAGO COM ENTRADA · PAGAMENTO FINALIZADO** (comparação por prefixo ASCII, para não depender de acento). Saída traz o marcador oculto `<!--FRZVIT:{…}-->` que alimenta os quatro KPIs do topo (os 3 status + conversão do funil) e o **card de imagem** (`renderFrzVit`/`drawFrzCard`) — Copiar imagem / Baixar PNG no mesmo modal dos outros cards. Rotas: `/api/cmd?id=leituraFrz&cidade=<VITORIA|BELEM>&turma=<id|todas>&consultor=<chave>&situacao=<neg,ent,fin>` e `/api/cmd?id=leituraFrzTurmas&cidade=<VITORIA|BELEM>`.

**Card Janela** (10/09/2026): o card de imagem do bloco **Clientes que fecharam** ganhou três modelos a mais no seletor, **🪟 Janela** (só título + tabela), **🪟 Janela + negociação** e **🪟 Janela + meta** — o "print" **preto e branco** da tabela de situação (`Situação · Linhas · Bruto · Líquido` com `PAGAMENTO FINALIZADO · PAGO COM ENTRADA · TOTAL`), só tons de cinza, sem barra nem gradiente. Título com a turma + praça + data. O primeiro acrescenta a linha **NEGOCIAÇÃO** em cinza abaixo do TOTAL (referência, não soma); o segundo fecha com **meta da turma · % pelo líquido · quanto falta** e grade vertical entre as colunas (meta = `itens[].meta` do FRZ; "todas" = soma). Sem "fonte" no rodapé, por pedido do usuário. Função `fcDrawJanela` no `index.html`; prévias em `_preview-card-janela.html` (escolhidas a 2, a 4 e a 5).

**Consumidor da outra vaga** (10/09/2026): no bloco **Clientes que fecharam**, quem fechou **2+ treinamentos** (o `×2` na lista) ganha **subtópicos com a mesma bolinha** do cliente, mostrando **quem ocupa cada vaga**. O FRZ guarda só `quantidade`; o nome vem do **ZS** (`beneficiary_name` de `/api/opportunity-products/?opportunity=N`) pelo script **`Consumidores-Vaga.ps1`** (raiz, só leitura), chamado pela rota `POST /api/consumidores-vaga` **depois** que o bloco já está na tela — a leitura não espera o ZS. Casamento: **pelo nome** (o CPF do FRZ vem quase sempre vazio), exigindo igualdade sem acento/caixa — homônimo vira aviso, nunca chute; e o **nome do curso do FRZ é igual ao `product_name` do ZS**, o que limita a busca aos treinamentos daquela leitura. Estados: consumidor definido · o próprio titular · vaga sem consumidor no ZS · cliente não encontrado/homônimo. **Todas** as vagas viram subtópico, inclusive as do próprio titular (em cinza), numeradas `v1 · v2` **por treinamento** — igual no desktop e no celular. Os botões **📋 Copiar nomes** e **📋 Com valores** saem no formato fixo definido pelo usuário em 10/09/2026: 1ª linha `TURMA - TIPO` em maiúsculas (o tipo vem do campo `tipo` da turma no FRZ, só o que vem depois do traço), 2ª linha `🎓` com os treinamentos abreviados (`CEOP - (4)`; `Coaching Individual` vira `CI - Alberto Freitas`), depois `NOME DOS NOVOS ALUNOS:` e a lista **numerada** `1 - Nome (SIGLA + SIGLA)` — cada aluno leva as **siglas dos treinamentos que fechou**, no mesmo formato da linha do consumidor. Sigla = o que vem antes do traço (`CEOP`, `FGPC`, `MASTER`, `BHP`, `Método CIS`), com `Coaching Individual` virando `CI`. Cada cliente leva os consumidores junto, em sub-linha `↳ Nome (CURSO + CURSO)`, **sem duplicidade**: cada pessoa sai uma vez só na lista inteira — nem o mesmo consumidor em dois treinamentos, nem quem já aparece como cliente. Os botões de copiar usam o caminho padrão do app (`mmCopiaVelha`, textarea + `execCommand`) quando não há secure context — **no celular o Meta Master roda em `http://IP:8765` e o navegador nem expõe `navigator.clipboard`**, então sem esse fallback o botão falha calado. No celular os três botões ocupam a linha inteira, com a mesma largura. Depende do `sc-web-auth.json` (gitignored).

**Card Janela — corte por produto** (11/09/2026): abaixo do TOTAL o card mostra mais duas linhas, **GGB · treinamentos** e **CI · Coaching Individual**, que **recortam o mesmo TOTAL** (não somam a ele). CI é o Coaching Individual, único produto que entra pela metade no líquido; GGB é todo o resto. Saem de `FRZVIT.vendas` filtrando as situações que o card soma (finalizado + pago com entrada), então fecham com o TOTAL exatamente. Vale nas três variantes: Janela, Janela + negociação e Janela + meta.

**Filtros na tela** (proposta 7 escolhida em 27/08/2026): abaixo do seletor de turma vêm os **chips de situação** e o **ranking de consultores** (linha com barra proporcional ao valor, clicável). Nos dois, **nada selecionado = todos** — clicar de novo no consultor já marcado volta para todos. O ranking obedece aos chips: marcando só "Negociação", ele soma e reordena por quem tem mais em aberto, e quem não tem venda naquela situação some da lista. Os KPIs do topo esmaecem as situações fora do filtro, para o zero não ser confundido com ausência na base.

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

**Pipeline em R$ também é só da campanha** (11/09/2026): `pipeNegoc`/`pipeVenda` (hashes `$pipe4`/`$pipe5`) eram o **único laço do backend sem filtro de campanha** — o relatório mostrava `R$ 10.990,46 · 2 negociação(ões)`, valor de 3 oportunidades ao lado de uma contagem já filtrada. Corrigido com o mesmo `Cidx` do resto do arquivo. Efeito: Gabriela R$ 10.990,46 → **R$ 3.994,00**; Natalia R$ 65.994,00 → **R$ 1.997,00** (era 33× maior); pipeline de vendas zera para quase todos, coerente com o "Vendas CIS 0" do card. Critério: **só campanha, sem filtro de produto**. Junto foram corrigidos os 6 cliques do modo **Movimentação** da tabela (abriam a carteira inteira) e os textos que viraram mentira quando a base mudou — "carteira inteira", "de qualquer origem" e sobretudo `rgcForaCamp`, que hoje mede **venda da campanha com outro produto**, não venda fora da campanha (renomeada para `rgcOutroProduto`).

**Trabalhado exige anotação do PRÓPRIO responsável** (11/09/2026): o lead que continua na etapa 1 só conta como trabalhado se a anotação for de quem é dono dele. Nota escrita por outro consultor — típico de **lead transferido** — não conta, e o lead fica em Leads parados. O `list_opportunity_notes` já devolve `author_name` e `author_user_id` na mesma resposta que o script buscava e descartava, então o custo de rede é **zero**; a comparação é igualdade exata contra `assignee_user__name`, que vem do mesmo sistema no mesmo formato. Efeito medido em set/2026: de 10 leads assim, **7 tinham anotação de outra pessoa** — Natalia caiu de 5 para 1, Heverton de 2 para 0, Gabriela de 3 para 2, e o empate Gabriela × Natalia em 55 virou 54 × 51. ⚠️ Consequência esperada: quem **recebe** carteira transferida aparece com parados alto até tocar os leads.

**Padrão de abertura dos consultores** (12/09/2026): o chip **📌 Salvar padrão**, ao lado de "Todos", grava quem já vem marcado ao abrir a página. Guarda **nomes**, não índices, para não quebrar quando alguém entra ou sai da equipe (`mm_conv_preset`). Com padrão salvo o chip fica verde e o clique remove, voltando à regra automática de carteira mínima.

**Quebra por etapa clicável no drill** (12/09/2026): no cabeçalho da lista de leads, cada etapa (`3 Conversa: 20`) virou botão e filtra a lista **na hora, sem ir ao servidor** — não muda período, consultor nem campanha do recorte. Clicar na etapa ativa, ou no ✕, volta a todas. Os números da quebra contam sempre a lista completa, então não mudam ao filtrar; o cabeçalho passa a mostrar "N de TOTAL".

**Quebra por etapa na linha Trabalhados** (11/09/2026): a linha **💼 Trab.** traz, na própria linha, `1✎:3 · 2:1 · 3:20 · 4:2 · 5:0 · 6:29`, que **soma exatamente** o número exibido (`trab = etapas 2..6 + etapa1ComNota`). O `1✎` **não é a etapa 1**: são os que estão nela e já têm anotação — a etapa 1 crua tem 42 — e o clique usa o recorte `e1nota` do `LD_RECORTE`. A **etapa 5 fica apagada** porque é zero por construção (a venda vira outra oportunidade e sai do funil). A **etapa 6 é destacada em roxo**, a cor dela, nunca em vermelho: descartar rápido quem não é perfil é bom trabalho. Cada número abre a lista filtrada por etapa e campanha; sem percentual quando há menos de 5 trabalhados, e "nenhum trabalhado ainda" quando é zero. Foi o que revelou Gabriela e Natalia com os mesmos 55 trabalhados, mas 29 contra 6 na etapa 6.

**Taxa de Conversão por consultor — TUDO é da campanha vigente (AA1, a do Método CIS).** Regra do usuário, 11/09/2026: a seção inteira mede o aproveitamento da campanha, então **Total, Trabalhados, Leads parados, Em negociação, Vendas CIS, Treinamentos e Aproveitamento** contam só leads dessa campanha — antes só o numerador era filtrado e o card se contradizia ("Vendas CIS 0" ao lado de "Treinamentos 6"). O backend manda o recorte pronto por consultor (`etapasCamp`, `totalCamp`, `etapa1ComNotaCamp`, `etapa1NotaIdsCamp`, `negCamp`), cruzando consultor × etapa × campanha; **todo clique abre a lista já filtrada**, para número e lista nunca divergirem. Vale igual nos **cards**, na **tabela**, no **funil** e nos **dois relatórios**. No **individual**, a lista de leads das seções de recuperação e oportunidades passou a pedir `campanha=camp`; no **consolidado**, o histórico dos 3 meses anteriores passou a resumir pelo recorte da campanha (a chave do cache virou `mm_rcc_histc_*` para não reaproveitar número velho). ⚠️ A campanha AA1 começou em setembro/2026: nos meses anteriores a carteira dela é **0**, então a evolução mostra zero antes e o mês atual cheio — é o dado, não um erro. JSON antigo, sem os campos, cai nos números gerais como antes.

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

## 🧠 6C. Pesquisa Socioeconômica — Relatório Estratégico da Turma
**Script:** `Pesquisa-Socioeconomica.ps1` (raiz, sem token/MCP — só baixa o Sheets público) · **App:** aba Comandos, categoria `📚 Leitura de Turma` (card `pesqSocio`, rota `/api/cmd?id=pesqSocio`).

Monta o **pacote** (padrão de análise + contexto + bases) para colar numa IA, que devolve o Relatório Estratégico da Turma + PDF. **Não** gera o relatório sozinho.

| Comando | O que faz |
|---|---|
| `Pesquisa Socioeconômica <link>` | Lê a planilha de respostas e devolve resumo + amostra + **pacote pronto** para a IA |
| `-Produto "<produto da turma>"` | **Regra R1:** o ICP muda com o produto. Sem isso a IA declara a premissa na capa em vez de assumir pelo nome da turma |
| `-Praca "<unidade>"` | Praça da turma (padrão do app: Vitória) |
| `-LinkMapa "<link>"` | Passo 2 opcional: Mapeamento da Turma (ADQUIRIDO × PENDENTE) — impede indicar o que a pessoa já comprou |

**Padrão de análise v3 (ICP)** — vive no `$PROMPT` do script, é a única fonte:
- **10 regras invioláveis (R1–R10)**: confirmar o produto antes de analisar · nunca analisar resumo · declarado ≠ inferido · objeção só do campo de receio · propensão ≠ capacidade · fila ≠ ranking · nada de fragilidade no palco · sem tabela de preços não há projeção de receita · nenhuma oferta sem checagem no CRM · seção de limites obrigatória.
- **Score em duas medidas:** `PROPENSÃO = 0.30·VOC + 0.30·ATR + 0.20·VIN + 0.20·NOT` e `TICKET = 0.45·F + 0.25·M + 0.30·S`, multiplicadas só no fim (`VE = P × T / 10`, faixa de indiferença 0,5). Nota reescalada (8→0, 9→5, 10→10).
- **10 etapas:** verificação da base · maturidade declarada × inferida · vocação/aderência · score · fila por linha de produto · objeções · munição de palco · cadeia de indicação · decisões (`D<n> | decisão | dono | prazo`) · limites.
- **Saída:** PDF A4 navy/gold, 10 seções fixas, capa sem marca de produto; conversão por **Edge headless**.

**Pré-agregado pelo script** (vai no pacote como `# VERIFICAÇÃO DA BASE`): total de respostas, **janela de coleta** (início → fim, min, s/resposta — alimenta o teste de viés) e aviso quando a planilha vem **sem linha de cabeçalho** (formulário FRZ), caso em que todas as linhas contam como respondentes — antes a 1ª pessoa virava cabeçalho e sumia da contagem.

**Conferência do tipo de cada link** (15/09/2026): cada planilha é classificada pelo **conteúdo**, nunca pelo nome — **Mapeamento** quando tem ≥5 células `ADQUIRIDO`/`PENDENTE` e elas são ≥20% das preenchidas; **Pesquisa** quando não tem cabeçalho (padrão FRZ), tem pergunta terminando em `?`, "Carimbo de data/hora", ou metade das linhas com data. O que o script faz com isso:

| Situação | Ação |
|---|---|
| Mesmo link nos dois passos | ⛔ bloqueia |
| Mapeamento no Passo 1 + Pesquisa no Passo 2 | 🔁 **troca sozinho** e avisa no resumo e no pacote |
| Mapeamento no Passo 1 (sem Pesquisa no 2) | ⛔ bloqueia dizendo o que colar |
| Pesquisa no Passo 2 | ⛔ bloqueia |
| Tipo não identificado | ⚠️ segue com aviso — nunca bloqueia (planilha antiga fora do padrão) |

O bloqueio sai com `exit 0` de propósito: com `exit 1` o `/api/cmd` devolveria 500 e o app mostraria "Falhou:" com o markdown cru. O resumo mostra a **identidade de cada base** (ID curto, abas, colunas e tipo detectado) — é por ele que se enxerga um link trocado. **"Dado preso" nesse comando nunca foi cache:** era um Mapeamento colado no Passo 1, que antes passava como se fosse a Pesquisa.

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
**Script:** `Conferir-Pipeline-ZS.ps1` (raiz) · **Gatilho:** `Pipeline x ZS` (equipe) · `Pipeline x ZS <consultor>` · `Pipeline x ZS atualizar` (mesma coisa, só reforça que é para reler tudo)

| Comando | O que faz |
|---|---|
| `-Consultor Heverton` | Bate HUD × ZS do mês vigente: as duas listas, o que só existe de cada lado e o total real |
| `-Consultor Natália -Periodo 2026-07` | Mesmo batimento em outro mês |
| `-Todos` | Equipe Vitória (Gabriela · Karla · Natália · Heverton Leonardo) |
| `-Csv` | Exporta as duas listas pareadas para CSV no %TEMP% |
| *(sem parâmetro)* | Lista as grafias de consultor existentes no HUD |

### 📐 FORMATO DA RESPOSTA (fixado em 18/08/2026 — seguir sempre)

**1. Tabela-resumo** com uma linha por consultor + **linha de TOTAL**, colunas: `HUD (líquido) · ZS bruto · ZS líquido · Pendências`. Abaixo dela, o **faturamento real da equipe** e a prova da conta (`HUD − pendências = ZS líquido`).

**2. Uma seção por consultor, com TUDO** — nunca resumir. Para cada um: tabela completa do HUD (todas as linhas, coluna `No ZS?`), tabela completa do ZS (todas as linhas, coluna `No HUD?` **e o link da venda em cada linha**) e as projeções em tabela à parte. **Todas as tabelas em ordem de VALOR decrescente**, não por data.

**3. Bloco "O que parece divergência e está certo"** — venda agrupada no ZS (CI+IF, IF+CEOP, CI+BHP) e matrículas de R$ 0,00.

**4. 🔴 PENDÊNCIAS por último**, em tabela única **agrupada por consultor** (ordem alfabética; dentro do consultor, por valor decrescente), com colunas consultor · data · aluno · curso · valor · ação · **link da venda**.

**5. 🛠️ Menu numerado de correções que EU consigo executar** — coluna `#`, por consultor e cliente. O usuário responde só com os números e eu executo. Entram: fechar como Ganho, trocar assignee, corrigir valor/nome/data/curso no HUD, unificar grafias. Não entram: lançar venda inexistente ou decidir valor divergente.

**6. Bloco copiável** (```) com as pendências agrupadas por consultor, uma linha por item com data · aluno · curso · valor · link — só para quem TEM pendência.

**7. Depois de aplicar qualquer correção do menu, RODAR O `-Todos` DE NOVO** e entregar o relatório completo já atualizado (fixado em 19/08/2026). Entre duas leituras o ZS muda sozinho: venda nova do dia, troca de responsável, oportunidade fechada por outra pessoa. Confirmar "aplicado" em cima de números velhos engana.

**8. FECHAR SEMPRE COM O `⟳ Sincronizar FRZ`** (fixado em 19/08/2026). Todo `Pipeline x ZS` termina rodando `Sincronizar-FRZ.ps1 -Aplicar` — o mesmo que o botão do app faz, só que pelo terminal. Sem isso a Pipeline Comercial fica com o quadro velho: lançamento novo no HUD não aparece e venda que trocou de dono continua duplicada dos dois lados. Antes dele, se mexeu em venda do Pablo, rode `Sync-Extraclasse-ZS.ps1 -Aplicar` — o sync lê o EXTRACLASSE daquele arquivo, e um arquivo velho **ressuscita** a venda que saiu do Pablo.

**O Pablo entra pela Turma FRZ × ZS**, não pelo HUD — ver a memória `feedback_pablo_sem_pipeline`.

**Regras:**
- **PROJEÇÃO fica fora da conta.** No HUD, projeção é negociação, não faturamento — comparar com o ZS só `FECHADO`/`ABERTO`, senão a "divergência" vira ruído de pipeline futuro. A projeção sai numa tabela à parte.
- **Pareamento = valor igual + nome compatível.** Valor sozinho **não** é prova (duas pessoas fecham o mesmo preço de tabela o tempo todo): quando só o valor bate, a linha sai como **⚠ duvidosa**, nunca como casada. Foi o que separou `Iasmin Brambilla` de `Kamila Barbara`, ambas R$ 1.997,00 em 04/08.
- **Nome:** o HUD guarda nome curto (`MAIKEL SILVA`, `SABRINA`) e o ZS o completo (`Maikel Da Silva Simão`). Casa por **token de 4+ letras em comum**, ignorando sobrenomes genéricos (Silva, Souza, Santos…) — resolve `Stéfany Godoy` × `Sté**ph**any Godoy` e `STÉFANY KUBIT` × `Sthefany Kubit Teixeira`.
- **Sem `data_iso` no HUD** entra no total, mas sai marcado: nenhuma sincronização enxerga esse lançamento.

**⚠️ PEGADINHAS (as duas custaram caro):**
1. **Acento quebra o `ilike`:** `consultant=ilike.*natal*` devolve **zero** para "Natália" — e zero parece "consultora sem vendas", não erro. O script lê as grafias reais do HUD e casa por nome normalizado.
2. **`$_` é sobrescrito:** chamar uma função que usa pipeline **dentro** de um `Where-Object` corrompe o `$_` do bloco externo (o pareamento dava 0 sempre). Calcular em variáveis antes e usar `foreach`, não `Where-Object`.

**⚠️ O QUE O SCRIPT NÃO ENXERGA (completar sempre por fora, via API REST):**
- **O script só lê Vitória (org 2).** Venda em **Teresina (org 3)** não aparece — somar à mão no ZS bruto do consultor. Acontece direto com TCE TOUR PV.
- **"Falta lançar no ZS" quase nunca é isso:** a oportunidade existe em `outcome=negotiating` na etapa "5. Venda Feita/Convertido". A ação é **fechar como Ganho**, não lançar. Confirmar um a um por `/api/opportunities/{id}/` antes de escrever a pendência.
- **Fechar como Ganho pela API:** `PATCH /api/opportunities/{id}/ {"outcome":"won"}` funciona em Vitória; **em Teresina reverte sozinho** em minutos — esses ficam fora do menu de correções (ver `reference_fechar_ganho_api_zs`).
- **IDs de oportunidade não são globais:** o mesmo número existe em orgs diferentes com clientes diferentes. Sempre conferir o nome do cliente ao montar o link.
- **Cliente do HUD com nome truncado/apelido** ("Meia Nathalia", "Jonas/ Daniela 5586999791999") — procurar no ZS pelas oportunidades recentes do consultor, não só pelo nome.

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
| `-Vagas "<cpf>[,<cpf>]"` | **Vagas extras** da mesma venda: cada CPF entra na MESMA turma por **R$ 0,00**, com o seu consumidor. O titular fica com o valor cheio. Só vale junto com `-Venda` |
| `-Acao cadastro` / `-Acao cadastro -Aplicar` | **Etapa 2 — clientes.** Cria quem não existe e completa só campo vazio (via `Ponte-ZS.ps1`) |
| `-Acao vendas` / `-Acao vendas -Aplicar` | **Etapa 3 — vendas.** Oportunidade + produto + pagamento + anotações + fecha como ganha |
| `-Acao status` | Testa Salesforce, Zsales e API web antes de começar |
| `-Abrir` | Abre a prévia HTML no navegador |
| `-Rodada <arquivo.json>` | Usa uma rodada específica (por padrão, a mais recente) |

**Regras do lançamento (definidas em 12–13/08/2026):**
- **⚠️ SEMPRE perguntar se a venda tem vaga extra** (04/09/2026). Venda do SF pode ser de **duas ou mais vagas**: o titular paga tudo e as vagas secundárias entram na **mesma turma por R$ 0,00**, cada uma com o seu consumidor. **O Salesforce não sabe disso** — o pedido tem um item só e a segunda pessoa às vezes nem existe como cliente lá —, então a informação só chega pela consultora. Perguntar **antes** de aplicar a etapa 3 e passar os CPFs em `-Vagas`. Cada CPF precisa já estar cadastrado no ZS da unidade; se não estiver, a prévia bloqueia com o motivo. A vaga do titular é criada primeiro de propósito: o `create_opportunity_product` recusa consumidor já associado à mesma turma.
- **Nome da oportunidade = nome do cliente**, sem prefixo de turma.
- **Valor = só o que entrou pelo CISPay.** O **cashback fica fora** do produto, do valor e dos pagamentos — vira a 2ª anotação com o link do registro no SF.
- **Pagamento:** `Cartão de crédito`/`PIX` + instituição **BCO ITAUBANK S.A.** + gateway **CISPay** + data do SF; parcelas no protocolo (`4x`) **e no campo Parcelas**.
- **⚠️ Parcelas são sempre conferidas** (02/09/2026): o `create_payment` do MCP **não tem** o campo `installments` — só `protocol` —, então todo pagamento nasce **1x** mesmo com "12x" no protocolo. O script agora grava as parcelas por `PATCH /api/payments/{id}/` na API web, **relê o pagamento para provar que pegou** (até 2 tentativas) e mostra o selo (`12x`) na linha de cada venda. O que não bater sai em **⚠ PARCELAS DIVERGENTES** no resumo, com o id do pagamento para corrigir na mão. A conferência acontece **antes** de fechar a venda, porque um PATCH em `payments` derruba o `outcome` da oportunidade para `negotiating`.
- **Anotação:** texto fixo + link da venda no SF + um bloco por forma de pagamento, campo a campo (layout da tela "Forma de Pag. Venda").
- **Responsável:** a venda herda o do cliente; cliente novo nasce com o `responsavel_padrao_id` do config.
- **Turma:** resolvida automaticamente (`FCIS31` → "FCIS 31 - 1º Módulo"); havendo módulos, usa o 1º; se ficar ambígua, **bloqueia** e você resolve no `config.json`. Quando a sigla muda entre os sistemas, use o de-para `siglas` do config — é o caso de `CIS-GL252` (SF) = `MCIS 252` (ZS), produto *Método CIS - Global* (262).
- **Venda que não existe no SF** (só comprovante, ex.: link da Rede): o script não cobre — o lançamento é manual, com `gateway: Rede` e a anotação montada a partir do comprovante, que vai anexado à oportunidade.
- **Anti-duplicidade:** consulta as vendas do cliente na API web; quem já tem venda com o mesmo valor ou a mesma turma é pulado. Rodar duas vezes não duplica.
- **Sem endereço no cliente o ZS recusa fechar** — a venda fica lançada e **aberta**, e aparece no resumo com o link.

**Config:** copie `config.exemplo.json` para `config.json` (org, responsável padrão, instituição/gateway, de-para de turmas). O `config.json` e a pasta `previas/` são gitignored.

---

## 🔗 10F. Pegar link SF (link de pagamento para o cliente)
**Script:** `Pegar-Link-SF.ps1` · **Gatilho:** `Pegar link SF` · **App:** aba Comandos, categoria `🔗 Links de pagamento` (painel próprio `lkPanel`, rota `/api/link-sf`)

Reproduz o painel **Links** do Salesforce Lightning (a barra inferior → *Selecionar unidade* → ofertas disponíveis → *Copiar link*), só que no terminal e já com o link montado.

**Fluxo em 3 passos** (para não despejar 177 links de uma vez):
1. `Pegar link SF` → **tabela dos clusters numerados**: `# | PRODUTO | OFERTAS | ONDE` (um por linha, a unidade primeiro). Só código de produto e contagem — nada de link.
2. Você diz o número do produto → `-Cluster <n>` abre as **ofertas numeradas** daquele cluster (# · oferta · valor), renumeradas de 1 a N.
3. Você diz o número da oferta → `-Item <n>` devolve **só aquele link**, em bloco copiável.

Cada listagem regrava a numeração no cache, então `-Cluster` e `-Item` sempre se referem à última lista mostrada.

`-Detalhar` abre todas as ofertas de todos os clusters de uma vez (árvore completa `tipo > produto > ofertas`).

A numeração (clusters e ofertas) fica em `%LOCALAPPDATA%\MetaMaster\pegar-link-ultima.json`.

| Comando | O que faz |
|---|---|
| `Pegar link SF` | Tabela dos **clusters numerados**: produto + quantidade de ofertas |
| `Pegar link SF cluster <n>` | Abre as ofertas numeradas daquele produto → `-Cluster 2` |
| `Pegar link SF produto <código>` | Idem, chamando pelo código → `-Produto BHP` |
| `Pegar link SF <n>` | Link pronto da oferta `<n>` da última listagem → `-Item <n>` |
| `Pegar link SF <texto>` | Filtra pelo **nome da oferta** → `-Busca "BHP"` |
| `Pegar link SF só da unidade` | Só as ofertas criadas pela própria unidade → `-Escopo unidade` (`rede` = só globais) |

**Como o link é montado** (idêntico ao botão *Copiar link* da tela):

```
<LinkOriginalCheckout__c>?utm_sellerId=<Id do usuário SF>
                         &utm_sellerId_check=<MD5 do Id>
                         &utm_source_enc=<Base64 da origem do lead>
```

- **Origem do lead** = o modal *Selecionar origem do lead* da tela. Padrão fixo do comando: **`Cliente Base`** (→ `Q2xpZW50ZSBCYXNl`). Trocar com `-Origem "<valor da picklist Lead.LeadSource>"`.
- **Unidade** = `User.N_da_Coligada__c`, gravado pelo *Selecionar unidade* do Lightning. Hoje: **84 = FEBRACIS VITORIA 2**. Forçar com `-Coligada 84`.
- **Vendedor** = usuário SF da sessão (`sf-creds.xml`). Trocar com `-Vendedor <Id do User>`.

**Saída do `-Item`:** cabeçalho com oferta · valor · unidade · origem, e abaixo o **bloco copiável só com o link** (nada de descrição dentro do bloco — o que se copia é exatamente o que se cola). `-Copiar` joga esse bloco direto na área de transferência.

**No Meta Master:** o painel faz **uma só chamada** (`/api/link-sf`, que roda o script com `-Json`) e recebe clusters + todas as ofertas com o link já montado — clicar em produto/oferta não volta ao servidor. Campos: **Origem do lead** (padrão `Cliente Base`) e **Escopo**. Ao abrir um produto, a lista de ofertas vem com **campo de busca** ao lado do título (ignora acento e caixa; casa também com o valor, ex.: `1300`) e o contador passa a mostrar "N de M". A oferta escolhida abre uma caixa com o link em `<textarea>` + **Copiar link** e **Abrir checkout**.

**Fonte:** `CheckoutCispay__c` (ativos, com link) + `ProdutoCheckoutCispay__c` para o código do produto. `Global__c = true` → *Rede Febracis*; `false` → *Minha unidade*. **Só leitura** — o script nunca escreve no SF. `-Json` para o app.

---

## 💰 11. Tabela de Preços (valores dos treinamentos)
**Script:** `Tabela-Precos.ps1` (raiz, **sem rede** — dados fixos) · **App:** aba Comandos (categoria `💰 Preços`, id `tabelaPrecos`, campo **Curso**) · **Rota:** `/api/cmd?id=tabelaPrecos[&curso=<sigla ou nome>]`

| Comando | O que faz |
|---|---|
| `Tabela de Preços` | **Consolidado:** os 11 treinamentos com `De · À vista · 12x · Total em 12x · Vigência`, mais a tabela de **Reciclagem** (50% do valor de tabela) e as notas |
| `Tabela de Preços <curso>` | **Grade completa de 1x a 12x** daquele treinamento: `Parcelas · Desconto · Total · Valor da parcela` + a linha de reciclagem. Aceita a **sigla** (`BHP`) ou pedaço do nome, sem acento e sem caixa (`oratoria`, `gestao de negocios`) |
| `-Json` | Só o objeto (11 cursos × grade de 12) — para conferência e uso futuro do app |

**📤 Repassar ao consultor** — no app, acima do resultado: **📋 Copiar texto** (markdown inteiro, para colar no chat). E **🖼️ Copiar imagem** em **cada tabela**, no canto direito dela — o consolidado responde com *NOVOS ALUNOS*, *RECICLAGEM* e as Notas juntas, e quem repassa manda uma só. A foto leva o título da seção e a tabela inteira (mesmo quando ela rola na tela); o fundo acompanha o tema e o PNG sai nomeado pela seção (`precos-condicao-novos-alunos.png`).

**Os valores são FIXOS no script** (bloco `$PRECOS`), extraídos da planilha da rede em **11/09/2026**. O comando não acessa a planilha nem o Sales Cube, então responde na hora e funciona offline — **mudança de preço é edição manual** deste arquivo. Planilha de origem: `https://docs.google.com/spreadsheets/d/1oVKOZfYd17baiceSdTGi5UkE-Xvnr-Rua7Vk-zZ77Zc/edit`.

| # | Treinamento | Sigla | De | À vista | 12x | Total em 12x | Reciclagem (12x) | Vigência |
|---|---|---|---|---|---|---|---|---|
| 1 | Formação em Coaching | **FCIS** | R$ 10.796,49 | R$ 8.997,00 | R$ 899,71 | R$ 10.796,49 | R$ 5.398,25 (R$ 449,85) | 20/01 a 20/12/2026 |
| 2 | Master Coaching | **MASTER** | R$ 7.796,47 | R$ 6.497,00 | R$ 649,71 | R$ 7.796,47 | R$ 3.898,24 (R$ 324,85) | Até 31/12/2027 |
| 3 | ML5 - Formação de Líderes | **ML5** | R$ 7.196,46 | R$ 5.997,00 | R$ 599,71 | R$ 7.196,46 | R$ 3.598,23 (R$ 299,85) | Até 31/12/2027 |
| 4 | Formação em Gestão de Pessoas c/ Perfil Comportamental | **FGPC** | R$ 5.996,45 | R$ 4.997,00 | R$ 499,70 | R$ 5.996,45 | R$ 2.998,23 (R$ 249,85) | Até 31/12/2027 |
| 5 | Comunicação Eficaz e Oratória Persuasiva | **CEOP** | R$ 5.996,45 | R$ 4.997,00 | R$ 499,70 | R$ 5.996,45 | R$ 2.998,23 (R$ 249,85) | Até 31/12/2027 |
| 6 | BHP - Gestão de Negócios | **BHP** | R$ 5.996,45 | R$ 4.997,00 | R$ 499,70 | R$ 5.996,45 | R$ 2.998,23 (R$ 249,85) | Até 31/12/2027 |
| 7 | Inteligência Financeira | **IF** | R$ 3.596,40 | R$ 2.997,00 | R$ 299,70 | R$ 3.596,40 | R$ 1.798,20 (R$ 149,85) | Até 31/12/2027 |
| 8 | Planejador Estratégico na Prática | **PE** | R$ 13.753,02 | R$ 9.164,09 | R$ 916,42 | R$ 10.997,01 | — | 20/01 a 20/12/2026 |
| 9 | Growth | **GV** | R$ 8.750,58 | R$ 5.830,80 | R$ 583,09 | R$ 6.997,02 | — | 20/01 a 20/12/2026 |
| 10 | Formação em Planejador Financeiro | **FPF** | R$ 5.998,50 | R$ 3.997,00 | R$ 399,70 | R$ 4.796,44 | — | 20/01 a 20/12/2026 |
| 11 | Técnica de Vendas | **TV** | R$ 2.997,00 | R$ 1.997,00 | R$ 199,70 | R$ 2.396,42 | — | Até 31/12/2026 |

Turmas: **Franquias** nos 11. **PE, GV, FPF e TV não têm condição de reciclagem.** Campanhas seguem o padrão `<SIGLA> - NOVOS ALUNOS - BRL` / `- RECICLAGEM - BRL` (exceção: **CEOP usa `FOP`**).

**Desconto por parcela** (idêntico nos 11): 1x = 16,67% · 2x = 13,00% · 3x = 11,75% · 4x = 10,49% · 5x = 9,22% · 6x = 7,94% · 7x = 6,64% · 8x = 5,34% · 9x = 4,02% · 10x = 2,69% · 11x = 1,35% · 12x = 0%. Menos parcelas, mais desconto. **Taxa CISPay: 2,923%.**

**⚠️ A grade de 1x a 12x é copiada linha a linha, nunca recalculada.** O percentual de desconto que a planilha mostra é arredondado: `De × (1 - desconto)` erra centavos (FCIS em 2x daria R$ 9.392,95 em vez de R$ 9.393,37). As 132 duplas (total + parcela) foram conferidas uma a uma contra a planilha — zero divergência.

**Divergências da planilha que o comando corrige (e informa no rodapé):**
- **BHP reciclagem:** a planilha traz R$ 499,70 na coluna 12x, que é a parcela do valor cheio e não fecha com o "Por" de R$ 2.998,23. O comando usa **R$ 249,85** (= Por ÷ 12), padrão dos outros seis.
- **PE e Growth:** a caixa de oferta desses blocos repete "12x R$ 399,70 / à vista R$ 1.997,00" (valores do FPF). O comando usa a **grade**, que fecha as contas.
- **SPLIT (só FPF):** 1x a 6x → *Vertuz 20%* · 7x a 12x → *Franquia 80%*.
- No título do bloco do PE a planilha grafa "Plan**je**jador"; o nome correto é **Planejador Estratégico na Prática**.

---

## 📋 12. Regras Comerciais (rotina por momento)
**Script:** `Regras-Comerciais.ps1` (raiz, **sem rede** — lê um arquivo) · **Gatilho:** `Regras Comerciais` · `Regras Comerciais <tópico>` · **App:** aba Comandos (categoria `📋 Regras`, id `regrasComerciais`, campo **Tópico**) · **Rota:** `/api/cmd?id=regrasComerciais[&topico=<n>]`

| Comando | O que faz |
|---|---|
| `Regras Comerciais` | **Menu numerado** dos tópicos (com a contagem de atividades de cada um) e pergunta qual você quer ver |
| `Regras Comerciais <tópico>` | Pula o menu: aceita o **número** (`3`) ou um **pedaço do nome**, sem acento e sem caixa (`negociacao`, `pos treinamento`) |
| `-Listar` | Força a listagem mesmo com `-Topico` preenchido |

**O conteúdo NÃO está no script — mora em `regras-comerciais.md` (raiz).** Essa é a fonte única: o chat e o app leem dela. **Adicionar tópico ou atividade é só editar esse arquivo** — não mexe em código, não reinicia o servidor, e o tópico novo aparece sozinho no seletor do app (o marcador repõe a lista a cada execução).

**Formato do `regras-comerciais.md`** (deliberadamente mínimo):
- `## <emoji> <Nome do tópico>` abre um tópico. O emoji é opcional e vai para o card de imagem.
- `- texto da atividade` é uma atividade, uma por linha.
- A ordem no arquivo é a ordem no menu e no card.
- Qualquer outra linha é ignorada — `###` não abre tópico (fica livre para subtítulo), e o cabeçalho explicativo do topo não atrapalha.

**Para que serve:** é a **base do gestor para repassar ao consultor**. Não é checklist marcável e não guarda estado. No app, o resultado vem com dois botões:
- **📋 Copiar texto** → título + atividades com `•`, formato de WhatsApp (sem Markdown, que o WhatsApp não renderiza). Passa por `mmCopiaTxt`, que funciona no celular em `http://IP:8765`.
- **🖼️ Copiar imagem** → card PNG (`drawRegrasCard`, 1040px) pelo `mmExportarPng`, com a cascata copiar → compartilhar → baixar → modal.

**Saída:** Markdown (título + atividades numeradas) + marcador oculto `<!--REGRAS:{modo,n,topico,emoji,itens[],topicos[],gerado}-->`, consumido por `renderRegras`. O campo `topicos[]` vem em **toda** resposta — é o que permite ao app popular o seletor sem uma segunda chamada.

**Detalhes:**
- Tópico inexistente **não é erro**: o script devolve a lista de tópicos e sai com **0** de propósito. Saindo com 1 o `/api/cmd` devolveria 500 e o app mostraria "Falhou:" em vez da lista, que é o que ajuda.
- A rota só aceita o **número** do tópico (`^\d{1,3}$`); o seletor do app sempre manda número. Busca por nome é só no terminal e no chat.
- `mdToHtml` ganhou suporte a **lista numerada** (`<ol class="md-ol">`) por causa deste comando — vale para qualquer comando agora.

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
