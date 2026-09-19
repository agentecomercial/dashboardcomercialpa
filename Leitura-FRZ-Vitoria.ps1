<#
════════════════════════════════════════════════════════════════════════════
 Leitura-FRZ-Vitoria.ps1 — leitura das vendas do FRZ SISTEMA v2 por unidade.

   SISTEMA  https://frz-sistema-v2.vercel.app   → tabelas `turmas` e `vendas`

 Lê (e SÓ lê) as turmas cadastradas na cidade escolhida (-Cidade VITORIA,
 padrão, ou BELEM) e as vendas de cada uma, separadas pelos três status:

   NEGOCIAÇÃO · PAGO COM ENTRADA · PAGAMENTO FINALIZADO

 A base é o mesmo Supabase do Turma-Lancar-FRZ.ps1, com a chave publishable
 (leitura anônima) — não há login nem escrita em lugar nenhum.

 Saída: markdown para a aba Comandos do Meta Master + um marcador oculto
 <!--FRZVIT:{json}--> com os números, usado pelos cards de KPI e pelo card
 de imagem.

   .\Leitura-FRZ-Vitoria.ps1                  # a turma MAIS RECENTE de Vitória
   .\Leitura-FRZ-Vitoria.ps1 -TurmaId 10      # uma turma específica
   .\Leitura-FRZ-Vitoria.ps1 -TurmaId todas   # todas as turmas da praça
   .\Leitura-FRZ-Vitoria.ps1 -Listar          # só a lista de turmas (JSON, p/ o seletor)
   .\Leitura-FRZ-Vitoria.ps1 -Cidade BELEM    # outra praça, se um dia precisar
