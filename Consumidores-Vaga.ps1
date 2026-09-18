<#
════════════════════════════════════════════════════════════════════════════
 Consumidores-Vaga.ps1 — quem consome cada vaga das vendas de um cliente.

 Alimenta o bloco "Clientes que fecharam" da Leitura FRZ: quando o cliente
 fechou 2+ treinamentos (o "×2" na lista), mostra o nome de quem ocupa a
 outra vaga.

 POR QUE PRECISA DO ZS: o frz-sistema-v2 guarda só `quantidade`; o nome do
 consumidor vive no Zsales, como `beneficiary_name` do produto da
 oportunidade (/api/opportunity-products/?opportunity=N).

 COMO CASA O CLIENTE: o CPF do FRZ vem quase sempre vazio, então o vínculo é
 pelo NOME — busca em /api/customers/?search= e exige igualdade exata sem
 acento/caixa. Havendo homônimo ou nenhum exato, devolve achou=false em vez
 de chutar (é melhor não mostrar do que mostrar a pessoa errada).

 COMO CASA A VENDA: o nome do curso no FRZ é IGUAL ao product_name do ZS
 ("CEOP - Comunicação Eficaz e Oratória Persuasiva"), então só entram os
 produtos que o cliente comprou naquela leitura.

   .\Consumidores-Vaga.ps1 -ClientesFile plano.json -Json

 Entrada (JSON): { org:2, desde:'2026-08-09', clientes:[ {nome, cursos:[...]} ] }
 Saída  (JSON): { ok, itens:[ {nome, achou, ambiguo, vagas:[{curso,quem,titular}]} ] }
 IMPORTANTE: salvar com BOM UTF-8.
════════════════════════════════════════════════════════════════════════════
#>
param(
  [string]$ClientesFile = '',
  [switch]$Json
)
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ErrorActionPreference = 'Stop'

$RAIZ = $PSScriptRoot

function Out-Json($o) { $o | ConvertTo-Json -Depth 12 -Compress; exit 0 }
function Fail($msg)   { @{ ok = $false; erro = "$msg" } | ConvertTo-Json -Compress; exit 1 }

# Sem acento, sem espaço duplo, em maiúsculas: "NATÁLIA" e "Natalia" viram a mesma chave.
function Norm($s) {
  $t = [string]$s
  $t = $t.Normalize([Text.NormalizationForm]::FormD) -replace '[^\x00-\x7F]', ''
  return ($t -replace '\s+', ' ').Trim().ToUpper()
}

