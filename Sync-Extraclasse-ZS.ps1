<#
================================================================================
 Sync-Extraclasse-ZS.ps1 - le as vendas GANHAS do Pablo no ZS e gera o arquivo
 assets/js/59-extraclasse-zs.js, que a Pipeline Comercial importa como
 EXTRACLASSE quando se clica em "Sincronizar FRZ".

 POR QUE ASSIM
 -------------
 O Pablo nao lanca no HUD: as vendas dele vivem no ZS. O navegador nao
 consegue ler o ZS (exige login e nao libera CORS), entao a ponte e este
 script: ele grava os dados num arquivo .js que a pagina ja carrega. Nada
 passa pelo HUD (pipeline_entries) - o EXTRACLASSE vai direto para a
 Pipeline Comercial.

 USO
 ---
   .\Sync-Extraclasse-ZS.ps1                   # PREVIA (nao escreve o arquivo)
   .\Sync-Extraclasse-ZS.ps1 -Aplicar          # gera o 59-extraclasse-zs.js
   .\Sync-Extraclasse-ZS.ps1 -Periodo 2026-08  # outro mes (padrao: mes atual)

 Depois de gerar, clique em "Sincronizar FRZ" na Pipeline Comercial.
 Para valer na versao publicada, rode o Deploy.
