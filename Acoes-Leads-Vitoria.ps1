<#
  Acoes-Leads-Vitoria.ps1
  Executa as ACOES de leads (escrita no Sales Cube) com 2 modos: preview (read-only) e apply (grava).
  Atende a aba Comandos do Meta Master via /api/acao do Servir.ps1.

  Acoes:
    equilibrio          - redistribui leads IGUALMENTE entre os consultores participantes
                          (move so o excedente; quem esta acima da media cede p/ quem esta abaixo)
    equilibrioCampanha  - igual ao equilibrio, mas so dos leads de UMA campanha (camp|outros)
    transferencia       - move N leads de 1+ consultores ORIGEM p/ 1+ DESTINOS (etapa origem -> destino)
    transferenciaCampanha - igual a transferencia, mas so dos leads de UMA campanha (camp|outros)

  Modos:
    preview  -> calcula o plano e devolve JSON { antes, depois, operacoes, ... } SEM gravar
    apply    -> le um arquivo JSON (-PlanoFile) com as operacoes confirmadas e GRAVA:
                assign_opportunity (troca responsavel) + move_opportunity_stage (se mudar etapa)

  IMPORTANTE: salvar este arquivo com BOM UTF-8 (PowerShell 5.1 corrompe os acentos dos nomes sem BOM).
