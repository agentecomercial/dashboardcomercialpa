# Relatorio-Turma.ps1 — Confirmacao de presenca x Meta 70% (le TODAS as abas via .xlsx)
# Uso: .\Relatorio-Turma.ps1 -Link "<link do Google Sheets>"
# Catalogado em COMANDOS.md secao 6B. Saida em Markdown (renderizada no card da aba Comandos).
param(
  [string]$Link = ''
)

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

if ([string]::IsNullOrWhiteSpace($Link)) { Write-Output "**Cole o link público** do Google Sheets da turma antes de executar."; exit 1 }

# ---------- 1) ID da planilha ----------
$m = [regex]::Match($Link, '/spreadsheets/d/([A-Za-z0-9_-]+)')
if (-not $m.Success) { Write-Output "**Link invalido.** Cole a URL completa do Google Sheets (contendo `/spreadsheets/d/...`)."; exit 1 }
$id = $m.Groups[1].Value

# ---------- 2) baixar .xlsx (traz todas as abas) ----------
$tmp = Join-Path $env:TEMP ("turma_" + [Guid]::NewGuid().ToString('N') + ".xlsx")
$url = "https://docs.google.com/spreadsheets/d/$id/export?format=xlsx"
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing -ErrorAction Stop
} catch {
  Write-Output "**Nao consegui baixar a planilha.** Verifique se o link esta publico (qualquer pessoa com o link pode ver). Detalhe: $($_.Exception.Message)"
  exit 1
}

# ---------- 3) parse do xlsx ----------
Add-Type -AssemblyName System.IO.Compression.FileSystem
function Read-Entry($zip,$name){ $e=$zip.Entries | Where-Object { $_.FullName -eq $name }; if(-not $e){return $null}; $r=New-Object IO.StreamReader($e.Open()); $t=$r.ReadToEnd(); $r.Close(); $t }
function Dec($s){ if($null -eq $s){return ''}; ($s -replace '&#10;',' ' -replace '&#9;',' ' -replace '&lt;','<' -replace '&gt;','>' -replace '&quot;','"' -replace '&apos;',"'" -replace '&amp;','&') }

$zip = [System.IO.Compression.ZipFile]::OpenRead($tmp)

# sharedStrings
$shared = @()
$ssXml = Read-Entry $zip 'xl/sharedStrings.xml'
if ($ssXml) {
  foreach ($si in [regex]::Matches($ssXml,'<si>(.*?)</si>',[Text.RegularExpressions.RegexOptions]::Singleline)) {
    $txt = ''
    foreach ($t in [regex]::Matches($si.Groups[1].Value,'<t[^>]*>(.*?)</t>',[Text.RegularExpressions.RegexOptions]::Singleline)) { $txt += $t.Groups[1].Value }
    $shared += (Dec $txt)
  }
}

# mapa nome-da-aba -> worksheets/sheetN.xml
$rels = Read-Entry $zip 'xl/_rels/workbook.xml.rels'
$wb   = Read-Entry $zip 'xl/workbook.xml'
$ridMap = @{}
foreach ($r in [regex]::Matches($rels,'Id="([^"]+)"[^>]*Target="([^"]+)"')) { $ridMap[$r.Groups[1].Value] = ($r.Groups[2].Value -replace '^/xl/','' -replace '^xl/','') }
$abas = @()  # ordem preservada
foreach ($s in [regex]::Matches($wb,'<sheet[^>]*name="([^"]*)"[^>]*r:id="([^"]*)"')) {
  $abas += [pscustomobject]@{ Nome=(Dec $s.Groups[1].Value); Target=$ridMap[$s.Groups[2].Value] }
}

