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
  [Parameter(Mandatory=$true)][string]$Link
)

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

# 1) extrai ID + gid do link
$mId  = [regex]::Match($Link, '/spreadsheets/d/([a-zA-Z0-9_-]+)')
if (-not $mId.Success) { Write-Output "Link invalido: nao encontrei o ID da planilha."; return }
$sheetId = $mId.Groups[1].Value
$mGid = [regex]::Match($Link, 'gid=([0-9]+)')
$gid  = if ($mGid.Success) { $mGid.Groups[1].Value } else { '0' }

# 2) baixa a aba como CSV
$exportUrl = "https://docs.google.com/spreadsheets/d/$sheetId/export?format=csv&gid=$gid"
$tmp = Join-Path $env:TEMP "leitura_turma_$gid.csv"
try {
  Invoke-WebRequest -Uri $exportUrl -OutFile $tmp -UseBasicParsing -ErrorAction Stop
} catch {
  Write-Output "Nao consegui baixar a planilha. Verifique se o link esta publico (qualquer pessoa com o link pode ver)."
  return
}
$csv = @(Import-Csv -Path $tmp -Encoding UTF8)
if ($csv.Count -eq 0) { Write-Output "A aba (gid=$gid) veio vazia."; return }

# 3) detecta colunas de treinamento (>=50% das celulas sao ADQUIRIDO/PENDENTE)
$headers = $csv[0].PSObject.Properties.Name
$trainCols = @()
foreach ($h in $headers) {
  $hits = @($csv.$h | Where-Object { $_ -match 'ADQUIR|PENDEN' }).Count
  if ($hits -ge ($csv.Count * 0.5)) { $trainCols += $h }
}
if ($trainCols.Count -eq 0) { Write-Output "Nao encontrei colunas de treinamento (ADQUIRIDO/PENDENTE) nesta aba."; return }

# coluna do nome do aluno = primeira coluna que NAO e de treinamento
$nomeCol = ($headers | Where-Object { $trainCols -notcontains $_ } | Select-Object -First 1)
if (-not $nomeCol) { $nomeCol = $headers[0] }
# coluna do CONSULTOR (opcional): header casa consultor/responsavel/vendedor/closer/assessor
$consCol = ($headers | Where-Object { $trainCols -notcontains $_ -and $_ -match '(?i)consultor|respons|vendedor|closer|assessor' } | Select-Object -First 1)

$total = $csv.Count
$linhas = New-Object System.Collections.Generic.List[string]

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
$linhas.Add("BASE: **$total ALUNOS** (aba gid=$gid)")
$linhas.Add('')

# ===================== TABELA 2: por aluno =====================
$linhas.Add('## TABELA 2 - LEITURA DOS ALUNOS: QUAIS TREINAMENTOS JÁ POSSUI E QUAL NÃO TEM')
$linhas.Add('')
$linhas.Add('| ALUNO | JÁ POSSUI | NÃO POSSUI |')
$linhas.Add('|---|---|---|')
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
  $linhas.Add("| $nome | $sPossui | $sNao |")
}
$linhas.Add('')

# ===================== LEITURA RAPIDA =====================
$linhas.Add('## LEITURA RÁPIDA')
$linhas.Add('')
$saturados = @($stats | Where-Object { $_.Pendente -eq 0 })
$top = @($stats | Where-Object { $_.Pendente -gt 0 } | Select-Object -First 3)
if ($top.Count) {
  $txtTop = ($top | ForEach-Object { "$($_.Treino) ($($_.Pendente))" }) -join ', '
  $linhas.Add("- **Maior oportunidade de venda (mais pendentes):** $txtTop.")
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
$outDet = [ordered]@{ det = $det; cons = $consMap }
$jsonDet = $outDet | ConvertTo-Json -Compress -Depth 6
if ([string]::IsNullOrWhiteSpace($jsonDet)) { $jsonDet = '{}' }

Write-Output (($linhas -join "`r`n") + "`r`n`r`n<!--LT-DET:" + $jsonDet + "-->")
