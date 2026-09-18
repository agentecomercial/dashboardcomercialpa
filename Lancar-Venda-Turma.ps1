<#
════════════════════════════════════════════════════════════════════════════
 Lancar-Venda-Turma.ps1 — lançamento de vendas numa turma do FRZ SISTEMA v2
 em LOTE, com prévia única e checagem de duplicata ANTES de perguntar.

   DESTINO  https://frz-sistema-v2.vercel.app  → Supabase, tabela `vendas`
   ALUNOS   ZS / Zsales (Painel-Vitoria.ps1 -> class_id, Painel-Turma.ps1)

 v2 (07/08/2026) — redesenho do fluxo guiado de 6 perguntas. O que mudou:
 • LOTE: uma linha por venda, prévia única, uma aprovação só.
 • Duplicata deixou de ser emboscada no fim: as vendas da turma são
   carregadas junto com os alunos e o alerta aparece já no painel.
 • CACHE: class_id é permanente, alunos valem o dia (o ZS leva ~1min).
 • Aluno por PREFIXO (3 letras bastam), não mais lista de 143 nomes.
 • Valor e status são sempre explícitos — nada de default silencioso em
   dinheiro. Quantidade default 1. Valor fora do padrão do curso vira ⚠.

 Como usar
 ─────────
   .\Lancar-Venda-Turma.ps1                                  # lista as turmas
   .\Lancar-Venda-Turma.ps1 -Turma 10                        # painel da turma
   .\Lancar-Venda-Turma.ps1 -Turma 10 -Atualizar             # ignora o cache
   .\Lancar-Venda-Turma.ps1 -Turma 10 -LinhasFile lote.txt   # PRÉVIA
   .\Lancar-Venda-Turma.ps1 -Turma 10 -LinhasFile lote.txt -Aplicar   # GRAVA

 Formato de cada linha (o que vai no -LinhasFile):
   nome | curso | [qtd] | valor | status
   isabely | IF | 2 | 2998,50 | pago
   carlos  | maestria | 12000 | neg
   Status: pago/finalizado · entrada · neg/negociacao