════════════════════════════════════════════════════════════════════════════
#>
param(
  [string]$Cidade    = 'VITORIA',
  [string]$TurmaId   = '',    # vazio = turma mais recente · 'todas' = a praça inteira
  [string]$Consultor = '',    # vazio = todos · compara sem acento/maiúsculas (junta "NATÁLIA" e "Natalia")
  [string]$Status    = '',    # vazio = todos · lista de neg,ent,fin (ex.: 'neg,ent')
  [switch]$Listar             # devolve turmas + consultores em JSON (alimenta os seletores)
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

$SB_BASE = 'https://mnfxnepsfdfcmoglmgec.supabase.co/rest/v1'
$SB_KEY  = 'sb_publishable_hbmxtsjNBloNR6CYBXZ8Zw_FQeMZXOC'
$HDR     = @{ apikey = $SB_KEY; Authorization = "Bearer $SB_KEY" }

# O Invoke-RestMethod do PS 5.1 embrulha a resposta em `value` conforme o caso:
# sem desembrulhar, o array vira um objeto só e toda soma sai vazia.
function Sb-Get($rota) {
  $r = Invoke-RestMethod -Uri "$SB_BASE/$rota" -Headers $HDR -Method Get
  if ($r -and $r.PSObject.Properties['value']) { $r = $r.value }
  return ,@($r)
}

# Sem acento e em maiúsculas: a comparação de cidade não pode depender do "Ó".
function Norm($s) {
  $t = [string]$s
  $t = $t.Normalize([Text.NormalizationForm]::FormD) -replace '[^\x00-\x7F]', ''
  return ($t -replace '\s+', ' ').Trim().ToUpper()
}

function Moeda($v) { '{0:N2}' -f ([double]$v) }

function Fmt-Data($d) {
  if (-not $d) { return '—' }
  try { return ([datetime]$d).ToString('dd/MM/yyyy') } catch { return [string]$d }
}

# Os três status do sistema. Comparação por prefixo ASCII (PAGO COM… × PAGAMENTO…)
# para não depender de acento vindo do banco.
function Chave-Status($st) {
  $s = Norm $st
  if ($s -like 'NEGOCIA*')  { return 'neg' }
  if ($s -like 'PAGO COM*') { return 'ent' }
  if ($s -like 'PAGAMENTO*') { return 'fin' }
  return 'outro'
}

# ── 1. Turmas da praça ───────────────────────────────────────────────────────
$cidadeAlvo = Norm $Cidade
$todas   = Sb-Get 'turmas?select=id,nome,cidade,tipo,status,data_inicio,meta_receita&order=data_inicio.desc'
$daPraca = @($todas | Where-Object { (Norm $_.cidade) -eq $cidadeAlvo })

$linhas = New-Object System.Collections.Generic.List[string]
$agora  = Get-Date -Format 'dd/MM/yyyy HH:mm'

# Consultores de um conjunto de vendas, agrupados SEM acento/maiúsculas: no FRZ a mesma
# pessoa aparece digitada de dois jeitos ("NATÁLIA" e "Natalia") e viraria dois filtros.
# O rótulo exibido é a grafia mais usada; a chave é a normalizada.
function Consultores-De($vds) {
  $mapa = @{}
  foreach ($v in $vds) {
    $nome = ([string]$v.consultor).Trim()
    if (-not $nome) { continue }
    $k = Norm $nome
    if (-not $mapa.ContainsKey($k)) {
      $mapa[$k] = @{ q = 0; v = 0.0; grafias = @{}
                     neg = @{ q = 0; v = 0.0 }; ent = @{ q = 0; v = 0.0 }; fin = @{ q = 0; v = 0.0 } }
    }
    $val = [double]$v.valor
    $mapa[$k].q += 1
    $mapa[$k].v += $val
    # por status também: a tela recalcula o ranking quando você marca só uma situação
    $ks = Chave-Status $v.status
    if ($ks -ne 'outro') { $mapa[$k][$ks].q += 1; $mapa[$k][$ks].v += $val }
    if (-not $mapa[$k].grafias.ContainsKey($nome)) { $mapa[$k].grafias[$nome] = 0 }
    $mapa[$k].grafias[$nome] += 1
  }
  $saida = @()
  foreach ($k in $mapa.Keys) {
    $rotulo = ($mapa[$k].grafias.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 1).Key
    $saida += [ordered]@{
      k = $k; nome = $rotulo; q = $mapa[$k].q; v = [math]::Round($mapa[$k].v, 2)
      neg = [ordered]@{ q = $mapa[$k].neg.q; v = [math]::Round($mapa[$k].neg.v, 2) }
      ent = [ordered]@{ q = $mapa[$k].ent.q; v = [math]::Round($mapa[$k].ent.v, 2) }
      fin = [ordered]@{ q = $mapa[$k].fin.q; v = [math]::Round($mapa[$k].fin.v, 2) }
    }
  }
  # o ranking da tela é por valor: quem está puxando a turma aparece primeiro
  return ,@($saida | Sort-Object { -$_.v })
}

# -Listar: catálogo de turmas da praça + os consultores de cada uma, para montar os
# seletores da tela. A primeira turma já vem por data_inicio desc = a mais recente (padrão).
if ($Listar) {
  $catIds = ($daPraca.id -join ',')
  $vdsPraca = if ($catIds) { Sb-Get "vendas?select=turma_id,consultor,valor,status&turma_id=in.($catIds)&limit=5000" } else { @() }
  $cat = @($daPraca | ForEach-Object {
    $tid = [int]$_.id
    [ordered]@{
      id          = [string]$_.id
      nome        = [string]$_.nome
      ini         = (Fmt-Data $_.data_inicio)
      consultores = (Consultores-De @($vdsPraca | Where-Object { [int]$_.turma_id -eq $tid }))
    } })
  $padrao = if ($cat.Count) { $cat[0].id } else { '' }
  Write-Output (ConvertTo-Json ([ordered]@{
    turmas      = $cat
    padrao      = $padrao
    consultores = (Consultores-De $vdsPraca)   # praça inteira (opção "todas as turmas")
  }) -Compress -Depth 8)
  return
}

if ($daPraca.Count -eq 0) {
  $linhas.Add("## 🏫 Leitura FRZ — $Cidade")
  $linhas.Add('')
  $linhas.Add("_(nenhuma turma cadastrada em $Cidade no FRZ)_")
  Write-Output ($linhas -join "`r`n")
  return
}

# ── 1b. Recorte: uma turma ou a praça inteira ────────────────────────────────
# Sem -TurmaId a leitura abre na turma MAIS RECENTE — é a que está em jogo no dia a dia.
$alvoId = ($TurmaId + '').Trim()
$recorte = ''
if ($alvoId -eq 'todas') {
  $turmas  = $daPraca
  $recorte = 'todas as turmas'
} else {
  $sel = $null
  if ($alvoId -match '^\d+$') { $sel = $daPraca | Where-Object { [int]$_.id -eq [int]$alvoId } | Select-Object -First 1 }
  if (-not $sel) { $sel = $daPraca[0] }   # padrão (e fallback de id que não existe mais): a mais recente
  $turmas  = @($sel)
  $recorte = [string]$sel.nome
}

# ── 2. Vendas dessas turmas ──────────────────────────────────────────────────
$ids    = ($turmas.id -join ',')
$vendas = Sb-Get "vendas?select=id,turma_id,consultor,nome_aluno,curso,valor,liquidez,status,created_at&turma_id=in.($ids)&limit=5000"

# ── 2b. Filtro de consultor ──────────────────────────────────────────────────
# Compara normalizado: escolher "Natália" traz também as vendas gravadas como "NATALIA".
$consAlvo  = Norm $Consultor
$consLabel = ''
if ($consAlvo) {
  $vendas = @($vendas | Where-Object { (Norm $_.consultor) -eq $consAlvo })
  $consLabel = if ($vendas.Count) {
    (@($vendas | Group-Object consultor | Sort-Object Count -Descending)[0]).Name
  } else { ([string]$Consultor).Trim() }
}

# ── 2c. Filtro de situação ───────────────────────────────────────────────────
# Nenhuma marcada = todas. Marcadas = só essas entram na tabela e nos totais.
$stTxt   = @{ neg = 'NEGOCIAÇÃO'; ent = 'PAGO COM ENTRADA'; fin = 'PAGAMENTO FINALIZADO' }
$stAlvo  = @(($Status -split ',') | ForEach-Object { $_.Trim().ToLower() } | Where-Object { $stTxt.ContainsKey($_) })
$stLabel = ''
if ($stAlvo.Count -gt 0 -and $stAlvo.Count -lt 3) {
  $vendas  = @($vendas | Where-Object { $stAlvo -contains (Chave-Status $_.status) })
  $stLabel = (($stAlvo | ForEach-Object { $stTxt[$_] }) -join ' + ')
} else {
  $stAlvo = @()   # nenhuma ou todas as três: sem recorte
}

# ── 3. Agregação por turma e total ───────────────────────────────────────────
$tot = [ordered]@{
  neg = [ordered]@{ q = 0; v = 0.0; liq = 0.0 }
  ent = [ordered]@{ q = 0; v = 0.0; liq = 0.0 }
  fin = [ordered]@{ q = 0; v = 0.0; liq = 0.0 }
}
$itens = @()

foreach ($t in $turmas) {
  $vt = @($vendas | Where-Object { [int]$_.turma_id -eq [int]$t.id })
  $bl = [ordered]@{
    neg = [ordered]@{ q = 0; v = 0.0; liq = 0.0 }
    ent = [ordered]@{ q = 0; v = 0.0; liq = 0.0 }
    fin = [ordered]@{ q = 0; v = 0.0; liq = 0.0 }
  }
  foreach ($v in $vt) {
    $k = Chave-Status $v.status
    if ($k -eq 'outro') { continue }
    $val = [double]$v.valor
    # líquido = coluna `liquidez` do FRZ (Coaching Individual entra pela metade); sem ela, vale o bruto
    $liq = if ($null -ne $v.liquidez) { [double]$v.liquidez } else { $val }
    $bl[$k].q  += 1
    $bl[$k].v  += $val
    $bl[$k].liq += $liq
    $tot[$k].q += 1
    $tot[$k].v += $val
    $tot[$k].liq += $liq
  }
  $itens += [ordered]@{
    id     = [string]$t.id
    nome   = [string]$t.nome
    tipo   = [string]$t.tipo      # "IF - Inteligência Financeira" — vira o subtítulo do "Copiar nomes"
    ini    = Fmt-Data $t.data_inicio
    meta   = [double]$t.meta_receita
    vendas = $vt.Count
    neg    = $bl.neg
    ent    = $bl.ent
    fin    = $bl.fin
  }
}

$totVendas = $tot.neg.q + $tot.ent.q + $tot.fin.q
$emAberto  = $tot.neg.v + $tot.ent.v
$conv      = if (($tot.fin.v + $emAberto) -gt 0) { [math]::Round(100 * $tot.fin.v / ($tot.fin.v + $emAberto), 1) } else { 0 }

# ── 4. Markdown ──────────────────────────────────────────────────────────────
$praca = switch ($cidadeAlvo) { 'VITORIA' { 'Vitória' } 'BELEM' { 'Belém' } 'TERESINA' { 'Teresina' } default { [string]$Cidade } }
$tituloRec = if ($consLabel) { "$recorte · $consLabel" } else { $recorte }
$linhas.Add("## 🏫 Leitura FRZ — $praca · $tituloRec")
$linhas.Add('')
$filtros = @()
if ($consLabel) { $filtros += "consultor **$consLabel**" }
if ($stLabel)   { $filtros += "situação **$stLabel**" }
$filtroTxt = if ($filtros.Count) { ' · filtrado por ' + ($filtros -join ' e ') } else { '' }
$linhas.Add("_lido em $agora · $($turmas.Count) turma(s) · $totVendas venda(s)$filtroTxt · fonte: frz-sistema-v2 (só leitura)_")
$linhas.Add('')
if ($alvoId -eq 'todas') {
  # Praça inteira: uma linha por turma. Bruto antes do líquido; o líquido é o do
  # PAGAMENTO FINALIZADO (é o que conta na meta).
  $linhas.Add('| Turma | Início | Negociação | Pago c/ entrada | Finalizado | Finalizado líq. | Vendas |')
  $linhas.Add('|:--|:--|:--|:--|:--|:--|:--|')
  foreach ($it in $itens) {
    $neg = if ($it.neg.q -gt 0) { Moeda $it.neg.v } else { '—' }
    $ent = if ($it.ent.q -gt 0) { Moeda $it.ent.v } else { '—' }
    $fin = if ($it.fin.q -gt 0) { Moeda $it.fin.v } else { '—' }
    $fnl = if ($it.fin.q -gt 0) { Moeda $it.fin.liq } else { '—' }
    $linhas.Add("| $($it.nome) | $($it.ini) | $neg | $ent | $fin | $fnl | $($it.vendas) |")
  }
  $linhas.Add("| **TOTAL** | | **$(Moeda $tot.neg.v)** | **$(Moeda $tot.ent.v)** | **$(Moeda $tot.fin.v)** | **$(Moeda $tot.fin.liq)** | **$totVendas** |")
} else {
  # Uma turma só: a tabela mostra as vendas dela, senão sobraria uma linha única.
  $linhas.Add('| Data | Consultor | Aluno | Curso | Valor | Líquido | Situação |')
  $linhas.Add('|:--|:--|:--|:--|:--|:--|:--|')
  $ordem = @($vendas | Sort-Object { [datetime]$_.created_at } -Descending)
  foreach ($v in $ordem) {
    $k = Chave-Status $v.status
    if ($k -eq 'outro') { continue }
    $dt = try { ([datetime]$v.created_at).ToString('dd/MM') } catch { '—' }
    $al = if ($v.nome_aluno) { [string]$v.nome_aluno } else { '—' }
    $lq = if ($null -ne $v.liquidez) { [double]$v.liquidez } else { [double]$v.valor }
    $linhas.Add("| $dt | $($v.consultor) | $al | $($v.curso) | $(Moeda $v.valor) | $(Moeda $lq) | $($stTxt[$k]) |")
  }
  if ($ordem.Count -eq 0) { $linhas.Add('| — | — | _(nenhuma venda lançada nesta turma)_ | — | — | — | — |') }
  $linhas.Add("| | | | **TOTAL** | **$(Moeda ($tot.neg.v + $tot.ent.v + $tot.fin.v))** | **$(Moeda ($tot.neg.liq + $tot.ent.liq + $tot.fin.liq))** | **$totVendas venda(s)** |")
}

# ── 4b. Lista enxuta de vendas ───────────────────────────────────────────────
# Alimenta o bloco "Clientes que fecharam" do Meta Master: aluno, consultor,
# curso, valor e a chave do status. Vale também em "Vitória inteira", onde a
# tabela do markdown é por turma e não traz nome de aluno.
$listaVendas = @()
foreach ($v in $vendas) {
  $k = Chave-Status $v.status
  if ($k -eq 'outro') { continue }
  $listaVendas += [ordered]@{
    al = if ($v.nome_aluno) { ([string]$v.nome_aluno).Trim() } else { '' }
    cs = ([string]$v.consultor).Trim()
    cu = ([string]$v.curso).Trim()
    vl = [double]$v.valor
    lq = if ($null -ne $v.liquidez) { [double]$v.liquidez } else { [double]$v.valor }
    st = $k
    # data da venda: vira a coluna Data do dossie de treinamentos (Meta Master)
    dt = try { ([datetime]$v.created_at).ToString('dd/MM/yyyy') } catch { '' }
  }
}

# ── 5. Marcador oculto (KPIs + card de imagem) ───────────────────────────────
$payload = [ordered]@{
  praca      = $praca
  recorte    = $recorte
  consultor  = $consLabel
  situacao   = $stLabel
  statusSel  = $stAlvo
  turmaId    = if ($alvoId -eq 'todas') { 'todas' } else { [string]$turmas[0].id }
  gerado     = $agora
  totTurmas  = $turmas.Count
  totVendas  = $totVendas
  conversao  = $conv
  tot        = $tot
  itens      = $itens
  vendas     = $listaVendas
}
$linhas.Add('')
$linhas.Add('<!--FRZVIT:' + (ConvertTo-Json $payload -Compress -Depth 8) + '-->')

Write-Output ($linhas -join "`r`n")