function Get-Cells($rowInner){
  $h=@{}
  foreach ($c in [regex]::Matches($rowInner,'<c r="([A-Z]+)\d+"([^>]*)>(?:<f[^>]*>.*?</f>|<f[^>]*/>)?(?:<is>(.*?)</is>|<v>(.*?)</v>)?</c>',[Text.RegularExpressions.RegexOptions]::Singleline)) {
    $col=$c.Groups[1].Value; $attr=$c.Groups[2].Value; $isv=$c.Groups[3].Value; $v=$c.Groups[4].Value
    $val=''
    if ($attr -match 't="s"') { if($v -ne ''){ $val=$shared[[int]$v] } }
    elseif ($attr -match 't="inlineStr"') { $txt=''; foreach($t in [regex]::Matches($isv,'<t[^>]*>(.*?)</t>',[Text.RegularExpressions.RegexOptions]::Singleline)){$txt+=$t.Groups[1].Value}; $val=(Dec $txt) }
    else { $val = (Dec $v) }
    if ($val -ne '') { $h[$col]=$val }
  }
  $h
}

function Norm-Status($s){
  $x = (($s -replace '\s+',' ').Trim()).ToLower()
  if ($x -eq '') { return '(vazio)' }
  elseif ($x -match 'confirmad')       { return 'Confirmado' }
  elseif ($x -match 'sem retorno')     { return 'Sem retorno' }
  elseif ($x -match 'titularidad')     { return 'Transf. titularidade' }
  elseif ($x -match 'transfer.*turma') { return 'Transf. turma' }
  elseif ($x -match 'transfer.*unidad'){ return 'Transf. unidade' }
  elseif ($x -match 'aguard')          { return 'Aguardando' }
  elseif ($x -match 'cancel')          { return 'Cancelamento' }
  elseif ($x -match 'contato errado')  { return 'Contato errado' }
  else { return ('Outro: ' + $s.Trim()) }
}

function Motivo($obs){
  $o = ("$obs").ToLower()
  if ($o -eq '') { return 'Sem motivo informado' }
  elseif ($o -match 'gestant|gesta|parto|filh|pessoal|familiar|delicad') { return 'Gestacao / familia / pessoal' }
  elseif ($o -match 'coach|revolution|curso|\bif\b|inscri|agendad')       { return 'Ja inscrito em outro curso' }
  elseif ($o -match 'viag|portugal|fora|s.o paulo|mendoza|dist.ncia|reside|linhares|interior|vit.ria') { return 'Fora da cidade / viagem' }
  elseif ($o -match 'trabalh|profission|demanda|agenda|safra|compromiss|empresa|financ') { return 'Demanda profissional / agenda' }
  else { return 'Outros' }
}

function FmtCpf($d){
  $x = "$d" -replace '\D',''
  if ($x.Length -eq 11) { '{0}.{1}.{2}-{3}' -f $x.Substring(0,3),$x.Substring(3,3),$x.Substring(6,3),$x.Substring(9,2) } else { $x }
}

