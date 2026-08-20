# Sincronizar-FRZ.ps1
# Faz pelo terminal exatamente o que o botao "Sincronizar FRZ" faz no app.
# Replica assets/js/58-frz-sync.js: HUD (pipeline_entries) + EXTRACLASSE
# (assets/js/59-extraclasse-zs.js) -> Firebase pipelineSales/<mes>.
#
# REGRAS (as mesmas do JS, para os dois lados nunca divergirem):
#   1. Espelho fiel: a origem manda. Apagou la -> some daqui.
#   2. So remove o que tem _frz:true E consultor do escopo. Venda lancada a
#      mao no app nunca e tocada.
#   3. Valor sobe LIQUIDO (o que esta no HUD). Nao recalcula nada.
#   4. und > 1 vira sufixo no nome do produto ("MCIS x3").
#   5. So o mes vigente, igual a trava do botao.
#
# USO:
#   .\Sincronizar-FRZ.ps1              # previa (nao grava)
#   .\Sincronizar-FRZ.ps1 -Aplicar     # grava no Firebase
#
# IMPORTANTE: salvar com BOM UTF-8 (senao o PS 5.1 estropia os acentos).
param(
  [string]$Periodo = (Get-Date -Format 'yyyy-MM'),
  [switch]$Aplicar,
  [switch]$ForcarMesAntigo
)

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$ErrorActionPreference = 'Stop'

$SB_URL = 'https://mnfxnepsfdfcmoglmgec.supabase.co/rest/v1/pipeline_entries'
$SB_KEY = 'sb_publishable_hbmxtsjNBloNR6CYBXZ8Zw_FQeMZXOC'
$FB_URL = 'https://dashboardcomercialpa-default-rtdb.firebaseio.com'
$RAIZ   = $PSScriptRoot
$ARQ_EX = Join-Path $RAIZ 'assets\js\59-extraclasse-zs.js'

# Nome no HUD -> nome do consultor no app. Igualzinho ao 58-frz-sync.js:
# errou a chave, o consultor some do sync sem dar erro nenhum.
$CONSULTORES = [ordered]@{
  'Gabriela'          = 'GABRIELA SOUZA'
  'Karla'             = 'KARLA FERREIRA'
  'Heverton Leonardo' = 'HEVERTON LEONARDO'
  'Natália'           = 'NATALIA OLIVEIRA'
}
$EXTRACLASSE_NOME = 'EXTRACLASSE'
$STATUS = [ordered]@{ 'FECHADO' = 'pago'; 'ABERTO' = 'aberto'; 'PROJEÇÃO' = 'negociacao' }

# Comparacao de status sem acento e em maiusculas (igual ao _stKey do JS).
function StKey($s) {
  $t = [string]$s
  $n = $t.Normalize([Text.NormalizationForm]::FormD)
  $sb = New-Object Text.StringBuilder
  foreach ($ch in $n.ToCharArray()) { if ([int]$ch -lt 128) { [void]$sb.Append($ch) } }
  return $sb.ToString().ToUpper().Trim()
}
$STATUS_N = @{}
foreach ($k in $STATUS.Keys) { $STATUS_N[(StKey $k)] = $STATUS[$k] }
function StatusApp($s) { return $STATUS_N[(StKey $s)] }

# Trava do mes vigente (a mesma do botao).
$mkHoje = (Get-Date -Format 'yyyy-MM')
if ($Periodo -ne $mkHoje -and -not $ForcarMesAntigo) {
  Write-Output "ERRO: o sync do FRZ so roda no mes vigente ($mkHoje). Use -ForcarMesAntigo se for mesmo o caso."
  return
}

# ---------- 1) HUD (Supabase) ----------
$nomes = @($CONSULTORES.Keys)
$inCons = '(' + (($nomes | ForEach-Object { '"' + $_ + '"' }) -join ',') + ')'
$inSt   = '(' + ((@($STATUS.Keys) | ForEach-Object { '"' + $_ + '"' }) -join ',') + ')'
$url = $SB_URL + '?select=*&month=eq.' + [uri]::EscapeDataString($Periodo) `
     + '&consultant=in.' + [uri]::EscapeDataString($inCons) `
     + '&status=in.' + [uri]::EscapeDataString($inSt) + '&limit=2000'
$hdr = @{ apikey = $SB_KEY; Authorization = "Bearer $SB_KEY" }
try {
  $r = Invoke-WebRequest -Uri $url -Headers $hdr -UseBasicParsing -ErrorAction Stop
  # PEGADINHA PS 5.1: @(... | ConvertFrom-Json) devolve UM item que e o array
  # inteiro. So o foreach desembrulha de verdade.
  $parsed = [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()) | ConvertFrom-Json
  $remotos = @(); foreach ($x in $parsed) { $remotos += $x }
} catch { Write-Output "ERRO ao ler o HUD: $($_.Exception.Message)"; return }