════════════════════════════════════════════════════════════════════════════
#>
param(
  [string]$Turma = '',
  [string]$LinhasFile = '',
  [switch]$Aplicar,
  [switch]$Atualizar,
  [switch]$TodosAlunos
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

$SB_BASE = 'https://mnfxnepsfdfcmoglmgec.supabase.co/rest/v1'
$SB_KEY  = 'sb_publishable_hbmxtsjNBloNR6CYBXZ8Zw_FQeMZXOC'
$HDR     = @{ apikey = $SB_KEY; Authorization = "Bearer $SB_KEY" }
$APP_URL = 'https://frz-sistema-v2.vercel.app/'
$RAIZ    = Split-Path -Parent $MyInvocation.MyCommand.Path
$CACHE   = Join-Path $env:LOCALAPPDATA 'MetaMaster\turmas'
if (-not (Test-Path $CACHE)) { New-Item -ItemType Directory -Path $CACHE -Force | Out-Null }

# Cursos que o app não tem no datalist mas já foram usados à mão nas vendas.
$CURSOS_EXTRA = @('PITCH LIVRAO', 'Coaching Individual')
# Fallback caso o app esteja fora do ar na hora (lista de 07/08/2026).
$CURSOS_FALLBACK = @(
  'BHP - Gestão de Negócios','CEOP - Comunicação Eficaz e Oratória Persuasiva',
  'FCIS - Formação em Coaching','FGPC - Formação em Gestão de Pessoas com Perfil Comportamental',
  'GRADE GGB','IF - Inteligência Financeira','MAESTRIA','MASTER - Master Coaching',
  'Método CIS - Global','Método CIS - Presencial','ML5 - Formação de Líderes',
  'TCE TOUR PV BRONZE - PA','TCE TOUR PV OURO - PA','TCE TOUR PV BLACK - PA','TV - Técnicas de Vendas')

# Apelido → curso canônico. Chave normalizada (sem acento, maiúscula).
$APELIDO = @{
  'IF'='IF - Inteligência Financeira'; 'LIVRAO'='PITCH LIVRAO'; 'PITCH LIVRAO'='PITCH LIVRAO'
  'CIS'='Método CIS - Global'; 'MCIS'='Método CIS - Global'; 'CIS GLOBAL'='Método CIS - Global'
  'CIS PRESENCIAL'='Método CIS - Presencial'; 'GGB'='GRADE GGB'; 'CI'='Coaching Individual'
  'TAV'='TV - Técnicas de Vendas'; 'TV'='TV - Técnicas de Vendas'; 'BHP'='BHP - Gestão de Negócios'
  'ML5'='ML5 - Formação de Líderes'; 'FGPC'='FGPC - Formação em Gestão de Pessoas com Perfil Comportamental'
  'FCIS'='FCIS - Formação em Coaching'; 'CEOP'='CEOP - Comunicação Eficaz e Oratória Persuasiva'
  'MASTER'='MASTER - Master Coaching'; 'MAESTRIA'='MAESTRIA'; 'TCE BRONZE'='TCE TOUR PV BRONZE - PA'
  'TCE OURO'='TCE TOUR PV OURO - PA'; 'TCE BLACK'='TCE TOUR PV BLACK - PA'
}
$STATUS_MAP = @{
  'PAGO'='PAGAMENTO FINALIZADO'; 'FINALIZADO'='PAGAMENTO FINALIZADO'; 'PAGAMENTO FINALIZADO'='PAGAMENTO FINALIZADO'
  'ENTRADA'='PAGO COM ENTRADA'; 'PAGO COM ENTRADA'='PAGO COM ENTRADA'
  'NEG'='NEGOCIAÇÃO'; 'NEGOCIACAO'='NEGOCIAÇÃO'; 'NEGOCIAÇÃO'='NEGOCIAÇÃO'
}

function Norm($s) {
  $t = [string]$s
  $t = $t.Normalize([Text.NormalizationForm]::FormD) -replace '[^\x00-\x7F]', ''
  return ($t -replace '\s+', ' ').Trim().ToUpper()
}
function SoDigitos($s) { return (([string]$s) -replace '\D', '') }
function Valor($v) {
  if ($v -is [double] -or $v -is [decimal] -or $v -is [int]) { return [double]$v }
  $t = ([string]$v).Trim() -replace '[^\d,\.]', ''
  if (-not $t) { return 0.0 }
  if ($t -match ',') { $t = ($t -replace '\.', '') -replace ',', '.' }   # 2.998,50 -> 2998.50
  return [double]::Parse($t, [Globalization.CultureInfo]::InvariantCulture)
}
function Sb-Get($rota) {
  $r = Invoke-WebRequest -Uri "$SB_BASE/$rota" -Headers $HDR -UseBasicParsing
  return ($r.Content | ConvertFrom-Json)
}
function Liquidez($curso, $valor) {
  if ((Norm $curso).StartsWith('COACHING INDIVIDUAL')) { return [math]::Round($valor * 0.5, 2) }
  return $valor
}

# ── catálogo de cursos: datalist do app (cache do dia) ───────────────────────
function Get-Cursos {
  $f = Join-Path $CACHE ('cursos-' + (Get-Date -Format 'yyyyMMdd') + '.json')
  if ((Test-Path $f) -and -not $Atualizar) { return @((Get-Content $f -Raw | ConvertFrom-Json)) }
  $lista = @()
  try {
    $html = (Invoke-WebRequest -Uri $APP_URL -UseBasicParsing).Content
    $m = [regex]::Match($html, 'const TIPOS_LIST\s*=\s*\[(.*?)\];', [Text.RegularExpressions.RegexOptions]::Singleline)
    foreach ($x in [regex]::Matches($m.Groups[1].Value, "'([^']*)'")) { $lista += $x.Groups[1].Value }
  } catch {}
  if ($lista.Count -eq 0) { $lista = $CURSOS_FALLBACK }
  foreach ($e in $CURSOS_EXTRA) { if ($lista -notcontains $e) { $lista += $e } }
  $lista | ConvertTo-Json | Out-File $f -Encoding utf8
  return @($lista)
}

# ── class_id do ZS: cache PERMANENTE (turma nova não muda de id) ─────────────
function Get-ClassId($nomeTurma, $cidade) {
  $f = Join-Path $CACHE 'class-map.json'
  $map = @{}
  if (Test-Path $f) { (Get-Content $f -Raw | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $map[$_.Name] = $_.Value } }
  $chave = (Norm "$nomeTurma $cidade")
  if ($map.ContainsKey($chave) -and -not $Atualizar) { return [int]$map[$chave] }

  $out = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RAIZ 'Painel-Vitoria.ps1') -Status todas 2>&1 | Out-String
  $mj = [regex]::Match($out, '<!--PAINEL:(.*?)-->', [Text.RegularExpressions.RegexOptions]::Singleline)
  if (-not $mj.Success) { return 0 }
  $itens = ($mj.Groups[1].Value | ConvertFrom-Json).itens
  # "MCIS 251" + "VITÓRIA" casa com "MCIS 251 - Vitória"
  $alvo = $itens | Where-Object { (Norm $_.nome).StartsWith((Norm $nomeTurma)) -and (Norm $_.nome).Contains((Norm $cidade)) } | Select-Object -First 1
  if (-not $alvo) { $alvo = $itens | Where-Object { (Norm $_.nome).StartsWith((Norm $nomeTurma)) } | Select-Object -First 1 }
  if (-not $alvo) { return 0 }
  $map[$chave] = [int]$alvo.id
  $map | ConvertTo-Json | Out-File $f -Encoding utf8
  return [int]$alvo.id
}

