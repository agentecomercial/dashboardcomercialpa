<#
  Acoes-Leads-Vitoria.ps1
  Executa as ACOES de leads (escrita no Sales Cube) com 2 modos: preview (read-only) e apply (grava).
  Atende a aba Comandos do Meta Master via /api/acao do Servir.ps1.

  Acoes:
    equilibrio          - redistribui leads IGUALMENTE entre os consultores participantes
                          (move so o excedente; quem esta acima da media cede p/ quem esta abaixo)
    equilibrioCampanha  - igual ao equilibrio, mas so dos leads de UMA campanha (mcis|tce|outros)
    transferencia       - move N leads de 1+ consultores ORIGEM p/ 1+ DESTINOS (etapa origem -> destino)

  Modos:
    preview  -> calcula o plano e devolve JSON { antes, depois, operacoes, ... } SEM gravar
    apply    -> le um arquivo JSON (-PlanoFile) com as operacoes confirmadas e GRAVA:
                assign_opportunity (troca responsavel) + move_opportunity_stage (se mudar etapa)

  IMPORTANTE: salvar este arquivo com BOM UTF-8 (PowerShell 5.1 corrompe os acentos dos nomes sem BOM).
#>
param(
  [ValidateSet('equilibrio','equilibrioCampanha','transferencia')]
  [string]$Acao = 'equilibrio',
  [ValidateSet('preview','apply')]
  [string]$Modo = 'preview',
  # --- janela de datas (created_at). Vazio: equilibrio = pipeline inteiro; transferencia = mes vigente ---
  [string]$De = '',
  [string]$Ate = '',
  # --- equilibrio ---
  [string]$Base = 'ativos',          # 'ativos' (etapas 1-4) ou '1'..'6' (uma etapa)
  [string]$Participantes = '',       # csv de consultores que entram no rateio (vazio = todos)
  [string]$Campanha = '',            # mcis|tce|outros (so para equilibrioCampanha)
  [string]$Ordem = 'antigos',        # antigos|recentes -> quais leads o cedente entrega primeiro
  # --- transferencia ---
  [string]$Origem = '',
  [string]$Destino = '',             # csv (1+)
  [string]$EtapaOrigem = '',
  [string]$EtapaDestino = '',
  [int]$Quantidade = 0,
  # --- apply ---
  [string]$PlanoFile = ''
)

# ===================== CONFIG =====================
# 1 consultor por linha. val = identificador curto usado pelo front; nome = exato no Sales Cube; id = user_id (assignee).
$Equipe = @(
  [pscustomobject]@{ val='Gabriela';  nome='Gabriela Souza de Jesus';          id=76 }
  [pscustomobject]@{ val='Natalia';   nome='Natalia de Oliveira Silva Cunha';  id=77 }
  [pscustomobject]@{ val='Karla';     nome='Karla Ferreira de Oliveira';       id=16314 }
)
$Etapas = @(
  [pscustomobject]@{ num='1'; id=5000492; nome='Novo Lead' }
  [pscustomobject]@{ num='2'; id=5000502; nome='Farmer' }
  [pscustomobject]@{ num='3'; id=5000582; nome='Conversa Ativa' }
  [pscustomobject]@{ num='4'; id=5000522; nome='Negociação' }
  [pscustomobject]@{ num='5'; id=5000532; nome='Venda Feita' }
  [pscustomobject]@{ num='6'; id=5000542; nome='Nutrição' }
)
$NomeMCIS = 'Meta Ads MCIS 250 - Vitoria'
$NomeTCE  = 'Meta Ads TCE Cresc. Empresarial - Teresina'

$Token = 'mcp_a7f09259f81429f0f204dd1cb5ea5eb04b382a7dca881fe6fd5613c7'
$Url   = 'https://mcp.zsales.com.br/mcp'
# =================================================

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