#>
param(
  [ValidateSet('equilibrio','equilibrioCampanha','transferencia','transferenciaCampanha','transferenciaIndividual','transferenciaIndividualCampanha')]
  [string]$Acao = 'equilibrio',
  [ValidateSet('preview','apply')]
  [string]$Modo = 'preview',
  # --- janela de datas (created_at). Vazio: equilibrio = pipeline inteiro; transferencia = mes vigente ---
  [string]$De = '',
  [string]$Ate = '',
  # --- equilibrio ---
  [string]$Base = 'ativos',          # 'ativos' (etapas 1-4) ou '1'..'6' (uma etapa)
  [switch]$Cruzamento,               # equilibrio: TODOS os leads trocam de dono (ninguem recebe lead que ja era seu)
  [string]$Participantes = '',       # csv de consultores que entram no rateio (vazio = todos)
  [string]$Zerados = '',             # csv: entrega TODOS os leads e nao recebe nenhum (alvo = 0)
  [string]$Campanha = '',            # camp|outros (so para equilibrioCampanha)
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
  [pscustomobject]@{ val='Pablo';     nome='PABLO MARTINS CORREIA';            id=28 }
  [pscustomobject]@{ val='Heverton';  nome='Heverton Martins Leonardo';        id=79 }
)
$Etapas = @(
  [pscustomobject]@{ num='1'; id=5000492; nome='Novo Lead' }
  [pscustomobject]@{ num='2'; id=5000502; nome='Farmer' }
  [pscustomobject]@{ num='3'; id=5000582; nome='Conversa Ativa' }
  [pscustomobject]@{ num='4'; id=5000522; nome='Negociação' }
  [pscustomobject]@{ num='5'; id=5000532; nome='Venda Feita' }
  [pscustomobject]@{ num='6'; id=5000542; nome='Nutrição' }
)
# ===== CAMPANHA EM DESTAQUE =====
# A tabela tem 2 colunas de campanha: a campanha do momento e "Outros" (todo o resto).
# TROCOU A CAMPANHA? Mude so estas 3 linhas - o resto (colunas, filtros, JSON) se ajusta sozinho.
$CampRegex = 'AA1'                      # o que procurar dentro do campaign__name do lead
$CampCurto = 'AA1'                      # rotulo curto, usado no cabecalho da coluna
$CampNome  = 'Meta Ads AA1 - Vitoria'   # nome completo, so para exibir

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
function TitleBR($s){ $ci=[Globalization.CultureInfo]::GetCultureInfo('pt-BR'); (($s -split ' ') | ForEach-Object { if ($_ -cmatch '^[A-ZÀ-ÝÇ]{2,}$') { $_.Substring(0,1) + $_.Substring(1).ToLower($ci) } else { $_ } }) -join ' ' }
function Short($n){ $p = ([string]$n).Trim() -split '\s+'; $s = if ($p.Count -ge 2) { "$($p[0]) $($p[-1])" } else { [string]$n }; TitleBR $s }
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
function Cidx($c){ if ($c -match $CampRegex) { 'camp' } else { 'outros' } }
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

    # O banco do Sales Cube entra em somente-leitura por alguns minutos (failover para replica).
    # Enquanto isso, TODA chamada volta com 'cannot execute UPDATE in a read-only transaction'
    # -- inclusive as de consulta. Nao e erro nosso e passa sozinho: tenta de novo, espacado.
    function EhSoLeitura($txt){ return ([string]$txt) -match 'read.?only transaction' }
    function Call-Tool($name, $arguments){
      $callObj  = [ordered]@{ jsonrpc='2.0'; id=9; method='tools/call'; params=[ordered]@{ name=$name; arguments=$arguments } }
      $callJson = $callObj | ConvertTo-Json -Depth 10 -Compress
      $espera = 1500
      for ($tent = 1; $tent -le 4; $tent++) {
        $rc = Invoke-WebRequest -Uri $Url -Method Post -Headers $h -ContentType 'application/json' -Body ([System.Text.Encoding]::UTF8.GetBytes($callJson)) -UseBasicParsing
        $resp = [System.Text.Encoding]::UTF8.GetString($rc.RawContentStream.ToArray())
        $obj  = Get-DataLine $resp | ConvertFrom-Json
        if ($obj.error) { throw ([string]$obj.error.message) }
        if ($obj.result.isError) {
          $msg = [string]$obj.result.content[0].text
          if ((EhSoLeitura $msg) -and $tent -lt 4) { Start-Sleep -Milliseconds $espera; $espera = $espera * 2; continue }
          if (EhSoLeitura $msg) { throw "O Sales Cube esta em modo somente-leitura agora e recusou a gravacao. Tente de novo em alguns minutos." }
          throw $msg
        }
        return $obj.result
      }
    }

    # ---- ANOTACAO DE PASSAGEM ----------------------------------------------------------
    # Quem recebe um lead transferido nao tem como saber que ele ja foi trabalhado: as
    # anotacoes anteriores sao de outra pessoa e o lead volta para a etapa 1 como se fosse novo.
    # Esta nota deixa a passagem registrada no proprio CRM, visivel para quem abrir o lead por
    # fora do app, e e a fonte do selo "veio de X" no painel.
    # O MARCADOR e o que o app procura para montar o selo — nao mudar sem ajustar o index.html.
    $HandoffTag = 'MM-PASSAGEM'
    function Nota-Passagem($oid, $de, $para, $etapaNome) {
      if (-not $de) { return $false }
      $quando = (Get-Date -Format 'dd/MM/yyyy HH:mm')
      # lista <ul><li>, o padrao de anotacao da casa
      $html = '<ul><li><b>' + $HandoffTag + '</b> — lead recebido de <b>' + $de + '</b> por <b>' + $para + '</b></li>' +
              '<li>Transferido pelo Meta Master em ' + $quando + $(if ($etapaNome) { ' · reposicionado na etapa ' + $etapaNome } else { '' }) + '</li>' +
              '<li>As anotacoes anteriores a esta data sao do responsavel anterior.</li></ul>'
      try { Call-Tool 'create_opportunity_note' ([ordered]@{ opportunity_id=[int]$oid; content_html=$html }) | Out-Null; return $true }
      catch { return $false }
    }

    $okN = 0; $falhas = @(); $notasOk = 0; $notasFalha = 0
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
        # a nota vem DEPOIS da troca de dono e da etapa: se algo acima falhar, nao registra uma
        # passagem que nao aconteceu. Falhar aqui nao desfaz a transferencia — so e contado.
        if (Nota-Passagem $oid ([string]$op.deNome) ([string]$op.paraNome) ([string]$op.novoStageNome)) { $notasOk++ } else { $notasFalha++ }
      } catch {
        $falhas += [ordered]@{ opportunity_id=$oid; cliente=([string]$op.cliente); erro=([string]$_.Exception.Message) }
      }
    }
    Write-Output ([ordered]@{ total=$ops.Count; ok=$okN; falhas=@($falhas); notasOk=$notasOk; notasFalha=$notasFalha } | ConvertTo-Json -Depth 6 -Compress)
    exit 0
  } catch {
    Write-Output (@{ erro = ([string]$_.Exception.Message) } | ConvertTo-Json -Compress)
    exit 1
  }
}

