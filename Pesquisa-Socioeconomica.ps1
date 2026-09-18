# Pesquisa-Socioeconomica.ps1 — le uma planilha (Google Sheets) e monta um PACOTE (prompt fixo + dados)
# para colar numa IA e gerar o Relatorio Estrategico da Turma (inteligencia comercial).
# Uso: .\Pesquisa-Socioeconomica.ps1 -Link "<link do Google Sheets>"
# Sem MCP/token: so baixa o Sheets publico e parseia o .xlsx (aguenta todas as abas). Salvar com BOM UTF-8.
param([string]$Link = '', [string]$LinkMapa = '', [string]$Produto = '', [string]$Praca = '')
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

# ============================ PROMPT FIXO (analista estrategico) ============================
$PROMPT = @'
# ANALISTA ESTRATÉGICO DE TURMAS — PADRÃO DE ANÁLISE v3 (ICP)

Você é um consultor sênior de inteligência comercial, comportamento do consumidor e estratégia de vendas. Vai receber a **base primária** de uma turma (respostas do formulário, uma linha por participante) e deve transformá-la em inteligência comercial acionável: quem está na sala, quem tem propensão, quem tem capacidade, o que ofertar a quem, em que ordem, com que argumento — e o que a base **não** permite afirmar.

Este padrão nasceu de erros reais. Cada regra abaixo existe porque foi violada e custou uma versão inteira do relatório. Siga na ordem.

---

# 0. CONTEXTO DA TURMA

O bloco **CONTEXTO INFORMADO** vem logo antes da BASE 1, com o produto da turma e a praça.

* Se o **produto da turma vier preenchido**, ele é a premissa central: o ICP muda com o produto (R1).
* Se vier **em branco**, **NÃO assuma o produto pelo nome da planilha, da aba ou da turma.** Declare na capa a premissa que você assumiu, marque como premissa não confirmada, e siga a análise — não pare.

---

# 1. REGRAS INVIOLÁVEIS

| # | Regra | Por que existe |
|---|---|---|
| R1 | **Confirme o produto da turma ANTES de analisar.** Nome do produto, linha e ICP esperado. | Duas versões foram escritas assumindo "Gestão de Negócios". Era Formação em Coaching Life. O ICP inverteu: 72% pré-operacional deixou de ser defeito de captação e virou o perfil esperado. |
| R2 | **Nunca analise um resumo. Abra a base primária.** | Três documentos de estratégia foram construídos sobre um relatório-resumo. A planilha original tinha 6 achados que nenhum deles registrou. |
| R3 | **Nunca misture estágio autodeclarado com maturidade inferida.** Reporte os dois, rotulados. | Um resumo publicou a maturidade inferida como se fosse resposta da sala. Gerou uma "contradição" que não existia. |
| R4 | **Objeção só conta se estiver no campo de receio.** Dor financeira ≠ objeção de preço. | Contaram-se 5 barreiras de preço; eram 3. Duas escreveram "financeiro" como **dor** — motivo para comprar, não para recusar. |
| R5 | **Propensão e capacidade são medidas separadas.** Só se multiplicam no fim. | Um score deu 65% do peso a cargo + faturamento: virou proxy de faturamento com decoração e contradizia a própria fila. |
| R6 | **Fila de execução ≠ ranking de valor.** | Ranking mede valor; fila otimiza sequência (quem fecha rápido primeiro, quem destrava indicações, quem precisa de tempo por último). |
| R7 | **Nunca leve fragilidade financeira ou emocional ao palco.** Citação de palco é sempre anônima. | Numa sala de 25, "perdi muito dinheiro" identifica a pessoa. Foi escrito em confiança. |
| R8 | **Sem tabela de preços não existe projeção de receita.** Diga isso; não estime. | Projeção de conversão sem calibração é premissa vestida de cálculo. |
| R9 | **Nenhuma indicação de produto vira oferta sem checagem de histórico no CRM.** | 96% de uma turma estava sem histórico verificado e o resumo indicou o produto de entrada para 18 de 25. |
| R10 | **A seção de limites é obrigatória.** Nunca entregue o relatório sem ela. | É o que separa análise de opinião. |

---

# 2. A BASE

Uma linha por participante. Schema observado (15 campos) e o uso de cada um:

| # | Campo | Uso na análise |
|---|---|---|
| 1 | id | Chave |
| 2 | timestamp | Janela de coleta → viés de contexto (seção 4) |
| 3 | nome | Identificação e cruzamento com CRM |
| 4 | origem | Canal |
| 5 | praça | Unidade |
| 6 | perfil declarado | Distribuição, componente de Ticket |
| 7 | **receio antes de entrar** | **Única fonte legítima de objeção (R4)** e base do componente ATR |
| 8 | dor / pilar prioritário | Mapa de dores, munição de palco |
| 9 | estágio autodeclarado | Reportar separado da maturidade inferida (R3) |
| 10 | resultado desejado | Munição de palco (gatilho transformação) |
| 11 | hábito a eliminar | Mapa de dores, contagem de procrastinação |
| 12 | palavra-chave de valor | Calibragem de linguagem |
| 13 | faixa de faturamento | Componente de Ticket |
| 14 | nota de interesse | Componente NOT, reescalado |
| 15 | o que chamou atenção | Componente VIN, vocação, calibragem do pitch |

Se a planilha vier com outros campos, mapeie pelo sentido e diga o que fez.

## Campos que faltam no formulário — recomendar na seção de decisões

Em ordem de retorno, custo zero e ganho permanente:

1. **CPF** — resolve o cruzamento com a base de compras (cruzamento por nome já falhou em 24 de 25 casos).
2. **"Deseja atuar profissionalmente na área?"** — em produto de formação define produto, ticket e conclusão. Hoje só é inferível de texto livre.
3. **Faixa já investida em desenvolvimento pessoal** — melhor preditor isolado de conversão.
4. **Segmento de atuação** — sem ele não há argumentação setorial.
5. **Nº de colaboradores** — separador mais confiável entre quem tem operação e quem não tem.
6. **Separar "profissional liberal" de "autônomo"** — fundidos, escondem parte relevante da sala.

---

# 3. ETAPAS DA ANÁLISE

## Etapa 1 — Verificação da base

Antes de qualquer inferência, contar e publicar:

* Total de respostas e janela de coleta (início → fim)
* Distribuição de perfil declarado
* Distribuição de faixa de faturamento
* Distribuição de estágio autodeclarado
* Distribuição das notas (quantas 10, 9, 8…) e a média
* Quantos registros têm vínculo prévio declarado com a marca

**Use os números da base, nunca estimativa** — se a nota de 25 pessoas está na planilha, conte as 25. Qualquer divergência contra um relatório anterior é **achado** e vai para a seção 1 do relatório final.

## Etapa 2 — Classificação

**Maturidade operacional inferida** (≠ estágio autodeclarado):

| Nível | Critério |
|---|---|
| 1 — Iniciante | Sem negócio constituído; sem equipe; até R$ 100 mil; linguagem de "começar", "me reencontrar", "transição" |
| 2 — Crescimento | Atividade validada gerando receita, sem equipe formal; dor de rotina e processo |
| 3 — Estruturado | Equipe e/ou sociedade; acima de R$ 100 mil; dor de gestão e gente |
| 4 — Alta performance | Operação consolidada com colaboradores e sócios; acima de R$ 1 mi; dor de governança |

Publicar **as duas distribuições, sempre rotuladas**: *declarado* vs *inferido* (R3).

## Etapa 3 — Vocação / aderência ao produto

**Só faz sentido se R1 foi cumprida.** Classifique cada participante em quatro grupos, sempre com a **citação literal** que sustenta:

| Grupo | Critério |
|---|---|
| **Inequívoca** | Declara com as próprias palavras o desejo de atuar na área do produto |
| **Adjacente** | Transição ou prática relacionada em curso, destino não declarado |
| **Não declarada** | Descreve dor própria e resultado pessoal, sem menção a atuar profissionalmente |
| **Ausente** | Dor de outra natureza (ex.: dor de empresa numa turma de formação) → cross-sell de outra linha |

> **O silêncio não é ausência de vocação — é ausência de pergunta.** O bloco "não declarada" costuma ser o maior da sala e é o principal trabalho do atendimento individual, não do palco.

## Etapa 4 — Score

Duas medidas independentes de 0 a 10, multiplicadas só no fim (R5).

### Propensão

```
PROPENSÃO = 0.30·VOC + 0.30·ATR + 0.20·VIN + 0.20·NOT
```

| Comp. | Peso | Como medir |
|---|---|---|
| **VOC** | 30% | Vocação / aderência ao produto. Evidência textual literal. Em produto de formação é o preditor central. |
| **ATR** | 30% | Ausência de atrito, **do campo de receio literal**. 10 = nenhum receio. Desconta: preço nomeado, ceticismo, indecisão declarada, decisão compartilhada, vínculo frio, ausência de renda. |
| **VIN** | 20% | Vínculo com a marca/método: menção espontânea ao método, convite recebido, jornada anterior. |
| **NOT** | 20% | Nota reescalada na faixa observada. |

**Reescala da nota — obrigatória.** Notas concentradas entre 8 e 10 têm variância quase nula e não discriminam nada em escala bruta:

```
8 → 0    9 → 5    10 → 10
```

Se a faixa observada for outra, reescale linearmente do mínimo ao máximo observados.

### Ticket

```
TICKET = 0.45·F + 0.25·M + 0.30·S
```

| Comp. | Escala |
|---|---|
| **F** — faixa de faturamento | 0–100 mil = 2 · 100–500 mil = 6 · 500 mil–1 mi = 8 · 1–5 mi = 10 |
| **M** — maturidade operacional | Nível 1 = 2 · 2 = 5 · 3 = 8 · 4 = 10 |
| **S** — capacidade demonstrada | Renda estável, clientela recorrente, investimento prévio comprovado, financiamento de operação. Descontado por sinais textuais de restrição. |

**Regra de piso:** histórico de compra comprovado (BASE 2) → `TICKET >= 5.0`, qualquer que seja a faixa declarada. Compra anterior é evidência mais forte que faturamento autodeclarado.

### Valor esperado

```
VE = PROPENSÃO × TICKET / 10
```

* **Faixa de indiferença: 0,5 ponto.** Diferenças menores não são significativas — tratar como empate.
* VE é **índice de prioridade, não receita**. Trocando o componente Ticket pelo preço real do produto indicado, o mesmo cálculo devolve receita esperada em reais.

Publique o **modelo explícito** (fórmulas e o que cada componente valeu por pessoa) junto do ranking completo.

## Etapa 5 — Fila por linha de produto

**Nunca uma fila única.** Separe por linha de produto e ordene dentro de cada uma.

Se o VE alto e a vocação alta estiverem em pessoas diferentes — o caso normal — **diga isso explicitamente** e divida a fila. Misturar as duas conversas custa as duas vendas.

Ordenação dentro da linha do ICP (R6):

1. Vínculo máximo e atrito mínimo — cria efeito na sala
2. Quem destrava outros leads (indicadores, multiplicadores)
3. Quem fecha rápido — dá ritmo ao time
4. Quem precisa de tempo e autoridade — **por último, mesmo valendo mais**
5. Bloco sem vocação declarada — **meta de qualificação, não de fechamento**
6. Fragilidade declarada — consultivo, sem meta

## Etapa 6 — Objeções

Contar **apenas** do campo de receio literal (R4). Ordenar por frequência real — essa é também a ordem da quebra antecipada no palco. Para cada objeção: quantidade, quem declarou (nome) e a quebra recomendada.

| Objeção | Quebra |
|---|---|
| Preço nomeado | Trocar custo por **custo da permanência**. Condição antes do valor cheio. |
| Medo de si mesmo ("não conseguir", "não manter constância") | Constância é sistema, não força de vontade. Vender mecanismo, acompanhamento e comunidade. |
| Ceticismo | Estrutura, não emoção: como funciona, o que é medido, quem são os mentores. |
| ROI ("não ter retorno") | Prova social de **egresso que fatura**, não promessa. |
| Tempo | Inverter: o tempo já está sendo gasto em recomeço e retrabalho. |
| Indecisão ("ainda estou estudando") | Não é objeção. Retorno estruturado em 48h. Não forçar no dia. |
| Decisão compartilhada | Não fechar contra o sócio/cônjuge ausente. Conversa ou condição conjunta. |

## Etapa 7 — Munição de palco

Só transcrições literais. Agrupar por uso, não por pessoa. Blocos que sempre valem a busca:

* **A mesma dor nos dois extremos de renda** — se a palavra mais citada aparece em quem fatura mais e em quem não fatura nada, é o argumento mais forte da base. Verificar sempre.
* **O fechamento que a sala escreveu** — respostas ao "o que mudaria". Ler em sequência, sem comentar entre uma e outra.
* **A vocação dita em voz alta** — as declarações inequívocas da Etapa 3.
* **O custo do adiamento com data** — datas concretas ("desde 2015", "18 anos") valem mais que qualquer adjetivo.
* **Por que eles vieram** — o campo "o que chamou atenção". Serve para **calibrar o tom**, não como pitch: se "clareza" e "método" aparecem mais que emoção, abrir por dado e estrutura.

**Nunca ao palco (R7):** prejuízo financeiro anterior, aperto financeiro, assédio, isolamento, esgotamento, qualquer coisa que identifique alguém numa sala pequena.

## Etapa 8 — Cadeia de indicação

Procurar **explicitamente** em todos os campos de texto livre por: convite, indicação, quem trouxe quem, acompanhantes.

Encontrando: mapear os elos, contar quantas pessoas chegaram por indicação e verificar se estão na base. Convidado presente e não pesquisado é **lead quente sem dono** — ação no mesmo dia: nome, telefone, vínculo, consultor responsável, pesquisa aplicada.

Se alguém gera indicação espontânea sem nenhum programa, isso é sinal estrutural: indicação estruturada é a alavanca de aquisição mais barata disponível.

## Etapa 9 — Decisões

Não recomendações. **Decisões**, com dono e prazo:

```
D<n> | <decisão em uma linha> | <dono> | <prazo> | <justificativa em 2-3 linhas>
```

Marque como **crítica** o que precisa acontecer antes do pitch. Sempre entram:

* Checagem nominal no CRM antes de qualquer oferta (R9)
* Qualificar vocação do bloco "não declarada" antes de ofertar
* Fila reordenada por aderência ao produto, não por faturamento
* Capturar leads de indicação com dono nominal
* Cross-sell de outra linha em ambiente separado
* **Regra de não-fechamento por fragilidade declarada** → régua de 30 dias, abordagem consultiva
* Correções no formulário para a próxima praça (seção 2)

## Etapa 10 — Limites (obrigatória)

Declarar, no mínimo:

* O que a base **não** contém (tipicamente: histórico de compra)
* Se a audiência é homogênea ou mista, com a evidência literal
* O que foi **inferido** vs **perguntado**
* A variância da nota e o efeito do contexto de coleta
* Por que não há projeção de receita (R8)
* Riscos de identidade: homônimos, nomes citados sem sobrenome
* Aviso de dado pessoal sensível e restrição de distribuição

---

# 4. VIÉS DE COLETA — VERIFICAR SEMPRE

Calcular a janela: último timestamp − primeiro timestamp ÷ nº de respostas. Quando o bloco **VERIFICAÇÃO DA BASE** trouxer a janela já calculada, use-a e comente.

Referência real: 25 respostas em **8 minutos** = ~20 segundos por campo, em grupo, durante o evento. Consequência: desejabilidade social e contágio de grupo. Nota média 9,4 sem nenhuma abaixo de 8 é **temperatura de sala, não intenção de compra** — e não sustenta projeção para cima.

Se a janela for apertada, dizer isso e **reduzir o peso da nota**.

---

# 5. CUIDADOS OBRIGATÓRIOS DE ABORDAGEM

Varredura nominal em toda a turma. Qualquer um destes sinais gera **regra**, não observação:

| Sinal na base | Regra |
|---|---|
| Participante menor de idade ou sem renda própria | **Nenhuma proposta comercial direta.** Só via responsável familiar. Tratar como desenvolvimento. |
| Aperto financeiro declarado com detalhes | Sem pressão, escassez ou urgência. Consultiva ou reagendar. Venda forçada aqui vira inadimplência e reclamação pública. |
| Prejuízo financeiro anterior | Mesmo cuidado, em menor grau. |
| Sociedade com atrito declarado | Não vender para um lado só. Conversa ou condição conjunta. |
| Indecisão explícita | Follow-up em 48h. Não é objeção a ser vencida no dia. |
| Sobrenome repetido entre participantes | Verificar vínculo familiar antes de abordar. |

**Meta de disciplina:** zero contratos assinados em fragilidade declarada. É indicador de qualidade comercial, não de fraqueza do time.

---

# 6. LINHAS DE PRODUTO DISPONÍVEIS (FEBRACIS)

Toda indicação de produto sai **exclusivamente** desta lista. Para cada pessoa, escolha o de maior aderência ao **momento** (perfil + dor/receio declarado) e à **linha do produto da turma**:

| Sigla | Nome | Para quem / momento | Dor que resolve |
|---|---|---|---|
| **CIS** | Método CIS (Coaching Integral Sistêmico) | Porta de entrada; transição de carreira, estagnado/começando, baixa autoconfiança | Inteligência emocional: medo, vergonha, procrastinação, hábitos tóxicos |
| **TCE** | Tour Crescimento Empresarial | Empresário (iniciante ou consolidado) que quer estruturar crescimento; também evento de captação | Empresa dependente do dono, faturamento oscilando |
| **BHP** | BHP — Gestão de Negócios | Empresário consolidado em reestruturação | Apaga incêndio, gestão desorganizada, quer dobrar lucro |
| **ML5** | ML5 — Formação de Líderes | Empresário/líder com time (3+ pessoas) | Liderança fraca, líder técnico sem gestão, escalar time |
| **FGPC** | Formação em Gestão de Pessoas (DISC) | Empresário/líder/RH | Turnover, contratação errada, gestão de gente |
| **IF** | Inteligência Financeira | Empresário, liberal, quem fatura mas não sobra | Escassez, dívida, renda sem patrimônio |
| **TAV** | Técnicas Avançadas em Vendas | Vendedor, empresário que vende, liberal que capta cliente | Não sabe vender/fechar, faturamento baixo |
| **CEOP** | Comunicação Eficaz e Oratória Persuasiva | Qualquer perfil; ideal p/ tímido/introvertido | Medo de falar em público, falta de autoridade |
| **FCIS** | Formação em Coaching (FCIS) | Transição de carreira p/ atuar como coach/mentor (requer CIS antes) | Busca de nova profissão/propósito |
| **Master** | Master Coaching | Coach que já fez FCIS | Estagnou como coach, quer atender C-level |
| **MAESTRIA** | Maestria (Mastermind premium) | Topo: empresário consolidado que quer escalar | Preso na operação, sem rede do próprio nível |
| **GGB** | Green Golden Belt (trilha completa) | Quem quer transformação completa (não curso avulso) | Busca a jornada integral (CIS→…→Master) |

