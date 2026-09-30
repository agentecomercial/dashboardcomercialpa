# ============================================================================
#  Integrar-Essencial.ps1
#  Liga treinamento-<sigla>-essencial/ ao treinamento completo e ao catálogo.
#
#  -Sigla fgpc -Marca "FGPC" [-Completo treinamento-fgpc]
#
#  No treinamento-<sigla>/index.html (mesmo shell do CIS/ML5):
#   - item "⚡ <Marca> Essencial" na barra lateral (antes do Fechamento)
#   - card "⚡ Versão Essencial" no menu (antes do card do Fechamento)
#   - rota 'essencial' apontando para ../treinamento-<sigla>-essencial/
#   - SLIDE_TITLES.essencial gerado a partir dos títulos do deck
#   - deckStoreKey entende rotas "../" (senão ocultar slide pela barra não pega)
#  Em assets/js/treinamentos/registro-inicial.js: entrada tipo 'extra'.
#  Idempotente: se já tiver a rota 'essencial', não mexe no index.
# ============================================================================
param(
  [Parameter(Mandatory = $true)][string]$Sigla,
  [Parameter(Mandatory = $true)][string]$Marca,
  [string]$Completo = ''
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
if (-not $Completo) { $Completo = "treinamento-$Sigla" }
$pastaEss = "treinamento-$Sigla-essencial"
$utf8 = New-Object System.Text.UTF8Encoding($false)
function Ler([string]$p) { [IO.File]::ReadAllText((Resolve-Path $p).Path, [Text.Encoding]::UTF8) }
function Gravar([string]$p, [string]$t) { [IO.File]::WriteAllText((Resolve-Path $p).Path, $t, $utf8) }
function Texto([string]$h) { ([Net.WebUtility]::HtmlDecode(([regex]::Replace($h, '<[^>]+>', ' '))) -replace '\s+', ' ').Trim() }

# --- títulos do deck ----------------------------------------------------------
$deck = Ler "$pastaEss\index.html"
$slides = [regex]::Matches($deck, '(?s)<section class="slide[^"]*">(.*?)</section>')
$titulos = New-Object System.Collections.Generic.List[string]
$i = 0
foreach ($s in $slides) {
  $i++; $h = $s.Groups[1].Value
  if ($i -eq 1) { $titulos.Add("$Marca Essencial — Capa"); continue }
  $t = [regex]::Match($h, '(?s)class="slide-title">(.*?)</h2>').Groups[1].Value
  $t = [regex]::Replace($t, '(?s)<span class="tag[^"]*">.*?</span>', '')
  $t = Texto $t
  $t = $t -replace '^🎯\s*Na prática:\s*', 'Na prática: ' -replace '^0\d\s*·\s*', ''
  $b = [regex]::Match($h, 'class="blk b([1-4])"').Groups[1].Value
  if ($t -eq 'Fecho do bloco') { $t = 'Resumo de impacto + Aplique agora' }
  if ($b) { $t = "B$b · $t" }
  elseif ($t -eq 'O cliente diz. E agora?') { $t = Texto ([regex]::Match($h, 'class="blk b0">(.*?)</span>').Groups[1].Value) }
  $titulos.Add($t)
}
$n = $titulos.Count
Write-Host "[..] $n slides no deck"

# --- index do treinamento completo --------------------------------------------
$idxPath = "$Completo\index.html"
$idx = Ler $idxPath
if ($idx -match "essencial:\s*\{ file:") {
  Write-Host "[--] $idxPath já tem a rota 'essencial' — index não alterado"
} else {
  $totalCompleto = [regex]::Match($idx, '<strong>(\d+)</strong>\s*Slides').Groups[1].Value
  if (-not $totalCompleto) { $totalCompleto = 'todos os' }
  $raio = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>'
  $chev = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>'
  $side = @"
      <button class="sidenav-item highlight" data-go="essencial">
        <span class="ico">$raio</span>
        $Marca Essencial
        <span class="meta">$n</span>
        <span class="chevron" data-toggle-sub="essencial" title="Expandir/recolher subtópicos">$chev</span>
      </button>
      <ul class="sidenav-sub" data-sub-for="essencial"></ul>

"@
  $card = @"
        <!-- Versão Essencial: deck condensado ($n slides), pasta irmã -->
        <button class="closing-card" data-go="essencial">
          <div>
            <span class="tag">⚡ Versão Essencial</span>
            <h3>$Marca Essencial</h3>
            <p>Os $totalCompleto slides condensados em ${n}: o que o consultor precisa saber e fazer, em 4 blocos, com resumos de impacto, scripts prontos, checklist e teste rápido. Para preparar antes, revisar depois e consultar na correria. Tem Modo Treinador (tecla T) com o roteiro de condução.</p>
          </div>
          <span class="cta">Abrir agora ▶</span>
        </button>

"@
  $rota = "    /* Versão Essencial: mora numa pasta irmã, não dentro de $Completo/. */`n    essencial:   { file: '../$pastaEss/index.html', title: '<strong>⚡</strong> $Marca Essencial' },`n"
  $lista = "    'essencial': [`n" + (($titulos | ForEach-Object { "      '" + ($_ -replace "'", "\'") + "'" }) -join ",`n") + "`n    ],`n"
  $chave = @"
    if (!f) return null;
    /* Rotas para fora desta pasta (ex.: ../$pastaEss/index.html)
       já carregam a própria pasta no caminho. O deck grava a chave como
       "pasta/arquivo" (últimos 2 segmentos do pathname) — sem esta
       normalização a barra lateral escreveria numa chave que o deck não lê,
       e ocultar um slide aqui não sumiria com ele lá. */
    if (f.slice(0, 3) === '../') return 'cis-edits:' + f.slice(3);
    return 'cis-edits:' + (TRILHA_FOLDER ? TRILHA_FOLDER + '/' : '') + f;
"@
  $passos = @(
    @{ nome = 'barra lateral'; rx = '(?m)^(\s*)<button class="sidenav-item highlight" data-go="fechamento">'; ins = { param($m) $side + $m.Value } },
    @{ nome = 'card do menu'; rx = '(?m)^\s*<button class="closing-card" data-go="fechamento">'; ins = { param($m) $card + $m.Value } },
    @{ nome = 'rota'; rx = '(?m)^\s*fechamento:\s*\{ file:'; ins = { param($m) $rota + $m.Value } },
    @{ nome = 'títulos'; rx = '(?m)^\s*''1'': \['; ins = { param($m) $lista + $m.Value } },
    @{ nome = 'deckStoreKey'; rx = "(?m)^\s*return f \? \('cis-edits:' \+ \(TRILHA_FOLDER \? TRILHA_FOLDER \+ '/' : ''\) \+ f\) : null;\r?\n"; ins = { param($m) $chave } }
  )
  foreach ($p in $passos) {
    $rx = [regex]$p.rx
    if (-not $rx.IsMatch($idx)) { throw "Não achei o ponto de encaixe '$($p.nome)' em $idxPath" }
    $idx = $rx.Replace($idx, [System.Text.RegularExpressions.MatchEvaluator]$p.ins, 1)
  }
  if ($idx.Contains("`r`n")) { $idx = ($idx -replace "(?<!`r)`n", "`r`n") }
  Gravar $idxPath $idx
  Write-Host "[OK] $idxPath integrado (barra lateral, card, rota, $n títulos, deckStoreKey)"
}

# --- catálogo ---------------------------------------------------------------
$regPath = 'assets\js\treinamentos\registro-inicial.js'
$reg = Ler $regPath
if ($reg.Contains("url: '$pastaEss/index.html'")) {
  Write-Host "[--] $regPath já tem o $Marca Essencial"
} else {
  $rx = [regex]("(?m)^(\s*)\{ titulo: 'Capa / Índice',\s*url: '" + [regex]::Escape($Completo) + "/index.html',\s*tipo: 'index'\s*\},\r?\n")
  if (-not $rx.IsMatch($reg)) { throw "Não achei a Capa / Índice de $Completo em $regPath" }
  $reg = $rx.Replace($reg, {
    param($m)
    $ind = $m.Groups[1].Value
    $nl = if ($m.Value.EndsWith("`r`n")) { "`r`n" } else { "`n" }
    $m.Value + "$ind/* Versão condensada: mora em pasta irmã, mas é parte do $Marca —$nl$ind   não vira card próprio no catálogo, só aparece aqui e no índice. */$nl" +
      "$ind{ titulo: '⚡ $Marca Essencial ($n slides)', url: '$pastaEss/index.html', tipo: 'extra' },$nl"
  }, 1)
  Gravar $regPath $reg
  Write-Host "[OK] ${regPath}: entrada '⚡ $Marca Essencial ($n slides)'"
}
