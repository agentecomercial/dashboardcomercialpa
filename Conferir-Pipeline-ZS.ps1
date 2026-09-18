<#
════════════════════════════════════════════════════════════════════════════
 Conferir-Pipeline-ZS.ps1 — bate o faturamento de um consultor nas DUAS bases:

   PIPELINE  https://frz-pipeline-hud.vercel.app  → Supabase `pipeline_entries`
   ZS        Sales Cube (MCP) via Faturamento-Vitoria.ps1

 Devolve: as duas listas, o que só existe de cada lado e o total real
 (união das duas). É a conferência que antes era feita à mão.

 USO
 ───
   .\Conferir-Pipeline-ZS.ps1 -Consultor Heverton
   .\Conferir-Pipeline-ZS.ps1 -Consultor Natália -Periodo 2026-07
   .\Conferir-Pipeline-ZS.ps1 -Todos                       # equipe Vitória
   .\Conferir-Pipeline-ZS.ps1 -Consultor Karla -Csv

 PEGADINHAS resolvidas aqui
 ──────────────────────────
 • Acento no nome: `ilike.*natal*` NÃO casa com "Natália". O script lê as
   grafias reais do HUD e casa por nome normalizado (sem acento).
 • O HUD guarda nome curto ("MAIKEL SILVA") e o ZS o nome completo
   ("Maikel Da Silva Simão") → pareamento por VALOR + primeiro nome.
 • Lançamento sem `data_iso` no HUD entra no total mas é marcado, porque
   nenhuma sincronização enxerga ele.
