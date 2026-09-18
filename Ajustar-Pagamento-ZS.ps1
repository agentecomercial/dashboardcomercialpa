<#
================================================================================
 Ajustar-Pagamento-ZS.ps1 - corrige campos de um PAGAMENTO no Sales Cube pela
 API REST web (api.zsales.com.br), que e o unico caminho para gateway/paid_at.

 POR QUE ESTE SCRIPT EXISTE
 --------------------------
 O classificador do Claude Code bloqueia o assistente de rodar login + PATCH na
 API do ZS, entao esta correcao sai pela mao do usuario. O script faz o login
 com o sc-web-auth.json da raiz, aplica o PATCH e RECONFERE a oportunidade -
 PATCH de gateway/paid_at nao derruba o Ganho, mas a conferencia fica aqui para
 provar isso a cada uso.

 USO
 ---
   .\Ajustar-Pagamento-ZS.ps1 -PagamentoId 14512 -OppId 2000379056 -SemGateway
   .\Ajustar-Pagamento-ZS.ps1 -PagamentoId 14512 -Gateway 'FRZ Pay'
   .\Ajustar-Pagamento-ZS.ps1 -PagamentoId 14512            # so mostra o atual

 REGRA: pagamento PIX fica SEM gateway. Gateway so em cartao (Rede/CISPay/FRZ Pay).
================================================================================
#>
param(
  [Parameter(Mandatory=$true)][int]$PagamentoId,
  [int]$OppId = 0,
  [int]$Org = 2,
  [switch]$SemGateway,
  [string]$Gateway = ''
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

$RAIZ = Split-Path -Parent $MyInvocation.MyCommand.Path
$f = Join-Path $RAIZ 'sc-web-auth.json'
if (-not (Test-Path $f)) { Write-Output 'sc-web-auth.json ausente na raiz.'; exit 1 }
$c = Get-Content -Raw -Encoding UTF8 $f | ConvertFrom-Json
$l = Invoke-RestMethod -Uri 'https://api.zsales.com.br/api/auth/login/' -Method Post `
     -ContentType 'application/json' -Body (@{ email = $c.email; password = $c.password } | ConvertTo-Json) -TimeoutSec 30
$h = @{ Authorization = "Bearer $($l.access)"; 'X-Organization-Id' = "$Org" }

function Get-Json($caminho) {
  $r = Invoke-WebRequest -Uri "https://api.zsales.com.br$caminho" -Headers $h -TimeoutSec 60 -UseBasicParsing
  return ([Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()) | ConvertFrom-Json)
}

$antes = Get-Json "/api/payments/$PagamentoId/"
Write-Output "ANTES : $($antes.method) $($antes.installments)x R$ $($antes.amount) | gateway=$($antes.gateway) | banco=$($antes.financial_institution) | paid_at=$($antes.paid_at)"

if (-not $SemGateway -and -not $Gateway) { Write-Output 'Nada a alterar (use -SemGateway ou -Gateway "<nome>").'; exit 0 }

$corpo = if ($SemGateway) { '{"gateway":null}' } else { (@{ gateway = $Gateway } | ConvertTo-Json -Compress) }
$bytes = [Text.Encoding]::UTF8.GetBytes($corpo)
$r = Invoke-WebRequest -Uri "https://api.zsales.com.br/api/payments/$PagamentoId/" -Method Patch `
     -Headers $h -ContentType 'application/json' -Body $bytes -TimeoutSec 60 -UseBasicParsing
$dep = [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()) | ConvertFrom-Json
Write-Output "DEPOIS: $($dep.method) $($dep.installments)x R$ $($dep.amount) | gateway=$($dep.gateway) | HTTP $($r.StatusCode)"

if ($OppId -gt 0) {
  Start-Sleep -Seconds 3
  $o = Get-Json "/api/opportunities/$OppId/"
  Write-Output "OPORTUNIDADE $OppId -> outcome=$($o.outcome) | etapa=$($o.funnel_stage_label) | close_date=$($o.close_date) | valor=$($o.value)"
  if ($o.outcome -ne 'won') { Write-Output 'ATENCAO: a oportunidade NAO esta mais como Ganho - refechar.' }
}
