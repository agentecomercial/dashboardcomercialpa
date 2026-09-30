# ============================================================================
#  Checar-Essencial.ps1
#  Confere treinamento-<sigla>-essencial no Edge headless:
#   - transbordo: com todos os itens revelados, algum elemento passa da borda
#     do slide? (lista so os slides com problema ou com rolagem interna > 13px)
#   - prints (opcional): PNG dos slides pedidos, sem animacao, tudo revelado
#
#  -Sigla bhp  -Prints 1,5,18,25  -Saida <pasta para copia + PNGs>
# ============================================================================
param(
  [Parameter(Mandatory = $true)][string]$Sigla,
  [int[]]$Prints = @(),
  [string]$Saida = $env:TEMP
)
# Continue: o Edge escreve avisos no stderr e, no PS 5.1, EAP Stop transforma isso em erro fatal
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$pasta = "treinamento-$Sigla-essencial"
$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw 'Edge nao encontrado' }
$dst = Join-Path $Saida ("chk-$Sigla-" + (Get-Date -Format 'HHmmss'))
New-Item -ItemType Directory -Force $dst | Out-Null
Copy-Item -Recurse "$pasta\*" $dst
$utf8 = New-Object System.Text.UTF8Encoding($false)
$base = [IO.File]::ReadAllText("$dst\index.html", [Text.Encoding]::UTF8)
$semAnim = '<style>*,*::before,*::after{animation:none!important;transition:none!important}</style>'
function Url([string]$p) { 'file:///' + ($p -replace '\\', '/') }

$probe = $semAnim + @'
<script>
window.addEventListener('load',function(){setTimeout(function(){
  var out=[];var ss=[].slice.call(document.querySelectorAll('.deck .slide'));
  ss.forEach(function(s,i){
    ss.forEach(function(x){x.classList.remove('is-active')}); s.classList.add('is-active');
    s.querySelectorAll('.cis-step').forEach(function(e){e.classList.add('is-revealed')});
    var r=s.getBoundingClientRect(), worst=0, who='';
    s.querySelectorAll('.slide-body *').forEach(function(e){ var b=e.getBoundingClientRect(); if(b.height===0)return; var d=Math.max(b.bottom-r.bottom,b.right-r.right); if(d>worst){worst=d;who=e.tagName+'.'+(e.className||'')} });
    var sb=s.querySelector('.slide-body'); out.push((i+1)+'|'+Math.round(worst)+'|'+(sb.scrollHeight-sb.clientHeight)+'|'+who);
  });
  var p=document.createElement('pre');p.id='OUT';p.textContent=out.join('\n');document.body.appendChild(p);
},800)});
</script>
'@
[IO.File]::WriteAllText("$dst\_teste.html", $base.Replace('</body>', $probe + '</body>'), $utf8)
$dom = & $edge --headless=new --disable-gpu --window-size=1600,900 --virtual-time-budget=5000 --dump-dom (Url "$dst\_teste.html") 2>$null | Out-String
$res = [Net.WebUtility]::HtmlDecode([regex]::Match($dom, '(?s)<pre id="OUT">(.*?)</pre>').Groups[1].Value).Trim()
if (-not $res) { throw 'A medicao nao voltou (o deck quebrou no carregamento?)' }
$linhas = $res -split "`n"
$ruins = $linhas | Where-Object { $c = $_ -split '\|'; [int]$c[1] -gt 0 -or [int]$c[2] -gt 40 }
Write-Host "[..] $($linhas.Count) slides medidos"
if ($ruins) { $ruins | ForEach-Object { $c = $_ -split '\|'; Write-Host ("[!!] slide {0}: passa {1}px da borda, rolagem interna {2}px ({3})" -f $c[0], $c[1], $c[2], $c[3]) } }
else { Write-Host '[OK] nenhum slide passa da borda' }

foreach ($n in $Prints) {
  $shot = $semAnim + "<script>window.addEventListener('load',function(){setTimeout(function(){var ss=[].slice.call(document.querySelectorAll('.deck .slide'));ss.forEach(function(x){x.classList.remove('is-active')});var s=ss[$n-1];s.classList.add('is-active');s.querySelectorAll('.cis-step').forEach(function(e){e.classList.add('is-revealed')});},600)});</script>"
  [IO.File]::WriteAllText("$dst\_shot$n.html", $base.Replace('</body>', $shot + '</body>'), $utf8)
  $png = Join-Path $Saida "$Sigla-slide$n.png"
  & $edge --headless=new --disable-gpu --hide-scrollbars --window-size=1600,900 --virtual-time-budget=4000 "--screenshot=$png" (Url "$dst\_shot$n.html") 2>$null | Out-Null
  Write-Host "[png] $png"
}
