<#
  Leitura-Turma.ps1
  Le uma planilha de turma (Google Sheets, aba/gid do link) e gera:
    Tabela 1 - LEITURA POR COLUNA (treinamento) ordenada por PENDENTE (maior -> menor)
    Tabela 2 - LEITURA DOS ALUNOS (quais treinamentos JA POSSUI e quais NAO POSSUI)
    Leitura rapida (insights)

  USO:
    pwsh ./Leitura-Turma.ps1 -Link "https://docs.google.com/spreadsheets/d/ID/edit?gid=GID"

  A planilha precisa estar acessivel por link (qualquer pessoa com o link pode ver).
  As colunas de treinamento sao detectadas automaticamente (celulas ADQUIRIDO/PENDENTE).
#>
param(
  [Parameter(Mandatory=$true)][string]$Link,
  # quem entra na leitura: a turma inteira, so quem tem a caixinha de PRESENCA marcada, ou so quem faltou
  [ValidateSet('todos','presentes','ausentes')][string]$Presenca = 'todos'
)

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

# 1) extrai ID + gid do link
$mId  = [regex]::Match($Link, '/spreadsheets/d/([a-zA-Z0-9_-]+)')
if (-not $mId.Success) { Write-Output "Link invalido: nao encontrei o ID da planilha."; return }
$sheetId = $mId.Groups[1].Value
$mGid = [regex]::Match($Link, 'gid=([0-9]+)')
$hasGid = $mGid.Success
$gid  = if ($hasGid) { $mGid.Groups[1].Value } else { '0' }

# 2) baixa a aba como CSV
#    - link COM gid  -> baixa exatamente essa aba
#    - link SEM gid  -> NAO forcar &gid=0 (a aba 0 pode nao existir e o Google devolve 400); deixa o Google entregar a 1a aba visivel
$baseUrl   = "https://docs.google.com/spreadsheets/d/$sheetId/export?format=csv"
$exportUrl = if ($hasGid) { "$baseUrl&gid=$gid" } else { $baseUrl }
$gidLabel  = if ($hasGid) { "aba gid=$gid" } else { "primeira aba" }
$tmp = Join-Path $env:TEMP "leitura_turma_$($sheetId)_$gid.csv"
try {
  Invoke-WebRequest -Uri $exportUrl -OutFile $tmp -UseBasicParsing -ErrorAction Stop
} catch {
  # fallback: se o gid do link nao existe mais (400/404), tenta a 1a aba antes de desistir
  try {
    Invoke-WebRequest -Uri $baseUrl -OutFile $tmp -UseBasicParsing -ErrorAction Stop
    $gidLabel = "primeira aba"
  } catch {
    Write-Output "Nao consegui baixar a planilha. Verifique se o link esta publico (qualquer pessoa com o link pode ver)."
    return
  }
}
$csv = @(Import-Csv -Path $tmp -Encoding UTF8)
if ($csv.Count -eq 0) { Write-Output "A $gidLabel veio vazia."; return }

$headers = $csv[0].PSObject.Properties.Name

# 2.1) filtro de PRESENCA (a caixinha da planilha; o Google exporta como TRUE/FALSE)
#      A coluna e achada pelo NOME do cabecalho, nunca por "coluna de caixinha": a planilha tem
#      outras colunas TRUE/FALSE (PROPOSTA) e filtrar pela errada passaria despercebido.
#      Sem coluna de presenca a leitura sai da turma inteira, com aviso - nao trava o comando.
function PresencaMarcada($v){ ([string]$v).Trim() -match '(?i)^(true|verdadeiro|sim|s|x|ok|1|✓|✔)$' }
$presCol   = @($headers | Where-Object { $_ -match '(?i)presen|compareceu|check.?in|frequen' } | Select-Object -First 1)
$avisoPres = ''
$rotPres   = ''
if ($Presenca -ne 'todos') {
  if (-not $presCol) {
    $avisoPres = "> ⚠ **Sem filtro de presenca:** esta aba nao tem coluna de presenca (procurei por PRESENCA / COMPARECEU / CHECK-IN / FREQUENCIA). A leitura abaixo e da **turma inteira**."
  } else {
    $antes  = $csv.Count
    $marcou = @($csv | Where-Object { PresencaMarcada $_.$presCol })
    if ($Presenca -eq 'presentes') { $csv = $marcou; $rotPres = 'somente PRESENTES' }
    else { $csv = @($csv | Where-Object { -not (PresencaMarcada $_.$presCol) }); $rotPres = 'somente AUSENTES' }
    if ($csv.Count -eq 0) {
      Write-Output "Nenhum aluno em **$rotPres** nesta aba (coluna $($presCol.Trim())): a turma tem $antes aluno(s), $($marcou.Count) com presenca marcada."
      return
    }
  }
}