════════════════════════════════════════════════════════════════════════════
#>
param(
  [string]$Consultor = '',
  [string]$Periodo = '',
  [switch]$Todos,
  [switch]$Csv
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

$SB_BASE = 'https://mnfxnepsfdfcmoglmgec.supabase.co/rest/v1'
$SB_KEY  = 'sb_publishable_hbmxtsjNBloNR6CYBXZ8Zw_FQeMZXOC'
$HDR     = @{ apikey = $SB_KEY; Authorization = "Bearer $SB_KEY" }
$RAIZ    = Split-Path -Parent $MyInvocation.MyCommand.Path
$EQUIPE  = @('Gabriela', 'Karla', 'Natália', 'Heverton Leonardo')

if (-not $Periodo) { $Periodo = (Get-Date -Format 'yyyy-MM') }
if ($Periodo -notmatch '^\d{4}-\d{2}$') { Write-Output '**-Periodo inválido.** Use AAAA-MM.'; exit 1 }

function Norm($s) {
  $t = [string]$s
  $t = $t.Normalize([Text.NormalizationForm]::FormD) -replace '[^\x00-\x7F]', ''
  return ($t -replace '\s+', ' ').Trim().ToUpper()
}
function Prim($s) { $p = @((Norm $s) -split ' ' | Where-Object { $_ }); if ($p.Count) { $p[0] } else { '' } }
# tokens de 4+ letras, sem conectivos: base do pareamento entre nome curto (HUD)
# e nome completo (ZS)
function Tokens($s) { return , @((Norm $s) -split ' ' | Where-Object { $_.Length -ge 4 -and $_ -notin 'JUNIOR','FILHO','NETO','SANTO','SANTOS','SILVA','COSTA','SOUZA','SOUSA','OLIVEIRA','PEREIRA','RIBEIRO','CARVALHO','ALVES','LIMA','ROCHA','MARTINS','BARBOSA','GOMES','ALMEIDA','NASCIMENTO','FERREIRA','RODRIGUES','FERNANDES','CARDOSO' }) }
function Valor($v) {
  if ($v -is [double] -or $v -is [decimal] -or $v -is [int]) { return [double]$v }
  $t = ([string]$v).Trim() -replace '[^\d,\.]', ''
  if (-not $t) { return 0.0 }
  if ($t -match ',') { $t = ($t -replace '\.', '') -replace ',', '.' }
  return [double]::Parse($t, [Globalization.CultureInfo]::InvariantCulture)
}
function Sb-Get($rota) { ((Invoke-WebRequest -Uri "$SB_BASE/$rota" -Headers $HDR -UseBasicParsing).Content | ConvertFrom-Json) }

# ── grafia real do consultor no HUD (o acento quebra o ilike) ────────────────
$grafias = @(Sb-Get 'pipeline_entries?select=consultant') | ForEach-Object { $_.consultant } | Where-Object { $_ } | Sort-Object -Unique
function Grafia-HUD($nome) {
  $n = Norm $nome
  $hit = @($grafias | Where-Object { (Norm $_) -eq $n })
  if ($hit.Count -eq 0) { $hit = @($grafias | Where-Object { (Norm $_).StartsWith($n) }) }
  if ($hit.Count -eq 0) { $hit = @($grafias | Where-Object { (Norm $_).Contains($n) }) }
  if ($hit.Count) { return $hit[0] }
  return ''
}

# ── lado 1: HUD ─────────────────────────────────────────────────────────────
function Get-HUD($nomeHud) {
  $enc = [Uri]::EscapeDataString($nomeHud)
  $r = @(Sb-Get "pipeline_entries?select=data_iso,aluno,curso,und,valor,status,origem&consultant=eq.$enc&month=eq.$Periodo&order=data_iso.asc")
  $out = @()
  foreach ($x in $r) {
    $out += [pscustomobject]@{
      data = $(if ($x.data_iso) { ([datetime]$x.data_iso).ToString('dd/MM') } else { 'SEM DATA' })
      aluno = $x.aluno; curso = $x.curso; und = [int]$x.und
      valor = (Valor $x.valor); status = $x.status; usado = $false; duvida = $false
    }
  }
  return , @($out)
}

# ── lado 2: ZS (reaproveita o Faturamento-Vitoria.ps1) ───────────────────────
function Get-ZS($nomeZs) {
  # O filtro do Faturamento-Vitoria compara o texto cru: "Natália" NÃO casa com
  # "Natalia Cunha" (acento) e sobrenome do HUD pode não existir lá. Manda só o
  # primeiro nome SEM acento — "Natalia", "Heverton", "Karla".
  $busca = (Prim $nomeZs)
  if ($busca.Length -gt 1) { $busca = $busca.Substring(0,1) + $busca.Substring(1).ToLower() }
  $txt = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RAIZ 'Faturamento-Vitoria.ps1') -Periodo $Periodo -Consultor $busca -Detalhe 2>&1 | Out-String
  $out = @()
  # linhas do detalhe: | 05/08/2026 | CLIENTE | Aprovado | R$ 1.997,00 | ...
  foreach ($m in [regex]::Matches($txt, '(?m)^\|\s*(\d{2}/\d{2}/\d{4})\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*R\$\s*([\d\.,]+)\s*\|')) {
    $out += [pscustomobject]@{
      data = $m.Groups[1].Value.Substring(0, 5); cliente = $m.Groups[2].Value.Trim()
      financeiro = $m.Groups[3].Value.Trim(); valor = (Valor $m.Groups[4].Value); usado = $false; duvida = $false
    }
  }
  return , @($out)
}

