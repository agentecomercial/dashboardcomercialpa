# ============================================================================
#  Novo-Essencial.ps1
#  Cria treinamento-<sigla>-essencial/assets a partir do modelo ML5 Essencial.
#
#  -Sigla fgpc  -> le treinamento-fgpc/assets/fgpc.css (paleta do treinamento)
#
#  O que faz:
#   1. <sigla>.css   = copia do css do treinamento completo (mesma estrutura do
#                      ml5.css, so as cores mudam).
#   2. <sigla>.js    = ml5.js do modelo Essencial (tem a revelacao por celula).
#   3. essencial.js  = copia do modelo (generico: marca vem do <body data-marca>).
#   4. essencial.css / treinador.css = copia do modelo com as cores do ML5
#      trocadas pelas do treinamento. O mapa de cores sai do alinhamento token
#      a token entre ml5.css e <sigla>.css (mesma ordem, mesma quantidade).
#   Imprime o mapa e a cor de destaque (rgb) para usar no index.html.
# ============================================================================
param(
  [Parameter(Mandatory = $true)][string]$Sigla,
  [string]$Completo = ''
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
if (-not $Completo) { $Completo = "treinamento-$Sigla" }

$modelo = 'treinamento-ml5-essencial\assets'
$cssAlvo = Join-Path $Completo "assets\$Sigla.css"
if (-not (Test-Path $cssAlvo)) { throw "Nao achei $cssAlvo" }
$dst = "treinamento-$Sigla-essencial\assets"
New-Item -ItemType Directory -Force $dst | Out-Null
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Ler([string]$p) { [IO.File]::ReadAllText((Resolve-Path $p).Path, [Text.Encoding]::UTF8) }
function Gravar([string]$p, [string]$t) { [IO.File]::WriteAllText((Join-Path (Resolve-Path (Split-Path $p)).Path (Split-Path $p -Leaf)), $t, $utf8) }

# --- mapa de cores ML5 -> alvo ---------------------------------------------
$rxCor = '#[0-9a-fA-F]{6}\b|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+'
function Norm([string]$c) {
  if ($c.StartsWith('#')) { return $c.ToLower() }
  $n = [regex]::Matches($c, '\d+') | ForEach-Object { $_.Value }
  return ($n -join ',')
}
# Alinhamento LINHA a linha (comentarios fora): o css do alvo pode ter blocos
# a mais (ex.: BHP tem o efeito metalico). Linhas que batem na estrutura (com
# as cores trocadas por um marcador) casam; linhas extras do alvo sao puladas.
function SemComentario([string]$t) { [regex]::Replace($t, '(?s)/\*.*?\*/', '') }
function Estrutura([string]$l) { ([regex]::Replace($l, $rxCor, '#C') -replace '\s+', ' ').Trim() }
$linM = @((SemComentario (Ler "$modelo\ml5.css")) -split "\r?\n" | Where-Object { $_.Trim() -ne '' })
$linA = @((SemComentario (Ler $cssAlvo)) -split "\r?\n" | Where-Object { $_.Trim() -ne '' })
$mapa = @{}
$i = 0; $j = 0; $pulados = 0
while ($i -lt $linM.Count -and $j -lt $linA.Count) {
  if ((Estrutura $linM[$i]) -eq (Estrutura $linA[$j])) {
    $cm = [regex]::Matches($linM[$i], $rxCor); $ca = [regex]::Matches($linA[$j], $rxCor)
    for ($k = 0; $k -lt $cm.Count; $k++) {
      $km = Norm $cm[$k].Value
      if (-not $mapa.ContainsKey($km)) { $mapa[$km] = Norm $ca[$k].Value }   # 1a ocorrencia vence
    }
    $i++; $j++; continue
  }
  # procura a linha do modelo mais adiante no alvo (bloco extra no alvo)
  $alvoEst = Estrutura $linM[$i]; $achou = -1
  for ($x = $j + 1; $x -lt [Math]::Min($linA.Count, $j + 80); $x++) { if ((Estrutura $linA[$x]) -eq $alvoEst) { $achou = $x; break } }
  if ($achou -ge 0) { $pulados += ($achou - $j); $j = $achou } else { $i++ }
}
if ($pulados) { Write-Host "     ($pulados linhas a mais no css do alvo foram ignoradas no alinhamento)" }
foreach ($essencial in '#0d0a05', '#e0b552', '224,181,82') { if (-not $mapa.ContainsKey($essencial)) { throw "Nao consegui mapear a cor $essencial do modelo" } }
# Tons quase-pretos do ML5 que so existem nas camadas do Essencial:
# viram o fundo mais escuro do alvo (o par do #0d0a05).
$fundo = $mapa['#0d0a05']
function HexParaRgb([string]$h) { '{0},{1},{2}' -f [Convert]::ToInt32($h.Substring(1,2),16), [Convert]::ToInt32($h.Substring(3,2),16), [Convert]::ToInt32($h.Substring(5,2),16) }
foreach ($escuro in '#12100c', '#0a0703', '#100b06', '#171009') { if (-not $mapa.ContainsKey($escuro)) { $mapa[$escuro] = $fundo } }
foreach ($escuro in '10,7,3') { if (-not $mapa.ContainsKey($escuro)) { $mapa[$escuro] = HexParaRgb $fundo } }

function Trocar([string]$t) {
  $faltou = New-Object System.Collections.Generic.List[string]
  $r = [regex]::Replace($t, $rxCor, {
    param($m)
    $k = Norm $m.Value
    if (-not $mapa.ContainsKey($k)) { if (-not $faltou.Contains($k)) { $faltou.Add($k) }; return $m.Value }
    $v = $mapa[$k]
    if ($m.Value.StartsWith('#')) { return $v }
    $pref = if ($m.Value.StartsWith('rgba')) { 'rgba(' } else { 'rgb(' }
    return $pref + ($v -replace ',', ', ')
  })
  return @{ texto = $r; faltou = $faltou }
}

# --- copias -----------------------------------------------------------------
Gravar "$dst\$Sigla.css" (Ler $cssAlvo)
Gravar "$dst\$Sigla.js" (Ler "$modelo\ml5.js")
Gravar "$dst\essencial.js" (Ler "$modelo\essencial.js")
foreach ($f in 'essencial.css', 'treinador.css') {
  $r = Trocar (Ler "$modelo\$f")
  $txt = $r.texto -replace 'camada sobre o ml5\.css original', "camada sobre o $Sigla.css original"
  Gravar "$dst\$f" $txt
  if ($r.faltou.Count) { Write-Warning "$f : cores do ML5 sem par no alvo (ficaram iguais): $($r.faltou -join ' | ')" }
}

$acc = $mapa['224,181,82']
Write-Host "[OK] $dst criado"
Write-Host "     destaque (rgb p/ index.html): $acc"
Get-ChildItem $dst | ForEach-Object { Write-Host ("     {0,-14} {1,7}" -f $_.Name, $_.Length) }
