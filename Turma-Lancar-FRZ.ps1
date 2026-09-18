<#
════════════════════════════════════════════════════════════════════════════
 Turma-Lancar-FRZ.ps1 — leva os lançamentos do FRZ // PIPELINE HUD para as
 vendas de uma turma do FRZ SISTEMA v2.

   ORIGEM  (pipeline)  https://frz-pipeline-hud.vercel.app  → tabela `pipeline_entries`
   DESTINO (sistema)   https://frz-sistema-v2.vercel.app    → tabela `vendas` (por turma)

 Os dois vivem no MESMO projeto Supabase e a leitura/escrita é anônima
 (chave publishable), então não há login nem servidor no meio.

 Como usar
 ─────────
   .\Turma-Lancar-FRZ.ps1                              # lista as turmas e sai
   .\Turma-Lancar-FRZ.ps1 -Turma "CIS 251"             # prévia de hoje
   .\Turma-Lancar-FRZ.ps1 -Turma 10 -Data 2026-08-05   # prévia de um dia
   .\Turma-Lancar-FRZ.ps1 -Turma 10 -Data 2026-08      # prévia do mês inteiro
   .\Turma-Lancar-FRZ.ps1 -Turma 10 -Data 2026-08-05 -Aplicar   # GRAVA

 Regras combinadas (06/08/2026)
 ──────────────────────────────
 • NADA é gravado sem `-Aplicar`. Sem o switch o script só mostra a prévia.
 • Escopo padrão = Pipeline Vitória (Gabriela · Karla · Natália · Heverton
   Leonardo). `-Todos` traz os 9 consultores do HUD; `-Consultores` sobrepõe.
 • NÃO duplica e NÃO sobrescreve: compara aluno+curso+valor com o que já
   existe na turma e só insere o que falta. Ajuste feito à mão no sistema da
   turma fica de pé — este script nunca faz UPDATE nem DELETE.
 • Status:  FECHADO → PAGAMENTO FINALIZADO · ABERTO → PAGO COM ENTRADA ·
            PROJEÇÃO → NEGOCIAÇÃO.
 • Liquidez: igual ao valor, MENOS "Coaching Individual*", que entra pela
   metade — é a mesma conta do sistema da turma (calcLiq).
 • Lançamento sem data no HUD não entra (aparece no rodapé como ignorado),
   porque não dá para saber a que dia ele pertence.
════════════════════════════════════════════════════════════════════════════
#>
param(
  [string]$Turma = '',
  [string]$Data = '',
  [string]$Consultores = 'Gabriela,Karla,Natália,Heverton Leonardo',
  [switch]$Todos,
  [switch]$Aplicar,
  [switch]$Json,            # saida estruturada (usada pelo Meta Master)
  [string]$PlanoFile = ''   # aplica EXATAMENTE o plano que o usuario viu na tela
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

# Em modo -Json a saida tem que ser SO o JSON: sobrescrever Write-Host no escopo do
# script silencia todas as mensagens de console sem tocar em cada linha.
if ($Json) { function Write-Host { } }
function Write-Plano($obj) {
  $txt = $obj | ConvertTo-Json -Depth 8 -Compress
  [Console]::Out.Write($txt)
}

$SB_BASE = 'https://mnfxnepsfdfcmoglmgec.supabase.co/rest/v1'
$SB_KEY  = 'sb_publishable_hbmxtsjNBloNR6CYBXZ8Zw_FQeMZXOC'
$HDR     = @{ apikey = $SB_KEY; Authorization = "Bearer $SB_KEY" }

function Sb-Get($rota) {
  return @(Invoke-RestMethod -Uri "$SB_BASE/$rota" -Headers $HDR -Method Get)
}

# Normaliza para comparar: sem acento, sem espaço duplo, maiúsculo.
function Norm($s) {
  $t = [string]$s
  $t = $t.Normalize([Text.NormalizationForm]::FormD) -replace '[^\x00-\x7F]', ''
  return ($t -replace '\s+', ' ').Trim().ToUpper()
}

# "4.596,46" / "4596,46" / 4596.46  →  4596.46
function Valor($v) {
  if ($v -is [double] -or $v -is [decimal] -or $v -is [int]) { return [double]$v }
  $t = ([string]$v).Trim() -replace '[^\d,\.]', ''
  if (-not $t) { return 0.0 }
  $t = $t -replace '\.', ''      # ponto no HUD é separador de milhar
  $t = $t -replace ',', '.'
  return [double]::Parse($t, [Globalization.CultureInfo]::InvariantCulture)
}

<# De-para de curso: o HUD é campo livre (o consultor digita "tce bronze",
   "Livrão", "CI"), o sistema da turma tem nomes canônicos no datalist.
   Chave = curso do HUD normalizado. Sem correspondência, o texto original
   passa direto e a linha é marcada com ⚠ na prévia. #>