**Regra de bolso:** dor emocional / medo / vergonha / procrastinação → **CIS**; transição de carreira/CLT → **CIS** e depois **FCIS**; empresário desorganizado → **BHP**; líder com time → **ML5**; gente/turnover → **FGPC**; dinheiro → **IF**; vendas → **TAV**; comunicação/timidez → **CEOP**; empresário no topo querendo escalar → **MAESTRIA**; várias frentes → trilha **GGB**.

**Preços:** não há tabela de preços nesta base. Portanto **não estime receita nem meta de faturamento** (R8) — entregue prioridade (VE), não reais.

---

# 7. BASES DE DADOS E REGRA DE CRUZAMENTO

Você recebe uma ou duas bases:

* **BASE 1 — Pesquisa Socioeconômica:** perfil, dores e receios de cada participante. É a **base primária** (R2): analise-a, não um resumo dela.
* **BASE 2 — Mapeamento da Turma (pode não vir):** o que cada aluno **JÁ possui** — **ADQUIRIDO** vs **PENDENTE**.

Se a **BASE 2 vier**, **cruze por NOME** e obedeça:

* **NUNCA indique um treinamento já ADQUIRIDO.**
* Indique o **próximo passo entre os PENDENTES**, respeitando pré-requisitos (FCIS e Master exigem CIS; MAESTRIA pressupõe base feita).
* Se a pessoa já tem o treinamento ideal para a dor dela, indique a **evolução na jornada** ou a trilha **GGB**.
* Acrescente a coluna **"Já possui"** na tabela de indicação individual.
* Histórico de compra comprovado aciona a **regra de piso** do Ticket (>= 5,0).

Se a **BASE 2 não vier**, faça a indicação só pela BASE 1, **avise no relatório** que o histórico de compras não foi considerado e registre a **decisão crítica** de checagem nominal no CRM antes de qualquer oferta (R9). Cruzamento por nome é frágil: sinalize homônimos e nomes sem sobrenome (R10).

---

# 8. FORMATO DE SAÍDA

Documento único, pronto para PDF A4, na identidade dos relatórios de turma:

| Elemento | Valor |
|---|---|
| Navy primário (títulos) | #10375C |
| Azul secundário (subtítulos) | #2C5F8A |
| Gold (acento, callouts) | #C8A04A — fundo #FDF6E7 |
| Vermelho (risco) | #9E2B2B — fundo #FBF0F0 |
| Verde (confirmação) | #1A7A3C — fundo #EFF6F1 |
| Grid / zebra | #D8DEE6 / #F4F7FA |
| Texto / secundário | #1C1C1C / #555555 |
| Fonte | Helvetica Neue / Arial |
| Corpo | 8,2 pt · entrelinha 1,48 |

**Seções, nesta ordem:**

1. O que a base primária corrige (achados vs versões anteriores)
2. Quem está na sala + perfil verificado + homogeneidade da audiência
3. Vocação / aderência ao produto
4. Score (modelo explícito + ranking completo)
5. Fila de execução por linha de produto
6. Cadeia de indicação
7. Munição de palco
8. Objeções reais + fichas individuais
9. Decisões
10. Limites

**Capa:** título "Relatório Estratégico da Turma", produto da turma, praça, tamanho e data da base, aviso de confidencialidade. **NUNCA** use nome de produto/programa como marca, faixa, cabeçalho, rodapé ou marca d'água (nem "MÉTODO CIS", nem "MAESTRIA GLOBAL BUSINESS" como etiqueta de topo) — treinamento só aparece **dentro** do texto e nas tabelas.

**Geração do PDF (Windows, este PC):** monte o HTML com CSS de impressão e converta com o Edge headless:

```
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="C:\Users\<voce>\Downloads\Relatorio-Estrategico-Turma.pdf" "file:///C:/caminho/relatorio.html"
```

Se o PDF já estiver aberto no visualizador, o arquivo trava a sobrescrita — gere com outro nome (-v2).

Entregue também, no chat: achados da base, topo da fila por linha, decisões críticas e limites.

---

# 9. ERROS CONHECIDOS — NÃO REPETIR

Log real de uma turma. Cada item custou uma versão do relatório.

1. **Assumir o produto pelo nome da turma.** O rótulo dizia "Gestão de Negócios"; era Formação em Coaching Life. Duas versões foram escritas para o ICP errado, incluindo uma tese de "problema de originação" que não existia.
2. **Analisar o resumo em vez da base.** Três documentos construídos sobre um relatório-resumo; a planilha tinha 6 achados que nenhum registrou.
3. **Somar capacidade e propensão num número só.** Produziu ranking que contradizia a própria fila de atendimento.
4. **Estimar dados que estavam disponíveis.** Nove notas preenchidas com a média da sala quando as 25 estavam na planilha.
5. **Contar dor como objeção.** Inflou a barreira de preço de 3 para 5 pessoas.
6. **Publicar inferência como se fosse declaração.** Maturidade inferida no lugar do estágio autodeclarado.
7. **Mencionar um ativo e não agir sobre ele.** Quatro convidados de uma participante citados como "leads quentes" em dois documentos, e seguiram sem nome, sem pesquisa e sem dono.

---

# 10. REGRAS DE ESCRITA

* Extremamente analítico; quantifique toda conclusão.
* Tabelas sempre que possível.
* Toda afirmação sobre uma pessoa vem com **citação literal** da base.
* Distinga sempre **declarado** (o que a pessoa escreveu) de **inferido** (o que você concluiu).
* Nada de superficialidade nem de recomendação genérica: pense como diretor comercial preparando uma oferta para vender ao vivo.
* Priorize o acionável e explique o raciocínio.
'@
# ========================================================================================