# ── alunos da turma: cache do DIA (a consulta ao ZS leva ~1 min) ─────────────
function Get-Alunos($classId) {
  $f = Join-Path $CACHE ("alunos-$classId-" + (Get-Date -Format 'yyyyMMdd') + '.json')
  if ((Test-Path $f) -and -not $Atualizar) {
    return [pscustomobject]@{ dados = (Get-Content $f -Raw | ConvertFrom-Json); em = (Get-Item $f).LastWriteTime; cache = $true }
  }
  $out = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RAIZ 'Painel-Turma.ps1') -ClassId $classId 2>&1 | Out-String
  $j = $out | ConvertFrom-Json
  $j | ConvertTo-Json -Depth 6 | Out-File $f -Encoding utf8
  return [pscustomobject]@{ dados = $j; em = (Get-Date); cache = $false }
}

# ── resolução por prefixo/pedaço do nome ─────────────────────────────────────
function Achar-Aluno($texto, $pool, $poolTodos) {
  $q = Norm $texto
  $r = @($pool | Where-Object { (Norm $_.nome).StartsWith($q) })
  if ($r.Count -eq 0) { $r = @($pool | Where-Object { (Norm $_.nome).Contains($q) }) }
  if ($r.Count -eq 0) {
    # não achou entre os confirmados: procura no restante da turma p/ avisar direito
    $fora = @($poolTodos | Where-Object { (Norm $_.nome).Contains($q) })
    if ($fora.Count -ge 1) { return [pscustomobject]@{ ok=$false; forat=$fora; cands=@() } }
    return [pscustomobject]@{ ok=$false; forat=@(); cands=@() }
  }
  if ($r.Count -gt 1) {
    $exato = @($r | Where-Object { (Norm $_.nome) -eq $q })
    if ($exato.Count -eq 1) { return [pscustomobject]@{ ok=$true; aluno=$exato[0] } }
    return [pscustomobject]@{ ok=$false; cands=$r; forat=@() }
  }
  return [pscustomobject]@{ ok=$true; aluno=$r[0] }
}
function Achar-Curso($texto, $cursos) {
  $q = Norm $texto
  if ($APELIDO.ContainsKey($q)) { return $APELIDO[$q] }
  $r = @($cursos | Where-Object { (Norm $_) -eq $q })
  if ($r.Count -eq 1) { return $r[0] }
  $r = @($cursos | Where-Object { (Norm $_).StartsWith($q) })
  if ($r.Count -eq 1) { return $r[0] }
  $r = @($cursos | Where-Object { (Norm $_).Contains($q) })
  if ($r.Count -eq 1) { return $r[0] }
  if ($r.Count -gt 1) { return '???' + ($r -join ' // ') }
  return ''
}