# 3) detecta colunas de treinamento (>=50% das celulas sao ADQUIRIDO/PENDENTE)
$trainCols = @()
foreach ($h in $headers) {
  $hits = @($csv.$h | Where-Object { $_ -match 'ADQUIR|PENDEN' }).Count
  if ($hits -ge ($csv.Count * 0.5)) { $trainCols += $h }
}
if ($trainCols.Count -eq 0) { Write-Output "Nao encontrei colunas de treinamento (ADQUIRIDO/PENDENTE) nesta aba."; return }

# colunas que NAO sao de treinamento (candidatas a nome/consultor/status)
# a de presenca fica de fora: e TRUE/FALSE e nao pode ser confundida com a coluna do nome
$nonTrain = @($headers | Where-Object { $trainCols -notcontains $_ -and $_ -ne $presCol })
# coluna do CONSULTOR (opcional): header casa consultor/responsavel/vendedor/closer/assessor
$consCol = ($nonTrain | Where-Object { $_ -match '(?i)consultor|respons|vendedor|closer|assessor' } | Select-Object -First 1)
# coluna do NOME do aluno:
#  1) cabecalho explicito (nome/aluno/cliente/participante) que NAO seja o consultor
$nomeCol = ($nonTrain | Where-Object { $_ -ne $consCol -and $_ -match '(?i)nome|aluno|cliente|participante' } | Select-Object -First 1)
#  2) senao, a coluna "mais cara de nome": mais valores DISTINTOS x comprimento medio -> evita colunas de status ("OK"/"SIM"/checkbox) e a coluna sem cabecalho
if (-not $nomeCol) {
  $best=$null; $bestScore=-1.0
  foreach ($h in $nonTrain) {
    if ($h -eq $consCol) { continue }
    $vals = @($csv.$h | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ })
    if ($vals.Count -lt 1) { continue }
    $distinct = @($vals | Sort-Object -Unique).Count
    $avgLen = [double](($vals | Measure-Object -Property Length -Average).Average)
    $score = ($distinct / $vals.Count) * [Math]::Min($avgLen, 40.0)   # nomes: quase todos distintos e longos; status: poucos distintos e curtos
    if ($score -gt $bestScore) { $bestScore = $score; $best = $h }
  }
  $nomeCol = $best
}
if (-not $nomeCol) { $nomeCol = $nonTrain | Select-Object -First 1 }
if (-not $nomeCol) { $nomeCol = $headers[0] }

$total = $csv.Count
$linhas = New-Object System.Collections.Generic.List[string]
# o filtro aparece no topo: um print de "so presentes" nao pode ser confundido com um da turma inteira
if ($avisoPres) { $linhas.Add($avisoPres); $linhas.Add('') }
elseif ($rotPres) { $linhas.Add("> 🎓 **Filtro: $rotPres** — coluna $($presCol.Trim()) da planilha."); $linhas.Add('') }

# ===================== TABELA 1: por treinamento =====================
$stats = foreach ($c in $trainCols) {
  $adq = @($csv.$c | Where-Object { $_ -match 'ADQUIR' }).Count
  $pen = @($csv.$c | Where-Object { $_ -match 'PENDEN' }).Count
  [pscustomobject]@{ Treino=$c.Trim(); Pendente=$pen; Adquirido=$adq }
}
$stats = $stats | Sort-Object -Property Pendente -Descending

$linhas.Add('## TABELA 1 - LEITURA POR COLUNA - ORDENADO POR PENDENTE (MAIOR -> MENOR)')
$linhas.Add('')
$linhas.Add('| TREINAMENTO | PENDENTE | NÃO POSSUI O TREINAMENTO | ADQUIRIDO | JÁ POSSUI O TREINAMENTO |')
$linhas.Add('|---|--:|--:|--:|--:|')
foreach ($s in $stats) {
  $pNao = [math]::Round($s.Pendente / $total * 100)
  $pSim = [math]::Round($s.Adquirido / $total * 100)
  $linhas.Add("| **$($s.Treino)** | $($s.Pendente) | $pNao% | $($s.Adquirido) | $pSim% |")
}
$linhas.Add('')
$baseRot = if ($rotPres) { "$gidLabel · $rotPres" } else { $gidLabel }
$linhas.Add("BASE: **$total ALUNOS** ($baseRot)")
$linhas.Add('')