# ── pareamento: valor igual + primeiro nome compatível ──────────────────────
function Parear($hud, $zs) {
  # valor igual SOZINHO não é prova: dois clientes diferentes fecham o mesmo
  # preço de tabela o tempo todo. Exige valor + nome compatível; valor sem nome
  # vira "duvidoso" (⚠), nunca casado.
  foreach ($h in $hud) {
    $cand = @($zs | Where-Object { -not $_.usado -and [math]::Abs($_.valor - $h.valor) -lt 0.005 })
    if (-not $cand.Count) { continue }
    # ⚠ PEGADINHA PS: chamar função que usa pipeline DENTRO de um Where-Object
    # sobrescreve o $_ do bloco externo. Por isso tudo é calculado antes, em
    # variáveis, e o laço é foreach — não Where-Object.
    $primH = Prim $h.aluno
    $tokH  = Tokens $h.aluno
    $hit = $null
    foreach ($c in $cand) { if ((Prim $c.cliente) -eq $primH) { $hit = $c; break } }
    # qualquer token de 4+ letras em comum — cobre "Stéfany Godoy" x "Stéphany
    # Godoy" e "MAIKEL SILVA" x "Maikel Da Silva Simão", sem casar homônimos de
    # valor igual ("Iasmin Brambilla" x "Kamila Barbara").
    if (-not $hit) {
      foreach ($c in $cand) {
        $tokC = Tokens $c.cliente
        $comuns = 0
        foreach ($t in $tokC) { if ($tokH -contains $t) { $comuns++ } }
        if ($comuns -gt 0) { $hit = $c; break }
      }
    }
    if ($hit) { $h.usado = $true; $hit.usado = $true; continue }
    $h.duvida = $true; $cand[0].duvida = $true
  }
}

