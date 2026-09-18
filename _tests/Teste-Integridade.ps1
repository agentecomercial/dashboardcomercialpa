<#
  Teste-Integridade.ps1 — o teste que teria pegado o incidente de 18/09/2026

  A PERGUNTA QUE ELE RESPONDE: "usar o app mudou algum arquivo de dado que
  ninguém mandou mudar?"

  No incidente, o MCP caiu, o coletor devolveu zeros com exit 0 e o servidor
  GRAVOU esses zeros por cima do snapshot bom. Nenhum teste de tela pegaria
  isso — a tela mostrava números. O que denunciava era o arquivo em disco
  mudando quando não devia.

  Aqui tiramos o hash dos arquivos de dado, exercitamos o app (o smoke, ou o
  que você mandar em -Comando) e conferimos o que mudou. Leitura não pode
  alterar nada. Escrita altera só o que foi pedido.

  USO
    .\_tests\Teste-Integridade.ps1                 # roda o smoke e confere
    .\_tests\Teste-Integridade.ps1 -SoMedir        # só tira o retrato de agora
    .\_tests\Teste-Integridade.ps1 -Comparar       # compara com o último retrato
    .\_tests\Teste-Integridade.ps1 -Comando { ... }  # exercita o que você quiser

  TESTE DE FONTE FORA (manual, 1 min): desconecte a internet, rode
    .\_tests\Teste-Integridade.ps1
  Todas as rotas do CRM devem falhar e NENHUM arquivo pode mudar. Era
  exatamente isso que falhava antes da correção.
#>
param(
  [switch]$SoMedir,
  [switch]$Comparar,
  [scriptblock]$Comando,
  [int]$Porta = 8766
)

$ErrorActionPreference = 'Stop'
$raizTestes = $PSScriptRoot
$raiz       = Split-Path $raizTestes -Parent
$mm         = Join-Path $raiz 'meta-master'
$retrato    = Join-Path $raizTestes 'retrato-dados.json'

# Dado do usuário: leitura NUNCA pode mexer nisso.
$intocaveis = @(
  (Join-Path $mm  'estado.json')
  (Join-Path $mm  'mm-fotos.js')
  (Join-Path $mm  'mapeamentos-turma.json')
  (Join-Path $raiz 'metas-vitoria.json')
  (Join-Path $raiz 'metas-leads-vitoria.json')
)
# Derivados: podem mudar numa carga bem-sucedida, mas NUNCA podem encolher a
# ponto de virar zero/vazio por causa de falha da fonte.
$derivados = @(
  (Join-Path $mm 'dados.js')
)

function Retrato {
  $itens = @()
  foreach ($a in ($intocaveis + $derivados)) {
    if (-not (Test-Path $a)) { continue }
    $i = Get-Item $a
    # Para .json o hash de BYTES mente: /api/estado faz read-modify-write do
    # arquivo inteiro e o ConvertTo-Json do PS 5.1 nao preserva a ordem das
    # chaves — o arquivo "muda" sem nada ter mudado. Comparamos o CONTEUDO:
    # pares chave=valor ordenados. Assim so acusa diferenca de verdade.
    $h = $null
    if ($i.Extension -eq '.json') {
      try {
        $o = Get-Content $a -Raw -Encoding UTF8 | ConvertFrom-Json
        $pares = @($o.PSObject.Properties | Sort-Object Name | ForEach-Object { "$($_.Name)=$([string]$_.Value)" })
        $ms = New-Object IO.MemoryStream
        $sw = New-Object IO.StreamWriter($ms); $sw.Write(($pares -join "`n")); $sw.Flush(); $ms.Position = 0
        $h = (Get-FileHash -InputStream $ms -Algorithm SHA256).Hash
        $sw.Dispose(); $ms.Dispose()
      } catch { }
    }
    if (-not $h) { $h = (Get-FileHash $a -Algorithm SHA256).Hash }
    $itens += [pscustomobject]@{
      arquivo = $i.FullName
      nome    = $i.Name
      bytes   = $i.Length
      hash    = $h
      tipo    = if ($intocaveis -contains $a) { 'intocavel' } else { 'derivado' }
    }
  }
  # snapshots de leads: conta e tamanho somado bastam
  $snap = Join-Path $mm '_tmp\snapshots'
  if (Test-Path $snap) {
    $arqs = @(Get-ChildItem $snap -Filter *.json -ErrorAction SilentlyContinue)
    $itens += [pscustomobject]@{
      arquivo = $snap; nome = '(snapshots)'; bytes = ($arqs | Measure-Object Length -Sum).Sum
      hash = "$($arqs.Count) arquivo(s)"; tipo = 'derivado'
    }
  }
  return $itens
}

