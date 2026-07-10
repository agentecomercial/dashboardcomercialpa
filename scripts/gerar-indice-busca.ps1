# ============================================================================
#  gerar-indice-busca.ps1
#  Gera assets/js/treinamentos-busca-index.js com o indice de busca de TODOS
#  os treinamentos (parte -> slides -> titulo + texto).
#
#  Por que existe: a busca (Ctrl+F) do visualizador monta o indice com fetch(),
#  que o navegador BLOQUEIA em file://. Com este indice embutido via <script src>
#  (que file:// carrega normalmente), a busca passa a funcionar tambem localmente.
#
#  Regerar sempre que editar/adicionar treinamentos (roda junto no "Deploy").
# ============================================================================
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot   # scripts/ esta na raiz do repo
Set-Location $root

function Strip-Html([string]$h) {
  $h = [regex]::Replace($h, '(?is)<script.*?</script>', ' ')
  $h = [regex]::Replace($h, '(?is)<style.*?</style>', ' ')
  $h = [regex]::Replace($h, '<[^>]+>', ' ')
  $h = [System.Net.WebUtility]::HtmlDecode($h)
  $h = [regex]::Replace($h, '\s+', ' ').Trim()
  return $h
}

$dirs = Get-ChildItem -Directory | Where-Object { $_.Name -match '^(treinamento-|apresentacao-|regras-)' }
$index = [ordered]@{}
$totalSlides = 0
$totalFiles = 0

foreach ($d in $dirs) {
  $files = Get-ChildItem -Path $d.FullName -Filter *.html -File
  foreach ($f in $files) {
    $txt = Get-Content -Raw -Encoding UTF8 $f.FullName
    if ($txt -notmatch 'class="[^"]*\bslide\b') { continue }   # sem slides = shell/capa
    $slideMatches = [regex]::Matches($txt, '(?s)<section\b[^>]*class="[^"]*\bslide\b[^"]*"[^>]*>(.*?)</section>')
    if ($slideMatches.Count -eq 0) { continue }

    $rel = ($f.FullName.Substring($root.Length).TrimStart('\', '/') -replace '\\', '/')
    $slides = @()
    $i = 0
    foreach ($m in $slideMatches) {
      $i++
      $inner = $m.Groups[1].Value
      $tm = [regex]::Match($inner, '(?is)<h[12][^>]*slide-title[^>]*>(.*?)</h[12]>')
      if (-not $tm.Success) { $tm = [regex]::Match($inner, '(?is)<h[12][^>]*>(.*?)</h[12]>') }
      $titulo = if ($tm.Success) { Strip-Html $tm.Groups[1].Value } else { "Slide $i" }
      if ([string]::IsNullOrWhiteSpace($titulo)) { $titulo = "Slide $i" }
      $texto = Strip-Html $inner
      $slides += [ordered]@{ id = $i; t = $titulo; x = $texto }
    }
    $index[$rel] = $slides
    $totalSlides += $slides.Count
    $totalFiles++
  }
}

$json = $index | ConvertTo-Json -Depth 6 -Compress
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$header = "/* Indice de busca dos treinamentos - GERADO por scripts/gerar-indice-busca.ps1 em $stamp */`r`n" +
          "/* Permite a busca (Ctrl+F) do visualizador funcionar em file:// (sem fetch). NAO editar a mao. */`r`n"
$out = $header + "window.TRAP_BUSCA_INDEX = $json;`r`n"

$outPath = Join-Path $root 'assets/js/treinamentos-busca-index.js'
Set-Content -Path $outPath -Value $out -Encoding UTF8

Write-Host "[OK] Indice de busca gerado: $totalFiles arquivo(s), $totalSlides slide(s)"
Write-Host "     -> assets/js/treinamentos-busca-index.js"