$DE_PARA = @{
  'LIVRAO'                = 'PITCH LIVRAO'
  'PITCH LIVRAO'          = 'PITCH LIVRAO'
  'IF'                    = 'IF - Inteligência Financeira'
  'GGB'                   = 'GRADE GGB'
  'GRADE GGB'             = 'GRADE GGB'
  'CI'                    = 'Coaching Individual'
  'COACHING INDIVIDUAL'   = 'Coaching Individual'
  'METODO CIS'            = 'Método CIS - Global'
  'METODO CIS GLOBAL'     = 'Método CIS - Global'
  'METODO CIS PRESENCIAL' = 'Método CIS - Presencial'
  'CEOP'                  = 'CEOP - Comunicação Eficaz e Oratória Persuasiva'
  'MASTER'                = 'MASTER - Master Coaching'
  'MASTER COACHING'       = 'MASTER - Master Coaching'
  'FGPC'                  = 'FGPC - Formação em Gestão de Pessoas com Perfil Comportamental'
  'FCIS'                  = 'FCIS - Formação em Coaching'
  'FPF'                   = 'FPF - Formação em Planejador Financeiro'
  'DIP'                   = 'DIP - Decifre e Influencie Pessoas'
  'GE'                    = 'GE - Gestão Eficaz'
  'JE'                    = 'JE - Jornada do Enriquecimento'
  'PDA'                   = 'PDA - Poder da Ação'
  'ML5'                   = 'ML5 - Formação de Líderes'
  'BHP'                   = 'BHP - Gestão de Negócios'
  'TV'                    = 'TV - Técnicas de Vendas'
  'IA'                    = 'IA para Negócios'
  'IA PARA NEGOCIOS'      = 'IA para Negócios'
  'TCE BRONZE'            = 'TCE TOUR PV BRONZE - PA'
  'TOUR BRONZE'           = 'TCE TOUR PV BRONZE - PA'
  'TCE OURO'              = 'TCE TOUR PV OURO - PA'
  'TOUR OURO'             = 'TCE TOUR PV OURO - PA'
  'TCE BLACK'             = 'TCE TOUR PV BLACK - PA'
  'TOUR BLACK'            = 'TCE TOUR PV BLACK - PA'
}

$STATUS = @{
  'FECHADO'  = 'PAGAMENTO FINALIZADO'
  'ABERTO'   = 'PAGO COM ENTRADA'
  'PROJECAO' = 'NEGOCIAÇÃO'
}

function Curso-Sistema($cursoHud) {
  $k = Norm $cursoHud
  if ($DE_PARA.ContainsKey($k)) { return $DE_PARA[$k] }
  return ([string]$cursoHud).Trim()
}

function Liquidez($curso, $valor) {
  if ($curso.StartsWith('Coaching Individual')) { return $valor * 0.5 }
  return $valor
}

# ── 1. Turma de destino ──────────────────────────────────────────────────────
$turmas = Sb-Get 'turmas?select=id,nome,tipo,cidade,data_inicio,status,meta_receita&order=data_inicio.asc'

if (-not $Turma) {
  if ($Json) {
    Write-Plano @{ ok = $true; modo = 'turmas'; turmas = @($turmas | ForEach-Object {
      @{ id = $_.id; nome = $_.nome; cidade = $_.cidade; tipo = $_.tipo
         data_inicio = $_.data_inicio; status = $_.status; meta = (Valor $_.meta_receita) } }) }
    return
  }
  Write-Host ''
  Write-Host '  TURMAS CADASTRADAS (frz-sistema-v2)' -ForegroundColor Cyan
  Write-Host ''
  # Out-String com largura fixa: sem isso o console estreito corta coluna
  # (e o Format-Table sai fora de ordem quando a saída é redirecionada).
  Write-Host ($turmas | Format-Table id, nome, tipo, cidade, data_inicio, status,
    @{n='meta'; e={ '{0:N2}' -f $_.meta_receita }} -AutoSize | Out-String -Width 200)
  Write-Host '  Rode de novo com -Turma <id ou nome>. Ex.: -Turma "CIS 251"' -ForegroundColor Yellow
  Write-Host ''
  return
}