# ---------- 2) EXTRACLASSE (arquivo gerado pelo Sync-Extraclasse-ZS.ps1) ----------
$extra = @()
$exMes = ''
if (Test-Path $ARQ_EX) {
  $txt = Get-Content -Raw -Encoding UTF8 $ARQ_EX
  $mMes = [regex]::Match($txt, "mes:\s*'([^']+)'")
  if ($mMes.Success) { $exMes = $mMes.Groups[1].Value }
  $mArr = [regex]::Match($txt, "vendas:\s*(\[[\s\S]*\])\s*\}\s*;")
  if ($mArr.Success -and $exMes -eq $Periodo) {
    $parsedEx = $mArr.Groups[1].Value | ConvertFrom-Json
    foreach ($x in $parsedEx) { $extra += $x }
  }
}

# ---------- 3) monta os itens (id -> venda), igual ao JS ----------
function DataIso($e) {
  if ($e.data_iso -and $e.data_iso -match '^\d{4}-\d{2}-\d{2}$') { return [string]$e.data_iso }
  $m = [regex]::Match([string]$e.data, '^(\d{2})/(\d{2})$')
  if ($m.Success) { return $Periodo.Substring(0,4) + '-' + $m.Groups[2].Value + '-' + $m.Groups[1].Value }
  if ($e.created_at) {
    try {
      $d = [datetime]::Parse($e.created_at)
      $iso = $d.ToString('yyyy-MM-dd')
      if ($iso.Substring(0,7) -eq $Periodo) { return $iso }
    } catch {}
  }
  return "$Periodo-01"
}

$itens = @()
foreach ($e in $remotos) {
  $app = $CONSULTORES[[string]$e.consultant]
  $st  = StatusApp $e.status
  if (-not $app -or -not $st) { continue }
  $und = 1; if ($e.und) { $und = [int]$e.und }
  $produto = ([string]$e.curso).Trim()
  if ($und -gt 1) { $produto = $produto + ' ' + [char]0x00D7 + $und }
  $orig = 'FRZ HUD'
  if ($e.origem) { $orig = $orig + ' ' + [char]0x00B7 + ' ' + [string]$e.origem }
  $ts = 0
  try { $ts = [int64]([datetimeoffset]::Parse($e.created_at)).ToUnixTimeMilliseconds() } catch { $ts = [int64]([datetimeoffset](Get-Date)).ToUnixTimeMilliseconds() }
  $itens += [pscustomobject]@{
    Id = 'frz_' + $e.id
    Venda = [ordered]@{
      clienteNome   = ([string]$e.aluno).Trim()
      consultorNome = $app
      produto       = $produto
      valor         = [double]$e.valor
      status        = $st
      data          = (DataIso $e)
      origemManual  = $orig
      obs           = ''
      mes           = $Periodo
      '_src'        = 'avulso'
      '_frz'        = $true
      frzId         = [string]$e.id
      ts            = $ts
    }
  }
}
foreach ($v in $extra) {
  $st = StatusApp $v.status; if (-not $st) { $st = 'pago' }
  $dt = [string]$v.data; if (-not $dt) { $dt = "$Periodo-01" }
  $itens += [pscustomobject]@{
    Id = 'zs_' + $v.id
    Venda = [ordered]@{
      clienteNome   = ([string]$v.cliente).Trim()
      consultorNome = $EXTRACLASSE_NOME
      produto       = ([string]$v.produto).Trim()
      valor         = [double]$v.valor
      status        = $st
      data          = $dt
      origemManual  = 'ZS ' + [char]0x00B7 + ' Extraclasse'
      obs           = ''
      mes           = $Periodo
      '_src'        = 'avulso'
      '_frz'        = $true
      frzId         = 'zs_' + $v.id
      ts            = [int64]([datetimeoffset](Get-Date)).ToUnixTimeMilliseconds()
    }
  }
}

# ---------- 4) o que ja existe no app ----------
$locais = @{}
try {
  $rf = Invoke-WebRequest -Uri "$FB_URL/pipelineSales/$Periodo.json" -UseBasicParsing -ErrorAction Stop
  $t = [Text.Encoding]::UTF8.GetString($rf.RawContentStream.ToArray())
  if ($t -and $t -ne 'null') {
    $o = $t | ConvertFrom-Json
    foreach ($p in $o.PSObject.Properties) { $locais[$p.Name] = $p.Value }
  }
} catch { Write-Output "ERRO ao ler o Firebase: $($_.Exception.Message)"; return }

# ---------- 5) diff (mesma comparacao do _igual) ----------
function Igual($a, $b) {
  if (-not $a -or -not $b) { return $false }
  return ([string]$a.clienteNome   -eq [string]$b.clienteNome) `
    -and ([string]$a.consultorNome -eq [string]$b.consultorNome) `
    -and ([string]$a.produto       -eq [string]$b.produto) `
    -and ([double]$a.valor         -eq [double]$b.valor) `
    -and ([string]$a.status        -eq [string]$b.status) `
    -and ([string]$a.data          -eq [string]$b.data) `
    -and ([string]$a.origemManual  -eq [string]$b.origemManual)
}