function Relatorio($nome) {
  $nomeHud = Grafia-HUD $nome
  if (-not $nomeHud) { Write-Output "### $nome"; Write-Output ''; Write-Output "**Não achei esse consultor no HUD.** Grafias existentes: $($grafias -join ' · ')"; Write-Output ''; return }
  $hudAll = Get-HUD $nomeHud
  # PROJEÇÃO no HUD é negociação, não faturamento — comparar com o ZS só o que
  # está FECHADO/ABERTO, senão a "divergência" vira ruído de pipeline futuro.
  $hud  = @($hudAll | Where-Object { (Norm $_.status) -ne 'PROJECAO' })
  $proj = @($hudAll | Where-Object { (Norm $_.status) -eq 'PROJECAO' })
  $zs   = Get-ZS $nome
  Parear $hud $zs

  $tHud = ($hud | Measure-Object valor -Sum).Sum; if (-not $tHud) { $tHud = 0 }
  $tZs  = ($zs  | Measure-Object valor -Sum).Sum; if (-not $tZs)  { $tZs  = 0 }
  $tPrj = ($proj | Measure-Object valor -Sum).Sum; if (-not $tPrj) { $tPrj = 0 }
  $soHud = @($hud | Where-Object { -not $_.usado })
  $soZs  = @($zs  | Where-Object { -not $_.usado })
  $real  = $tZs + (($soHud | Measure-Object valor -Sum).Sum)

  Write-Output "## $nomeHud — $Periodo"
  Write-Output ''
  Write-Output '| Fonte | Lançamentos | Valor |'
  Write-Output '|---|--:|--:|'
  Write-Output ('| FRZ HUD — vendas (FECHADO/ABERTO) | {0} | R$ {1:N2} |' -f $hud.Count, $tHud)
  Write-Output ('| ZS (Sales Cube) | {0} | R$ {1:N2} |' -f $zs.Count, $tZs)
  Write-Output ('| **Diferença** | **{0:+#;-#;0}** | **R$ {1:N2}** |' -f ($hud.Count - $zs.Count), ($tHud - $tZs))
  if ($proj.Count) { Write-Output ('| _HUD — projeção (fora da conta)_ | _{0}_ | _R$ {1:N2}_ |' -f $proj.Count, $tPrj) }
  Write-Output ''

  if ($hud.Count) {
    Write-Output '**Pipeline (HUD) — vendas**'
    Write-Output ''
    Write-Output '| Data | Aluno | Curso | Und | Valor | Status | No ZS? |'
    Write-Output '|---|---|---|--:|--:|---|:-:|'
    foreach ($h in $hud) { Write-Output ('| {0} | {1} | {2} | {3} | {4:N2} | {5} | {6} |' -f $h.data, $h.aluno, $h.curso, $h.und, $h.valor, $h.status, $(if ($h.usado) { '✔' } elseif ($h.duvida) { '⚠' } else { '❌' })) }
    Write-Output ''
  }
  if ($zs.Count) {
    Write-Output '**ZS (Sales Cube)**'
    Write-Output ''
    Write-Output '| Data | Cliente | Financeiro | Valor | No HUD? |'
    Write-Output '|---|---|---|--:|:-:|'
    foreach ($z in $zs) { Write-Output ('| {0} | {1} | {2} | {3:N2} | {4} |' -f $z.data, $z.cliente, $z.financeiro, $z.valor, $(if ($z.usado) { '✔' } elseif ($z.duvida) { '⚠' } else { '❌' })) }
    Write-Output ''
  }
  if ($proj.Count) {
    Write-Output ('**Projeção no HUD (não é faturamento) — {0} · R$ {1:N2}**' -f $proj.Count, $tPrj)
    Write-Output ''
    Write-Output '| Data | Aluno | Curso | Valor |'
    Write-Output '|---|---|---|--:|'
    foreach ($p in $proj) { Write-Output ('| {0} | {1} | {2} | {3:N2} |' -f $p.data, $p.aluno, $p.curso, $p.valor) }
    Write-Output ''
  }

  Write-Output '**Divergências**'
  Write-Output ''
  if ($soHud.Count) {
    Write-Output ('_Só no HUD ({0} · R$ {1:N2}) — falta lançar no ZS:_' -f $soHud.Count, (($soHud | Measure-Object valor -Sum).Sum))
    foreach ($h in $soHud) { Write-Output ('- **{0}** · {1} · R$ {2:N2} · {3}{4}' -f $h.aluno, $h.curso, $h.valor, $h.data, $(if ($h.data -eq 'SEM DATA') { ' ⚠️ sem data no HUD' } else { '' })) }
    Write-Output ''
  }
  if ($soZs.Count) {
    Write-Output ('_Só no ZS ({0} · R$ {1:N2}) — falta lançar no HUD:_' -f $soZs.Count, (($soZs | Measure-Object valor -Sum).Sum))
    foreach ($z in $soZs) { Write-Output ('- **{0}** · R$ {1:N2} · {2}{3}' -f $z.cliente, $z.valor, $z.data, $(if ($z.valor -le 0) { ' ⚠️ venda de R$ 0,00' } else { '' })) }
    Write-Output ''
  }
  if (-not $soHud.Count -and -not $soZs.Count) { Write-Output '✅ **As duas bases batem** — nenhum lançamento sobrando de lado nenhum.'; Write-Output '' }
  Write-Output ('**Total real (união das duas bases): R$ {0:N2}**' -f $real)
  Write-Output ''

  if ($Csv) {
    $f = Join-Path $env:TEMP ("conferencia_" + (Norm $nomeHud).Replace(' ', '_') + "_$Periodo.csv")
    $linhas = @()
    foreach ($h in $hud) { $linhas += [pscustomobject]@{ Fonte='HUD'; Data=$h.data; Pessoa=$h.aluno; Curso=$h.curso; Valor=$h.valor; Status=$h.status; Pareado=$(if($h.usado){'sim'}else{'nao'}) } }
    foreach ($z in $zs)  { $linhas += [pscustomobject]@{ Fonte='ZS';  Data=$z.data; Pessoa=$z.cliente; Curso='';      Valor=$z.valor; Status=$z.financeiro; Pareado=$(if($z.usado){'sim'}else{'nao'}) } }
    $linhas | Export-Csv -Path $f -NoTypeInformation -Encoding UTF8
    Write-Output "_CSV: $f_"
    Write-Output ''
  }
}

# ── execução ────────────────────────────────────────────────────────────────
if (-not $Consultor -and -not $Todos) {
  Write-Output '## Conferência Pipeline × ZS'
  Write-Output ''
  Write-Output "Consultores no HUD: **$($grafias -join ' · ')**"
  Write-Output ''
  Write-Output 'Rode com `-Consultor <nome>` ou `-Todos` (equipe Vitória).'
  exit 0
}
$alvos = if ($Todos) { $EQUIPE } else { @($Consultor) }
foreach ($a in $alvos) { Relatorio $a }