$alvo = $null
if ($Turma -match '^\d+$') {
  $alvo = $turmas | Where-Object { $_.id -eq [int]$Turma } | Select-Object -First 1
} else {
  $n = Norm $Turma
  $alvo = $turmas | Where-Object { (Norm $_.nome) -eq $n } | Select-Object -First 1
  if (-not $alvo) {
    $alvo = $turmas | Where-Object { (Norm $_.nome).Contains($n) } | Select-Object -First 1
  }
}
if (-not $alvo) {
  if ($Json) { Write-Plano @{ ok = $false; erro = "Turma '$Turma' não encontrada." }; return }
  Write-Host "  Turma '$Turma' não encontrada. Rode sem -Turma para ver a lista." -ForegroundColor Red
  return
}

# ── 2. Data / período ────────────────────────────────────────────────────────
if (-not $Data) { $Data = (Get-Date).ToString('yyyy-MM-dd') }
# `data_iso` é coluna date: like não vale, tem que ser intervalo.
if ($Data -match '^\d{4}-\d{2}$') {
  $ini = [datetime]"$Data-01"
  $fim = $ini.AddMonths(1).AddDays(-1)
  $filtroData = "data_iso=gte.$($ini.ToString('yyyy-MM-dd'))&data_iso=lte.$($fim.ToString('yyyy-MM-dd'))"
  $rotuloData = "mês $Data"
} elseif ($Data -match '^\d{4}-\d{2}-\d{2}$') {
  $filtroData = "data_iso=eq.$Data"
  $rotuloData = ([datetime]$Data).ToString('dd/MM/yyyy')
} else {
  if ($Json) { Write-Plano @{ ok = $false; erro = '-Data inválida: use AAAA-MM-DD ou AAAA-MM.' }; return }
  Write-Host "  -Data inválida: use AAAA-MM-DD (um dia) ou AAAA-MM (mês inteiro)." -ForegroundColor Red
  return
}

# ── 3. Lançamentos do HUD ────────────────────────────────────────────────────
$hud = Sb-Get "pipeline_entries?select=*&$filtroData&order=consultant.asc,created_at.asc"

if (-not $Todos) {
  $permitidos = @()
  foreach ($c in ($Consultores -split ',')) { $permitidos += (Norm $c) }
  $hud = @($hud | Where-Object { $permitidos -contains (Norm $_.consultant) })
}

if ($hud.Count -eq 0) {
  if ($Json) {
    Write-Plano @{ ok = $true; modo = 'previa'; vazio = $true
      turma = @{ id = $alvo.id; nome = $alvo.nome; cidade = $alvo.cidade }
      rotulo = $rotuloData; itens = @(); plano = @(); semData = @()
      resumo = @{ novas = 0; jaTem = 0; ignora = 0; total = 0.0 }
      aviso = "Nenhum lançamento no HUD em $rotuloData para: $Consultores" }
    return
  }
  Write-Host ''
  Write-Host "  Nenhum lançamento no HUD em $rotuloData para: $Consultores" -ForegroundColor Yellow
  Write-Host ''
  return
}

# ── 4. O que já existe na turma ──────────────────────────────────────────────
$jaTem = Sb-Get "vendas?select=nome_aluno,curso,valor&turma_id=eq.$($alvo.id)"
$chaves = @{}
$chavesBanco = @{}     # so o que JA esta no banco — usado para reconferir na hora de gravar
foreach ($v in $jaTem) {
  $k = '{0}|{1}|{2:F2}' -f (Norm $v.nome_aluno), (Norm $v.curso), (Valor $v.valor)
  $chaves[$k] = $true; $chavesBanco[$k] = $true
}

# ── 5. Monta a prévia ────────────────────────────────────────────────────────
$linhas = @()
$novas  = @()
foreach ($e in $hud) {
  $stKey  = Norm $e.status
  $stSis  = $STATUS[$stKey]
  $curso  = Curso-Sistema $e.curso
  $val    = Valor $e.valor
  $qtd    = [int]$e.und; if ($qtd -lt 1) { $qtd = 1 }
  $liq    = Liquidez $curso $val
  $chave  = '{0}|{1}|{2:F2}' -f (Norm $e.aluno), (Norm $curso), $val

  $acao = 'NOVA'
  $nota = ''
  if (-not $stSis)                          { $acao = 'IGNORA'; $nota = "status '$($e.status)' sem de-para" }
  elseif ($chaves.ContainsKey($chave))      { $acao = 'JÁ TEM'; $nota = 'igual na turma' }
  elseif ((Norm $curso) -eq (Norm $e.curso) -and -not $DE_PARA.ContainsKey((Norm $e.curso))) {
    $nota = '⚠ curso sem de-para'
  }

  $linhas += [pscustomobject]@{
    Consultor = $e.consultant
    Aluno     = $e.aluno
    'Curso HUD' = $e.curso
    'Curso sistema' = $curso
    Qtd       = $qtd
    Valor     = '{0:N2}' -f $val
    Liquidez  = '{0:N2}' -f $liq
    Status    = $(if ($stSis) { $stSis } else { $e.status })
    Ação      = $acao
    Obs       = $nota
  }

  if ($acao -eq 'NOVA') {
    $chaves[$chave] = $true   # protege contra duplicata dentro do próprio lote
    $novas += @{
      turma_id   = $alvo.id
      consultor  = $e.consultant
      nome_aluno = $e.aluno
      cpf        = ''
      curso      = $curso
      quantidade = $qtd
      entrada    = 0
      valor      = $val
      liquidez   = $liq
      parcelas   = $null
      status     = $stSis
      link_sf    = ''
      obs        = "Importado do FRZ Pipeline HUD - $rotuloData"
    }
  }
}