# ---- helpers de normalizacao ----
function SemAcento($s){
  $n = ([string]$s).Normalize([Text.NormalizationForm]::FormD)
  $sb = New-Object Text.StringBuilder
  foreach($c in $n.ToCharArray()){ if([Globalization.CharUnicodeInfo]::GetUnicodeCategory($c) -ne 'NonSpacingMark'){ [void]$sb.Append($c) } }
  $sb.ToString().ToLower().Trim()
}
function Short($n){ $p = ([string]$n).Trim() -split '\s+'; if ($p.Count -ge 2) { "$($p[0]) $($p[-1])" } else { [string]$n } }
# Resolve um texto (val, nome curto ou completo) para um membro da equipe.
function ResolveMembro($txt){
  $t = SemAcento $txt; if(-not $t){ return $null }
  foreach($m in $Equipe){
    if((SemAcento $m.val) -eq $t -or (SemAcento $m.nome) -eq $t -or (SemAcento (Short $m.nome)) -eq $t){ return $m }
  }
  foreach($m in $Equipe){ if((SemAcento $m.nome).Contains($t) -or (SemAcento $m.val).Contains($t)){ return $m } }
  return $null
}
function ParseLista($csv){
  $out = @()
  foreach($x in ([string]$csv -split ',')){ $m = ResolveMembro $x.Trim(); if($m){ $out += $m } }
  $out
}
function Cidx($c){ if ($c -match 'MCIS') { 'mcis' } elseif ($c -match 'TCE') { 'tce' } else { 'outros' } }
function NomeLead($r){ $c = [string]$r.customer__name; if ($c) { $c } elseif ($r.name) { [string]$r.name } else { '(sem nome)' } }

# ===================== APPLY =====================
# (grava no CRM as operacoes confirmadas; nada de leitura/preview)
if ($Modo -eq 'apply') {
  $idsValidos    = @{}; foreach($m in $Equipe){ $idsValidos[[string]$m.id] = $true }
  $stagesValidos = @{}; foreach($e in $Etapas){ $stagesValidos[[string]$e.id] = $true }
  try {
    if (-not (Test-Path $PlanoFile)) { throw "Plano nao encontrado." }
    $raw   = [System.IO.File]::ReadAllText($PlanoFile, [System.Text.Encoding]::UTF8)
    $plano = $raw | ConvertFrom-Json
    $ops   = @($plano.operacoes)
    if ($ops.Count -eq 0) { Write-Output (@{ total=0; ok=0; falhas=@() } | ConvertTo-Json -Compress); exit 0 }

    $baseHeaders = @{ Authorization = "Bearer $Token"; Accept = 'application/json, text/event-stream' }
    function Get-DataLine($content){ ($content -split "`n" | Where-Object { $_ -like 'data: *' } | Select-Object -First 1).Substring(6) }
    $initBody = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"ps","version":"1"}}}'
    $ri  = Invoke-WebRequest -Uri $Url -Method Post -Headers $baseHeaders -ContentType 'application/json' -Body $initBody -UseBasicParsing
    $sid = $ri.Headers['Mcp-Session-Id']; if ($sid -is [array]) { $sid = $sid[0] }
    $h = $baseHeaders.Clone(); $h['Mcp-Session-Id'] = $sid
    Invoke-WebRequest -Uri $Url -Method Post -Headers $h -ContentType 'application/json' -Body '{"jsonrpc":"2.0","method":"notifications/initialized"}' -UseBasicParsing | Out-Null

    function Call-Tool($name, $arguments){
      $callObj  = [ordered]@{ jsonrpc='2.0'; id=9; method='tools/call'; params=[ordered]@{ name=$name; arguments=$arguments } }
      $callJson = $callObj | ConvertTo-Json -Depth 10 -Compress
      $rc = Invoke-WebRequest -Uri $Url -Method Post -Headers $h -ContentType 'application/json' -Body ([System.Text.Encoding]::UTF8.GetBytes($callJson)) -UseBasicParsing
      $resp = [System.Text.Encoding]::UTF8.GetString($rc.RawContentStream.ToArray())
      $obj  = Get-DataLine $resp | ConvertFrom-Json
      if ($obj.error) { throw ([string]$obj.error.message) }
      if ($obj.result.isError) { throw ([string]$obj.result.content[0].text) }
      return $obj.result
    }

    $okN = 0; $falhas = @()
    foreach ($op in $ops) {
      $oid = [int]$op.opportunity_id
      $destId = [string]$op.paraId
      try {
        if (-not $idsValidos[$destId]) { throw "Destino $destId fora da whitelist" }
        Call-Tool 'assign_opportunity' ([ordered]@{ opportunity_id=$oid; assignee_user_id=[int]$destId }) | Out-Null
        if ($op.novoStageId) {
          $sid2 = [string]$op.novoStageId
          if (-not $stagesValidos[$sid2]) { throw "Etapa $sid2 fora da whitelist" }
          Call-Tool 'move_opportunity_stage' ([ordered]@{ opportunity_id=$oid; funnel_stage_id=[int]$sid2 }) | Out-Null
        }
        $okN++
      } catch {
        $falhas += [ordered]@{ opportunity_id=$oid; cliente=([string]$op.cliente); erro=([string]$_.Exception.Message) }
      }
    }
    Write-Output ([ordered]@{ total=$ops.Count; ok=$okN; falhas=@($falhas) } | ConvertTo-Json -Depth 6 -Compress)
    exit 0
  } catch {
    Write-Output (@{ erro = ([string]$_.Exception.Message) } | ConvertTo-Json -Compress)
    exit 1
  }
}

