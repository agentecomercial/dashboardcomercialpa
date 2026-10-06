# Sincronizar-ZS.ps1
# Fonte do botao "Sincronizar ZS" da Pipeline Comercial (desde 06/10/2026).
# Le as vendas da equipe direto no ZS (Sales Cube) e grava em
# Firebase pipelineSales/<mes>. Substitui o HUD (pipeline_entries) como origem:
# o que vale e o que esta no ZS.
#
# POR QUE UM SCRIPT: o navegador nao le o ZS (exige login e nao libera CORS).
# O botao do app chama a rota /api/sync-zs do Servir.ps1 do Meta Master
# (localhost:8765), que roda este script. Como o resultado vai para o Firebase,
# os tres enderecos do dashboard (Local, Desktop e GitHub Pages) enxergam igual.
#
# REGRAS (as mesmas do antigo sync do HUD):
#   1. Espelho fiel: o ZS manda. Saiu de la (perdeu o won, trocou de dono) -> some daqui.
#   2. So remove o que tem _frz:true E consultor do escopo. Venda lancada a mao
#      no app nunca e tocada. Os lancamentos antigos do HUD (frz_*) saem na 1a rodada.
#   3. Valor sobe LIQUIDO, item a item: Coaching Individual vale metade (o outro
#      50% e do coach). Item de R$ 0,00 (matricula, bonus, 2a vaga) nao entra.
#   4. Ganha (won) no mes, pela close_date -> "pago". Negociacao (etapas 4/5 do funil
#      -> "negociacao", o "Potencial total") SO com -ComNegociacao: na equipe sao
#      dezenas de leads de R$ 1.997 que lotariam a tabela de vendas (06/10/2026: 41).
#   5. Vitoria (org 2) e Teresina (org 3). So o mes vigente, salvo -ForcarMesAntigo.
#
# USO:
#   .\Sincronizar-ZS.ps1                # previa (nao grava)
#   .\Sincronizar-ZS.ps1 -Aplicar       # grava no Firebase
#   .\Sincronizar-ZS.ps1 -Aplicar -Json # o que a rota /api/sync-zs usa
#
# IMPORTANTE: salvar com BOM UTF-8 (senao o PS 5.1 estropia os acentos).
param(
  [string]$Periodo = (Get-Date -Format 'yyyy-MM'),
  [switch]$Aplicar,
  [switch]$Json,
  [switch]$ComNegociacao,
  [switch]$ForcarMesAntigo
)

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$ErrorActionPreference = 'Stop'

$API_BASE = 'https://api.zsales.com.br'
$AUTH     = Join-Path $PSScriptRoot 'sc-web-auth.json'
$FB_URL   = 'https://dashboardcomercialpa-default-rtdb.firebaseio.com'
$ORGS     = @(2, 3)   # Vitoria, Teresina

# Responsavel no ZS (assignee_user) -> nome do consultor na Pipeline. Chave em TEXTO:
# num [ordered], chave inteira e lida como POSICAO ($x[76] = 77o item = nulo).
# Mesmos nomes do antigo mapa do HUD (58-frz-sync.js), para as vendas casarem
# com metas, ranking e usuarios do app.
$CONSULTORES = [ordered]@{
  '76'    = 'GABRIELA SOUZA'
  '77'    = 'NATALIA OLIVEIRA'
  '79'    = 'HEVERTON LEONARDO'
  '16314' = 'KARLA FERREIRA'
  '28'    = 'EXTRACLASSE'        # Pablo
}

function Sair-Erro($msg) {
  if ($Json) { Write-Output (@{ ok = $false; erro = $msg } | ConvertTo-Json -Compress) } else { Write-Output "ERRO: $msg" }
  exit 1
}

if ($Periodo -notmatch '^\d{4}-\d{2}$') { Sair-Erro 'Periodo invalido: use AAAA-MM.' }
$mkHoje = (Get-Date -Format 'yyyy-MM')
if ($Periodo -ne $mkHoje -and -not $ForcarMesAntigo) { Sair-Erro "o sync do ZS so roda no mes vigente ($mkHoje)." }
$ini = "$Periodo-01"
$fim = ([datetime]$ini).AddMonths(1).AddDays(-1).ToString('yyyy-MM-dd')