# O app aberto no navegador grava em /api/estado sozinho. Se ele estiver no ar,
# uma mudanca detectada aqui pode ser dele, nao do que estamos testando.
$appNoAr = $null
try { $appNoAr = Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue } catch {}
if ($appNoAr) {
  Write-Host "AVISO: o Meta Master esta no ar em :8765. Se ele estiver aberto no" -ForegroundColor DarkYellow
  Write-Host "       navegador, ele grava estado.json sozinho e polui o resultado." -ForegroundColor DarkYellow
  Write-Host "       Para um teste limpo, feche a aba do app antes de rodar.`
" -ForegroundColor DarkYellow
}

$antes = Retrato

if ($SoMedir) {
  $antes | ConvertTo-Json -Depth 4 | Set-Content $retrato -Encoding UTF8
  Write-Host "retrato gravado: $($antes.Count) item(ns)" -ForegroundColor Cyan
  $antes | Format-Table nome, tipo, bytes -AutoSize
  exit 0
}

if ($Comparar) {
  if (-not (Test-Path $retrato)) { throw "Nao ha retrato anterior. Rode com -SoMedir primeiro." }
  $antes = @(Get-Content $retrato -Raw | ConvertFrom-Json)
} else {
  Write-Host "retrato ANTES: $($antes.Count) item(ns)" -ForegroundColor DarkGray
  if ($Comando) {
    Write-Host "executando o comando informado..." -ForegroundColor Cyan
    & $Comando
  } else {
    Write-Host "exercitando o app pelo smoke (so leitura)..." -ForegroundColor Cyan
    & (Join-Path $raizTestes 'Smoke-Rotas.ps1') -Porta $Porta | Out-Null
  }
}

$depois = Retrato

# ------------------------------------------------------------------ compara
$problemas = @()
Write-Host "`nDEPOIS:" -ForegroundColor White
foreach ($d in $depois) {
  $a = $antes | Where-Object { $_.nome -eq $d.nome } | Select-Object -First 1
  if (-not $a) { Write-Host "  novo     $($d.nome)" -ForegroundColor DarkYellow; continue }

  if ($a.hash -eq $d.hash) { Write-Host "  igual    $($d.nome)" -ForegroundColor Green; continue }

  if ($d.tipo -eq 'intocavel') {
    Write-Host "  MUDOU    $($d.nome)  ($($a.bytes) -> $($d.bytes) bytes)" -ForegroundColor Red
    $problemas += "$($d.nome): dado do usuario mudou sem ninguem mandar"
    continue
  }

  # derivado que mudou: ok, desde que nao tenha virado vazio
  if ([int]$d.bytes -eq 0 -or ([int]$a.bytes -gt 0 -and [int]$d.bytes -lt ([int]$a.bytes / 4))) {
    Write-Host "  ENCOLHEU $($d.nome)  ($($a.bytes) -> $($d.bytes) bytes)" -ForegroundColor Red
    $problemas += "$($d.nome): derivado encolheu demais — sinal de 'falha virou vazio'"
  } else {
    Write-Host "  mudou    $($d.nome)  ($($a.bytes) -> $($d.bytes) bytes, derivado — ok)" -ForegroundColor DarkGray
  }
}

Write-Host ""
if ($problemas.Count) {
  Write-Host "INTEGRIDADE VIOLADA:" -ForegroundColor Red
  $problemas | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
  exit 1
}
Write-Host "INTEGRIDADE OK — nenhum dado do usuario foi tocado." -ForegroundColor Green
exit 0
