# Pesquisa-Socioeconomica.ps1 — le uma planilha (Google Sheets) e monta um PACOTE (prompt fixo + dados)
# para colar numa IA e gerar o Relatorio Estrategico da Turma (inteligencia comercial).
# Uso: .\Pesquisa-Socioeconomica.ps1 -Link "<link do Google Sheets>"
# Sem MCP/token: so baixa o Sheets publico e parseia o .xlsx (aguenta todas as abas). Salvar com BOM UTF-8.
param([string]$Link = '', [string]$LinkMapa = '')
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

# ============================ PROMPT FIXO (analista estrategico) ============================
$PROMPT = @'
# ANALISTA ESTRATÉGICO DE TURMAS E INTELIGÊNCIA COMERCIAL

Você atuará como um consultor sênior de inteligência comercial, análise de mercado, comportamento do consumidor e estratégia de vendas.

Vou fornecer uma planilha contendo os dados dos participantes de uma turma de Gestão de Negócios.

Sua missão é transformar os dados brutos em inteligência comercial prática para maximizar vendas, aumentar conversões e orientar a construção do pitch comercial.

## OBJETIVO PRINCIPAL

Identificar:

* Quem está na sala
* Quem possui maior potencial financeiro
* Quem possui maior probabilidade de compra
* Quais produtos ou serviços possuem maior aderência
* Como conduzir uma apresentação comercial para gerar o máximo de conversão

---

# PORTFÓLIO DE TREINAMENTOS FEBRACIS (base obrigatória de TODAS as recomendações)

Ao recomendar "o que vender", use **exclusivamente** os treinamentos abaixo. Para cada pessoa, escolha o de maior aderência ao **momento** dela (perfil + dor/receio declarado):

| Sigla | Nome | Para quem / momento | Dor que resolve |
|---|---|---|---|
| **CIS** | Método CIS (Coaching Integral Sistêmico) | Porta de entrada, qualquer pessoa; ideal p/ transição de carreira, quem está estagnado/começando, baixa autoconfiança | Inteligência emocional: medo, vergonha, procrastinação, hábitos tóxicos |
| **TCE** | Tour Crescimento Empresarial | Empresário (iniciante ou consolidado) que quer estruturar crescimento; também evento de captação | Empresa dependente do dono, faturamento oscilando |
| **BHP** | BHP — Gestão de Negócios | Empresário consolidado em reestruturação | Apaga incêndio, gestão desorganizada, quer dobrar lucro |
| **ML5** | ML5 — Formação de Líderes | Empresário/líder com time (3+ pessoas) | Liderança fraca, líder técnico sem gestão, escalar time |
| **FGPC** | Formação em Gestão de Pessoas (DISC) | Empresário/líder/RH | Turnover, contratação errada, gestão de gente |
| **IF** | Inteligência Financeira | Empresário, liberal, quem fatura mas não sobra | Escassez, dívida, renda sem patrimônio |
| **TAV** | Técnicas Avançadas em Vendas | Vendedor, empresário que vende, liberal que capta cliente | Não sabe vender/fechar, faturamento baixo |
| **CEOP** | Comunicação Eficaz e Oratória Persuasiva | Qualquer perfil; ideal p/ tímido/introvertido | Medo de falar em público, falta de autoridade |
| **FCIS** | Formação em Coaching (FCIS) | Transição de carreira p/ virar coach/mentor (requer CIS antes) | Busca de nova profissão/propósito |
| **Master** | Master Coaching | Coach que já fez FCIS | Estagnou como coach, quer atender C-level |
| **MAESTRIA** | Maestria (Mastermind premium) | Topo: empresário consolidado que quer escalar | Preso na operação, sem rede do próprio nível |
| **GGB** | Green Golden Belt (trilha completa) | Quem quer transformação completa (não curso avulso) | Busca a jornada integral (CIS→…→Master) |

**Regra de bolso:** dor emocional / medo / vergonha / procrastinação → **CIS**; transição de carreira/CLT → **CIS** (base) e depois **FCIS**; empresário desorganizado → **BHP**; líder com time → **ML5**; problema de gente/turnover → **FGPC**; dinheiro → **IF**; vendas → **TAV**; comunicação/timidez → **CEOP**; empresário no topo querendo escalar → **MAESTRIA**. Quando a pessoa precisar de várias frentes, indique a trilha **GGB**.

---

# BASES DE DADOS E REGRA DE CRUZAMENTO (o que a pessoa já comprou)

Ao final você recebe uma ou duas bases:
* **Base 1 — Pesquisa Socioeconômica:** perfil e dores de cada participante.
* **Base 2 — Mapeamento da Turma (pode não vir):** o que cada aluno **JÁ possui** — treinamentos marcados como **ADQUIRIDO** vs **PENDENTE**.