# ===================== TABELA 2: por aluno =====================
$linhas.Add('## TABELA 2 - LEITURA DOS ALUNOS: QUAIS TREINAMENTOS JÁ POSSUI E QUAL NÃO TEM')
$linhas.Add('')
$linhas.Add('| # | ALUNO | JÁ POSSUI | NÃO POSSUI |')
$linhas.Add('|--:|---|---|---|')
$iAluno = 0
# detalhe p/ o drill (tabela 3): por treinamento, quem tem ADQUIRIDO e quem tem PENDENTE; e consultor por aluno
$detAdq = @{}; $detPen = @{}; $consMap = [ordered]@{}
foreach ($c in $trainCols) { $detAdq[$c.Trim()] = @(); $detPen[$c.Trim()] = @() }
foreach ($row in $csv) {
  $nome = ([string]$row.$nomeCol).Trim()
  if (-not $nome) { continue }
  if ($consCol -and -not $consMap.Contains($nome)) { $consMap[$nome] = ([string]$row.$consCol).Trim() }
  $possui = @(); $naoPossui = @()
  foreach ($c in $trainCols) {
    $v = [string]$row.$c
    if ($v -match 'ADQUIR') { $possui += $c.Trim(); $detAdq[$c.Trim()] += $nome }
    elseif ($v -match 'PENDEN') { $naoPossui += $c.Trim(); $detPen[$c.Trim()] += $nome }
  }
  $sPossui = if ($possui.Count) { $possui -join ', ' } else { '-' }
  $sNao    = if ($naoPossui.Count) { $naoPossui -join ', ' } else { '-' }
  $iAluno++
  $linhas.Add("| $iAluno | $nome | $sPossui | $sNao |")
}
$linhas.Add('')
$linhas.Add("BASE: **$iAluno ALUNOS** listados.")
$linhas.Add('')

# ===================== LEITURA RAPIDA =====================
$linhas.Add('## LEITURA RÁPIDA')
$linhas.Add('')
$saturados = @($stats | Where-Object { $_.Pendente -eq 0 })
# o campeao sai da MESMA lista que monta a Tabela 1 ($stats, ja ordenada por Pendente):
# os dois numeros nunca podem divergir. O empate e dito com todas as letras - sem isso o
# "maior" seria escolhido pela ordem alfabetica da planilha, e a leitura mentiria.
$comPend = @($stats | Where-Object { $_.Pendente -gt 0 })
if ($comPend.Count) {
  $maxPend  = $comPend[0].Pendente
  $campeoes = @($comPend | Where-Object { $_.Pendente -eq $maxPend })
  $pctCamp  = if ($total -gt 0) { [math]::Round($maxPend / $total * 100) } else { 0 }
  $nomesCamp = ($campeoes | ForEach-Object { $_.Treino }) -join ' e '
  if ($campeoes.Count -gt 1) {
    $linhas.Add("- **Maior oportunidade de venda:** empate entre **$nomesCamp** — $maxPend dos $total alunos ainda não têm cada um ($pctCamp% da turma).")
  } else {
    $linhas.Add("- **Maior oportunidade de venda:** **$nomesCamp** — $maxPend dos $total alunos ainda não têm ($pctCamp% da turma).")
  }
  # todos os demais com pendencia, nao so os 3 primeiros: a lista inteira e o cardapio de venda
  $resto = @($comPend | Where-Object { $_.Pendente -lt $maxPend })
  if ($resto.Count) {
    $txtResto = ($resto | ForEach-Object { "$($_.Treino) ($($_.Pendente))" }) -join ', '
    $linhas.Add("- **Demais pendentes:** $txtResto.")
  }
}
if ($saturados.Count) {
  $txtSat = ($saturados | ForEach-Object { $_.Treino }) -join ', '
  $linhas.Add("- **Saturados (toda a turma já possui):** $txtSat.")
}
$totPend = ($stats | Measure-Object -Property Pendente -Sum).Sum
$linhas.Add("- **Total de pendências na turma:** $totPend (somando todos os treinamentos).")

# detalhe p/ o drill (tabela 3): { det:{ "TREINO":{adq:[],pen:[]} }, cons:{ "Aluno":"Consultor" } }
$det = [ordered]@{}
foreach ($c in $trainCols) { $t = $c.Trim(); $det[$t] = [ordered]@{ adq = @($detAdq[$t]); pen = @($detPen[$t]) } }
$outDet = [ordered]@{ det = $det; cons = $consMap; pres = $rotPres }   # pres: rotulo do filtro, p/ a matriz de alunos dizer de qual base ela saiu
$jsonDet = $outDet | ConvertTo-Json -Compress -Depth 6
if ([string]::IsNullOrWhiteSpace($jsonDet)) { $jsonDet = '{}' }

Write-Output (($linhas -join "`r`n") + "`r`n`r`n<!--LT-DET:" + $jsonDet + "-->")