# ---------- 4) coletar dados de cada aba ----------
$turmas = @()
$todosAlunos = @()  # para cruzamento por CPF
foreach ($aba in $abas) {
  $sx = Read-Entry $zip ("xl/" + $aba.Target)
  if (-not $sx) { continue }

  $resumo = @{}
  $alunos = @()
  foreach ($row in [regex]::Matches($sx,'<row[^>]*>(.*?)</row>',[Text.RegularExpressions.RegexOptions]::Singleline)) {
    $cells = Get-Cells $row.Groups[1].Value
    $a = "$($cells['A'])"; $b = "$($cells['B'])"
    if ($a -ne '') {
      $num = $null
      if ($b -match '^\d+$') { $num = [int]$b } elseif ($a -match '(\d+)\s*$') { $num = [int]$Matches[1] }
      if     ($a -match 'Total de aluno')           { $resumo['Total']=$num }
      elseif ($a -match 'Confirmad')                { $resumo['Confirmados']=$num }
      elseif ($a -match 'Sem retorno')              { $resumo['SemRetorno']=$num }
      elseif ($a -match 'Contato errado')           { $resumo['ContatoErrado']=$num }
      elseif ($a -match 'Cancelament')              { $resumo['Cancelamentos']=$num }
      elseif ($a -match 'titularidad')              { $resumo['TransfTit']=$num }
      elseif ($a -match 'Transfer.*turma')          { $resumo['TransfTurma']=$num }
      elseif ($a -match 'Transfer.*unidad')         { $resumo['TransfUni']=$num }
      elseif ($a -match 'Meta 70')                  { $resumo['Meta70']=$num }
    }
    $nome = "$($cells['D'])".Trim()
    if ($nome -ne '' -and $nome -ne 'NOME') {
      $cpf = ("$($cells['E'])" -replace '\D','')
      $alunos += [pscustomobject]@{ Nome=$nome; Cpf=$cpf; StatusRaw="$($cells['F'])"; Status=(Norm-Status $cells['F']); Obs=("$($cells['G'])".Trim()) }
    }
  }

  # contagem real por status
  $cont = @{}
  foreach ($al in $alunos) { if(-not $cont.ContainsKey($al.Status)){$cont[$al.Status]=0}; $cont[$al.Status]++ }

  foreach ($al in $alunos) { $todosAlunos += [pscustomobject]@{ Turma=$aba.Nome; Nome=$al.Nome; Cpf=$al.Cpf; Status=$al.Status } }

  $turmas += [pscustomobject]@{ Nome=$aba.Nome; Resumo=$resumo; Alunos=$alunos; Cont=$cont }
}
$zip.Dispose()
Remove-Item $tmp -ErrorAction SilentlyContinue

# ---------- 5) montar Markdown ----------
$L = @()
function Add($s){ $script:L += $s }
function N($x){ if($null -eq $x){'—'} else {"$x"} }

Add "# 📋 Relatório de Turma — confirmação de presença × Meta 70%"
Add ""
Add "Planilha lida: **$($turmas.Count) aba(s)/turma(s)** — $(( $turmas | ForEach-Object { $_.Nome }) -join ' · ')"
Add ""

# 5.1 Panorama consolidado
Add "## 1) Panorama consolidado"
Add ""
Add "_👆 Clique em uma turma para ver o detalhe dela (margem, follow-up e transferências)._"
Add ""
Add "| Turma | Total | ✅ Confirm. | 🚫 Sem retorno | 🔄 Transf. turma | 🎯 Meta 70% | Faltam | Term. |"
Add "|---|--:|--:|--:|--:|--:|--:|:--:|"
$tTot=0;$tConf=0;$tSem=0;$tTransf=0
foreach ($t in $turmas) {
  $r=$t.Resumo
  $total = if($null -ne $r['Total']){$r['Total']}else{$t.Alunos.Count}
  $conf  = if($null -ne $r['Confirmados']){$r['Confirmados']}else{ if($t.Cont['Confirmado']){$t.Cont['Confirmado']}else{0} }
  $sem   = if($null -ne $r['SemRetorno']){$r['SemRetorno']}else{ if($t.Cont['Sem retorno']){$t.Cont['Sem retorno']}else{0} }
  $trf   = if($null -ne $r['TransfTurma']){$r['TransfTurma']}else{ if($t.Cont['Transf. turma']){$t.Cont['Transf. turma']}else{0} }
  $meta  = $r['Meta70']
  if ($null -eq $meta -and $null -ne $total) { $meta = [int][Math]::Round($total * 0.7, 0, [MidpointRounding]::AwayFromZero) }
  $faltam = if($null -ne $meta){ [Math]::Max(0, $meta - $conf) } else { $null }
  if ($t.Alunos.Count -eq 0) { $term='⚠️' }
  elseif ($null -eq $meta -or $meta -eq 0) { $term='—' }
  elseif ($conf -ge $meta) { $term='🟢' }
  elseif ($conf -ge [Math]::Floor($meta*0.8)) { $term='🟡' }
  else { $term='🔴' }
  Add ("| **{0}** | {1} | {2} | {3} | {4} | {5} | {6} | {7} |" -f $t.Nome,(N $total),(N $conf),(N $sem),(N $trf),(N $meta),(N $faltam),$term)
  if($null -ne $total){$tTot+=$total}; $tConf+=$conf; $tSem+=$sem; $tTransf+=$trf
}
Add ("| **TOTAL** | **{0}** | **{1}** | **{2}** | **{3}** | | | |" -f $tTot,$tConf,$tSem,$tTransf)
Add ""