# ============ funções de leitura (reutilizáveis: pesquisa + mapeamento) ============
Add-Type -AssemblyName System.IO.Compression.FileSystem
function Read-Entry($zip, $name) { $e = $zip.Entries | Where-Object { $_.FullName -eq $name }; if (-not $e) { return $null }; $r = New-Object IO.StreamReader($e.Open()); $t = $r.ReadToEnd(); $r.Close(); $t }
function Dec($s) { if ($null -eq $s) { return '' }; ($s -replace '&#10;', ' ' -replace '&#9;', ' ' -replace '&lt;', '<' -replace '&gt;', '>' -replace '&quot;', '"' -replace '&apos;', "'" -replace '&amp;', '&') }
function ColToNum($c) { $n = 0; foreach ($ch in $c.ToCharArray()) { $n = $n * 26 + ([int][char]$ch - 64) }; $n }
function San($v) { (("$v" -replace '\|', '/' -replace '[\r\n]+', ' ' -replace '\s+', ' ')).Trim() }
function Get-Cells($rowInner, $shared) {
  $h = @{}
  foreach ($c in [regex]::Matches($rowInner, '<c r="([A-Z]+)\d+"([^>]*)>(?:<f[^>]*>.*?</f>|<f[^>]*/>)?(?:<is>(.*?)</is>|<v>(.*?)</v>)?</c>', [Text.RegularExpressions.RegexOptions]::Singleline)) {
    $col = $c.Groups[1].Value; $attr = $c.Groups[2].Value; $isv = $c.Groups[3].Value; $v = $c.Groups[4].Value
    $val = ''
    if ($attr -match 't="s"') { if ($v -ne '') { $val = $shared[[int]$v] } }
    elseif ($attr -match 't="inlineStr"') { $txt = ''; foreach ($t in [regex]::Matches($isv, '<t[^>]*>(.*?)</t>', [Text.RegularExpressions.RegexOptions]::Singleline)) { $txt += $t.Groups[1].Value }; $val = (Dec $txt) }
    else { $val = (Dec $v) }
    if ($val -ne '') { $h[$col] = $val }
  }
  $h
}

# ---- verificacao da base (Etapa 1 / R2): cabecalho ausente e janela de coleta ----
# Google Forms da FRZ exporta SEM linha de cabecalho: a 1a linha ja e um respondente.
# Sem isso o parser trata a 1a pessoa como header e some 1 resposta da contagem.
function Parece-Dado($linha, $cols) {
  $vals = @()
  foreach ($c in $cols) { $v = San $linha[$c]; if ($v -ne '') { $vals += $v } }
  if ($vals.Count -eq 0) { return $false }
  foreach ($v in $vals) { if ($v.EndsWith('?')) { return $false } }      # pergunta do formulario = e cabecalho
  foreach ($v in $vals) {
    if ($v -match '\d{1,2}/\d{1,2}/\d{2,4}') { return $true }             # data
    if ($v -match '^\d{4}-\d{2}-\d{2}') { return $true }                  # data ISO
    if ($v -match '^[\w.\-]+@[\w.\-]+\.\w{2,}$') { return $true }      # e-mail
    if ($v -match '^\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}$') { return $true } # telefone
  }
  return $false
}
function ParseDataHora($v) {
  $t = ("$v").Trim()
  if ($t -eq '') { return $null }
  if ($t -match '^\d{5}(\.\d+)?$') {                                    # serial do Excel
    $n = [double]$t
    if ($n -gt 40000 -and $n -lt 60000) { return ([datetime]'1899-12-30').AddDays($n) }
  }
  $fmts = @('dd/MM/yyyy HH:mm:ss','dd/MM/yyyy HH:mm','dd/MM/yyyy','yyyy-MM-dd HH:mm:ss','yyyy-MM-ddTHH:mm:ss','yyyy-MM-dd HH:mm','yyyy-MM-dd')
  foreach ($f in $fmts) {
    $dt = [datetime]::MinValue
    if ([datetime]::TryParseExact($t, $f, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::None, [ref]$dt)) { return $dt }
  }
  return $null
}
function Janela-Coleta($resp, $cols) {
  $min = $null; $max = $null; $n = 0
  foreach ($r in $resp) {
    $achou = $null
    foreach ($c in $cols) { $d = ParseDataHora (San $r[$c]); if ($d) { $achou = $d; break } }
    if ($achou) {
      $n++
      if ($null -eq $min -or $achou -lt $min) { $min = $achou }
      if ($null -eq $max -or $achou -gt $max) { $max = $achou }
    }
  }
  if ($null -eq $min) { return $null }
  $mins = [math]::Round(($max - $min).TotalMinutes, 1)
  $seg  = if ($n -gt 0) { [math]::Round((($max - $min).TotalSeconds / $n), 0) } else { 0 }
  return [pscustomobject]@{ Ini = $min; Fim = $max; Qtd = $n; Minutos = $mins; SegPorResposta = $seg }
}

# ---------- tipo da planilha: Pesquisa x Mapeamento ----------
# O script aceitava qualquer planilha em qualquer passo: um Mapeamento colado no Passo 1 virava
# "BASE 1 — PESQUISA SOCIOECONÔMICA" sem aviso nenhum, e para quem olha a tela isso parece
# "dado preso no app" (nao ha cache nenhum — ver o diagnostico de 15/09/2026). Cada aba e
# classificada pelo CONTEUDO, nunca pelo nome da planilha ou da aba: esses sao livres e mentem.
function Tipo-Aba($header, $resp, $cols, $semH) {
  # Mapeamento: celulas ADQUIRIDO/PENDENTE fora das 2 primeiras colunas (cliente/consultor).
  # Exige VOLUME (>= 5) E PROPORCAO (>= 20% das celulas preenchidas): uma pesquisa com uma
  # resposta livre "pendente" nao pode virar Mapeamento. As duas palavras nao tem acento,
  # entao basta a caixa alta para aceitar "Adquirido" / "pendente".
  $dataCols = @($cols | Select-Object -Skip 2)
  $marca = 0; $cheias = 0
  foreach ($r in $resp) {
    foreach ($c in $dataCols) {
      $v = (San $r[$c]).ToUpperInvariant(); if ($v -eq '') { continue }
      $cheias++
      if ($v -eq 'ADQUIRIDO' -or $v -eq 'PENDENTE') { $marca++ }
    }
  }
  if ($marca -ge 5 -and ($marca / $cheias) -ge 0.20) { return 'mapa' }
  # Pesquisa: formulario sem cabecalho (padrao FRZ), pergunta terminando em "?", carimbo de
  # data/hora do Google Forms, ou metade das respostas com data/hora reconhecivel.
  if ($semH) { return 'pesquisa' }
  foreach ($c in $cols) {
    $h = San $header[$c]
    if ($h.EndsWith('?')) { return 'pesquisa' }
    if ($h.ToUpperInvariant() -match 'CARIMBO DE DATA|TIMESTAMP') { return 'pesquisa' }
  }
  $j = Janela-Coleta $resp $cols
  if ($j -and $resp.Count -gt 0 -and ($j.Qtd / $resp.Count) -ge 0.5) { return 'pesquisa' }
  return 'indef'   # nunca bloqueia: planilha antiga fora do padrao segue com aviso
}