$semData = @(Sb-Get "pipeline_entries?select=consultant,aluno,curso,valor&data_iso=is.null&month=eq.$($Data.Substring(0,7))")
if (-not $Todos -and $semData.Count) {
  $permitidos = @(); foreach ($c in ($Consultores -split ',')) { $permitidos += (Norm $c) }
  $semData = @($semData | Where-Object { $permitidos -contains (Norm $_.consultant) })
}

Write-Host ''
Write-Host ("  DE: pipeline (HUD) $rotuloData   →   PARA: turma $($alvo.nome) [id $($alvo.id)] · $($alvo.cidade)") -ForegroundColor Cyan
Write-Host ''
Write-Host ($linhas | Format-Table -AutoSize | Out-String -Width 250)

$qNovas = @($linhas | Where-Object { $_.Ação -eq 'NOVA' }).Count
$qTem   = @($linhas | Where-Object { $_.Ação -eq 'JÁ TEM' }).Count
$qIgn   = @($linhas | Where-Object { $_.Ação -eq 'IGNORA' }).Count
$somaN  = ($novas | ForEach-Object { $_.valor } | Measure-Object -Sum).Sum
if (-not $somaN) { $somaN = 0 }

Write-Host ("  {0} nova(s) · {1} já na turma · {2} ignorada(s) · total a lançar R$ {3:N2}" -f $qNovas, $qTem, $qIgn, $somaN) -ForegroundColor White
if ($semData.Count) {
  Write-Host ("  ⚠ {0} lançamento(s) do mês estão SEM data no HUD e ficaram de fora:" -f $semData.Count) -ForegroundColor Yellow
  foreach ($s in $semData) { Write-Host ("      {0} · {1} · {2}" -f $s.consultant, $s.aluno, $s.curso) -ForegroundColor DarkYellow }
}

# ── 6. Grava ─────────────────────────────────────────────────────────────────
if ($Json -and -not $Aplicar) {
  Write-Plano @{
    ok = $true; modo = 'previa'
    turma  = @{ id = $alvo.id; nome = $alvo.nome; cidade = $alvo.cidade; meta = (Valor $alvo.meta_receita) }
    rotulo = $rotuloData; data = $Data; consultores = $(if ($Todos) { 'todos' } else { $Consultores })
    itens  = @($linhas | ForEach-Object {
      @{ consultor = $_.Consultor; aluno = $_.Aluno; cursoHud = $_.'Curso HUD'; curso = $_.'Curso sistema'
         qtd = $_.Qtd; valor = $_.Valor; liquidez = $_.Liquidez; status = $_.Status
         acao = $_.'Ação'; obs = $_.Obs } })
    plano  = @($novas)                       # exatamente o que sera gravado no Confirmar
    semData = @($semData | ForEach-Object { @{ consultor = $_.consultant; aluno = $_.aluno; curso = $_.curso } })
    resumo = @{ novas = $qNovas; jaTem = $qTem; ignora = $qIgn; total = [double]$somaN }
  }
  return
}
if (-not $Aplicar) {
  Write-Host ''
  Write-Host '  PRÉVIA — nada foi gravado. Para lançar de verdade, repita com -Aplicar:' -ForegroundColor Yellow
  Write-Host ("      .\Turma-Lancar-FRZ.ps1 -Turma $($alvo.id) -Data $Data -Aplicar") -ForegroundColor Gray
  Write-Host ''
  return
}