# 5.2 Detalhe por turma -> objeto estruturado (alunos agrupados por status) p/ o modal clicavel do app
$detTurmas = [ordered]@{}
$ordemGrp = @(
  @{ key='Confirmado';     label='Confirmados';    emoji='✅'; cor='ok'     },
  @{ key='Sem retorno';    label='Sem retorno';    emoji='🚫'; cor='no'     },
  @{ key='Aguardando';     label='Aguardando';     emoji='⏳'; cor='wait'   },
  @{ key='__transf';       label='Transferências'; emoji='🔄'; cor='trf'    },
  @{ key='Cancelamento';   label='Cancelamentos';  emoji='❌'; cor='cancel' },
  @{ key='Contato errado'; label='Contato errado'; emoji='📵'; cor='cont'   },
  @{ key='(vazio)';        label='Sem status';     emoji='⬜'; cor='none'   },
  @{ key='__outro';        label='Fora do padrão'; emoji='⚠️'; cor='warn'   }
)
foreach ($t in $turmas) {
  $r=$t.Resumo
  $total = if($null -ne $r['Total']){$r['Total']}else{$t.Alunos.Count}
  $conf  = if($null -ne $r['Confirmados']){$r['Confirmados']}else{ if($t.Cont['Confirmado']){$t.Cont['Confirmado']}else{0} }
  $meta  = $r['Meta70']
  if ($null -eq $meta -and $null -ne $total) { $meta = [int][Math]::Round($total * 0.7, 0, [MidpointRounding]::AwayFromZero) }

  # alerta de margem (texto)
  $margem = ''
  if ($t.Alunos.Count -gt 0 -and $null -ne $meta -and $null -ne $total) {
    $trfTot = 0; foreach($k in 'TransfTurma','TransfTit','TransfUni'){ if($null -ne $r[$k]){$trfTot+=$r[$k]} }
    $cancel = if($null -ne $r['Cancelamentos']){$r['Cancelamentos']}else{0}
    $cerr   = if($null -ne $r['ContatoErrado']){$r['ContatoErrado']}else{0}
    $confirmaveis = $total - $trfTot - $cancel - $cerr
    if ($confirmaveis -lt $meta) { $margem = "🔴 Meta inatingível: só há $confirmaveis confirmáveis (total − transferências/cancelamentos) para a meta de $meta." }
    elseif ($confirmaveis -eq $meta) { $margem = "🔴 Margem zero: confirmáveis ($confirmaveis) = meta ($meta). Todo 'Sem retorno'/'Aguardando' precisa confirmar." }
    else { $margem = "🟡 Margem de $($confirmaveis - $meta): há $confirmaveis confirmáveis para a meta de $meta." }
  }

  # grupos por status (apenas os presentes); transferencias trazem o motivo na obs
  $grupos = @()
  foreach ($g in $ordemGrp) {
    $lista = switch ($g.key) {
      '__transf' { @($t.Alunos | Where-Object { $_.Status -like 'Transf.*' }) }
      '__outro'  { @($t.Alunos | Where-Object { $_.Status -like 'Outro:*' }) }
      default    { @($t.Alunos | Where-Object { $_.Status -eq $g.key }) }
    }
    if ($lista.Count -gt 0) {
      $alunos = @()
      foreach ($al in $lista) {
        $obs = "$($al.Obs)"
        if ($g.key -eq '__transf') {
          $mot = Motivo $al.Obs
          if ($obs -ne '') { $obs = "[$mot] $obs" } else { $obs = $mot }
        } elseif ($g.key -eq '__outro') {
          $raw = "$($al.StatusRaw)".Trim()
          if ($obs -ne '') { $obs = "status '$raw' — $obs" } else { $obs = "status '$raw'" }
        }
        $alunos += [ordered]@{ n = $al.Nome; c = (FmtCpf $al.Cpf); o = $obs }
      }
      $grupos += [ordered]@{ label=$g.label; emoji=$g.emoji; cor=$g.cor; n=$lista.Count; alunos=$alunos }
    }
  }

  $detTurmas[[string]$t.Nome] = [ordered]@{
    nome   = $t.Nome
    meta   = $meta
    conf   = $conf
    total  = $total
    faltam = if($null -ne $meta){ [Math]::Max(0, $meta - $conf) } else { $null }
    vazia  = ($t.Alunos.Count -eq 0)
    margem = $margem
    grupos = $grupos
  }
}