$novos = @(); $mudados = @(); $iguais = 0
foreach ($it in $itens) {
  $atual = $locais[$it.Id]
  if (-not $atual) { $novos += $it; continue }
  if (Igual $atual $it.Venda) { $iguais++ } else { $mudados += $it }
}

$vivos = @{}; foreach ($it in $itens) { $vivos[$it.Id] = $true }
$escopo = @{}; foreach ($k in $CONSULTORES.Keys) { $escopo[$CONSULTORES[$k]] = $true }
$escopo[$EXTRACLASSE_NOME] = $true
$remover = @()
foreach ($k in $locais.Keys) {
  $v = $locais[$k]
  if (-not $v -or $v._frz -ne $true) { continue }
  if (-not $escopo[[string]$v.consultorNome]) { continue }
  if ($vivos[$k]) { continue }
  $remover += $k
}

# ---------- 6) saida ----------
$modo = if ($Aplicar) { 'APLICADO' } else { 'PREVIA (nada foi gravado)' }
Write-Output "# SINCRONIZAR FRZ - $Periodo  [$modo]"
Write-Output ''
Write-Output ("Origem: {0} do HUD + {1} do EXTRACLASSE = {2} lancamento(s)." -f ($itens.Count - $extra.Count), $extra.Count, $itens.Count)
if ($extra.Count -eq 0 -and $exMes -and $exMes -ne $Periodo) {
  Write-Output "AVISO: 59-extraclasse-zs.js e do mes $exMes - ignorado. Rode Sync-Extraclasse-ZS.ps1 -Aplicar."
}
Write-Output ''
if ($novos.Count) {
  Write-Output '**Novos**'
  Write-Output '| Consultor | Cliente | Produto | Valor | Status |'
  Write-Output '|---|---|---|--:|---|'
  foreach ($it in $novos) { Write-Output ("| {0} | {1} | {2} | {3:N2} | {4} |" -f $it.Venda.consultorNome, $it.Venda.clienteNome, $it.Venda.produto, $it.Venda.valor, $it.Venda.status) }
  Write-Output ''
}
if ($mudados.Count) {
  Write-Output '**Atualizados**'
  Write-Output '| Consultor | Cliente | Produto | Valor | Status |'
  Write-Output '|---|---|---|--:|---|'
  foreach ($it in $mudados) { Write-Output ("| {0} | {1} | {2} | {3:N2} | {4} |" -f $it.Venda.consultorNome, $it.Venda.clienteNome, $it.Venda.produto, $it.Venda.valor, $it.Venda.status) }
  Write-Output ''
}
if ($remover.Count) {
  Write-Output '**Removidos (sumiram da origem)**'
  Write-Output '| Id | Consultor | Cliente | Valor |'
  Write-Output '|---|---|---|--:|'
  foreach ($k in $remover) { $v = $locais[$k]; Write-Output ("| {0} | {1} | {2} | {3:N2} |" -f $k, $v.consultorNome, $v.clienteNome, [double]$v.valor) }
  Write-Output ''
}
Write-Output ("Resumo: {0} novo(s) - {1} atualizado(s) - {2} ja igual(is) - {3} removido(s)." -f $novos.Count, $mudados.Count, $iguais, $remover.Count)

if (-not $Aplicar) {
  Write-Output ''
  Write-Output 'Rode com -Aplicar para gravar.'
  return
}

# ---------- 7) gravacao ----------
$ok = 0; $errs = @()
foreach ($it in @($novos + $mudados)) {
  $body = [Text.Encoding]::UTF8.GetBytes(($it.Venda | ConvertTo-Json -Depth 6 -Compress))
  try {
    Invoke-WebRequest -Uri "$FB_URL/pipelineSales/$Periodo/$($it.Id).json" -Method Put -Body $body -ContentType 'application/json' -UseBasicParsing -ErrorAction Stop | Out-Null
    $ok++
  } catch { $errs += "$($it.Venda.clienteNome): $($_.Exception.Message)" }
}
$del = 0
foreach ($k in $remover) {
  try {
    Invoke-WebRequest -Uri "$FB_URL/pipelineSales/$Periodo/$k.json" -Method Delete -UseBasicParsing -ErrorAction Stop | Out-Null
    $del++
  } catch { $errs += "remover $k : $($_.Exception.Message)" }
}
Write-Output ''
Write-Output ("Gravados {0} - removidos {1}." -f $ok, $del)
if ($errs.Count) { Write-Output 'FALHAS:'; $errs | ForEach-Object { Write-Output "  - $_" } }