# ── Autenticação da API REST web (mesmo sc-web-auth.json do Vendas-ZS.ps1) ──
$script:webTok = $null
function Web-Token {
  if ($script:webTok) { return $script:webTok }
  $f = Join-Path $RAIZ 'sc-web-auth.json'
  if (-not (Test-Path $f)) { return $null }
  try {
    $c = Get-Content -Raw -Encoding UTF8 $f | ConvertFrom-Json
    $l = Invoke-RestMethod -Uri 'https://api.zsales.com.br/api/auth/login/' -Method Post `
         -ContentType 'application/json' -Body (@{ email = $c.email; password = $c.password } | ConvertTo-Json) -TimeoutSec 25
    $script:webTok = $l.access
    return $script:webTok
  } catch { return $null }
}

# O PS 5.1 assume Latin1 quando a resposta não declara charset e os acentos viram "â":
# por isso lemos os BYTES e decodificamos como UTF-8 na mão.
function Web-Get($caminho, $org) {
  $tk = Web-Token; if (-not $tk) { return $null }
  $h = @{ Authorization = "Bearer $tk"; 'X-Organization-Id' = "$org" }
  try {
    $r = Invoke-WebRequest -Uri "https://api.zsales.com.br$caminho" -Headers $h -TimeoutSec 30 -UseBasicParsing
    return ([Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()) | ConvertFrom-Json)
  } catch { return $null }
}

function Lista($r) { if ($null -eq $r) { return @() }; if ($r.PSObject.Properties['results']) { return @($r.results) }; return @($r) }

# ── Casamento APROXIMADO (só quando não há nome idêntico) ────────────────────
# O FRZ e o ZS costumam guardar o mesmo cliente com nomes de tamanhos diferentes:
# "André Sampaio" × "ANDRE DOS SANTOS SAMPAIO", "Maria Gerúzia Gervásio de Souza" ×
# "Gerúzia Gervásio" (FCIS 31, 16/09/2026). A busca do ZS diferencia acento e casa
# palavra inteira ("André" não acha "ANDRE"), então cada palavra do nome é buscada
# com e sem acento. Aceita o candidato cujas palavras contêm TODAS as do nome mais
# curto (mín. 2 palavras, sem de/da/dos) — e só se ele for ÚNICO. Dois candidatos
# = homônimo = aviso, nunca chute.
$PARTICULAS = @('DE','DA','DO','DAS','DOS','E')
function Palavras($s) { @((Norm $s) -replace '[^A-Z0-9 ]', ' ' -split '\s+' | Where-Object { $_.Length -ge 2 -and $PARTICULAS -notcontains $_ }) }
function Contem-Todas($curto, $longo) {
  if (@($curto).Count -lt 2) { return $false }
  foreach ($w in $curto) { if (@($longo) -notcontains $w) { return $false } }
  return $true
}
function Achar-Aproximado($nome, $org) {
  $pn = Palavras $nome
  $cands = @{}
  $termos = @()
  foreach ($w in (([string]$nome).Trim() -split '\s+')) {
    if ((Norm $w).Length -lt 3 -or $PARTICULAS -contains (Norm $w)) { continue }
    $termos += $w
    $semAc = ($w.Normalize([Text.NormalizationForm]::FormD) -replace '[^\x00-\x7F]', '')
    if ($semAc -ne $w) { $termos += $semAc }
  }
  foreach ($t in ($termos | Select-Object -Unique)) {
    foreach ($c in (Lista (Web-Get ("/api/customers/?search=" + [Uri]::EscapeDataString($t) + "&page_size=100") $org))) {
      $pc = Palavras $c.name
      $ok = if (@($pc).Count -le @($pn).Count) { Contem-Todas $pc $pn } else { Contem-Todas $pn $pc }
      if ($ok) { $cands[[string]$c.id] = $c }
    }
  }
  if ($cands.Count -eq 1) { return @{ cliente = @($cands.Values)[0]; ambiguo = $false } }
  return @{ cliente = $null; ambiguo = ($cands.Count -gt 1) }
}

# ── 1. Entrada ───────────────────────────────────────────────────────────────
if (-not $ClientesFile -or -not (Test-Path $ClientesFile)) { Fail 'ClientesFile nao informado ou inexistente' }
try { $ent = Get-Content -Raw -Encoding UTF8 $ClientesFile | ConvertFrom-Json } catch { Fail 'JSON de entrada invalido' }

$org = if ($ent.org) { [int]$ent.org } else { 2 }
$desde = [string]$ent.desde
if ($desde -notmatch '^\d{4}-\d{2}-\d{2}$') { $desde = (Get-Date).AddDays(-120).ToString('yyyy-MM-dd') }
$clientes = @($ent.clientes)
# pessoas: so o historico (CPF + treinamentos da grade no ZS) de quem nao esta no mapeamento da
# turma — consumidores de vaga e compradores. Alimenta o selo "Novo Green/Golden Belt".
$pessoas = @($ent.pessoas | Where-Object { $_ })
if ($clientes.Count -eq 0 -and $pessoas.Count -eq 0) { Out-Json @{ ok = $true; itens = @(); pessoas = @() } }
if (-not (Web-Token)) { Fail 'Nao consegui autenticar na API do Zsales (sc-web-auth.json)' }

$dtDesde = [datetime]::ParseExact($desde, 'yyyy-MM-dd', $null)

# cliente no ZS: primeiro nome identico (sem acento/caixa), depois o aproximado unico
function Achar-Cliente($nome, $org) {
  $kN = Norm $nome
  $busca = Lista (Web-Get ("/api/customers/?search=" + [Uri]::EscapeDataString($nome) + "&page_size=10") $org)
  $exatos = @($busca | Where-Object { (Norm $_.name) -eq $kN })
  if ($exatos.Count -gt 1) { return @{ cliente = $null; ambiguo = $true; aproximado = $false } }
  if ($exatos.Count -eq 1) { return @{ cliente = $exatos[0]; ambiguo = $false; aproximado = $false } }
  $apx = Achar-Aproximado $nome $org
  if ($apx.ambiguo -or -not $apx.cliente) { return @{ cliente = $null; ambiguo = ($apx.ambiguo -or $busca.Count -gt 0); aproximado = $false } }
  return @{ cliente = $apx.cliente; ambiguo = $false; aproximado = $true }
}

# sigla da grade GGB a partir do product_name do ZS ('' = fora da grade). Espelho do
# fcSiglaGrade do Meta Master e da $GRADE do Ponte-SF.ps1: FOP conta como CEOP, FPCH e
# CIS ASSESSMENT como FGPC, TAV como TV. A ordem importa (FCIS e CIS ASSESSMENT antes de CIS).
function Sigla-Grade($prod) {
  $t = Norm $prod
  if ($t -match '^FCIS\b|FORMACAO EM COACHING') { return 'FCIS' }
  if ($t -match '^(FGPC|FPCH)\b|CIS ASSESSMENT|PERFIL COMPORTAMENTAL') { return 'FGPC' }
  if ($t -match 'CIS.?FAM') { return '' }
  if ($t -match '^(METODO )?CIS\b') { return 'CIS' }
  if ($t -match '^IF\b|INTELIGENCIA FINANCEIRA') { return 'IF' }
  if ($t -match '^(TV|TAV)\b|TECNICAS AVANCADAS') { return 'TV' }
  if ($t -match '^BHP\b|BUSINESS HIGH') { return 'BHP' }
  if ($t -match '^(ML5|MLS)\b') { return 'ML5' }
  if ($t -match '^MASTER\b|MASTER COACHING') { return 'MASTER' }
  if ($t -match '^(CEOP|FOP)\b|ORATORIA|ORADORES') { return 'CEOP' }
  # CI (Coaching Individual) NAO conta para a grade GGB (regra do usuario, 17/09/2026)
  return ''
}

# ── 2. Um cliente por vez ────────────────────────────────────────────────────
$itens = @()
foreach ($cl in $clientes) {
  $nome  = ([string]$cl.nome).Trim()
  $kNome = Norm $nome
  $cursos = @($cl.cursos | ForEach-Object { Norm $_ } | Where-Object { $_ })
  $res = [ordered]@{ nome = $nome; achou = $false; ambiguo = $false; aproximado = $false; nomeZs = ''; cpf = ''; vagas = @() }
  if (-not $nome) { $itens += $res; continue }

  # 2a. cliente no ZS — primeiro, nome idêntico (sem acento/caixa)
  $ac = Achar-Cliente $nome $org
  if (-not $ac.cliente) { $res.ambiguo = [bool]$ac.ambiguo; $itens += $res; continue }
  $exatos = @($ac.cliente)
  if ($ac.aproximado) { $res.aproximado = $true; $res.nomeZs = [string]$ac.cliente.name }
  $res.cpf = ([string]$ac.cliente.document_number -replace '\D', '')
  $cid = $exatos[0].id

  # 2b. oportunidades ganhas a partir da data de corte (a turma da leitura)
  $opps = Lista (Web-Get "/api/opportunities/?customer=$cid&outcome=won&page_size=40" $org)
  $recentes = @()
  foreach ($o in $opps) {
    $cd = [string]$o.close_date
    if ($cd -match '^\d{4}-\d{2}-\d{2}') {
      try { if ([datetime]::ParseExact($cd.Substring(0,10), 'yyyy-MM-dd', $null) -lt $dtDesde) { continue } } catch {}
    }
    $recentes += $o
  }
  # teto de segurança: cliente antigo pode ter dezenas de oportunidades
  if ($recentes.Count -gt 12) { $recentes = @($recentes | Select-Object -First 12) }
  $res.achou = $true

  # 2c. produtos de cada oportunidade — só os cursos que ele fechou nesta leitura
  $vistos = @{}
  $vagas = @()
  foreach ($o in $recentes) {
    foreach ($p in (Lista (Web-Get "/api/opportunity-products/?opportunity=$($o.id)" $org))) {
      $prod = [string]$p.product_name
      if ($cursos.Count -gt 0 -and $cursos -notcontains (Norm $prod)) { continue }
      $quem = ([string]$p.beneficiary_name).Trim()
      $chave = (Norm $prod) + '|' + (Norm $quem) + '|' + [string]$p.id
      if ($vistos.ContainsKey($chave)) { continue }
      $vistos[$chave] = 1
      $vagas += [ordered]@{
        curso   = $prod
        turma   = [string]$p.class_name
        quem    = $quem
        # titular pelo nome do FRZ OU pelo do cadastro do ZS (casamento aproximado: os dois diferem)
        titular = (((Norm $quem) -eq $kNome) -or ($res.nomeZs -and (Norm $quem) -eq (Norm $res.nomeZs)))
        vazio   = ($quem -eq '')
      }
    }
  }
  # agrupa por curso e, dentro dele, titular primeiro: a numeração v1/v2 da tela é
  # POR TREINAMENTO, senão um curso de 2 vagas apareceria como "v3" só por vir depois.
  $res.vagas = @($vagas | Sort-Object @{ Expression = { $_.curso } }, @{ Expression = { -not $_.titular } }, @{ Expression = { $_.quem } })
  $itens += $res
}

# ── 3. Histórico de quem não está no mapeamento da turma ─────────────────────
# Entrada: pessoas:[{nome, cursos:[siglas fechadas NESTA turma]}] (ou só o nome).
# Saída:   {nome, achou, ambiguo, aproximado, nomeZs, cpf, zsGrade:[siglas]}
# zsGrade = treinamentos da grade que a pessoa JÁ TINHA no ZS: produtos das oportunidades ganhas
# dela em que ela é a beneficiária (ou não há beneficiário). A compra desta turma NÃO entra —
# senão o curso recém-fechado já contaria como "tinha antes" e ninguém viraria belt: produto
# de oportunidade fechada a partir de `desde` cuja sigla está nos cursos fechados é descartado.
$saidaPessoas = @()
foreach ($pe in $pessoas) {
  $nomeP = if ($pe -is [string]) { $pe.Trim() } else { ([string]$pe.nome).Trim() }
  $fechP = if ($pe -is [string]) { @() } else { @($pe.cursos | ForEach-Object { ([string]$_).Trim().ToUpper() } | Where-Object { $_ }) }
  $rp = [ordered]@{ nome = $nomeP; achou = $false; ambiguo = $false; aproximado = $false; nomeZs = ''; cpf = ''; zsGrade = @() }
  if (-not $nomeP) { continue }
  $ac = Achar-Cliente $nomeP $org
  if (-not $ac.cliente) { $rp.ambiguo = [bool]$ac.ambiguo; $saidaPessoas += $rp; continue }
  $rp.achou = $true
  $rp.aproximado = [bool]$ac.aproximado
  $rp.nomeZs = [string]$ac.cliente.name
  $rp.cpf = ([string]$ac.cliente.document_number -replace '\D', '')
  # quem JA esta no mapeamento so precisa do CPF (validacao no SF): pula a varredura de vendas
  if (-not ($pe -is [string]) -and $pe.soCpf) { $saidaPessoas += $rp; continue }
  $kP = Norm $nomeP; $kZ = Norm $rp.nomeZs
  $sig = @{}
  foreach ($o in @(Lista (Web-Get "/api/opportunities/?customer=$($ac.cliente.id)&outcome=won&page_size=40" $org))) {
    $recente = $false
    # close_date pode vir vazio em venda antiga ganha (BHP da Maria Geruzia): cai no won_at
    $cd = [string]$o.close_date
    if ($cd -notmatch '^\d{4}-\d{2}-\d{2}') { $cd = [string]$o.won_at }
    if ($cd -match '^\d{4}-\d{2}-\d{2}') { try { $recente = ([datetime]::ParseExact($cd.Substring(0,10), 'yyyy-MM-dd', $null) -ge $dtDesde) } catch {} }
    else { $recente = $true }   # ganha sem data nenhuma: trata como desta turma (conservador)
    foreach ($p in (Lista (Web-Get "/api/opportunity-products/?opportunity=$($o.id)" $org))) {
      $s = Sigla-Grade $p.product_name
      if (-not $s) { continue }
      # vaga de outra pessoa? O beneficiary_name e texto gravado na venda e nao acompanha a
      # correcao do cadastro (Maria Geruzia: cliente renomeado, produtos ainda "Geruzia Gervasio"),
      # entao tambem vale o casamento por palavras do nome mais curto.
      $bq = Norm ([string]$p.beneficiary_name)
      if ($bq -and $bq -ne $kP -and $bq -ne $kZ) {
        $pb = Palavras $p.beneficiary_name; $pz = Palavras $rp.nomeZs
        $mesma = if (@($pb).Count -le @($pz).Count) { Contem-Todas $pb $pz } else { Contem-Todas $pz $pb }
        if (-not $mesma) { continue }
      }
      if ($recente -and $fechP -contains $s) { continue }       # a compra desta turma
      $sig[$s] = 1
    }
  }
  $rp.zsGrade = @($sig.Keys | Sort-Object)
  $saidaPessoas += $rp
}

Out-Json @{ ok = $true; org = $org; desde = $desde; itens = $itens; pessoas = $saidaPessoas }