# Aplicar A PARTIR DO PLANO que o usuario viu na tela (em vez de recalcular): garante que
# o Confirmar grava exatamente aquilo. Mesmo assim reconferimos contra o banco logo abaixo.
if ($PlanoFile) {
  if (-not (Test-Path $PlanoFile)) {
    if ($Json) { Write-Plano @{ ok = $false; erro = 'Plano não encontrado.' }; return }
    Write-Host '  Plano não encontrado.' -ForegroundColor Red; return
  }
  $doPlano = @(Get-Content $PlanoFile -Raw -Encoding UTF8 | ConvertFrom-Json)
  $novas = @(); $jaForam = @()
  foreach ($p in $doPlano) {
    if ([int]$p.turma_id -ne [int]$alvo.id) { continue }        # plano de outra turma: ignora
    $k = '{0}|{1}|{2:F2}' -f (Norm $p.nome_aluno), (Norm $p.curso), (Valor $p.valor)
    if ($chavesBanco.ContainsKey($k)) { $jaForam += $p.nome_aluno + ' · ' + $p.curso; continue }
    $chavesBanco[$k] = $true                                     # nao repete dentro do lote
    $novas += @{
      turma_id = $alvo.id; consultor = $p.consultor; nome_aluno = $p.nome_aluno; cpf = ''
      curso = $p.curso; quantidade = [int]$p.quantidade; entrada = 0
      valor = (Valor $p.valor); liquidez = (Valor $p.liquidez); parcelas = $null
      status = $p.status; link_sf = ''; obs = $p.obs
    }
  }
  $qNovas = $novas.Count
}

if ($qNovas -eq 0) {
  if ($Json) {
    Write-Plano @{ ok = $true; modo = 'aplicado'; gravadas = 0
      turma = @{ id = $alvo.id; nome = $alvo.nome }
      jaForam = @($jaForam)
      aviso = 'Nada novo para lançar — a turma já está em dia.' }
    return
  }
  Write-Host ''
  Write-Host '  Nada novo para lançar — a turma já está em dia com o HUD.' -ForegroundColor Green
  Write-Host ''
  return
}

$corpo = $novas | ConvertTo-Json -Depth 3
if ($novas.Count -eq 1) { $corpo = "[$corpo]" }   # PS 5.1 serializa 1 item como objeto
$bytes = [Text.Encoding]::UTF8.GetBytes($corpo)
$hPost = $HDR.Clone(); $hPost['Prefer'] = 'return=representation'
try {
  $resp = @(Invoke-RestMethod -Uri "$SB_BASE/vendas" -Method Post -Headers $hPost -Body $bytes -ContentType 'application/json')
} catch {
  if ($Json) { Write-Plano @{ ok = $false; erro = 'Falha ao gravar: ' + $_.Exception.Message }; return }
  throw
}

Write-Host ''
Write-Host ("  ✔ {0} venda(s) gravada(s) na turma {1}" -f $resp.Count, $alvo.nome) -ForegroundColor Green
Write-Host ($resp | Format-Table id, nome_aluno, curso, quantidade, valor, liquidez, status -AutoSize | Out-String -Width 250)

$todas = Sb-Get "vendas?select=valor,liquidez,status&turma_id=eq.$($alvo.id)"
$liqTot = ($todas | ForEach-Object { Valor $_.liquidez } | Measure-Object -Sum).Sum
$liqRea = ($todas | Where-Object { $_.status -ne 'NEGOCIAÇÃO' } | ForEach-Object { Valor $_.liquidez } | Measure-Object -Sum).Sum
if (-not $liqTot) { $liqTot = 0 }; if (-not $liqRea) { $liqRea = 0 }
$meta = Valor $alvo.meta_receita
$pct  = if ($meta -gt 0) { [math]::Round(($liqTot / $meta) * 100) } else { 0 }

Write-Host ("  Turma agora: {0} venda(s) · liquidez R$ {1:N2} de R$ {2:N2} ({3}%) · realizado R$ {4:N2}" -f `
  $todas.Count, $liqTot, $meta, $pct, $liqRea) -ForegroundColor Cyan
Write-Host ''

if ($Json) {
  Write-Plano @{
    ok = $true; modo = 'aplicado'; gravadas = $resp.Count
    turma = @{ id = $alvo.id; nome = $alvo.nome }
    itens = @($resp | ForEach-Object {
      @{ id = $_.id; aluno = $_.nome_aluno; curso = $_.curso; qtd = $_.quantidade
         valor = (Valor $_.valor); liquidez = (Valor $_.liquidez); status = $_.status } })
    jaForam = @($jaForam)          # estavam no plano mas ja constavam no banco: puladas
    turmaResumo = @{ vendas = $todas.Count; liquidez = [double]$liqTot; meta = [double]$meta
                     pct = $pct; realizado = [double]$liqRea }
  }
}
