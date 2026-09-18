# Pegar-Link-SF.ps1
# Comando "Pegar link SF": lista as OFERTAS DISPONIVEIS da unidade no Salesforce (painel "Links")
# e monta o LINK DE PAGAMENTO pronto para entregar ao cliente.
#
# Reproduz o que a tela do Lightning faz (LWC "linksDashboard"):
#   link final = LinkOriginalCheckout__c
#                + ?utm_sellerId=<Id do usuario SF>
#                + &utm_sellerId_check=<MD5 do Id>
#                + &utm_source_enc=<Base64 da origem do lead>
# A origem do lead e o "Selecionar origem do lead" da tela; o padrao aqui e "Cliente Base".
#
# ESTE SCRIPT NUNCA ESCREVE NO SALESFORCE: so SELECT (SOQL) via REST.
#
# USO:
#   .\Pegar-Link-SF.ps1                        -> lista os CLUSTERS: produto + quantidade de ofertas
#   .\Pegar-Link-SF.ps1 -Cluster 2             -> abre as ofertas do cluster 2 da ultima lista
#   .\Pegar-Link-SF.ps1 -Produto BHP           -> idem, chamando o cluster pelo codigo do produto
#   .\Pegar-Link-SF.ps1 -Item 37               -> entrega o link SO da oferta 37 da ultima tabela
#   .\Pegar-Link-SF.ps1 -Busca "BHP"           -> filtra pelo nome da oferta
#   .\Pegar-Link-SF.ps1 -Produto BHP           -> filtra pelo codigo do produto
#   .\Pegar-Link-SF.ps1 -Escopo unidade        -> so as ofertas da propria unidade
#   .\Pegar-Link-SF.ps1 -Origem "Indicacao"    -> troca a origem do lead
#   .\Pegar-Link-SF.ps1 -Busca "BHP" -Copiar   -> ja copia o bloco para a area de transferencia
#   .\Pegar-Link-SF.ps1 -Busca "BHP" -Json     -> saida JSON (para o app)
#
# A saida SEMPRE termina com um bloco copiavel (oferta + valor + link), pronto para
# mandar para o consultor sem edicao.
#
# Credenciais: %LOCALAPPDATA%\MetaMaster\sf-creds.xml (DPAPI) -> grave com Configurar-SF.ps1.
# IMPORTANTE: salvar com BOM UTF-8.
param(
  [string]$Busca = '',
  [string]$Produto = '',
  [string]$Origem = 'Cliente Base',
  [ValidateSet('todas','rede','unidade')][string]$Escopo = 'todas',
  [int]$Coligada = 0,
  [string]$Vendedor = '',
  [int]$Top = 0,
  [int]$Item = 0,
  [int]$Cluster = 0,
  [switch]$Detalhar,
  [switch]$Json,
  [switch]$Copiar
)
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$API   = '59.0'
$dir   = Join-Path $env:LOCALAPPDATA 'MetaMaster'
$fCred = Join-Path $dir 'sf-creds.xml'
$fSess = Join-Path $dir 'sf-session.json'

function Out-Json($o){ $o | ConvertTo-Json -Depth 10 -Compress; exit 0 }
function Fail($msg, $extra){
  if ($Json) {
    $o = [ordered]@{ ok=$false; erro="$msg" }
    if ($extra) { foreach($k in $extra.Keys){ $o[$k] = $extra[$k] } }
    $o | ConvertTo-Json -Depth 6 -Compress
  } else {
    Write-Host ''
    Write-Host "  ERRO: $msg" -ForegroundColor Red
    if ($extra -and $extra.como) { Write-Host "  $($extra.como)" -ForegroundColor Yellow }
    Write-Host ''
  }
  exit 1
}
function SoqlEsc($s){ ("$s" -replace "\\","\\\\") -replace "'","\'" }
function Md5Hex($s){
  $md5 = [System.Security.Cryptography.MD5]::Create()
  $b   = $md5.ComputeHash([System.Text.Encoding]::UTF8.GetBytes("$s"))
  -join ($b | ForEach-Object { $_.ToString('x2') })
}
function B64($s){ [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes("$s")) }
function Moeda($v){
  if ($null -eq $v) { return 'R$ 0,00' }
  'R$ ' + ([double]$v).ToString('N2',[Globalization.CultureInfo]::GetCultureInfo('pt-BR'))
}