# ---------- 1) login na API REST do ZS (so leitura daqui em diante) ----------
if (-not (Test-Path $AUTH)) { Sair-Erro "credenciais do ZS ausentes ($AUTH)." }
try {
  $cred  = Get-Content -Raw -Encoding UTF8 $AUTH | ConvertFrom-Json
  $login = Invoke-RestMethod -Uri "$API_BASE/api/auth/login/" -Method Post -ContentType 'application/json' `
           -Body (@{ email = $cred.email; password = $cred.password } | ConvertTo-Json) -TimeoutSec 30
} catch { Sair-Erro "login no ZS falhou: $($_.Exception.Message)" }

function Zs-Get($org, $path) {
  $h = @{ Authorization = "Bearer $($login.access)"; 'X-Organization-Id' = "$org" }
  $r = Invoke-WebRequest -Uri "$API_BASE$path" -Method Get -Headers $h -UseBasicParsing -TimeoutSec 40
  return ([Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()) | ConvertFrom-Json)
}

# Nome curto do produto, no padrao que a Pipeline ja usava (vinha do HUD):
# "FGPC - Formacao em ..." -> "FGPC"; "Metodo CIS - Global" -> "METODO CIS";
# "Coaching Individual - Alberto Freitas" -> "CI".
function Produto-Curto($nome) {
  $n = ([string]$nome).Trim()
  if ($n -match '(?i)^coaching\s+individual') { return 'CI' }
  $p = ($n -split '\s+-\s+')[0].Trim()
  if (-not $p) { $p = $n }
  return $p.ToUpper()
}

# ---------- 2) le o ZS: ganhas do mes + negociacao 4/5, item a item ----------
$itens = @()
$porCons = [ordered]@{}; foreach ($k in $CONSULTORES.Keys) { $porCons[$CONSULTORES[$k]] = 0.0 }
$tsAgora = [int64]([datetimeoffset](Get-Date)).ToUnixTimeMilliseconds()

function Add-Itens($org, $o, $nomeApp, $status) {
  $prods = @()
  try { $prods = @((Zs-Get $org "/api/opportunity-products/?opportunity=$($o.id)").results) } catch { }
  $linhas = @()
  foreach ($p in $prods) {
    $preco = [double]$p.price
    if ($preco -le 0) { continue }   # matricula / bonus / 2a vaga
    if ("$($p.product_name)" -match '(?i)coaching\s+individual') { $preco = $preco / 2 }
    $cli = ([string]$p.beneficiary_name).Trim(); if (-not $cli) { $cli = ([string]$o.customer_name).Trim() }
    $linhas += [pscustomobject]@{ pid = "$($p.id)"; produto = (Produto-Curto $p.product_name); valor = [math]::Round($preco, 2); cliente = $cli }
  }
  # Venda com valor e sem itens com preco: entra inteira, para nao sumir.
  if (-not $linhas.Count -and [double]$o.value -gt 0) {
    $linhas += [pscustomobject]@{ pid = 'v'; produto = 'VENDA ZS'; valor = [double]$o.value; cliente = ([string]$o.customer_name).Trim() }
  }
  $dt = if ($status -eq 'pago' -and $o.close_date) { "$($o.close_date)" } else { (Get-Date).ToString('yyyy-MM-dd') }
  foreach ($l in $linhas) {
    $script:itens += [pscustomobject]@{
      Id = "zs_$($o.id)_$($l.pid)"
      Org = $org
      Opp = "$($o.id)"
      Venda = [ordered]@{
        clienteNome   = $l.cliente
        consultorNome = $nomeApp
        produto       = $l.produto
        valor         = [double]$l.valor
        status        = $status
        data          = $dt
        origemManual  = 'ZS' + $(if ($org -eq 3) { ' ' + [char]0x00B7 + ' Teresina' } else { '' })
        obs           = ''
        mes           = $Periodo
        '_src'        = 'avulso'
        '_frz'        = $true
        '_zs'         = $true
        frzId         = "zs_$($o.id)_$($l.pid)"
        zsOrg         = $org
        zsOpp         = "$($o.id)"
        ts            = $script:tsAgora
      }
    }
    if ($status -eq 'pago') { $script:porCons[$nomeApp] += [double]$l.valor }
  }
}

try {
  foreach ($org in $ORGS) {
    foreach ($uid in $CONSULTORES.Keys) {
      $nomeApp = $CONSULTORES[$uid]
      # ganhas: ordenadas pela close_date mais recente, entao o mes vigente vem na 1a pagina
      $rw = Zs-Get $org "/api/opportunities/?assignee_user=$uid&outcome=won&ordering=-close_date&page_size=100"
      foreach ($o in @($rw.results | Where-Object { $_.close_date -ge $ini -and $_.close_date -le $fim })) {
        Add-Itens $org $o $nomeApp 'pago'
      }
      # negociacao de verdade: so etapas 4 e 5 do funil (lead frio fica fora do potencial)
      if (-not $ComNegociacao) { continue }
      $rn = Zs-Get $org "/api/opportunities/?assignee_user=$uid&outcome=negotiating&page_size=100"
      foreach ($o in @($rn.results | Where-Object { "$($_.funnel_stage_label)" -match '^\s*[45]' })) {
        Add-Itens $org $o $nomeApp 'negociacao'
      }
    }
  }
} catch { Sair-Erro "leitura do ZS falhou: $($_.Exception.Message)" }

# ---------- 3) o que ja existe no app ----------
$locais = @{}
try {
  $rf = Invoke-WebRequest -Uri "$FB_URL/pipelineSales/$Periodo.json" -UseBasicParsing -ErrorAction Stop
  $t = [Text.Encoding]::UTF8.GetString($rf.RawContentStream.ToArray())
  if ($t -and $t -ne 'null') {
    $o = $t | ConvertFrom-Json
    foreach ($p in $o.PSObject.Properties) { $locais[$p.Name] = $p.Value }
  }
} catch { Sair-Erro "leitura do Firebase falhou: $($_.Exception.Message)" }

# ---------- 4) diff (mesma comparacao do antigo _igual) ----------
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
$remover = @()
foreach ($k in $locais.Keys) {
  $v = $locais[$k]
  if (-not $v -or $v._frz -ne $true) { continue }
  if (-not $escopo[[string]$v.consultorNome]) { continue }
  if ($vivos[$k]) { continue }
  $remover += $k
}

# ---------- 5) gravacao ----------
$ok = 0; $del = 0; $errs = @()
if ($Aplicar) {
  foreach ($it in @($novos + $mudados)) {
    $body = [Text.Encoding]::UTF8.GetBytes(($it.Venda | ConvertTo-Json -Depth 6 -Compress))
    try {
      Invoke-WebRequest -Uri "$FB_URL/pipelineSales/$Periodo/$($it.Id).json" -Method Put -Body $body -ContentType 'application/json' -UseBasicParsing -ErrorAction Stop | Out-Null
      $ok++
    } catch { $errs += "$($it.Venda.clienteNome): $($_.Exception.Message)" }
  }
  foreach ($k in $remover) {
    try {
      Invoke-WebRequest -Uri "$FB_URL/pipelineSales/$Periodo/$k.json" -Method Delete -UseBasicParsing -ErrorAction Stop | Out-Null
      $del++
    } catch { $errs += "remover $k : $($_.Exception.Message)" }
  }
}

# ---------- 6) saida ----------
$pagos = @($itens | Where-Object { $_.Venda.status -eq 'pago' })
$negs  = @($itens | Where-Object { $_.Venda.status -eq 'negociacao' })
if ($Json) {
  $cons = [ordered]@{}; foreach ($k in $porCons.Keys) { $cons[$k] = [math]::Round($porCons[$k], 2) }
  Write-Output ([ordered]@{
    ok = ($errs.Count -eq 0); aplicado = [bool]$Aplicar; periodo = $Periodo
    novos = $novos.Count; atualizados = $mudados.Count; iguais = $iguais; removidos = $remover.Count
    gravados = $ok; apagados = $del
    vendas = $pagos.Count; negociacoes = $negs.Count
    totalPago = [math]::Round((($pagos | ForEach-Object { $_.Venda.valor }) | Measure-Object -Sum).Sum + 0, 2)
    porConsultor = $cons; falhas = $errs
  } | ConvertTo-Json -Depth 5 -Compress)
  exit 0
}
$modo = if ($Aplicar) { 'APLICADO' } else { 'PREVIA (nada foi gravado)' }
Write-Output "# SINCRONIZAR ZS - $Periodo  [$modo]"
Write-Output ''
Write-Output ("Origem: ZS (Vitoria + Teresina) = {0} venda(s) ganha(s) + {1} em negociacao." -f $pagos.Count, $negs.Count)
Write-Output ''
Write-Output '| Consultor | Cliente | Produto | Valor | Status | Opp |'
Write-Output '|---|---|---|--:|---|---|'
foreach ($it in ($itens | Sort-Object { $_.Venda.consultorNome }, { -$_.Venda.valor })) {
  Write-Output ("| {0} | {1} | {2} | {3:N2} | {4} | {5}{6} |" -f $it.Venda.consultorNome, $it.Venda.clienteNome, $it.Venda.produto, $it.Venda.valor, $it.Venda.status, $it.Opp, $(if ($it.Org -eq 3) { ' (org 3)' } else { '' }))
}
Write-Output ''
if ($remover.Count) {
  Write-Output '**Saem da Pipeline (nao estao no ZS)**'
  Write-Output '| Id | Consultor | Cliente | Valor |'
  Write-Output '|---|---|---|--:|'
  foreach ($k in $remover) { $v = $locais[$k]; Write-Output ("| {0} | {1} | {2} | {3:N2} |" -f $k, $v.consultorNome, $v.clienteNome, [double]$v.valor) }
  Write-Output ''
}
Write-Output ("Resumo: {0} novo(s) - {1} atualizado(s) - {2} ja igual(is) - {3} removido(s)." -f $novos.Count, $mudados.Count, $iguais, $remover.Count)
Write-Output ("Total pago por consultor: " + (($porCons.Keys | ForEach-Object { "{0} R$ {1:N2}" -f $_, $porCons[$_] }) -join ' | '))
if ($Aplicar) { Write-Output ("Gravados {0} - removidos {1}." -f $ok, $del) } else { Write-Output 'Rode com -Aplicar para gravar.' }
if ($errs.Count) { Write-Output 'FALHAS:'; $errs | ForEach-Object { Write-Output "  - $_" } }