Se a **Base 2** vier, **cruze por NOME** e obedeça:
* **NUNCA indique um treinamento que a pessoa já tem (ADQUIRIDO).**
* Indique o **próximo passo entre os PENDENTES**, respeitando pré-requisitos (ex.: FCIS e Master exigem CIS; MAESTRIA pressupõe base feita).
* Se a pessoa já possui o treinamento ideal para a dor dela, indique a **evolução na jornada** (próximo produto) ou a **trilha GGB**.
* Na tabela de indicação individual, acrescente uma coluna **"Já possui"** com o que a pessoa já adquiriu.

Se a **Base 2 não vier**, faça a indicação apenas pela Pesquisa (Base 1) e **avise no relatório** que o histórico de compras não foi considerado.

---

# ETAPA 1 — DIAGNÓSTICO DA TURMA

Apresente:

## Panorama Geral

* Total de participantes
* Quantidade de empresários
* Quantidade de gestores
* Quantidade de profissionais liberais
* Quantidade de autônomos
* Quantidade de funcionários CLT
* Quantidade de participantes sem atividade claramente definida

## Distribuição por Segmento

Criar ranking dos segmentos presentes.

Exemplo:

1. Construção Civil
2. Saúde
3. Varejo
4. Serviços
5. Tecnologia

Apresentar:

* Quantidade
* Percentual
* Participação na turma

## Distribuição por Cargo

Criar tabela com:

* Cargo
* Quantidade
* Percentual

---

# ETAPA 2 — ANÁLISE DE MATURIDADE EMPRESARIAL

Classifique cada participante em:

### Nível 1 — Iniciante

* Recém empreendendo
* Pouca estrutura
* Pouca equipe

### Nível 2 — Crescimento

* Empresa validada
* Busca expansão
* Possui processos básicos

### Nível 3 — Estruturado

* Equipe formada
* Gestão definida
* Busca escala

### Nível 4 — Alta Performance

* Operação consolidada
* Busca crescimento acelerado
* Busca gestão estratégica

Explique os critérios utilizados.

Apresente os percentuais da turma em cada estágio.

---

# ETAPA 3 — SEGMENTAÇÃO COMERCIAL

Crie clusters comerciais.

Exemplo:

### Cluster A — Empresários em Crescimento

Características:
Dores:
Desejos:
Potencial financeiro:

### Cluster B — Prestadores de Serviço

Características:
Dores:
Desejos:
Potencial financeiro:

### Cluster C — CLT em Transição para Empreender

Características:
Dores:
Desejos:
Potencial financeiro:

Crie quantos clusters forem necessários.

---

# ETAPA 4 — SCORE DE OPORTUNIDADE

Crie um ranking dos participantes com maior potencial de compra.

Considere:

* Cargo
* Segmento
* Possível faturamento
* Nível empresarial
* Capacidade de investimento
* Necessidade aparente

Classifique:

🟢 Alta oportunidade

🟡 Média oportunidade

🔴 Baixa oportunidade

Explique os critérios utilizados.

---

# ETAPA 5 — MAPA DE DORES

Identifique:

## Dores Financeiras

## Dores de Gestão

## Dores de Liderança

## Dores de Vendas

## Dores de Marketing

## Dores de Escala

Para cada dor:

* Probabilidade de ocorrência
* Intensidade
* Impacto no negócio

---

# ETAPA 6 — OPORTUNIDADES DE VENDA

Baseie o "o que vender" **exclusivamente** no Portfólio de Treinamentos FEBRACIS (seção inicial). Para cada perfil identificado, apresente:

### O que vender

### Por que vender

### Como posicionar

### Faixa de valor recomendada

### Probabilidade de conversão

Classifique:

* Muito Alta
* Alta
* Média
* Baixa

---

# ETAPA 7 — ESTRATÉGIA DE PITCH AO VIVO

Defina:

## Melhor abertura

## História mais aderente ao público

## Gatilhos mentais mais eficazes

* Autoridade
* Prova social
* Escassez
* Pertencimento
* Oportunidade
* Transformação

## Sequência ideal da oferta

Passo a passo do pitch.

## Principais argumentos

## Principais objeções

## Como quebrar cada objeção

---

# ETAPA 8 — PERFIL FINANCEIRO DA SALA

Estime:

* Percentual com alto poder de compra
* Percentual com médio poder de compra
* Percentual com baixo poder de compra

Explique quais sinais nos dados sustentam essa análise.

---

# ETAPA 9 — RESUMO EXECUTIVO

Entregue:

### Quem está na sala

Resumo em até 10 linhas.

### Melhor estratégia comercial

Resumo em até 10 linhas.

### Principal oportunidade de faturamento