# Le uma planilha do Google Sheets (link) -> objeto { erro, sid, tipo, colunas[], abaNomes, totResp, totCols, dados[], amostra[] }
function Ler-Sheet($LinkX, $rotulo) {
  $res = [ordered]@{ erro = ''; sid = ''; tipo = 'indef'; colunas = @(); abaNomes = @(); totResp = 0; totCols = 0; dados = @(); amostra = @(); semHeader = $false; janela = $null }
  if ([string]::IsNullOrWhiteSpace($LinkX)) { $res.erro = 'vazio'; return $res }
  $mx = [regex]::Match($LinkX, '/spreadsheets/d/([A-Za-z0-9_-]+)')
  if (-not $mx.Success) { $res.erro = "**Link inválido ($rotulo).** Cole a URL completa do Google Sheets."; return $res }
  $sidX = $mx.Groups[1].Value
  $res.sid = $sidX
  $tmp = Join-Path $env:TEMP ("pesq_" + [Guid]::NewGuid().ToString('N') + ".xlsx")
  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri "https://docs.google.com/spreadsheets/d/$sidX/export?format=xlsx" -OutFile $tmp -UseBasicParsing -ErrorAction Stop
  } catch { $res.erro = "**Não consegui baixar a planilha ($rotulo).** Verifique se o link está público. Detalhe: $($_.Exception.Message)"; return $res }

  $zip = [System.IO.Compression.ZipFile]::OpenRead($tmp)
  $shared = @()
  $ssXml = Read-Entry $zip 'xl/sharedStrings.xml'
  if ($ssXml) {
    foreach ($si in [regex]::Matches($ssXml, '<si>(.*?)</si>', [Text.RegularExpressions.RegexOptions]::Singleline)) {
      $txt = ''
      foreach ($t in [regex]::Matches($si.Groups[1].Value, '<t[^>]*>(.*?)</t>', [Text.RegularExpressions.RegexOptions]::Singleline)) { $txt += $t.Groups[1].Value }
      $shared += (Dec $txt)
    }
  }
  $rels = Read-Entry $zip 'xl/_rels/workbook.xml.rels'
  $wb = Read-Entry $zip 'xl/workbook.xml'
  $ridMap = @{}
  foreach ($r in [regex]::Matches($rels, 'Id="([^"]+)"[^>]*Target="([^"]+)"')) { $ridMap[$r.Groups[1].Value] = ($r.Groups[2].Value -replace '^/xl/', '' -replace '^xl/', '') }
  $abas = @()
  foreach ($s in [regex]::Matches($wb, '<sheet[^>]*name="([^"]*)"[^>]*r:id="([^"]*)"')) { $abas += [pscustomobject]@{ Nome = (Dec $s.Groups[1].Value); Target = $ridMap[$s.Groups[2].Value] } }

  $dados = @(); $amostra = @(); $totResp = 0; $totCols = 0; $abaNomes = @(); $tipos = @()
  foreach ($aba in $abas) {
    $sx = Read-Entry $zip ("xl/" + $aba.Target)
    if (-not $sx) { continue }
    $rows = @()
    foreach ($row in [regex]::Matches($sx, '<row[^>]*>(.*?)</row>', [Text.RegularExpressions.RegexOptions]::Singleline)) {
      $cells = Get-Cells $row.Groups[1].Value $shared
      if ($cells.Count -gt 0) { $rows += , $cells }
    }
    if ($rows.Count -eq 0) { continue }
    $colsSet = @{}
    foreach ($r in $rows) { foreach ($k in $r.Keys) { $colsSet[$k] = $true } }
    $cols = @($colsSet.Keys | Sort-Object { ColToNum $_ })
    if ($cols.Count -eq 0) { continue }
    $semH = Parece-Dado $rows[0] $cols
    if ($semH) {
      $header = @{}                       # planilha sem cabecalho: toda linha e resposta
      $resp   = @($rows)
      $res.semHeader = $true
    } else {
      $header = $rows[0]
      $resp = if ($rows.Count -ge 2) { @($rows[1..($rows.Count - 1)]) } else { @() }
    }
    if ($null -eq $res.janela -and $resp.Count -gt 0) { $res.janela = Janela-Coleta $resp $cols }
    $abaNomes += $aba.Nome
    $totResp += $resp.Count
    if ($cols.Count -gt $totCols) { $totCols = $cols.Count }

    $dados += "## Aba: $($aba.Nome) — $($resp.Count) linha(s), $($cols.Count) coluna(s)"
    $dados += ''
    $hh = @('#')
    foreach ($c in $cols) { $v = San $header[$c]; if ($v -eq '') { $v = "Col_$c" }; $hh += $v }
    $tipos += (Tipo-Aba $header $resp $cols $semH)
    if ($res.colunas.Count -eq 0) { $res.colunas = @($hh | Select-Object -Skip 1) }   # identidade: colunas da 1a aba
    $dados += '| ' + ($hh -join ' | ') + ' |'
    $dados += '|' + (($hh | ForEach-Object { '---' }) -join '|') + '|'
    if ($amostra.Count -eq 0 -and $resp.Count -gt 0) {
      $amostra += '| ' + ($hh -join ' | ') + ' |'
      $amostra += '|' + (($hh | ForEach-Object { '---' }) -join '|') + '|'
      $k = 0
      foreach ($r in $resp) { $k++; if ($k -gt 8) { break }; $al = @([string]$k); foreach ($c in $cols) { $al += (San $r[$c]) }; $amostra += '| ' + ($al -join ' | ') + ' |' }
    }
    $i = 0
    foreach ($r in $resp) {
      $i++
      $line = @([string]$i)
      foreach ($c in $cols) { $line += (San $r[$c]) }
      $dados += '| ' + ($line -join ' | ') + ' |'
    }
    $dados += ''
  }
  $zip.Dispose()
  Remove-Item $tmp -ErrorAction SilentlyContinue

  $res.abaNomes = $abaNomes; $res.totResp = $totResp; $res.totCols = $totCols; $res.dados = $dados; $res.amostra = $amostra
  # a planilha e Pesquisa se QUALQUER aba for pesquisa (uma aba de resumo ao lado nao a
  # desqualifica); Mapeamento so quando nenhuma aba e pesquisa e ao menos uma e mapeamento
  $res.tipo = if ($tipos -contains 'pesquisa') { 'pesquisa' } elseif ($tipos -contains 'mapa') { 'mapa' } else { 'indef' }
  if ($abaNomes.Count -eq 0) { $res.erro = "**Planilha vazia ou ilegível ($rotulo).** Confira o link." }
  return $res
}