# ── 1. turma ────────────────────────────────────────────────────────────────
$turmas = @(Sb-Get 'turmas?select=id,nome,tipo,cidade,data_inicio,status,meta_receita&order=data_inicio.asc')
if (-not $Turma) {
  Write-Output '## Turmas cadastradas (frz-sistema-v2)'
  Write-Output ''
  Write-Output '| id | Turma | Cidade | Início | Tipo | Meta |'
  Write-Output '|---|---|---|---|---|---|'
  foreach ($t in $turmas) { Write-Output ('| {0} | {1} | {2} | {3} | {4} | {5:N2} |' -f $t.id, $t.nome, $t.cidade, $t.data_inicio, $t.tipo, $t.meta_receita) }
  Write-Output ''
  Write-Output 'Rode de novo com `-Turma <id>`.'
  exit 0
}
$alvo = $null
if ($Turma -match '^\d+$') { $alvo = $turmas | Where-Object { $_.id -eq [int]$Turma } | Select-Object -First 1 }
else { $alvo = $turmas | Where-Object { (Norm $_.nome).Contains((Norm $Turma)) } | Select-Object -First 1 }
if (-not $alvo) { Write-Output "**Turma '$Turma' não encontrada.** Rode sem -Turma para ver a lista."; exit 1 }

# ── 2. contexto da turma: vendas já lançadas + alunos do ZS ─────────────────
$vendas = @(Sb-Get "vendas?select=id,consultor,nome_aluno,cpf,curso,quantidade,valor,liquidez,status&turma_id=eq.$($alvo.id)&order=id.asc")
$classId = Get-ClassId $alvo.nome $alvo.cidade
if (-not $classId) { Write-Output "**Não achei a turma '$($alvo.nome) - $($alvo.cidade)' no ZS.**"; exit 1 }
$al = Get-Alunos $classId
$todosAl = @($al.dados.pessoas)
$confirmados = @($todosAl | Where-Object { $_.status -eq 'Presença Confirmada' })
$pool = if ($TodosAlunos) { $todosAl } else { $confirmados }
$cursos = Get-Cursos

# quem já tem venda lançada (casa por CPF; sem CPF na venda, cai no nome)
$cpfVenda = @{}; $nomeVenda = @{}
foreach ($v in $vendas) {
  $c = SoDigitos $v.cpf
  if ($c) { if (-not $cpfVenda.ContainsKey($c)) { $cpfVenda[$c] = @() }; $cpfVenda[$c] += $v }
  $n = Norm $v.nome_aluno
  if ($n) { if (-not $nomeVenda.ContainsKey($n)) { $nomeVenda[$n] = @() }; $nomeVenda[$n] += $v }
}
function Vendas-Do-Aluno($aluno) {
  $out = @()
  $c = SoDigitos $aluno.cpf
  if ($c -and $cpfVenda.ContainsKey($c)) { $out += $cpfVenda[$c] }
  $tok = @((Norm $aluno.nome) -split ' ' | Where-Object { $_.Length -ge 4 })
  foreach ($k in $nomeVenda.Keys) {
    $ktok = @($k -split ' ' | Where-Object { $_.Length -ge 4 })
    if ($tok.Count -and $ktok.Count) {
      $comuns = @($tok | Where-Object { $ktok -contains $_ })
      if ($comuns.Count -ge 2 -or ($ktok.Count -eq 1 -and $comuns.Count -eq 1)) {
        foreach ($v in $nomeVenda[$k]) { if ($out -notcontains $v) { $out += $v } }
      }
    }
  }
  return ,@($out)
}