# ===================== PREVIEW =====================
try {
  # ---- janela de datas ----
  $hoje = Get-Date
  $primMes = Get-Date -Year $hoje.Year -Month $hoje.Month -Day 1
  if ($De)  { $janIni = [datetime]::ParseExact($De,'yyyy-MM-dd',$null) }
  elseif ($Acao -eq 'transferencia') { $janIni = $primMes }
  else { $janIni = [datetime]'2000-01-01' }
  if ($Ate) { $janFim = ([datetime]::ParseExact($Ate,'yyyy-MM-dd',$null)).AddDays(1) }
  elseif ($Acao -eq 'transferencia') { $janFim = $primMes.AddMonths(1) }
  else { $janFim = [datetime]'2999-01-01' }
  $semFiltroData = (-not $De -and -not $Ate -and $Acao -ne 'transferencia')
  $periodoLabel = if ($semFiltroData) { 'pipeline atual (todas as datas)' } else { "$($janIni.ToString('dd/MM/yyyy')) a $($janFim.AddDays(-1).ToString('dd/MM/yyyy'))" }

  # ---- etapas-base ----
  if ($Acao -eq 'transferencia') {
    $eOrig = $Etapas | Where-Object { $_.num -eq $EtapaOrigem }  | Select-Object -First 1
    $eDest = $Etapas | Where-Object { $_.num -eq $EtapaDestino } | Select-Object -First 1
    if (-not $eOrig) { throw "Etapa de origem invalida." }
    if (-not $eDest) { throw "Etapa de destino invalida." }
    $stageIds = @($eOrig.id)
  } else {
    if ($Base -eq 'ativos') { $stageIds = @(($Etapas | Where-Object { $_.num -in '1','2','3','4' }).id) }
    else {
      $eb = $Etapas | Where-Object { $_.num -eq $Base } | Select-Object -First 1
      if (-not $eb) { throw "Base de etapa invalida." }
      $stageIds = @($eb.id)
    }
  }

  # ---- consultores em cena ----
  if ($Acao -eq 'transferencia') {
    $origs = @(ParseLista $Origem); if ($origs.Count -eq 0) { throw "Escolha ao menos 1 consultor de origem." }
    $dest  = @(ParseLista $Destino); if ($dest.Count -eq 0) { throw "Escolha ao menos 1 consultor de destino." }
    # destino nunca pode ser uma das origens (evita atribuir o lead a quem ja era o dono)
    $origVals = @($origs | ForEach-Object { $_.val })
    $dest = @($dest | Where-Object { $origVals -notcontains $_.val })
    if ($dest.Count -eq 0) { throw "Os destinos coincidem com as origens. Escolha destinos diferentes." }
    $foco  = @($origs)
  } else {
    $foco = @(ParseLista $Participantes)
    if ($foco.Count -eq 0) { $foco = @($Equipe) }
    if ($foco.Count -lt 2) { throw "Escolha ao menos 2 consultores para equilibrar." }
  }
  $nomesFoco = @($foco | ForEach-Object { $_.nome })

  # ---- MCP: init + leitura paginada ----
  $baseHeaders = @{ Authorization = "Bearer $Token"; Accept = 'application/json, text/event-stream' }
  function Get-DataLine($content){ ($content -split "`n" | Where-Object { $_ -like 'data: *' } | Select-Object -First 1).Substring(6) }
  $initBody = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"ps","version":"1"}}}'
  $ri  = Invoke-WebRequest -Uri $Url -Method Post -Headers $baseHeaders -ContentType 'application/json' -Body $initBody -UseBasicParsing
  $sid = $ri.Headers['Mcp-Session-Id']; if ($sid -is [array]) { $sid = $sid[0] }
  $h = $baseHeaders.Clone(); $h['Mcp-Session-Id'] = $sid
  Invoke-WebRequest -Uri $Url -Method Post -Headers $h -ContentType 'application/json' -Body '{"jsonrpc":"2.0","method":"notifications/initialized"}' -UseBasicParsing | Out-Null

  function Get-Leads {
    $acc = [ordered]@{}
    $cursor = $janIni.ToString('yyyy-MM-dd')
    for ($p = 0; $p -lt 80; $p++) {
      $cfg = [ordered]@{ report_type_slug='opportunities'; config=[ordered]@{
        columns = @(
          @{ path='id' }, @{ path='assignee_user__name' }, @{ path='funnel_stage_id' },
          @{ path='created_at' }, @{ path='customer__name' }, @{ path='name' }, @{ path='campaign__name' }
        )
        filters = @(
          @{ id='funnel_stage_id';     operator='in';     value=$stageIds },
          @{ id='created_at';          operator='gte';    value=$cursor },
          @{ id='created_at';          operator='before'; value=$janFim.ToString('yyyy-MM-dd') },
          @{ id='assignee_user__name'; operator='in';     value=$nomesFoco }
        )
        sort = @(@{ path='created_at'; order='asc' }); limit = 2000 } }
      $callJson = ([ordered]@{ jsonrpc='2.0'; id=2; method='tools/call'; params=[ordered]@{ name='run_report_preview'; arguments=$cfg } } | ConvertTo-Json -Depth 12 -Compress)
      $rc = Invoke-WebRequest -Uri $Url -Method Post -Headers $h -ContentType 'application/json' -Body ([System.Text.Encoding]::UTF8.GetBytes($callJson)) -UseBasicParsing
      $resp = [System.Text.Encoding]::UTF8.GetString($rc.RawContentStream.ToArray())
      $rows = @((Get-DataLine $resp | ConvertFrom-Json).result.content[0].text | ConvertFrom-Json | Select-Object -ExpandProperty rows)
      if ($rows.Count -eq 0) { break }
      $nv = 0; foreach ($r in $rows) { $k=[string]$r.id; if (-not $acc.Contains($k)) { $acc[$k]=$r; $nv++ } }
      if ($rows.Count -lt 200) { break }
      $px = [string]$rows[$rows.Count-1].created_at; if ($px -eq $cursor -or $nv -eq 0) { break }; $cursor = $px
    }
    @($acc.Values)
  }

  $todos = Get-Leads
  # filtro de campanha (equilibrioCampanha) - aceita 1+ campanhas SOMADAS (ex: 'mcis,tce')
  $campLista = @(); $campanhaLabel = ''
  if ($Acao -eq 'equilibrioCampanha') {
    $mapaCampLabel = @{ mcis='MCIS'; tce='TCE'; outros='Outros' }
    $campLista = @($Campanha -split ',' | ForEach-Object { $_.Trim().ToLower() } | Where-Object { $_ })
    foreach ($cc in $campLista) { if ($cc -notin 'mcis','tce','outros') { throw "Campanha invalida: $cc (use mcis|tce|outros)." } }
    if ($campLista.Count -eq 0) { throw "Escolha ao menos 1 campanha." }
    $campanhaLabel = (($campLista | ForEach-Object { $mapaCampLabel[$_] }) -join ' + ')
    $todos = @($todos | Where-Object { (Cidx $_.campaign__name) -in $campLista })
  }

  # leads por membro (mapeado pelo nome completo) + ordenacao por created_at
  $porMembro = @{}
  foreach ($m in $foco) { $porMembro[$m.val] = @() }
  foreach ($r in $todos) {
    $m = $foco | Where-Object { $_.nome -eq [string]$r.assignee_user__name } | Select-Object -First 1
    if ($m) { $porMembro[$m.val] += $r }
  }
  $stageNome = @{}; foreach($e in $Etapas){ $stageNome[[string]$e.id] = $e.nome }

  $operacoes = @()

  if ($Acao -eq 'transferencia') {
    # junta os leads de TODAS as origens num pool unico (guardando de quem veio cada lead)
    $pool = @()
    foreach ($mo in $origs) {
      foreach ($r in @($porMembro[$mo.val])) { $pool += [pscustomobject]@{ lead=$r; de=$mo } }
    }
    $pool = if ($Ordem -eq 'recentes') { @($pool | Sort-Object { [string]$_.lead.created_at } -Descending) }
            else { @($pool | Sort-Object { [string]$_.lead.created_at }) }
    $qtd = if ($Quantidade -gt 0) { [Math]::Min($Quantidade, $pool.Count) } else { $pool.Count }
    $sel = @($pool | Select-Object -First $qtd)
    $novoStage = if ($eDest.id -ne $eOrig.id) { $eDest } else { $null }
    for ($i=0; $i -lt $sel.Count; $i++) {
      $it = $sel[$i]
      $d  = $dest[$i % $dest.Count]   # round-robin entre os destinos
      $op = [ordered]@{
        opportunity_id = [int]$it.lead.id
        cliente        = (NomeLead $it.lead)
        etapaNome      = $eOrig.nome
        deNome         = (Short $it.de.nome)
        paraNome       = (Short $d.nome)
        paraId         = $d.id
      }
      if ($novoStage) { $op.novoStageId = $novoStage.id; $op.novoStageNome = $novoStage.nome }
      $operacoes += $op
    }
  } else {
    # ---- equilibrio: alvo por membro (move so o excedente) ----
    $vals = @($foco | ForEach-Object { $_.val } | Sort-Object)   # ordem alfabetica define quem leva a sobra
    $cont = @{}; foreach ($v in $vals) { $cont[$v] = @($porMembro[$v]).Count }
    $total = 0; foreach ($v in $vals) { $total += $cont[$v] }
    $n = $vals.Count
    $baseAlvo = [Math]::Floor($total / $n); $resto = $total - ($baseAlvo * $n)
    $alvo = @{}; for ($i=0; $i -lt $n; $i++) { $alvo[$vals[$i]] = $baseAlvo + ($(if ($i -lt $resto) {1} else {0})) }

    # pool de cessao: de quem esta acima do alvo, na ordem escolhida
    $pool = @()
    foreach ($v in $vals) {
      $exced = $cont[$v] - $alvo[$v]
      if ($exced -le 0) { continue }
      $lst = @($porMembro[$v])
      $lst = if ($Ordem -eq 'recentes') { @($lst | Sort-Object created_at -Descending) } else { @($lst | Sort-Object created_at) }
      foreach ($r in @($lst | Select-Object -First $exced)) { $pool += @{ lead=$r; de=$v } }
    }
    # entrega aos que estao abaixo do alvo
    $k = 0
    foreach ($v in $vals) {
      $faltam = $alvo[$v] - $cont[$v]
      for ($j=0; $j -lt $faltam -and $k -lt $pool.Count; $j++) {
        $item = $pool[$k]; $k++
        $mDe   = $Equipe | Where-Object { $_.val -eq $item.de } | Select-Object -First 1
        $mPara = $Equipe | Where-Object { $_.val -eq $v }       | Select-Object -First 1
        $operacoes += [ordered]@{
          opportunity_id = [int]$item.lead.id
          cliente        = (NomeLead $item.lead)
          etapaNome      = [string]$stageNome[[string]$item.lead.funnel_stage_id]
          deNome         = (Short $mDe.nome)
          paraNome       = (Short $mPara.nome)
          paraId         = $mPara.id
        }
      }
    }
  }

  # ---- antes / depois (contagem por consultor) ----
  $depoisDelta = @{}
  foreach ($op in $operacoes) {
    $depoisDelta[$op.deNome]   = ($(if ($depoisDelta.ContainsKey($op.deNome))   { $depoisDelta[$op.deNome] }   else { 0 })) - 1
    $depoisDelta[$op.paraNome] = ($(if ($depoisDelta.ContainsKey($op.paraNome)) { $depoisDelta[$op.paraNome] } else { 0 })) + 1
  }
  $nomesTab = @()
  foreach ($m in $foco) { $nomesTab += (Short $m.nome) }
  if ($Acao -eq 'transferencia') { foreach ($d in $dest) { $sd = Short $d.nome; if ($nomesTab -notcontains $sd) { $nomesTab += $sd } } }
  $antes = @(); $depois = @()
  foreach ($nm in $nomesTab) {
    # contagem "antes" pelo membro resolvido
    $mm = ResolveMembro $nm
    $a = if ($mm -and $porMembro.ContainsKey($mm.val)) { @($porMembro[$mm.val]).Count } else { 0 }
    $delta = if ($depoisDelta.ContainsKey($nm)) { $depoisDelta[$nm] } else { 0 }
    $antes  += [ordered]@{ nome=$nm; qtd=$a }
    $depois += [ordered]@{ nome=$nm; qtd=($a + $delta) }
  }

  # ---- titulo legivel ----
  $baseLabel = if ($Acao -eq 'transferencia') { "etapa $($eOrig.num) ($($eOrig.nome))" }
               elseif ($Base -eq 'ativos') { 'leads ativos (etapas 1-4)' }
               else { $eb2 = $Etapas | Where-Object { $_.num -eq $Base } | Select-Object -First 1; "etapa $($eb2.num) ($($eb2.nome))" }
  $titulo = switch ($Acao) {
    'equilibrio'         { "Equilibrio de Leads - $baseLabel" }
    'equilibrioCampanha' { "Equilibrio de Leads (campanha $campanhaLabel) - $baseLabel" }
    'transferencia'      { "Transferencia de Leads - " + (($origs | ForEach-Object { Short $_.nome }) -join ' + ') }
  }

  $out = [ordered]@{
    acao         = $Acao
    titulo       = $titulo
    periodoLabel = $periodoLabel
    baseLabel    = $baseLabel
    campanhaLabel = $campanhaLabel
    ordemLabel   = $(if ($Ordem -eq 'recentes') { 'mais recentes primeiro' } else { 'mais antigos primeiro' })
    totalLeads   = @($todos).Count
    qtdMovimenta = $operacoes.Count
    antes        = @($antes)
    depois       = @($depois)
    operacoes    = @($operacoes)
    geradoEm     = (Get-Date -Format 'dd/MM/yyyy HH:mm:ss')
  }
  Write-Output ($out | ConvertTo-Json -Depth 8 -Compress)
  exit 0
} catch {
  Write-Output (@{ erro = ([string]$_.Exception.Message); linha = ([string]$_.InvocationInfo.ScriptLineNumber); pos = ([string]$_.InvocationInfo.Line).Trim() } | ConvertTo-Json -Compress)
  exit 1
}