# ---------------- sessao (mesmo padrao do Ponte-SF.ps1) ----------------
$script:sess = $null
function Ler-Sessao {
  if (Test-Path $fSess) { try { return (Get-Content -Raw $fSess | ConvertFrom-Json) } catch { return $null } }
  return $null
}
function Login-SF {
  if (-not (Test-Path $fCred)) {
    Fail 'Credenciais do Salesforce nao configuradas neste PC.' @{ precisa_configurar=$true; como="Rode uma vez: powershell -ExecutionPolicy Bypass -File `"$PSScriptRoot\Configurar-SF.ps1`"" }
  }
  $cred = Import-Clixml $fCred
  $user = $cred.UserName
  $pass = $cred.GetNetworkCredential().Password
  function XmlEsc($s){ $s -replace '&','&amp;' -replace '<','&lt;' -replace '>','&gt;' -replace '"','&quot;' }
  $body = @"
<?xml version="1.0" encoding="utf-8"?>
<env:Envelope xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:env="http://schemas.xmlsoap.org/soap/envelope/">
  <env:Body>
    <n1:login xmlns:n1="urn:partner.soap.sforce.com">
      <n1:username>$(XmlEsc $user)</n1:username>
      <n1:password>$(XmlEsc $pass)</n1:password>
    </n1:login>
  </env:Body>
</env:Envelope>
"@
  try {
    $r = Invoke-WebRequest -Uri "https://login.salesforce.com/services/Soap/u/$API" -Method Post -Body $body ` -ErrorAction Stop
          -ContentType 'text/xml; charset=UTF-8' -Headers @{ SOAPAction='login' } -UseBasicParsing -ErrorAction Stop -TimeoutSec 60
    $xml = [xml]$r.Content
    $res = $xml.Envelope.Body.loginResponse.result
    if (-not $res.sessionId) { throw 'resposta sem sessionId' }
  } catch {
    Fail "Sessao do Salesforce: relogin falhou. $($_.Exception.Message)" @{ relogin_falhou=$true }
  }
  $script:sess = [pscustomobject]@{ serverUrl=$res.serverUrl; sessionId=$res.sessionId; usuario=$res.userInfo.userName }
  @{ serverUrl=$res.serverUrl; sessionId=$res.sessionId; usuario=$res.userInfo.userName } | ConvertTo-Json | Set-Content $fSess -Encoding UTF8
  return $script:sess
}
function Sessao {
  if ($script:sess) { return $script:sess }
  $s = Ler-Sessao
  if ($s -and $s.sessionId -and $s.serverUrl) { $script:sess = $s; return $s }
  return (Login-SF)
}
function Chamar($rota) {
  $s = Sessao
  $inst = ([Uri]$s.serverUrl).GetLeftPart([UriPartial]::Authority)
  $hdr  = @{ Authorization = "Bearer $($s.sessionId)"; Accept = 'application/json' }
  try {
    return (Invoke-RestMethod -Uri "$inst$rota" -Headers $hdr -Method Get -TimeoutSec 60 -ErrorAction Stop)
  } catch {
    $code = 0; try { $code = [int]$_.Exception.Response.StatusCode.value__ } catch {}
    # 401 = INVALID_SESSION_ID. 403 = "Bad_OAuth_Token": e o que /services/oauth2/userinfo devolve
    # quando a sessao gravada expirou. Nos dois casos a saida e a mesma: relogar e repetir.
    if ($code -ne 401 -and $code -ne 403) { Fail "Consulta ao Salesforce falhou (HTTP $code): $($_.Exception.Message)" }
    $s = Login-SF
    $inst = ([Uri]$s.serverUrl).GetLeftPart([UriPartial]::Authority)
    $hdr  = @{ Authorization = "Bearer $($s.sessionId)"; Accept = 'application/json' }
    try { return (Invoke-RestMethod -Uri "$inst$rota" -Headers $hdr -Method Get -TimeoutSec 60 -ErrorAction Stop) }
    catch { Fail "Consulta ao Salesforce falhou mesmo apos relogin: $($_.Exception.Message)" }
  }
}
function Soql($q) { Chamar ("/services/data/v$API/query?q=" + [Uri]::EscapeDataString($q)) }

# ---------------- quem esta vendendo (utm_sellerId) ----------------
# A tela usa o Id do usuario SF logado. O "Selecionar unidade" da barra inferior grava
# a coligada escolhida em User.N_da_Coligada__c (ex.: 84 = FEBRACIS VITORIA 2).
$sellerId = $Vendedor
$sellerNome = ''
if (-not $sellerId) {
  $me = Chamar '/services/oauth2/userinfo'
  $sellerId   = "$($me.user_id)"
  $sellerNome = "$($me.name)"
} else {
  $u = Soql "SELECT Id, Name FROM User WHERE Id = '$(SoqlEsc $sellerId)'"
  if (-not $u.records -or @($u.records).Count -eq 0) { Fail "Usuario (vendedor) nao encontrado no Salesforce: $Vendedor" }
  $sellerId   = "$($u.records[0].Id)"
  $sellerNome = "$($u.records[0].Name)"
}

# ---------------- unidade selecionada ----------------
$codColigada = $Coligada
if ($codColigada -le 0) {
  $uq = Soql "SELECT Id, Name, N_da_Coligada__c FROM User WHERE Id = '$(SoqlEsc $sellerId)'"
  if ($uq.records -and @($uq.records).Count -gt 0) {
    $codColigada = 0
    $raw = $uq.records[0].N_da_Coligada__c
    if ($null -ne $raw -and "$raw" -ne '') { $codColigada = [int][double]$raw }
  }
}
$unidadeId = ''
$unidadeNome = '(sem unidade selecionada)'
if ($codColigada -gt 0) {
  $cq = Soql "SELECT Id, Name, CodigoColigada__c FROM Coligada__c WHERE CodigoColigada__c = $codColigada"
  if ($cq.records -and @($cq.records).Count -gt 0) {
    $unidadeId   = "$($cq.records[0].Id)"
    $unidadeNome = "$($cq.records[0].Name)"
  }
}
if ($Escopo -eq 'unidade' -and -not $unidadeId) {
  Fail "Nao consegui identificar a unidade do usuario no Salesforce." @{ como='Use -Coligada 84 (FEBRACIS VITORIA 2) ou selecione a unidade na barra inferior do Lightning.' }
}

# ---------------- -Item: entrega so a oferta ja escolhida ----------------
# A numeracao vem da ultima tabela listada, guardada em pegar-link-ultima.json.
$fCache = Join-Path $dir 'pegar-link-ultima.json'
if ($Cluster -gt 0) {
  if (-not (Test-Path $fCache)) {
    Fail "Nao tenho a lista anterior para achar o cluster $Cluster." @{ como='Rode o comando sem -Cluster primeiro, para listar os produtos.' }
  }
  $cc = $null
  try { $cc = Get-Content -Raw $fCache | ConvertFrom-Json } catch {}
  if (-not $cc -or -not $cc.clusters) {
    Fail 'Nao consegui ler a lista de produtos anterior.' @{ como='Rode o comando sem -Cluster para listar de novo.' }
  }
  $cl = @(@($cc.clusters) | Where-Object { [int]$_.n -eq $Cluster })
  if ($cl.Count -eq 0) {
    Fail "O cluster $Cluster nao esta na ultima lista (ela tem $(@($cc.clusters).Count) produtos)." @{ como='Rode o comando sem -Cluster para listar de novo.' }
  }
  $Produto = "$($cl[0].produto)"
}

if ($Item -gt 0) {
  if (-not (Test-Path $fCache)) {
    Fail "Nao tenho a lista anterior para achar o item $Item." @{ como='Rode o comando sem -Item primeiro, para listar as ofertas.' }
  }
  $cache = $null
  try { $cache = Get-Content -Raw $fCache | ConvertFrom-Json } catch {}
  if (-not $cache -or -not $cache.ofertas) {
    Fail 'Nao consegui ler a lista anterior.' @{ como='Rode o comando sem -Item para listar de novo.' }
  }
  $lista = @($cache.ofertas)
  $alvo  = @($lista | Where-Object { [int]$_.n -eq $Item })
  if ($alvo.Count -eq 0) {
    Fail "O item $Item nao esta na ultima lista (ela tem $($lista.Count) ofertas)." @{ como='Rode o comando sem -Item para listar de novo.' }
  }
  $alvo = $alvo[0]

  $check = Md5Hex $sellerId
  $src   = B64 $Origem
  $base  = "$($alvo.link_base)"
  $sep   = '?'
  if ($base.Contains('?')) { $sep = '&' }
  $link  = $base + $sep +
           "utm_sellerId=" + [Uri]::EscapeDataString($sellerId) +
           "&utm_sellerId_check=" + [Uri]::EscapeDataString($check) +
           "&utm_source_enc=" + [Uri]::EscapeDataString($src)
  # O bloco copiavel leva SO o link: a descricao fica no cabecalho, fora da area de copia.
  $texto = $link

  if ($Json) {
    Out-Json @{
      ok=$true; unidade=$unidadeNome; coligada=$codColigada; vendedor=$sellerNome; vendedor_id=$sellerId
      origem=$Origem; item=$Item; oferta=$alvo; link=$link; texto=$texto
    }
  }

  Write-Host ''
  Write-Host "  LINK DE PAGAMENTO - $($alvo.produto)" -ForegroundColor Cyan
  Write-Host "  $($alvo.oferta)  -  $(Moeda $alvo.valor)  -  $($alvo.tipo)" -ForegroundColor White
  Write-Host "  Unidade: $unidadeNome ($codColigada)   Vendedor: $sellerNome   Origem do lead: $Origem" -ForegroundColor DarkGray
  Write-Host ''
  Write-Host '  ---------- COPIAR E ENVIAR PARA O CONSULTOR ----------' -ForegroundColor Yellow
  Write-Host ''
  Write-Host $texto
  Write-Host ''
  Write-Host '  ------------------------------------------------------' -ForegroundColor Yellow
  Write-Host ''
  if ($Copiar) {
    try {
      Set-Clipboard -Value $texto
      Write-Host '  Copiado para a area de transferencia.' -ForegroundColor Green
      Write-Host ''
    } catch {
      Write-Host "  Nao consegui copiar para a area de transferencia: $($_.Exception.Message)" -ForegroundColor Yellow
      Write-Host ''
    }
  }
  exit 0
}

# ---------------- ofertas disponiveis ----------------
$onde = @()
$onde += "Ativo__c = true"
$onde += "LinkOriginalCheckout__c != null"
if ($Escopo -eq 'rede') {
  $onde += "Global__c = true"
} elseif ($Escopo -eq 'unidade') {
  $onde += "Global__c = false AND UnidadeGeradora__c = '$(SoqlEsc $unidadeId)'"
} else {
  if ($unidadeId) { $onde += "(Global__c = true OR UnidadeGeradora__c = '$(SoqlEsc $unidadeId)')" }
  else { $onde += "Global__c = true" }
}
if ($Busca)   { $onde += "Name LIKE '%$(SoqlEsc $Busca)%'" }
if ($Produto) { $onde += "Id IN (SELECT CheckoutCispay__c FROM ProdutoCheckoutCispay__c WHERE CodigoProduto__c = '$(SoqlEsc $Produto)')" }

$q = "SELECT Id, Name, Global__c, ValorCarrinho__c, LinkOriginalCheckout__c, UnidadeGeradora__r.Name, CreatedDate, " +
     "(SELECT CodigoProduto__c, Principal__c FROM Produtos__r) " +
     "FROM CheckoutCispay__c WHERE " + ($onde -join ' AND ') + " ORDER BY CreatedDate DESC"
$r = Soql $q

$total = [int]$r.totalSize
$regs  = @($r.records)
if ($regs.Count -eq 0) {
  if ($Json) { Out-Json @{ ok=$true; unidade=$unidadeNome; vendedor=$sellerNome; origem=$Origem; total=0; ofertas=@() } }
  Write-Host ''
  Write-Host "  Nenhuma oferta encontrada com esses filtros." -ForegroundColor Yellow
  Write-Host ''
  exit 0
}

$check = Md5Hex $sellerId
$src   = B64 $Origem

$linhas = @()
$i = 0
foreach ($o in $regs) {
  if ($Top -gt 0 -and $i -ge $Top) { break }
  $i++
  $prodPrincipal = ''
  $prods = @()
  if ($o.Produtos__r -and $o.Produtos__r.records) {
    foreach ($p in $o.Produtos__r.records) {
      $prods += "$($p.CodigoProduto__c)"
      if ($p.Principal__c -eq $true) { $prodPrincipal = "$($p.CodigoProduto__c)" }
    }
  }
  if (-not $prodPrincipal -and $prods.Count -gt 0) { $prodPrincipal = $prods[0] }

  $baseLink = "$($o.LinkOriginalCheckout__c)"
  $sep = '?'
  if ($baseLink.Contains('?')) { $sep = '&' }
  $link = $baseLink + $sep +
          "utm_sellerId=" + [Uri]::EscapeDataString($sellerId) +
          "&utm_sellerId_check=" + [Uri]::EscapeDataString($check) +
          "&utm_source_enc=" + [Uri]::EscapeDataString($src)

  $tipo = 'Minha unidade'
  if ($o.Global__c -eq $true) { $tipo = 'Rede Febracis' }
  $ger = ''
  if ($o.UnidadeGeradora__r) { $ger = "$($o.UnidadeGeradora__r.Name)" }

  $linhas += [pscustomobject]@{
    n         = $i
    id        = "$($o.Id)"
    produto   = $prodPrincipal
    produtos  = ($prods -join ', ')
    oferta    = "$($o.Name)"
    valor     = [double]$o.ValorCarrinho__c
    tipo      = $tipo
    geradora  = $ger
    link_base = $baseLink
    link      = $link
  }
}

# ---------------- agrupa em cluster: TIPO > PRODUTO (igual a arvore do painel) ----------------
# A unidade vem primeiro; dentro de cada tipo os produtos seguem a ordem em que aparecem
# (do checkout mais recente para o mais antigo), como na tela.
$ordenadas = @()
foreach ($tipoAlvo in @('Minha unidade','Rede Febracis')) {
  $doTipo = @($linhas | Where-Object { $_.tipo -eq $tipoAlvo })
  if ($doTipo.Count -eq 0) { continue }
  $ordemProd = @()
  foreach ($l in $doTipo) { if ($ordemProd -notcontains $l.produto) { $ordemProd += $l.produto } }
  foreach ($prod in $ordemProd) {
    foreach ($l in $doTipo) { if ($l.produto -eq $prod) { $ordenadas += $l } }
  }
}
$n = 0
foreach ($l in $ordenadas) { $n++; $l.n = $n }
$linhas = $ordenadas

# clusters numerados (produto + quantidade), na mesma ordem da arvore
$clusters = @()
$vistosC  = @()
foreach ($l in $linhas) {
  $chave = "$($l.tipo)|$($l.produto)"
  if ($vistosC -contains $chave) { continue }
  $vistosC += $chave
  $rotulo = $l.produto
  if (-not $rotulo) { $rotulo = '(sem produto)' }
  $clusters += [pscustomobject]@{
    n       = @($clusters).Count + 1
    produto = $rotulo
    tipo    = $l.tipo
    qtd     = @($linhas | Where-Object { $_.tipo -eq $l.tipo -and $_.produto -eq $l.produto }).Count
  }
}

# Guarda a lista para o -Item / -Cluster resolverem a escolha depois.
# Quando a rodada esta FILTRADA (abrindo um cluster), preserva a lista de produtos da
# rodada completa: senao a numeracao dos clusters passaria a valer so para o subconjunto.
$clustersSalvar = @($clusters)
if ($Busca -or $Produto -or $Detalhar) {
  if (Test-Path $fCache) {
    try {
      $ant = Get-Content -Raw $fCache | ConvertFrom-Json
      if ($ant -and $ant.clusters -and @($ant.clusters).Count -gt @($clusters).Count) {
        $clustersSalvar = @($ant.clusters)
      }
    } catch {}
  }
}
try {
  @{ unidade=$unidadeNome; coligada=$codColigada; vendedor_id=$sellerId; origem=$Origem; ofertas=@($linhas); clusters=@($clustersSalvar) } |
    ConvertTo-Json -Depth 6 | Set-Content $fCache -Encoding UTF8
} catch {}

if ($Json) {
  Out-Json @{
    ok=$true; unidade=$unidadeNome; coligada=$codColigada; vendedor=$sellerNome; vendedor_id=$sellerId
    origem=$Origem; total=$total; mostrando=@($linhas).Count; ofertas=@($linhas); clusters=@($clusters)
  }
}

# ---------------- saida: TABELA para escolher (sem os links) ----------------
Write-Host ''
Write-Host "  OFERTAS DISPONIVEIS - SALESFORCE" -ForegroundColor Cyan
Write-Host "  Unidade: $unidadeNome ($codColigada)   Vendedor: $sellerNome   Origem do lead: $Origem" -ForegroundColor DarkGray
if ($Busca -or $Produto -or $Escopo -ne 'todas') {
  $f = @()
  if ($Busca)   { $f += "busca=$Busca" }
  if ($Produto) { $f += "produto=$Produto" }
  if ($Escopo -ne 'todas') { $f += "escopo=$Escopo" }
  Write-Host "  Filtros: $($f -join '  |  ')" -ForegroundColor DarkGray
}
Write-Host ''

# Sem filtro nenhum: mostra so os CLUSTERS (produto + quantidade), para escolher.
# Com -Busca/-Produto/-Detalhar: abre as ofertas numeradas.
$mostrarClusters = (-not $Busca -and -not $Produto -and -not $Detalhar)

if ($mostrarClusters) {
  $fmtC = "  {0,4}  {1,-16} {2,7}   {3}"
  Write-Host ($fmtC -f '#','PRODUTO','OFERTAS','ONDE') -ForegroundColor DarkGray
  Write-Host ("  " + ('-' * 56)) -ForegroundColor DarkGray
  foreach ($c in $clusters) {
    $cor = 'Gray'
    if ($c.tipo -eq 'Minha unidade') { $cor = 'Green' }
    Write-Host ($fmtC -f $c.n, $c.produto, $c.qtd, $c.tipo) -ForegroundColor $cor
  }
  Write-Host ''
  Write-Host "  $(@($clusters).Count) produtos  |  $(@($linhas).Count) ofertas no total." -ForegroundColor DarkGray
  Write-Host "  Escolha o produto:  .\Pegar-Link-SF.ps1 -Cluster 2   (abre as ofertas numeradas do cluster)" -ForegroundColor Yellow
  Write-Host ''
  exit 0
}

$fmt = "      {0,4}  {1,-66} {2,15}"
$tipoAtual = ''
$prodAtual = ''
foreach ($l in $linhas) {
  if ($l.tipo -ne $tipoAtual) {
    $tipoAtual = $l.tipo
    $prodAtual = ''
    $qtdTipo = @($linhas | Where-Object { $_.tipo -eq $tipoAtual }).Count
    Write-Host ''
    Write-Host "  v $tipoAtual  ($qtdTipo)" -ForegroundColor Cyan
  }
  if ($l.produto -ne $prodAtual) {
    $prodAtual = $l.produto
    $qtdProd = @($linhas | Where-Object { $_.tipo -eq $tipoAtual -and $_.produto -eq $prodAtual }).Count
    $rotulo = $prodAtual
    if (-not $rotulo) { $rotulo = '(sem produto)' }
    Write-Host "    > $rotulo  ($qtdProd)" -ForegroundColor White
  }
  $nome = $l.oferta
  if ($nome.Length -gt 66) { $nome = $nome.Substring(0,63) + '...' }
  Write-Host ($fmt -f $l.n, $nome, (Moeda $l.valor)) -ForegroundColor Gray
}
Write-Host ''
Write-Host ''
Write-Host "  $(@($linhas).Count) ofertas listadas de $total encontradas." -ForegroundColor DarkGray
Write-Host "  Escolha o numero e rode:  .\Pegar-Link-SF.ps1 -Item <n>   (o link sai pronto, em bloco copiavel)" -ForegroundColor Yellow
Write-Host ''