# ============ leitura das bases ============
if ([string]::IsNullOrWhiteSpace($Link)) { Write-Output "**Cole o link público** do Google Sheets da Pesquisa Socioeconômica (Passo 1) antes de executar."; exit 1 }
$P = Ler-Sheet $Link 'Pesquisa Socioeconômica'
if ($P.erro) { Write-Output $P.erro; exit 1 }

$temMapa = -not [string]::IsNullOrWhiteSpace($LinkMapa)
$M = $null
if ($temMapa) { $M = Ler-Sheet $LinkMapa 'Mapeamento da Turma'; if ($M.erro) { Write-Output $M.erro; exit 1 } }

# ============ conferencia do TIPO de cada link (15/09/2026) ============
# Antes daqui qualquer planilha passava. Agora: mesma planilha nos dois passos = bloqueio; links
# invertidos (Mapeamento no 1, Pesquisa no 2) = troca sozinho e avisa; Mapeamento no Passo 1 ou
# Pesquisa no Passo 2 = bloqueio dizendo o que fazer; tipo nao identificado = segue com aviso
# (planilha antiga fora do padrao nao pode parar de funcionar).
# Bloqueio sai com exit 0 DE PROPOSITO: com exit 1 o /api/cmd devolve 500 e o app mostra
# "Falhou:" com o markdown cru; com 0 o renderPesqSocio exibe a mensagem formatada, porque ela
# nao traz o marcador do pacote.
function Id-Curto($sid) { if ($sid.Length -gt 6) { '…' + $sid.Substring($sid.Length - 6) } else { $sid } }
function Cols-Curtas($x) { $c = @($x.colunas); $s = ($c | Select-Object -First 6) -join ', '; if ($c.Count -gt 6) { $s += ', …' }; $s }
$ROT_TIPO = @{ pesquisa = 'Pesquisa Socioeconômica'; mapa = 'Mapeamento da Turma'; indef = 'não identificado' }
$avisos = @()

if ($temMapa -and $P.sid -eq $M.sid) {
  Write-Output '## ⛔ Os dois passos apontam para a mesma planilha'
  Write-Output ''
  Write-Output ("O Passo 1 e o Passo 2 estão com o mesmo link (planilha ``{0}``, detectada como **{1}**)." -f (Id-Curto $P.sid), $ROT_TIPO[$P.tipo])
  Write-Output ''
  Write-Output '**O que fazer:** no Passo 1 vai a **Pesquisa Socioeconômica** (respostas do formulário); no Passo 2, o **Mapeamento da Turma** (ADQUIRIDO × PENDENTE).'
  exit 0
}
if ($P.tipo -eq 'mapa' -and $temMapa -and $M.tipo -eq 'pesquisa') {
  $tmpT = $P; $P = $M; $M = $tmpT
  $avisos += ("**Links invertidos — corrigi sozinho.** A planilha ``{0}`` (Pesquisa) estava no Passo 2 e a ``{1}`` (Mapeamento) no Passo 1; li cada uma no lugar certo." -f (Id-Curto $P.sid), (Id-Curto $M.sid))
}
elseif ($P.tipo -eq 'mapa') {
  Write-Output '## ⛔ O link do Passo 1 é um Mapeamento da Turma, não uma Pesquisa'
  Write-Output ''
  Write-Output ("A planilha ``{0}`` tem as colunas **{1}** com valores ADQUIRIDO / PENDENTE — é o Mapeamento (o que cada aluno já comprou), não as respostas da Pesquisa Socioeconômica." -f (Id-Curto $P.sid), (Cols-Curtas $P))
  Write-Output ''
  $dica = '**O que fazer:** cole no Passo 1 o link da **Pesquisa Socioeconômica** (a planilha de respostas do formulário). O Mapeamento vai no Passo 2 — escolha **Seguir com os 2 passos**.'
  if ($temMapa) { $dica += ' Se o link que está no Passo 2 for a Pesquisa, os campos estão invertidos: troque um pelo outro.' }
  Write-Output $dica
  exit 0
}
elseif ($temMapa -and $M.tipo -eq 'pesquisa') {
  Write-Output '## ⛔ O link do Passo 2 é uma Pesquisa, não um Mapeamento'
  Write-Output ''
  Write-Output ("A planilha ``{0}`` do Passo 2 tem cara de respostas de formulário (colunas: {1}). No Passo 2 vai o **Mapeamento da Turma** — a planilha ADQUIRIDO × PENDENTE." -f (Id-Curto $M.sid), (Cols-Curtas $M))
  Write-Output ''
  Write-Output '**O que fazer:** troque o link do Passo 2 pelo Mapeamento. Se quiser seguir só com a Pesquisa, escolha **Seguir com 1 passo**.'
  exit 0
}
if ($P.tipo -eq 'indef') {
  $avisos += ("**Não consegui confirmar que o Passo 1 é uma Pesquisa** (planilha ``{0}``, colunas: {1}). Segui assim mesmo — confira a amostra abaixo antes de gerar o relatório." -f (Id-Curto $P.sid), (Cols-Curtas $P))
}
if ($temMapa -and $M.tipo -eq 'indef') {
  $avisos += ("**Não consegui confirmar que o Passo 2 é um Mapeamento** (planilha ``{0}``, sem colunas ADQUIRIDO / PENDENTE reconhecíveis). Segui assim mesmo — confira a amostra." -f (Id-Curto $M.sid))
}