# ===================== PREVIEW =====================
try {
  # transferenciaCampanha = transferencia (mesma mecanica) + filtro de campanha (como no equilibrioCampanha)
  # transferenciaIndividual = transferencia dentro do MESMO consultor (so muda de etapa; origem = destino)
  $ehIndividual = ($Acao -eq 'transferenciaIndividual' -or $Acao -eq 'transferenciaIndividualCampanha')
  $ehTransfer   = ($Acao -eq 'transferencia' -or $Acao -eq 'transferenciaCampanha' -or $ehIndividual)
  $ehCampanha   = ($Acao -eq 'equilibrioCampanha' -or $Acao -eq 'transferenciaCampanha' -or $Acao -eq 'transferenciaIndividualCampanha')

  # ---- janela de datas ----
  $hoje = Get-Date
  $primMes = Get-Date -Year $hoje.Year -Month $hoje.Month -Day 1
  if ($De)  { $janIni = [datetime]::ParseExact($De,'yyyy-MM-dd',$null) }
  elseif ($ehTransfer) { $janIni = $primMes }
  else { $janIni = [datetime]'2000-01-01' }
  if ($Ate) { $janFim = ([datetime]::ParseExact($Ate,'yyyy-MM-dd',$null)).AddDays(1) }
  elseif ($ehTransfer) { $janFim = $primMes.AddMonths(1) }
  else { $janFim = [datetime]'2999-01-01' }
  $semFiltroData = (-not $De -and -not $Ate -and -not $ehTransfer)
  $periodoLabel = if ($semFiltroData) { 'pipeline atual (todas as datas)' } else { "$($janIni.ToString('dd/MM/yyyy')) a $($janFim.AddDays(-1).ToString('dd/MM/yyyy'))" }

  # ---- etapas-base ----
  # EtapaOrigem/Base aceitam UMA ou VARIAS etapas (csv, ex: '1,3,5'). EtapaDestino = 1 etapa (p/ onde mandar).
  $eqDest = $null   # equilibrio: etapa destino opcional (mover os redistribuidos p/ essa etapa; vazio = manter)
  if ($ehTransfer) {
    $origNums = @($EtapaOrigem -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    $eOrigs = @(); foreach ($on in $origNums) { $e = $Etapas | Where-Object { $_.num -eq $on } | Select-Object -First 1; if ($e) { $eOrigs += $e } }
    if ($eOrigs.Count -eq 0) { throw "Etapa(s) de origem invalida(s)." }
    $eDest = $Etapas | Where-Object { $_.num -eq $EtapaDestino } | Select-Object -First 1
    if (-not $eDest) { throw "Etapa de destino invalida." }
    $stageIds = @($eOrigs | ForEach-Object { $_.id })
  } else {
    if ($Base -eq 'ativos') { $stageIds = @(($Etapas | Where-Object { $_.num -in '1','2','3','4' }).id) }
    else {
      $baseNums = @($Base -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
      $ebs = @(); foreach ($bn in $baseNums) { $e = $Etapas | Where-Object { $_.num -eq $bn } | Select-Object -First 1; if ($e) { $ebs += $e } }
      if ($ebs.Count -eq 0) { throw "Base de etapa invalida." }
      $stageIds = @($ebs | ForEach-Object { $_.id })
    }
    if ($EtapaDestino) { $eqDest = $Etapas | Where-Object { $_.num -eq $EtapaDestino } | Select-Object -First 1; if (-not $eqDest) { throw "Etapa de destino invalida." } }
  }

  # ---- consultores em cena ----
  if ($ehTransfer) {
    $origs = @(ParseLista $Origem); if ($origs.Count -eq 0) { throw "Escolha ao menos 1 consultor de origem." }
    if ($ehIndividual) {
      # individual: mesmo consultor (transfere entre as etapas dele; nada muda de dono)
      $dest = @($origs)
    } else {
      $dest = @(ParseLista $Destino); if ($dest.Count -eq 0) { throw "Escolha ao menos 1 consultor de destino." }
      # destino nunca pode ser uma das origens (evita atribuir o lead a quem ja era o dono)
      $origVals = @($origs | ForEach-Object { $_.val })
      $dest = @($dest | Where-Object { $origVals -notcontains $_.val })
      if ($dest.Count -eq 0) { throw "Os destinos coincidem com as origens. Escolha destinos diferentes." }
    }
    $foco  = @($origs)
  } else {
    $foco = @(ParseLista $Participantes)
    if ($foco.Count -eq 0) { $foco = @($Equipe) }
    if ($foco.Count -lt 2) { throw "Escolha ao menos 2 consultores para equilibrar." }
  }
  # Quem "zera" entrega a carteira inteira e nao recebe nada. Ele continua DENTRO de $foco de
  # proposito: e o filtro $foco que manda os leads serem lidos do CRM, e sao justamente os leads
  # dele que vao para o bolo. O que muda e so o alvo, que vai a zero (ver o bloco do rateio).
  # Valida aqui, ANTES de ler o CRM: a leitura paginada leva segundos e varias chamadas MCP,
  # e nao faz sentido gastar isso para descobrir no fim que nao sobrou ninguem para receber.
  $zerVals = @()
  if (-not $ehTransfer -and $Zerados) {
    $focoVals = @($foco | ForEach-Object { $_.val })
    $zerVals  = @(@(ParseLista $Zerados) | ForEach-Object { $_.val } |
                  Where-Object { $focoVals -contains $_ } | Select-Object -Unique)
    if ($zerVals.Count -ge $foco.Count) {
      throw "Deixe ao menos um consultor sem zerar - alguem precisa receber os leads."
    }
  }
  $nomesFoco = @($foco | ForEach-Object { $_.nome })   # inclui os zerados: os leads deles PRECISAM ser lidos

  # ---- MCP: init + leitura paginada ----
  $baseHeaders = @{ Authorization = "Bearer $Token"; Accept = 'application/json, text/event-stream' }
  function Get-DataLine($content){ ($content -split "`n" | Where-Object { $_ -like 'data: *' } | Select-Object -First 1).Substring(6) }
  $initBody = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"ps","version":"1"}}}'
  $ri  = Invoke-WebRequest -Uri $Url -Method Post -Headers $baseHeaders -ContentType 'application/json' -Body $initBody -UseBasicParsing
  $sid = $ri.Headers['Mcp-Session-Id']; if ($sid -is [array]) { $sid = $sid[0] }
  $h = $baseHeaders.Clone(); $h['Mcp-Session-Id'] = $sid
  Invoke-WebRequest -Uri $Url -Method Post -Headers $h -ContentType 'application/json' -Body '{"jsonrpc":"2.0","method":"notifications/initialized"}' -UseBasicParsing | Out-Null

  # Uma pagina do relatorio, com nova tentativa quando o banco esta em somente-leitura.
  # O run_report_preview grava estatistica antes de devolver as linhas; quando o Sales Cube
  # esta em replica read-only ele responde 'cannot execute UPDATE in a read-only transaction'
  # em texto puro. Sem isso o ConvertFrom-Json quebrava com 'JSON primitivo invalido: Error.'
  function Ler-Relatorio($cfg){
    $callJson = ([ordered]@{ jsonrpc='2.0'; id=2; method='tools/call'; params=[ordered]@{ name='run_report_preview'; arguments=$cfg } } | ConvertTo-Json -Depth 12 -Compress)
    $espera = 1500
    for ($tent = 1; $tent -le 4; $tent++) {
      $rc   = Invoke-WebRequest -Uri $Url -Method Post -Headers $h -ContentType 'application/json' -Body ([System.Text.Encoding]::UTF8.GetBytes($callJson)) -UseBasicParsing
      $resp = [System.Text.Encoding]::UTF8.GetString($rc.RawContentStream.ToArray())
      $txt  = [string]((Get-DataLine $resp | ConvertFrom-Json).result.content[0].text)
      if ($txt -like '{*') { return ($txt | ConvertFrom-Json) }
      if ($txt -match 'read.?only transaction') {
        if ($tent -lt 4) { Start-Sleep -Milliseconds $espera; $espera = $espera * 2; continue }
        throw "O Sales Cube esta em modo somente-leitura agora: o servidor recusou ate a consulta dos leads. Nada foi alterado. Tente de novo em alguns minutos."
      }
      throw ("Sales Cube: " + $txt)
    }
  }

  # Le TODOS os leads das etapas-base, uma etapa por vez, paginando por created_at (cursor).
  # ATENCAO: o run_report_preview IGNORA o limit pedido e corta a resposta por TAMANHO
  # (~200 linhas com 4 colunas, ~179 com estas 7) devolvendo truncated=true. Por isso:
  #   - nunca parar por "rows.Count < 200" (o corte nao tem numero fixo -> truncava na 1a pagina);
  #   - a unica paginacao que funciona e o cursor por created_at (offset/page sao ignorados);
  #   - so para quando a pagina nao trouxer nenhum id novo.
  function Get-Leads {
    $acc = [ordered]@{}
    foreach ($sidEtapa in $stageIds) {
      $cursor = $janIni.ToString('yyyy-MM-dd')
      for ($p = 0; $p -lt 120; $p++) {
        $cfg = [ordered]@{ report_type_slug='opportunities'; config=[ordered]@{
          columns = @(
            @{ path='id' }, @{ path='assignee_user__name' }, @{ path='funnel_stage_id' },
            @{ path='created_at' }, @{ path='customer__name' }, @{ path='name' }, @{ path='campaign__name' }
          )
          filters = @(
            @{ id='funnel_stage_id';     operator='equals'; value=$sidEtapa },
            @{ id='created_at';          operator='gte';    value=$cursor },
            @{ id='created_at';          operator='before'; value=$janFim.ToString('yyyy-MM-dd') },
            @{ id='assignee_user__name'; operator='in';     value=$nomesFoco }
          )
          sort = @(@{ path='created_at'; order='asc' }); limit = 2000 } }
        $rows = @((Ler-Relatorio $cfg) | Select-Object -ExpandProperty rows)
        if ($rows.Count -eq 0) { break }
        $nv = 0; foreach ($r in $rows) { $k=[string]$r.id; if (-not $acc.Contains($k)) { $acc[$k]=$r; $nv++ } }
        if ($nv -eq 0) { break }
        $px = [string]$rows[$rows.Count-1].created_at; if ($px -eq $cursor) { break }; $cursor = $px
      }
    }
    @($acc.Values)
  }

  $todos = Get-Leads
  # filtro de campanha (equilibrioCampanha / transferenciaCampanha) - aceita 1+ campanhas SOMADAS (ex: 'camp,outros')
  $campLista = @(); $campanhaLabel = ''
  if ($ehCampanha) {
    $mapaCampLabel = @{ camp=$CampCurto; outros='Outros' }
    $campLista = @($Campanha -split ',' | ForEach-Object { $_.Trim().ToLower() } | Where-Object { $_ })
    foreach ($cc in $campLista) { if ($cc -notin 'camp','outros') { throw "Campanha invalida: $cc (use camp|outros)." } }
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
  $stageNum  = @{}; foreach($e in $Etapas){ $stageNum[[string]$e.id]  = $e.num }   # id -> num da etapa (p/ projetar a carteira no app)

  $operacoes = @()
  $parados   = 0   # cruzamento: leads sem destino elegivel, que ficam com o dono atual

  if ($ehTransfer) {
    # junta os leads de TODAS as origens num pool unico (guardando de quem veio cada lead)
    $pool = @()
    foreach ($mo in $origs) {
      foreach ($r in @($porMembro[$mo.val])) { $pool += [pscustomobject]@{ lead=$r; de=$mo } }
    }
    # O @() precisa ficar FORA do if. Dentro dele, uma lista de 1 item e desembrulhada na
    # atribuicao: $pool virava o objeto solto, $pool.Count saia NULO e o -First quebrava.
    # Era por isso que transferir 1 lead sozinho falhava e 2 ou mais funcionava.
    $pool = @(if ($Ordem -eq 'recentes') { $pool | Sort-Object { [string]$_.lead.created_at } -Descending }
              else { $pool | Sort-Object { [string]$_.lead.created_at } })
    # [int] fecha a porta: seja o que for, -First recebe numero
    $qtd = [int]$(if ($Quantidade -gt 0) { [Math]::Min($Quantidade, $pool.Count) } else { $pool.Count })
    $sel = @($pool | Select-Object -First $qtd)
    for ($i=0; $i -lt $sel.Count; $i++) {
      $it = $sel[$i]
      $d  = if ($ehIndividual) { $it.de } else { $dest[$i % $dest.Count] }   # individual: fica com o mesmo dono; senao round-robin entre os destinos
      $curId = [string]$it.lead.funnel_stage_id   # etapa atual do lead (pode vir de varias etapas de origem)
      $op = [ordered]@{
        opportunity_id = [int]$it.lead.id
        cliente        = (NomeLead $it.lead)
        etapaNome      = [string]$stageNome[$curId]
        etapaNum       = [string]$stageNum[$curId]
        campanha       = (Cidx $it.lead.campaign__name)
        deNome         = (Short $it.de.nome)
        paraNome       = (Short $d.nome)
        paraId         = $d.id
      }
      if ([string]$eDest.id -ne $curId) { $op.novoStageId = $eDest.id; $op.novoStageNome = $eDest.nome; $op.novoStageNum = $eDest.num }
      $operacoes += $op
    }
  } else {
    # ---- equilibrio: alvo por membro (move so o excedente) ----
    $vals = @($foco | ForEach-Object { $_.val } | Sort-Object)   # ordem alfabetica define quem leva a sobra
    $cont = @{}; foreach ($v in $vals) { $cont[$v] = @($porMembro[$v]).Count }
    $total = 0; foreach ($v in $vals) { $total += $cont[$v] }
    # O bolo ($total) continua somando TODO MUNDO, inclusive os zerados - e a carteira deles que
    # sera repartida. O que encolhe e a lista de quem recebe: alvo do zerado e zero, e dai os dois
    # ramos abaixo funcionam sozinhos (no cruzamento ele nunca tem vaga; sem cruzamento, cede tudo).
    $rec = @($vals | Where-Object { $zerVals -notcontains $_ })
    $n = $rec.Count
    if ($n -lt 1) { throw "Todos os consultores estao zerados - nao ha para quem mandar os leads." }
    $baseAlvo = [Math]::Floor($total / $n); $resto = $total - ($baseAlvo * $n)
    $alvo = @{}; foreach ($v in $vals) { $alvo[$v] = 0 }
    for ($i=0; $i -lt $n; $i++) { $alvo[$rec[$i]] = $baseAlvo + ($(if ($i -lt $resto) {1} else {0})) }

    if ($Cruzamento) {
      # ---- CRUZAMENTO: todos os leads trocam de dono; ninguem recebe lead que ja era seu (balanceado) ----
      $rem = @{}; foreach ($v in $vals) { $rem[$v] = $alvo[$v] }
      $pool = @()
      foreach ($v in $vals) {
        $lst = @($porMembro[$v])
        $lst = @(if ($Ordem -eq 'recentes') { $lst | Sort-Object created_at -Descending } else { $lst | Sort-Object created_at })
        foreach ($r in $lst) { $pool += [pscustomobject]@{ lead=$r; de=$v; dc=$cont[$v] } }
      }
      $pool = @($pool | Sort-Object -Property @{Expression='dc';Descending=$true})   # quem tem mais leads primeiro (mais dificil de realocar sem cair em si mesmo)
      foreach ($item in $pool) {
        $cand = @($vals | Where-Object { $rem[$_] -gt 0 -and $_ -ne $item.de })
        if ($cand.Count -eq 0) { $parados++; continue }   # cauda infactivel: lead fica onde esta
        $pick = ($cand | Sort-Object @{Expression={ $rem[$_] };Descending=$true}, @{Expression={ $_ }} | Select-Object -First 1)
        $mDe   = $Equipe | Where-Object { $_.val -eq $item.de } | Select-Object -First 1
        $mPara = $Equipe | Where-Object { $_.val -eq $pick }    | Select-Object -First 1
        $curId = [string]$item.lead.funnel_stage_id
        $opE = [ordered]@{
          opportunity_id = [int]$item.lead.id
          cliente        = (NomeLead $item.lead)
          etapaNome      = [string]$stageNome[$curId]
          etapaNum       = [string]$stageNum[$curId]
          campanha       = (Cidx $item.lead.campaign__name)
          deNome         = (Short $mDe.nome)
          paraNome       = (Short $mPara.nome)
          paraId         = $mPara.id
        }
        if ($eqDest -and [string]$eqDest.id -ne $curId) { $opE.novoStageId = $eqDest.id; $opE.novoStageNome = $eqDest.nome; $opE.novoStageNum = $eqDest.num }
        $operacoes += $opE
        $rem[$pick]--
      }
    } else {
      # pool de cessao: de quem esta acima do alvo, na ordem escolhida
      $pool = @()
      foreach ($v in $vals) {
        $exced = $cont[$v] - $alvo[$v]
        if ($exced -le 0) { continue }
        $lst = @($porMembro[$v])
        $lst = @(if ($Ordem -eq 'recentes') { $lst | Sort-Object created_at -Descending } else { $lst | Sort-Object created_at })
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
          $curId = [string]$item.lead.funnel_stage_id
          $opE = [ordered]@{
            opportunity_id = [int]$item.lead.id
            cliente        = (NomeLead $item.lead)
            etapaNome      = [string]$stageNome[$curId]
            etapaNum       = [string]$stageNum[$curId]
            campanha       = (Cidx $item.lead.campaign__name)
            deNome         = (Short $mDe.nome)
            paraNome       = (Short $mPara.nome)
            paraId         = $mPara.id
          }
          if ($eqDest -and [string]$eqDest.id -ne $curId) { $opE.novoStageId = $eqDest.id; $opE.novoStageNome = $eqDest.nome; $opE.novoStageNum = $eqDest.num }
          $operacoes += $opE
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
  if ($ehTransfer) { foreach ($d in $dest) { $sd = Short $d.nome; if ($nomesTab -notcontains $sd) { $nomesTab += $sd } } }
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
  $baseLabel = if ($ehTransfer) { "etapa(s) " + (($eOrigs | ForEach-Object { $_.num }) -join '+') + " -> $($eDest.num) ($($eDest.nome))" }
               elseif ($Base -eq 'ativos') { 'leads ativos (etapas 1-4)' + $(if ($eqDest) { " -> etapa $($eqDest.num) ($($eqDest.nome))" } else { '' }) }
               else { "etapa(s) " + (($ebs | ForEach-Object { $_.num }) -join '+') + $(if ($eqDest) { " -> $($eqDest.num) ($($eqDest.nome))" } else { '' }) }
  if ($Cruzamento -and -not $ehTransfer) { $baseLabel = "$baseLabel · cruzamento (todos trocam de dono)" }
  # quem foi zerado tem de aparecer no cabecalho da previa: e a diferenca entre "equilibrou" e
  # "esvaziou a carteira de alguem", e o gestor precisa ver isso antes de clicar em aplicar
  if ($zerVals.Count -gt 0) {
    $zerNomes = @($zerVals | ForEach-Object { $m = ResolveMembro $_; if ($m) { Short $m.nome } else { $_ } })
    $baseLabel = "$baseLabel · zerado(s): " + ($zerNomes -join ', ')
  }
  $titulo = switch ($Acao) {
    'equilibrio'                     { "Equilibrio de Leads - $baseLabel" }
    'equilibrioCampanha'             { "Equilibrio de Leads (campanha $campanhaLabel) - $baseLabel" }
    'transferencia'                  { "Transferencia de Leads - " + (($origs | ForEach-Object { Short $_.nome }) -join ' + ') }
    'transferenciaCampanha'          { "Transferencia de Leads (campanha $campanhaLabel) - " + (($origs | ForEach-Object { Short $_.nome }) -join ' + ') }
    'transferenciaIndividual'        { "Transferencia Individual - " + (($origs | ForEach-Object { Short $_.nome }) -join ' + ') + " (entre etapas)" }
    'transferenciaIndividualCampanha'{ "Transferencia Individual (campanha $campanhaLabel) - " + (($origs | ForEach-Object { Short $_.nome }) -join ' + ') + " (entre etapas)" }
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
    qtdParados   = $parados             # ficaram com o dono atual por falta de destino elegivel
    zerados      = @($zerVals)          # o app remarca as caixas a partir daqui, nao do seu proprio estado
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