# 5.3 Cruzamento por CPF
Add "## 3) 🔗 Cruzamento entre turmas (mesmo CPF em +1 turma)"
Add ""
$cruz = $todosAlunos | Where-Object { $_.Cpf -ne '' } | Group-Object Cpf | Where-Object { ($_.Group | Select-Object -ExpandProperty Turma -Unique).Count -ge 2 }
if (-not $cruz) { Add "- Nenhum aluno aparece em mais de uma turma." }
else {
  Add "| Aluno | CPF | Turmas (status) |"
  Add "|---|---|---|"
  foreach($c in $cruz){
    $nome = ($c.Group | Select-Object -ExpandProperty Nome -First 1)
    $cpfF = if($c.Name.Length -eq 11){ '{0}.{1}.{2}-{3}' -f $c.Name.Substring(0,3),$c.Name.Substring(3,3),$c.Name.Substring(6,3),$c.Name.Substring(9,2) } else { $c.Name }
    $det = ($c.Group | ForEach-Object { "$($_.Turma): $($_.Status)" }) -join ' · '
    Add ("| {0} | {1} | {2} |" -f $nome,$cpfF,$det)
  }
}
Add ""

# 5.4 Qualidade de dados
Add "## 4) ⚠️ Qualidade de dados"
Add ""
foreach ($t in $turmas) {
  $probs = @()
  $r=$t.Resumo
  if ($t.Alunos.Count -eq 0) { $probs += "lista nominal vazia (resumo declara $(N $r['Total']))" }
  else {
    if ($null -ne $r['Total'] -and $r['Total'] -ne $t.Alunos.Count) { $probs += "resumo declara $($r['Total']), a lista tem $($t.Alunos.Count) linha(s)" }
    $semSt = @($t.Alunos | Where-Object { $_.Status -eq '(vazio)' }).Count
    if ($semSt -gt 0) { $probs += "$semSt aluno(s) sem status preenchido" }
    $typos = @($t.Alunos | Where-Object { $_.Status -like 'Outro:*' })
    if ($typos.Count -gt 0) { $probs += ("status fora do padrão: " + (($typos | ForEach-Object { $_.StatusRaw.Trim() } | Select-Object -Unique) -join ', ')) }
    $dups = $t.Alunos | Where-Object { $_.Cpf -ne '' } | Group-Object Cpf | Where-Object { $_.Count -gt 1 }
    if ($dups) { $probs += ("CPF duplicado: " + (($dups | ForEach-Object { ($_.Group | Select-Object -ExpandProperty Nome -First 1) }) -join ', ')) }
  }
  if ($probs.Count -eq 0) { Add "- **$($t.Nome):** ok, sem inconsistências." }
  else { Add "- **$($t.Nome):** $($probs -join '; ')." }
}
Add ""

# ---------- 6) saida: corpo visivel (markdown) + detalhe por turma (JSON) p/ o modal do app ----------
$corpo = $L -join "`n"
$json  = $detTurmas | ConvertTo-Json -Compress -Depth 8
if ([string]::IsNullOrWhiteSpace($json)) { $json = '{}' }
$corpo + "`n`n<!--RT-DET:" + $json + "-->"