# consultor: usa a grafia que a turma já pratica (resp do ZS = "Karla Ferreira de Oliveira" -> "Karla")
function Consultor-Grafia($resp) {
  if (-not $resp) { return '' }
  $p = (Norm $resp) -split ' '
  $prim = $p[0]
  $usadas = @($vendas | ForEach-Object { $_.consultor } | Where-Object { $_ } | Sort-Object -Unique)
  $hit = @($usadas | Where-Object { (Norm $_).StartsWith($prim) })
  if ($hit.Count -ge 1) { return ($hit | Sort-Object { $_.Length } | Select-Object -First 1) }
  return $resp
}

# ── 3. painel da turma (sem -LinhasFile) ────────────────────────────────────
if (-not $LinhasFile) {
  $liq = ($vendas | Measure-Object liquidez -Sum).Sum; if (-not $liq) { $liq = 0 }
  $rea = ($vendas | Where-Object { $_.status -ne 'NEGOCIAÇÃO' } | Measure-Object liquidez -Sum).Sum; if (-not $rea) { $rea = 0 }
  $comVenda = @($confirmados | Where-Object { (Vendas-Do-Aluno $_).Count -gt 0 })
  Write-Output ("## 🎒 {0} · {1} (id {2}) — ZS class {3}" -f $alvo.nome, $alvo.cidade, $alvo.id, $classId)
  Write-Output ''
  Write-Output ("**{0} venda(s)** · liquidez **R$ {1:N2}** de R$ {2:N2} ({3}%) · realizado R$ {4:N2}" -f `
    $vendas.Count, $liq, (Valor $alvo.meta_receita), $(if ((Valor $alvo.meta_receita) -gt 0) { [math]::Round($liq / (Valor $alvo.meta_receita) * 100) } else { 0 }), $rea)
  Write-Output ("**{0} aluno(s) com Presença Confirmada** (de {1} matriculados) · **{2} já têm venda lançada**" -f $confirmados.Count, $todosAl.Count, $comVenda.Count)
  Write-Output ("Alunos {0} — {1}" -f $(if ($al.cache) { 'do cache' } else { 'recém-consultados no ZS' }), $al.em.ToString('dd/MM HH:mm'))
  Write-Output ''
  if ($comVenda.Count) {
    Write-Output '**Já lançados (não repita):**'
    Write-Output ''
    Write-Output '| Aluno | Curso | Valor | Status |'
    Write-Output '|---|---|---|---|'
    foreach ($a in $comVenda) { foreach ($v in (Vendas-Do-Aluno $a)) { Write-Output ('| {0} | {1} | {2:N2} | {3} |' -f $a.nome, $v.curso, (Valor $v.valor), $v.status) } }
    Write-Output ''
  }
  Write-Output '**Para lançar:** uma linha por venda — `nome | curso | [qtd] | valor | status`'
  Write-Output '(status: `pago` · `entrada` · `neg` — qtd é opcional, default 1; o nome pode ser só o começo)'
  exit 0
}

# ── 4. parse do lote + prévia ───────────────────────────────────────────────
if (-not (Test-Path $LinhasFile)) { Write-Output "**Arquivo não encontrado:** $LinhasFile"; exit 1 }
$linhas = @(Get-Content $LinhasFile -Encoding UTF8 | Where-Object { $_.Trim() -and -not $_.Trim().StartsWith('#') })
if ($linhas.Count -eq 0) { Write-Output '**Nenhuma linha para lançar.**'; exit 1 }

$itens = @(); $n = 0
foreach ($ln in $linhas) {
  $n++
  $p = @($ln -split '\|' | ForEach-Object { $_.Trim() })
  $it = [ordered]@{ n=$n; raw=$ln; alerta=@(); erro=''; qtd=1 }
  if ($p.Count -lt 4) { $it.erro = 'formato: nome | curso | [qtd] | valor | status'; $itens += [pscustomobject]$it; continue }

  if ($p.Count -ge 5) { $it.qtd = [int](SoDigitos $p[2]); $vTxt = $p[3]; $sTxt = $p[4] }
  else { $vTxt = $p[2]; $sTxt = $p[3] }
  if ($it.qtd -lt 1) { $it.qtd = 1 }

  $ra = Achar-Aluno $p[0] $pool $todosAl
  if (-not $ra.ok) {
    if ($ra.cands.Count -gt 1) { $it.erro = 'ambíguo: ' + (($ra.cands | ForEach-Object { $_.nome }) -join ' // ') }
    elseif ($ra.forat.Count -ge 1) { $it.erro = 'está na turma mas SEM presença confirmada: ' + (($ra.forat | ForEach-Object { "$($_.nome) [$($_.status)]" }) -join ' // ') }
    else { $it.erro = "aluno não encontrado na turma ($($p[0]))" }
    $itens += [pscustomobject]$it; continue
  }
  $it.aluno = $ra.aluno

  $cu = Achar-Curso $p[1] $cursos
  if (-not $cu) { $it.erro = "curso não reconhecido ($($p[1]))"; $itens += [pscustomobject]$it; continue }
  if ($cu.StartsWith('???')) { $it.erro = 'curso ambíguo: ' + $cu.Substring(3); $itens += [pscustomobject]$it; continue }
  $it.curso = $cu

  $st = $STATUS_MAP[(Norm $sTxt)]
  if (-not $st) { $it.erro = "status inválido ($sTxt) — use pago / entrada / neg"; $itens += [pscustomobject]$it; continue }
  $it.status = $st

  $val = Valor $vTxt
  if ($val -le 0) { $it.erro = "valor inválido ($vTxt)"; $itens += [pscustomobject]$it; continue }
  $it.valor = $val
  $it.liq = Liquidez $cu $val
  $it.consultor = Consultor-Grafia $ra.aluno.resp

  # duplicata: mesmo aluno + mesmo curso já na turma
  $jaTem = @((Vendas-Do-Aluno $ra.aluno) | Where-Object { (Norm $_.curso) -eq (Norm $cu) })
  if ($jaTem.Count) { $it.alerta += ('DUPLICATA — venda ' + (($jaTem | ForEach-Object { "#$($_.id) R$ $('{0:N2}' -f (Valor $_.valor)) $($_.status)" }) -join ' / ')) }
  # valor destoante do praticado no curso dentro da turma
  $prat = @($vendas | Where-Object { (Norm $_.curso) -eq (Norm $cu) -and (Valor $_.valor) -gt 0 } | ForEach-Object { Valor $_.valor })
  if ($prat.Count -ge 2) {
    $med = ($prat | Measure-Object -Average).Average
    if ($med -gt 0 -and ($val -lt $med * 0.5 -or $val -gt $med * 2)) { $it.alerta += ('valor destoa do praticado no curso (média R$ {0:N2})' -f $med) }
  }
  $itens += [pscustomobject]$it
}

$ok  = @($itens | Where-Object { -not $_.erro })
$bad = @($itens | Where-Object { $_.erro })

Write-Output ("## Prévia — {0} · {1} (turma {2})" -f $alvo.nome, $alvo.cidade, $alvo.id)
Write-Output ''
Write-Output '| # | Aluno | CPF | Curso | Qtd | Valor | Liquidez | Status | Consultor | ⚠ |'
Write-Output '|---|---|---|---|---|---|---|---|---|---|'
foreach ($i in $ok) {
  Write-Output ('| {0} | {1} | {2} | {3} | {4} | {5:N2} | {6:N2} | {7} | {8} | {9} |' -f `
    $i.n, $i.aluno.nome, $i.aluno.cpf, $i.curso, $i.qtd, $i.valor, $i.liq, $i.status, $i.consultor, ($i.alerta -join ' · '))
}
Write-Output ''
if ($bad.Count) {
  Write-Output '**Linhas com problema (não entram):**'
  Write-Output ''
  Write-Output '| # | Linha | Problema |'
  Write-Output '|---|---|---|'
  # a linha crua tem "|" — escapar, senão estoura as colunas da tabela markdown
  foreach ($i in $bad) { Write-Output ('| {0} | {1} | {2} |' -f $i.n, ($i.raw -replace '\|', '\|'), $i.erro) }
  Write-Output ''
}
$soma = ($ok | Measure-Object valor -Sum).Sum; if (-not $soma) { $soma = 0 }
$alertas = @($ok | Where-Object { $_.alerta.Count })
Write-Output ("**{0} linha(s) prontas · R$ {1:N2} · {2} com alerta · {3} com erro**" -f $ok.Count, $soma, $alertas.Count, $bad.Count)