================================================================================
#>
param(
  [string]$Periodo = '',
  [switch]$Aplicar
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

$API_BASE = 'https://api.zsales.com.br'
$AUTH     = Join-Path $PSScriptRoot 'sc-web-auth.json'
$SAIDA    = Join-Path $PSScriptRoot 'assets\js\59-extraclasse-zs.js'

$ORG      = 2    # Vitoria
$ASSIGNEE = 28   # PABLO MARTINS CORREIA no ZS

if (-not $Periodo) { $Periodo = (Get-Date).ToString('yyyy-MM') }
if ($Periodo -notmatch '^\d{4}-\d{2}$') { throw "Periodo invalido: use AAAA-MM." }
$ini = "$Periodo-01"
$fim = ([datetime]"$ini").AddMonths(1).AddDays(-1).ToString('yyyy-MM-dd')

# ---------- login na API REST do ZS ----------
if (-not (Test-Path $AUTH)) { throw "Credenciais ausentes: $AUTH" }
$cred  = Get-Content -Raw -Encoding UTF8 $AUTH | ConvertFrom-Json
$login = Invoke-RestMethod -Uri "$API_BASE/api/auth/login/" -Method Post -ContentType 'application/json' `
         -Body (@{ email = $cred.email; password = $cred.password } | ConvertTo-Json) -TimeoutSec 30
$ZS_HDR = @{ Authorization = "Bearer $($login.access)"; 'X-Organization-Id' = "$ORG" }

function Zs-Get($path) {
  $r = Invoke-WebRequest -Uri "$API_BASE$path" -Method Get -Headers $ZS_HDR -UseBasicParsing -TimeoutSec 40
  return ([Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()) | ConvertFrom-Json)
}

# ---------- vendas ganhas do mes ----------
$resp = Zs-Get "/api/opportunities/?assignee_user=$ASSIGNEE&outcome=won&ordering=-close_date&page_size=100"
$opps = @($resp.results | Where-Object { $_.close_date -ge $ini -and $_.close_date -le $fim })

# Monta a linha de uma oportunidade ja no LIQUIDO.
# O ZS guarda o BRUTO; a Pipeline recebe o liquido, igual aos consultores do
# HUD. Unica diferenca hoje: COACHING INDIVIDUAL vale metade (o outro 50% e
# do coach). A conta e feita item a item, entao venda mista (CI + outro
# produto) sai certa - so a parte do CI cai pela metade.
function New-Linha($o, $st) {
  $bruto = [double]$o.value
  if ($bruto -le 0) { return $null }   # matricula sem receita nao e venda

  $produto = ''
  $liquido = $bruto
  try {
    $prods = (Zs-Get "/api/opportunity-products/?opportunity=$($o.id)").results
    if ($prods -and $prods.Count -gt 0) {
      $produto = "$($prods[0].product_name)"
      if ($prods.Count -gt 1) { $produto = "$produto x$($prods.Count)" }
      $soma = 0.0
      foreach ($p in $prods) {
        $preco = [double]$p.price
        if ("$($p.product_name)" -match '(?i)coaching individual') { $preco = $preco / 2 }
        $soma += $preco
      }
      if ($soma -gt 0) { $liquido = [math]::Round($soma, 2) }
    }
  } catch { }
  if (-not $produto) { $produto = 'Venda ZS' }

  $dt = if ($o.close_date) { "$($o.close_date)" } else { (Get-Date).ToString('yyyy-MM-dd') }
  return [pscustomobject]@{
    id      = "$($o.id)"
    cliente = "$($o.customer_name)"
    produto = $produto
    valor   = $liquido
    data    = $dt
    status  = $st
  }
}

$vendas = @()
$total  = 0.0
foreach ($o in $opps) {
  $l = New-Linha $o 'FECHADO'
  if ($l) { $vendas += $l; $total += [double]$l.valor }
}

# ---------- negociacao (vira "Potencial total" na Pipeline) ----------
# So etapas 4 e 5 do funil: negociacao de verdade. As demais (lead frio,
# "Contato Sem Retorno/Farmer") ficam de fora para nao inflar o potencial.
$negTotal = 0.0
try {
  $rn   = Zs-Get "/api/opportunities/?assignee_user=$ASSIGNEE&outcome=negotiating&page_size=100"
  $abertas = @($rn.results | Where-Object { "$($_.funnel_stage_label)" -match '^\s*[45]' })
  foreach ($o in $abertas) {
    $l = New-Linha $o 'PROJEÇÃO'
    if ($l) { $vendas += $l; $negTotal += [double]$l.valor }
  }
} catch { }

# ---------- relatorio ----------
"## EXTRACLASSE (ZS do Pablo) -> Pipeline Comercial - $Periodo"
""
"| Data | Cliente | Produto | Liquido | Status |"
"|---|---|---|--:|---|"
foreach ($v in ($vendas | Sort-Object { -$_.valor })) {
  "| {0} | {1} | {2} | {3:N2} | {4} |" -f ([datetime]$v.data).ToString('dd/MM'), $v.cliente, $v.produto, $v.valor, $v.status
}
""
$qtdFechadas = @($vendas | Where-Object { $_.status -eq 'FECHADO' }).Count
$qtdNeg      = @($vendas | Where-Object { $_.status -eq 'PROJEÇÃO' }).Count
"**{0} venda(s) fechada(s) - R$ {1:N2}**" -f $qtdFechadas, $total
if ($qtdNeg -gt 0) { "**{0} em negociacao (potencial) - R$ {1:N2}**" -f $qtdNeg, $negTotal }
""

if (-not $Aplicar) {
  "**PREVIA - o arquivo nao foi gerado.** Repita com ``-Aplicar``."
  exit 0
}

# ---------- gera o arquivo de dados ----------
$geradoEm = (Get-Date).ToString('dd/MM/yyyy HH:mm')
$json = $vendas | ConvertTo-Json -Depth 5
if ($vendas.Count -eq 1) { $json = "[$json]" }
if ($vendas.Count -eq 0) { $json = "[]" }

$conteudo = @"
/* ══════════════════════════════════════════════════════════════════
   59-extraclasse-zs.js — VENDAS DO ZS DO PABLO (EXTRACLASSE)

   ARQUIVO GERADO AUTOMATICAMENTE — não edite à mão.
   Fonte: Sync-Extraclasse-ZS.ps1 (lê o ZS via API REST).
   Gerado em: $geradoEm · Mês: $Periodo · $($vendas.Count) venda(s)

   O Pablo não lança no HUD; as vendas dele estão só no ZS, que o navegador
   não consegue ler (login + CORS). Este arquivo é a ponte: o 58-frz-sync.js
   lê window.EXTRACLASSE_ZS e importa como EXTRACLASSE na Pipeline Comercial,
   sem passar pelo pipeline_entries.

   Para atualizar:  .\Sync-Extraclasse-ZS.ps1 -Aplicar
   Depois clique em "⟳ Sincronizar FRZ" na Pipeline Comercial.
   ══════════════════════════════════════════════════════════════════ */
window.EXTRACLASSE_ZS = {
  mes: '$Periodo',
  geradoEm: '$geradoEm',
  vendas: $json
};
"@

$dir = Split-Path -Parent $SAIDA
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
[IO.File]::WriteAllText($SAIDA, $conteudo, (New-Object Text.UTF8Encoding($true)))

"OK - arquivo gerado: assets\js\59-extraclasse-zs.js ({0} venda(s), R$ {1:N2})." -f $vendas.Count, $total

# ---------- bump do cache ----------
# O dashboard.html carrega este .js com ?v=<timestamp> FIXO. Sem renovar o ?v=,
# o navegador continua servindo a copia velha do cache e o botao "Sincronizar
# FRZ" RESSUSCITA as vendas que ja sairam do Pablo (aconteceu 3x em 19-20/08/2026,
# com Jose Vicente R$ 1.997,00 e Alexsanda R$ 4.500,00 contadas em dobro).
$idx = Join-Path $PSScriptRoot 'dashboard.html'
if (Test-Path $idx) {
  $html = [IO.File]::ReadAllText($idx, [Text.Encoding]::UTF8)
  $ver  = Get-Date -Format 'yyyyMMdd-HHmmss'
  $novo = $html -replace '59-extraclasse-zs\.js\?v=[0-9\-]+', "59-extraclasse-zs.js?v=$ver"
  if ($novo -ne $html) {
    [IO.File]::WriteAllText($idx, $novo, (New-Object Text.UTF8Encoding($true)))
    "OK - cache do dashboard.html renovado: ?v=$ver"
  } else {
    "AVISO: nao achei o ?v= do 59-extraclasse-zs.js no dashboard.html - confira o cache a mao."
  }
} else {
  "AVISO: dashboard.html nao encontrado em $PSScriptRoot - cache NAO renovado."
}

""
"Agora clique em **⟳ Sincronizar FRZ** na Pipeline Comercial."
"(ou rode .\Sincronizar-FRZ.ps1 -Aplicar, que nao depende do cache do navegador)"
"Para publicar online, rode o Deploy."