# ============ contexto da turma (R1) + verificacao da base (Etapa 1) ============
$ctx = @()
$ctx += '# CONTEXTO INFORMADO'
$ctx += ''
if ($Produto) { $ctx += "* **Produto da turma:** $Produto" }
else          { $ctx += '* **Produto da turma:** NÃO INFORMADO — não assuma pelo nome da planilha, da aba ou da turma (R1). Declare na capa a premissa que assumiu, marque como não confirmada e siga a análise.' }
if ($Praca)   { $ctx += "* **Praça:** $Praca" }
# o que a conferencia de tipo decidiu vai para a IA tambem: se os links foram trocados, ela
# precisa saber — senao o relatorio cita "Passo 1" achando que e o link que foi colado ali
foreach ($a in $avisos) { $ctx += "* ⚠️ $a" }
if ($temMapa) { $ctx += '* **BASE 2 (o que cada aluno já possui):** informada — cruze por nome e nunca indique ADQUIRIDO.' }
else          { $ctx += '* **BASE 2 (o que cada aluno já possui):** NÃO informada — histórico de compra não considerado; registre a decisão crítica de checagem nominal no CRM antes de qualquer oferta (R9).' }
$ctx += '* **Tabela de preços:** não fornecida — sem projeção de receita (R8).'
$ctx += ''
$ctx += '# VERIFICAÇÃO DA BASE (pré-agregado pelo script — confira e complete na Etapa 1)'
$ctx += ''
$ctx += "* **Respostas na BASE 1:** $($P.totResp) linha(s) em $($P.abaNomes.Count) aba(s), até $($P.totCols) coluna(s)."
if ($P.semHeader) {
  $ctx += '* **Planilha SEM linha de cabeçalho** (padrão do formulário FRZ): TODAS as linhas abaixo são respondentes — nenhuma pessoa virou cabeçalho e nenhuma foi descartada da contagem. As colunas aparecem como `Col_A`, `Col_B`… — identifique cada uma pelo conteúdo, na ordem do schema da seção 2.'
}
if ($P.janela) {
  $j = $P.janela
  $ctx += ("* **Janela de coleta:** {0} → {1} = **{2} min** para {3} resposta(s) ≈ **{4} s por resposta**." -f $j.Ini.ToString('dd/MM/yyyy HH:mm'), $j.Fim.ToString('dd/MM/yyyy HH:mm'), $j.Minutos, $j.Qtd, $j.SegPorResposta)
  if ($j.Minutos -le 30 -and $j.Qtd -ge 5) { $ctx += '* ⚠️ **Janela apertada** — coleta em grupo durante o evento: desejabilidade social e contágio. Reduza o peso da nota e não projete conversão para cima (seção 4).' }
} else {
  $ctx += '* **Janela de coleta:** não identificada (sem coluna de data/hora reconhecível) — declare isso nos Limites.'
}
if ($temMapa) { $ctx += "* **BASE 2:** $($M.totResp) linha(s) em $($M.abaNomes.Count) aba(s)." }

# ============ pacote (prompt + contexto + Base 1 + Base 2) ============
$pacote = $PROMPT + "`r`n`r`n---`r`n`r`n" + ($ctx -join "`r`n") + "`r`n`r`n---`r`n`r`n# BASE 1 — PESQUISA SOCIOECONÔMICA`r`n`r`n" + ($P.dados -join "`r`n")
if ($temMapa) {
  $pacote += "`r`n`r`n---`r`n`r`n# BASE 2 — MAPEAMENTO DA TURMA (o que cada aluno JÁ possui: ADQUIRIDO/PENDENTE)`r`n`r`n" + ($M.dados -join "`r`n")
}

# ============ saída para o app (3 passos): resumos + amostras + pacote ============
$L = @()
$L += '<!--PESQ-SOCIO-->'
$L += '## 🧠 Pesquisa Socioeconômica — pacote pronto para a IA'
$L += ''
foreach ($a in $avisos) { $L += "⚠️ $a"; $L += '' }
# identidade de cada base: ID curto, abas e colunas lidas deixam um link errado visivel na hora.
# Antes a tela dizia "Pesquisa: 26 respostas" para um Mapeamento, e isso parecia dado preso.
$abasP = ($P.abaNomes | ForEach-Object { '"' + $_ + '"' }) -join ', '
$L += ("**Passo 1 · Pesquisa:** planilha ``{0}`` · aba(s) {1} · **{2} resposta(s)** · até {3} coluna(s) · detectado: **{4}**" -f (Id-Curto $P.sid), $abasP, $P.totResp, $P.totCols, $ROT_TIPO[$P.tipo])
$L += ("↳ colunas: {0}" -f (Cols-Curtas $P))
if ($Produto) { $L += "**Produto da turma:** $Produto" + $(if($Praca){" · **Praça:** $Praca"}else{''}) }
else { $L += "⚠️ **Produto da turma não informado** — o relatório vai declarar a premissa na capa em vez de assumir pelo nome da turma (regra R1)." }
if ($P.semHeader) { $L += "ℹ️ Planilha **sem linha de cabeçalho**: as $($P.totResp) linhas foram contadas como respondentes (ninguém virou cabeçalho)." }
if ($P.janela) { $L += ("🕒 **Janela de coleta:** {0} → {1} = {2} min · ~{3}s por resposta." -f $P.janela.Ini.ToString('dd/MM HH:mm'), $P.janela.Fim.ToString('dd/MM HH:mm'), $P.janela.Minutos, $P.janela.SegPorResposta) }
if ($temMapa) {
  $abasM = ($M.abaNomes | ForEach-Object { '"' + $_ + '"' }) -join ', '
  $L += ("**Passo 2 · Mapeamento:** planilha ``{0}`` · aba(s) {1} · **{2} linha(s)** · até {3} coluna(s) · detectado: **{4}**" -f (Id-Curto $M.sid), $abasM, $M.totResp, $M.totCols, $ROT_TIPO[$M.tipo])
}
else { $L += "**Passo 2 · Mapeamento:** _não informado — o relatório NÃO vai considerar o que já foi comprado._" }
$L += ''
$L += 'Confira as amostras; se estiver certo, clique em **Trazer relatório**.'
$L += '<!--PESQ-AMOSTRA-->'
$L += ($P.amostra -join "`r`n")
if ($temMapa) {
  $L += '<!--PESQ-MAPA-->'
  $L += ($M.amostra -join "`r`n")
}
$L += '<!--PESQ-PACOTE-->'
$L += $pacote
Write-Output ($L -join "`r`n")
exit 0