if (-not $Aplicar) {
  Write-Output ''
  Write-Output '**PRÉVIA — nada foi gravado.** Repita com `-Aplicar` para gravar.'
  exit 0
}
if ($ok.Count -eq 0) { Write-Output ''; Write-Output '**Nada a gravar.**'; exit 1 }

# ── 5. grava ────────────────────────────────────────────────────────────────
$novas = @()
foreach ($i in $ok) {
  $novas += @{
    turma_id   = $alvo.id
    consultor  = $i.consultor
    nome_aluno = $i.aluno.nome
    cpf        = $i.aluno.cpf
    curso      = $i.curso
    quantidade = $i.qtd
    entrada    = 0
    valor      = $i.valor
    liquidez   = $i.liq
    parcelas   = $null
    status     = $i.status
    link_sf    = ''
    obs        = ''
  }
}
$json = '[' + (($novas | ForEach-Object { $_ | ConvertTo-Json -Depth 3 }) -join ',') + ']'
$hPost = $HDR.Clone(); $hPost['Prefer'] = 'return=representation'
$resp = (Invoke-WebRequest -Uri "$SB_BASE/vendas" -Method Post -Headers $hPost -Body ([Text.Encoding]::UTF8.GetBytes($json)) -ContentType 'application/json' -UseBasicParsing).Content | ConvertFrom-Json