Resumo em até 5 linhas.

### Ranking dos 3 melhores produtos para ofertar

1º Lugar
2º Lugar
3º Lugar

### Quem recebe cada oferta — cruzamento com a Etapa 6

Cruze o produto recomendado por cluster (Etapa 6) com o Score de Oportunidade (Etapa 4) e entregue uma **tabela** com a fila de abordagem: para cada cluster, o **treinamento a ofertar** e os **participantes-alvo prioritários (com os nomes)**, na ordem de prioridade de venda.

Em seguida, indique a **sequência sugerida de atendimento pós-pitch** (quem abordar primeiro e por quê), destacando eventuais promotores/indicadores da turma (quem já demonstrou entusiasmo pode virar prova social e fonte de indicação).

### Indicação individual — nome × treinamento ideal

Para **CADA participante** da turma, indique o treinamento do **Portfólio FEBRACIS** com maior aderência ao **momento** dele (cruze perfil + dor/receio declarado). Entregue uma **TABELA**: **Nome | Perfil | Treinamento indicado | Por quê (1 linha)**. Quando fizer sentido, aponte também um **próximo passo** (ex.: CIS agora → FGPC depois). Não deixe ninguém de fora.

### Probabilidade geral de conversão da turma

Justifique.

---

# REGRAS OBRIGATÓRIAS

* Seja extremamente analítico.
* Faça inferências inteligentes quando os dados permitirem.
* Utilize tabelas sempre que possível.
* Quantifique conclusões.
* Não seja superficial.
* Pense como um diretor comercial preparando uma oferta para vender ao vivo.
* Priorize insights acionáveis.
* Sempre explique o raciocínio por trás das conclusões.

---

# ENTREGA FINAL — GERAR O PDF

Ao concluir todas as 9 etapas, monte o relatório completo como um **documento único, bem formatado e pronto para exportar em PDF** (crie como artifact/documento): com **capa** (identificação da turma e data), **sumário**, todas as **seções numeradas** e as **tabelas**.

Ao final, **gere o PDF do relatório** e disponibilize para download.
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

# Le uma planilha do Google Sheets (link) -> objeto { erro, abaNomes, totResp, totCols, dados[], amostra[] }
function Ler-Sheet($LinkX, $rotulo) {
  $res = [ordered]@{ erro = ''; abaNomes = @(); totResp = 0; totCols = 0; dados = @(); amostra = @() }
  if ([string]::IsNullOrWhiteSpace($LinkX)) { $res.erro = 'vazio'; return $res }
  $mx = [regex]::Match($LinkX, '/spreadsheets/d/([A-Za-z0-9_-]+)')
  if (-not $mx.Success) { $res.erro = "**Link inválido ($rotulo).** Cole a URL completa do Google Sheets."; return $res }
  $sidX = $mx.Groups[1].Value
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

  $dados = @(); $amostra = @(); $totResp = 0; $totCols = 0; $abaNomes = @()
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
    $header = $rows[0]
    $resp = if ($rows.Count -ge 2) { @($rows[1..($rows.Count - 1)]) } else { @() }
    $abaNomes += $aba.Nome
    $totResp += $resp.Count
    if ($cols.Count -gt $totCols) { $totCols = $cols.Count }

    $dados += "## Aba: $($aba.Nome) — $($resp.Count) linha(s), $($cols.Count) coluna(s)"
    $dados += ''
    $hh = @('#')
    foreach ($c in $cols) { $v = San $header[$c]; if ($v -eq '') { $v = "Col_$c" }; $hh += $v }
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

# ============ pacote (prompt + Base 1 + Base 2) ============
$pacote = $PROMPT + "`r`n`r`n---`r`n`r`n# BASE 1 — PESQUISA SOCIOECONÔMICA`r`n`r`n" + ($P.dados -join "`r`n")
if ($temMapa) {
  $pacote += "`r`n`r`n---`r`n`r`n# BASE 2 — MAPEAMENTO DA TURMA (o que cada aluno JÁ possui: ADQUIRIDO/PENDENTE)`r`n`r`n" + ($M.dados -join "`r`n")
}

# ============ saída para o app (3 passos): resumos + amostras + pacote ============
$L = @()
$L += '<!--PESQ-SOCIO-->'
$L += '## 🧠 Pesquisa Socioeconômica — pacote pronto para a IA'
$L += ''
$L += "**Passo 1 · Pesquisa:** $($P.abaNomes.Count) aba(s) · **$($P.totResp) resposta(s)** · até $($P.totCols) coluna(s)."
if ($temMapa) { $L += "**Passo 2 · Mapeamento:** $($M.abaNomes.Count) aba(s) · **$($M.totResp) linha(s)** · até $($M.totCols) coluna(s)." }
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
