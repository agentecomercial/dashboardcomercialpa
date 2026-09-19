<#
  Smoke-Rotas.ps1 — rede de segurança mínima do Meta Master (Fase 1 da auditoria de 18/09/2026)

  O QUE ELE PROVA: que nenhuma das 23 rotas /api/* parou de responder depois de
  uma alteração no Servir.ps1. Não valida número de negócio — valida que a rota
  existe, responde com status previsto e devolve um corpo com a forma esperada.

  POR QUE EM OUTRA PORTA: o Servir.ps1 atende UMA requisição por vez. Rodar o
  smoke contra o servidor que você está usando trava o app no meio do teste.
  Este script sobe uma instância própria em :8766 e a derruba no fim.

  REGRA DE SEGURANÇA: rotas que ESCREVEM (no disco ou no CRM) nunca são
  executadas de verdade. Delas testamos só o contrário — que recusam o que
  deve ser recusado. /api/atualizar fica de fora por completo: ela sobrescreve
  o dados.js, e um teste não pode ter esse efeito colateral.

  USO
    .\_tests\Smoke-Rotas.ps1                # completo (bate no CRM, ~2-4 min)
    .\_tests\Smoke-Rotas.ps1 -Rapido        # só rotas locais (~10 s)
    .\_tests\Smoke-Rotas.ps1 -GravarGolden  # (re)grava as chaves de referência
    .\_tests\Smoke-Rotas.ps1 -Porta 8767    # se a 8766 estiver ocupada
#>
param(
  [int]$Porta = 8766,
  [switch]$Rapido,
  [switch]$GravarGolden,
  [int]$TimeoutSeg = 300
)

$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'

$raizTestes = $PSScriptRoot
$raiz       = Split-Path $raizTestes -Parent
$mm         = Join-Path $raiz 'meta-master'
$servir     = Join-Path $mm 'Servir.ps1'
$goldenDir  = Join-Path $raizTestes 'golden'
$base       = "http://localhost:$Porta"

if (-not (Test-Path $servir)) { throw "Nao achei o Servir.ps1 em $servir" }
if (-not (Test-Path $goldenDir)) { New-Item -ItemType Directory -Path $goldenDir -Force | Out-Null }

# ---------------------------------------------------------------- casos
# esperado : status HTTP aceitáveis. 503 entra em quase tudo de propósito —
#            "o CRM caiu" é resposta CORRETA, não falha do app.
# chaves   : campos que precisam existir no JSON de 200 (contrato mínimo)
# lento    : bate no CRM; pulado com -Rapido
# escrita  : NAO executa de verdade; confere só que o método errado é recusado
$casos = @(
  # ---- leitura local (rápidas) ----
  @{ nome='ip';                rota='/api/ip';                 esperado=@(200);          chaves=@() }
  @{ nome='estado';            rota='/api/estado';             esperado=@(200);          chaves=@() }
  @{ nome='metas-consultores'; rota='/api/metas-consultores';  esperado=@(200);          chaves=@() }
  @{ nome='metas';             rota='/api/metas';              esperado=@(200);          chaves=@() }
  @{ nome='mapeamento-turma';  rota='/api/mapeamento-turma?turma=21&praca=Vit%C3%B3ria'; esperado=@(200,400); chaves=@() }
  @{ nome='cmd-tabelaPrecos';  rota='/api/cmd?id=tabelaPrecos'; esperado=@(200,500);     chaves=@() }
  @{ nome='cmd-regras';        rota='/api/cmd?id=regrasComerciais'; esperado=@(200,500); chaves=@() }
  @{ nome='cmd-id-invalido';   rota='/api/cmd?id=nao_existe_xyz'; esperado=@(400,404,500); chaves=@() }

  # ---- leitura que bate no CRM (lentas) ----
  @{ nome='leads';             rota='/api/leads?periodo=2026-09'; esperado=@(200,503); lento=$true
     chaves=@('consultores','etapas','totaisEtapa','totalGeral') }
  @{ nome='carteira-leads';    rota='/api/carteira-leads?periodo=2026-09&acao=leads'; esperado=@(200,500,503); lento=$true; chaves=@() }
  @{ nome='lancamentos-arq';   rota='/api/lancamentos?acao=arquivos'; esperado=@(200,500); lento=$true; chaves=@() }
  @{ nome='treinamento';       rota='/api/treinamento?query=CIS'; esperado=@(200,400,500); lento=$true; chaves=@() }
  @{ nome='link-sf';           rota='/api/link-sf'; esperado=@(200,400,500); lento=$true; chaves=@() }
  @{ nome='sfxsc';             rota='/api/sfxsc?acao=usuarios'; esperado=@(200,400,500); lento=$true; chaves=@() }
  # classId=0 nao existe: o Painel-Turma sai com exit 1 e {"erro":"ClassId invalido."}.
  # Ate 19/09/2026 a rota devolvia 200 com o erro escondido no corpo, porque lia
  # $LASTEXITCODE (que nunca era do filho). Agora 500 e o esperado — turma VALIDA
  # continua 200 (conferido a mao nas turmas 296 e 297).
  @{ nome='turma';             rota='/api/turma?classId=0&contatos=0'; esperado=@(400,500); lento=$true; chaves=@() }
  @{ nome='turma-acao-leitura';rota='/api/turma-acao?acao=opps&turma=21'; esperado=@(200,400,500); lento=$true; chaves=@() }
  @{ nome='acao-previa';       rota='/api/acao?acao=equilibrio&periodo=2026-09'; esperado=@(200,400,500); lento=$true; chaves=@() }
  @{ nome='turma-frz-previa';  rota='/api/turma-frz?turma=21&cidade=VITORIA'; esperado=@(200,400,500); lento=$true; chaves=@() }

  # ---- comandos que rodam coletores proprios (Fase 4: cada um tem seu .ps1) ----
  @{ nome='cmd-faturamento';   rota='/api/cmd?id=faturamento&periodo=2026-09'; esperado=@(200,500,503); lento=$true; chaves=@() }
  @{ nome='cmd-metaUnidade';   rota='/api/cmd?id=metaUnidade&periodo=2026-09';  esperado=@(200,500,503); lento=$true; chaves=@() }
  @{ nome='cmd-metaConsult';   rota='/api/cmd?id=metaConsultores&periodo=2026-09'; esperado=@(200,500,503); lento=$true; chaves=@() }
  @{ nome='cmd-negociacoes';   rota='/api/cmd?id=negociacoes&periodo=2026-09';  esperado=@(200,500,503); lento=$true; chaves=@() }
  @{ nome='cmd-movimentacao';  rota='/api/cmd?id=movimentacao&periodo=2026-09'; esperado=@(200,500,503); lento=$true; chaves=@() }
  @{ nome='cmd-leads';         rota='/api/cmd?id=leads&periodo=2026-09';        esperado=@(200,500,503); lento=$true; chaves=@() }
  @{ nome='cmd-painel';        rota='/api/cmd?id=painel';                        esperado=@(200,500,503); lento=$true; chaves=@() }

  # ---- escrita: só o teste NEGATIVO (metodo errado tem de ser recusado) ----
  @{ nome='mover-etapa-GET';   rota='/api/mover-etapa'; esperado=@(405); escrita=$true }
  @{ nome='vendas-zs-GET';     rota='/api/vendas-zs?acao=remover&opp=1'; esperado=@(405); escrita=$true }
  @{ nome='consumidores-GET';  rota='/api/consumidores-vaga'; esperado=@(405); escrita=$true }
  @{ nome='img-GET';           rota='/api/img'; esperado=@(405); escrita=$true }
  @{ nome='fotos-GET';         rota='/api/fotos'; esperado=@(405); escrita=$true }
  @{ nome='lancar-GET-escrita'; rota='/api/lancar?acao=excluirOportunidade&id=0'; esperado=@(405); escrita=$true }
  # /api/atualizar regera o dados.js. O POST nao pode ser testado aqui (sobrescreve
  # dado de verdade), mas o GET tem de ser RECUSADO — antes da Fase 0 da auditoria
  # de 19/09/2026 um GET qualquer disparava o gerador.
  @{ nome='atualizar-GET';     rota='/api/atualizar?periodo=2026-09'; esperado=@(405); escrita=$true }
)
# /api/atualizar via POST: DE FORA. Sobrescreve o dados.js — teste nao pode fazer isso.

# ---------------------------------------------------------------- sobe o servidor
$jaEmUso = $null
try { $jaEmUso = Get-NetTCPConnection -LocalPort $Porta -State Listen -ErrorAction SilentlyContinue } catch {}
if ($jaEmUso) { throw "A porta $Porta ja esta em uso. Use -Porta com outro numero." }

Write-Host "subindo instancia de teste em $base ..." -ForegroundColor Cyan
$cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$servir`" -Porta $Porta"
$pidServidor = $null
try {
  $r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd; CurrentDirectory = $mm }
  if ($r.ReturnValue -ne 0) { throw "Win32_Process Create devolveu $($r.ReturnValue)" }
  $pidServidor = $r.ProcessId
} catch { throw "Nao consegui subir o servidor de teste: $($_.Exception.Message)" }

$subiu = $false
foreach ($i in 1..20) {
  Start-Sleep -Seconds 2
  try { Invoke-WebRequest "$base/" -UseBasicParsing -TimeoutSec 5 | Out-Null; $subiu = $true; break } catch {}
}
if (-not $subiu) {
  if ($pidServidor) { Stop-Process -Id $pidServidor -Force -ErrorAction SilentlyContinue }
  throw "O servidor de teste nao respondeu em $base"
}
Write-Host "no ar (PID $pidServidor)`n" -ForegroundColor DarkGray

# ---------------------------------------------------------------- utilitários
# Chaves recursivas do JSON, ordenadas. Os VALORES ficam de fora de proposito:
# eles mudam todo dia; a forma da resposta e que e contrato.
function Chaves($obj, $prefixo = '') {
  $out = New-Object System.Collections.ArrayList
  if ($null -eq $obj) { return $out }
  if ($obj -is [Array]) {
    if ($obj.Count -gt 0) { foreach ($k in (Chaves $obj[0] "$prefixo[]")) { [void]$out.Add($k) } }
    return $out
  }
  if ($obj -is [PSCustomObject]) {
    foreach ($p in $obj.PSObject.Properties) {
      $cam = if ($prefixo) { "$prefixo.$($p.Name)" } else { $p.Name }
      [void]$out.Add($cam)
      foreach ($k in (Chaves $p.Value $cam)) { [void]$out.Add($k) }
    }
  }
  return $out
}

$res = @()
function Reg($nome, $ok, $detalhe, $conhecido = $null) {
  $script:res += [pscustomobject]@{ caso=$nome; ok=$ok; detalhe=$detalhe; conhecido=$conhecido }
  $cor = if ($ok) { 'Green' } elseif ($conhecido) { 'DarkYellow' } else { 'Red' }
  $marca = if ($ok) { 'ok  ' } elseif ($conhecido) { 'BUG ' } else { 'FALHA' }
  Write-Host ("  {0} {1,-22} {2}" -f $marca, $nome, $detalhe) -ForegroundColor $cor
}

# ---------------------------------------------------------------- executa
try {
  foreach ($c in $casos) {
    if ($Rapido -and $c.lento) { continue }

    $url = $base + $c.rota
    $status = 0; $corpo = ''
    try {
      $resp = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec $TimeoutSeg -ErrorAction Stop
      $status = [int]$resp.StatusCode
      $corpo  = $resp.Content
    } catch {
      if ($_.Exception.Response) {
        $status = [int]$_.Exception.Response.StatusCode
        try {
          $sr = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())
          $corpo = $sr.ReadToEnd(); $sr.Close()
        } catch {}
      } else {
        Reg $c.nome $false "sem resposta: $($_.Exception.Message)" $c.conhecido
        continue
      }
    }

    if ($status -notin $c.esperado) {
      Reg $c.nome $false "status $status (esperado: $($c.esperado -join '/'))" $c.conhecido
      continue
    }

    # DEGRADACAO: status na lista de aceitaveis, mas PIOR do que da ultima vez.
    # Sem isto o smoke dizia "ok" quando uma rota caia de 200 para 500 -- foi o
    # que aconteceu ao migrar o executor de scripts (Fase 2) e passou batido.
    $arqSt = Join-Path $goldenDir ($c.nome + '.status.txt')
    if ($GravarGolden -or -not (Test-Path $arqSt)) {
      [IO.File]::WriteAllText($arqSt, [string]$status, (New-Object Text.UTF8Encoding($false)))
    } else {
      $stAntes = 0; try { $stAntes = [int]([IO.File]::ReadAllText($arqSt).Trim()) } catch {}
      if ($stAntes -eq 200 -and $status -ne 200) {
        Reg $c.nome $false "DEGRADOU: respondia 200, agora $status" $c.conhecido
        continue
      }
      if ($status -eq 200 -and $stAntes -ne 200) {
        # melhorou: passa a valer como novo piso
        [IO.File]::WriteAllText($arqSt, [string]$status, (New-Object Text.UTF8Encoding($false)))
      }
    }

    # rota de escrita: basta ter recusado com o status certo
    if ($c.escrita) { Reg $c.nome $true "status $status (recusou como deve)"; continue }

    # status previsto que nao e 200: a rota respondeu de forma honesta (erro de
    # parametro, fonte fora...). O smoke quer saber se a ROTA existe e responde,
    # nao se o dado de negocio veio.
    if ($status -ne 200) { Reg $c.nome $true "status $status (previsto)"; continue }

    $obj = $null
    try { $obj = $corpo | ConvertFrom-Json } catch {
      # nem toda rota devolve JSON (algumas devolvem texto/markdown)
      if ($c.chaves.Count -gt 0) { Reg $c.nome $false "200 mas corpo nao e JSON" $c.conhecido; continue }
      # Resposta de TEXTO tambem tem contrato: o tamanho. Um coletor que quebra
      # costuma devolver 200 com uma linha de erro -- status igual, conteudo
      # murcho. E a mesma classe do incidente, e sem isto o smoke diria "ok".
      $arqT = Join-Path $goldenDir ($c.nome + '.bytes.txt')
      $tam = $corpo.Length
      if ($GravarGolden -or -not (Test-Path $arqT)) {
        [IO.File]::WriteAllText($arqT, [string]$tam, (New-Object Text.UTF8Encoding($false)))
        Reg $c.nome $true "200 (texto, $tam bytes — referencia gravada)"
      } else {
        $tamAntes = 0; try { $tamAntes = [int]([IO.File]::ReadAllText($arqT).Trim()) } catch {}
        if ($tamAntes -gt 0 -and $tam -lt ($tamAntes / 3)) {
          Reg $c.nome $false "200 mas o conteudo MURCHOU: $tamAntes -> $tam bytes" $c.conhecido
        } else {
          if ($tam -gt $tamAntes) { [IO.File]::WriteAllText($arqT, [string]$tam, (New-Object Text.UTF8Encoding($false))) }
          Reg $c.nome $true "200 (texto, $tam bytes)"
        }
      }
      continue
    }

    $faltando = @()
    foreach ($k in $c.chaves) { if (-not $obj.PSObject.Properties[$k]) { $faltando += $k } }
    if ($faltando.Count) { Reg $c.nome $false "200 mas faltam chaves: $($faltando -join ', ')" $c.conhecido; continue }

    # ---- golden: o conjunto de chaves mudou? ----
    $arqG = Join-Path $goldenDir ($c.nome + '.keys.txt')
    # @() obrigatorio: Sort-Object de colecao vazia devolve $null no PS 5.1,
    # e WriteAllLines recusa nulo. Resposta que e array vazio no topo caia aqui.
    $agora = @((Chaves $obj) | Sort-Object -Unique)
    if ($GravarGolden -or -not (Test-Path $arqG)) {
      [IO.File]::WriteAllLines($arqG, [string[]]$agora, (New-Object Text.UTF8Encoding($false)))
      Reg $c.nome $true "200 — golden gravado ($($agora.Count) chaves)"
    } else {
      $antes = @([IO.File]::ReadAllLines($arqG))
      $sumiu = @($antes | Where-Object { $_ -and $agora -notcontains $_ })
      if ($sumiu.Count) { Reg $c.nome $false "200 mas SUMIRAM chaves: $((($sumiu | Select-Object -First 4) -join ', '))" $c.conhecido }
      else {
        $novas = @($agora | Where-Object { $antes -notcontains $_ })
        $obs = if ($novas.Count) { "200 ok (+$($novas.Count) chave(s) nova(s))" } else { "200 ok ($($agora.Count) chaves)" }
        Reg $c.nome $true $obs
      }
    }
  }
}
finally {
  if ($pidServidor) {
    Stop-Process -Id $pidServidor -Force -ErrorAction SilentlyContinue
    Write-Host "`ninstancia de teste encerrada." -ForegroundColor DarkGray
  }
}

# ---------------------------------------------------------------- resumo
$falhas    = @($res | Where-Object { -not $_.ok -and -not $_.conhecido })
$conhecidos= @($res | Where-Object { -not $_.ok -and $_.conhecido })
$oks       = @($res | Where-Object { $_.ok })

Write-Host ""
Write-Host ("RESUMO: {0} ok | {1} falha(s) | {2} bug(s) conhecido(s) | {3} caso(s)" -f `
  $oks.Count, $falhas.Count, $conhecidos.Count, $res.Count) -ForegroundColor White

foreach ($c in $conhecidos) { Write-Host "  BUG conhecido: $($c.caso) — $($c.conhecido)" -ForegroundColor DarkYellow }
foreach ($f in $falhas)     { Write-Host "  FALHA: $($f.caso) — $($f.detalhe)" -ForegroundColor Red }

if ($falhas.Count) { exit 1 }
exit 0