Write-Output ''
Write-Output ("### ✔ {0} venda(s) gravada(s)" -f @($resp).Count)
Write-Output ''
Write-Output '| id | Aluno | Curso | Qtd | Valor | Status |'
Write-Output '|---|---|---|---|---|---|'
foreach ($r in @($resp)) { Write-Output ('| {0} | {1} | {2} | {3} | {4:N2} | {5} |' -f $r.id, $r.nome_aluno, $r.curso, $r.quantidade, (Valor $r.valor), $r.status) }

$todas = @(Sb-Get "vendas?select=liquidez,status&turma_id=eq.$($alvo.id)")
$liqT = ($todas | Measure-Object liquidez -Sum).Sum; if (-not $liqT) { $liqT = 0 }
$reaT = ($todas | Where-Object { $_.status -ne 'NEGOCIAÇÃO' } | Measure-Object liquidez -Sum).Sum; if (-not $reaT) { $reaT = 0 }
$meta = Valor $alvo.meta_receita
Write-Output ''
Write-Output ("Turma agora: **{0} venda(s)** · liquidez R$ {1:N2} de R$ {2:N2} ({3}%) · realizado R$ {4:N2}" -f `
  $todas.Count, $liqT, $meta, $(if ($meta -gt 0) { [math]::Round($liqT / $meta * 100) } else { 0 }), $reaT)
