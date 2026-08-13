# Lancar-Vendas-SF.ps1
# Fluxo padronizado: relatorio de vendas do Salesforce -> lancamento no Zsales (ZS).
#
# TRES ETAPAS, nessa ordem (a previa NUNCA grava nada):
#   1) previa    -> le o .xls do SF, cruza com o ZS e gera o relatorio HTML de conferencia
#   2) cadastro  -> cria/completa os CLIENTES no ZS (so campo vazio; divergente nunca sobrescreve)
#   3) vendas    -> oportunidade + produto + pagamento + anotacoes + fecha como ganha
#
# USO:
#   .\Lancar-Vendas-SF.ps1 -Arquivo "C:\...\report1786560182019.xls"
#   .\Lancar-Vendas-SF.ps1 -Acao cadastro -Aplicar
#   .\Lancar-Vendas-SF.ps1 -Acao vendas   -Aplicar
#   (sem -Aplicar as etapas 2 e 3 so mostram o que fariam)
#
# A rodada fica em previas\rodada-<data>.json e as etapas seguintes usam a MAIS RECENTE
# quando -Rodada nao e informado.
#
# DEPENDENCIAS (na pasta acima): Ponte-SF.ps1 (leitura do SF) e Ponte-ZS.ps1 (cadastro no ZS).
# IMPORTANTE: salvar com BOM UTF-8.
param(
  [ValidateSet('previa','cadastro','vendas','status')][string]$Acao = 'previa',
  [string]$Arquivo = '',
  [string]$Venda   = '',            # venda avulsa: Id da Opportunity (006...) ou o link do Lightning
  [string]$Rodada  = '',            # NAO criar variavel local chamada $rodada: colide com este param
                                     # tipado (PS e case-insensitive) e o objeto vira string.
  [switch]$Aplicar,
  [switch]$Abrir,
  [int]$Org = 0
)
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ErrorActionPreference = 'Stop'

$RAIZ     = Split-Path -Parent $PSScriptRoot      # pasta do projeto (onde estao Ponte-SF/Ponte-ZS)
$PREVIAS  = Join-Path $PSScriptRoot 'previas'
$CFGFILE  = Join-Path $PSScriptRoot 'config.json'
if (-not (Test-Path $PREVIAS)) { New-Item -ItemType Directory -Path $PREVIAS | Out-Null }

# ============================ CONFIG ============================
$CFG = [ordered]@{
  org                   = 2
  responsavel_padrao_id = 28
  instituicao           = 'BCO ITAUBANK S.A.'
  gateway               = 'CISPay'
  funnel_stage_id       = 5000532
  texto_anotacao        = 'Anotação - Clientes que vieram do presencial.'
  texto_cashback        = 'Cliente fez uso do cashback no produto lançado. Segue o link do cashback.'
  turmas                = @{}     # de-para manual: "2026 - FCIS31" = @{ product_id=32; class_id=113 }
}
if (Test-Path $CFGFILE) {
  try {
    $j = Get-Content -Raw -Encoding UTF8 $CFGFILE | ConvertFrom-Json
    foreach ($p in $j.PSObject.Properties) { $CFG[$p.Name] = $p.Value }
  } catch { Write-Host "config.json invalido — usando os padroes." -ForegroundColor Yellow }
}
if ($Org -gt 0) { $CFG.org = $Org }
$ORG = [int]$CFG.org

# ============================ UTIL ============================
function OnlyDigits($s){ ("$s" -replace '\D','') }
function FmtCpf($d){ $d=OnlyDigits $d; if($d.Length -eq 11){ '{0}.{1}.{2}-{3}' -f $d.Substring(0,3),$d.Substring(3,3),$d.Substring(6,3),$d.Substring(9,2) } else { "$d" } }
function Esc($s){ ("$s" -replace '&','&amp;' -replace '<','&lt;' -replace '>','&gt;') }
function Vl($v){ if ($null -eq $v -or "$v".Trim() -eq '') { return '—' }; return (Esc $v) }
function Dt($iso){ if (-not $iso) { return '—' }; try { return ([datetime]$iso).ToString('dd/MM/yyyy') } catch { return '—' } }
function DtH($iso){ if (-not $iso) { return '—' }; try { return ([datetime]$iso).ToLocalTime().ToString('dd/MM/yyyy HH:mm') } catch { return '—' } }
function Mo($v){ if ($null -eq $v) { return '—' }; return ('BRL ' + ('{0:N2}' -f [Math]::Round([double]$v,2))) }
function R2($v){ return [Math]::Round([double]$v, 2) }
function Titulo($t){ Write-Host ''; Write-Host ("=" * 78); Write-Host "  $t"; Write-Host ("=" * 78) }
# Measure-Object -Property nao enxerga chave de hashtable (os itens da previa sao [ordered]@{}):
# somar na mao evita o "A propriedade valor nao pode ser encontrada".
function Somar($lista, $campo) { $s = 0.0; foreach ($x in @($lista)) { if ($null -ne $x) { $s += [double]$x.$campo } }; return $s }
# PEGADINHA: "$obj | ConvertTo-Json" com [ordered] enumera o dicionario e grava o ToString()
# ("System.Collections.Specialized.OrderedDictionary"). Usar -InputObject resolve.
function GravarJson($obj, $path) {
  $txt = ConvertTo-Json -InputObject $obj -Depth 14
  [IO.File]::WriteAllText($path, $txt, (New-Object Text.UTF8Encoding($false)))
}

# ============================ SALESFORCE (leitura) ============================
# Reusa a credencial ja configurada por Configurar-SF.ps1 (DPAPI em %LOCALAPPDATA%\MetaMaster).
$SF_API = '59.0'
$sfDir  = Join-Path $env:LOCALAPPDATA 'MetaMaster'
$sfCred = Join-Path $sfDir 'sf-creds.xml'
$sfSess = Join-Path $sfDir 'sf-session.json'
function SF-Login {
  if (-not (Test-Path $sfCred)) { throw "Credenciais do Salesforce nao configuradas. Rode: powershell -ExecutionPolicy Bypass -File `"$RAIZ\Configurar-SF.ps1`"" }
  $c = Import-Clixml $sfCred
  $u = $c.UserName; $p = $c.GetNetworkCredential().Password
  function XmlEsc($s){ $s -replace '&','&amp;' -replace '<','&lt;' -replace '>','&gt;' -replace '"','&quot;' }
  $body = @"
<?xml version="1.0" encoding="utf-8"?>
<env:Envelope xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:env="http://schemas.xmlsoap.org/soap/envelope/">
  <env:Body><n1:login xmlns:n1="urn:partner.soap.sforce.com"><n1:username>$(XmlEsc $u)</n1:username><n1:password>$(XmlEsc $p)</n1:password></n1:login></env:Body>
</env:Envelope>
"@
  $r = Invoke-WebRequest -Uri "https://login.salesforce.com/services/Soap/u/$SF_API" -Method Post -Body $body -ContentType 'text/xml; charset=UTF-8' -Headers @{ SOAPAction='login' } -UseBasicParsing
  $res = ([xml]$r.Content).Envelope.Body.loginResponse.result
  if (-not $res.sessionId) { throw 'Login no Salesforce nao devolveu sessao.' }
  @{ serverUrl=$res.serverUrl; sessionId=$res.sessionId } | ConvertTo-Json | Set-Content $sfSess -Encoding UTF8
  return [pscustomobject]@{ serverUrl=$res.serverUrl; sessionId=$res.sessionId }
}
function SF-Sessao { if (Test-Path $sfSess) { try { $s = Get-Content -Raw $sfSess | ConvertFrom-Json; if ($s.sessionId) { return $s } } catch {} }; return (SF-Login) }
function SF-Soql($q) {
  $s = SF-Sessao
  $inst = ([Uri]$s.serverUrl).GetLeftPart([UriPartial]::Authority)
  $hdr  = @{ Authorization="Bearer $($s.sessionId)"; Accept='application/json' }
  $uri  = "$inst/services/data/v$SF_API/query?q=" + [Uri]::EscapeDataString($q)
  try { $r = Invoke-RestMethod -Uri $uri -Headers $hdr }
  catch {
    $s = SF-Login
    $inst = ([Uri]$s.serverUrl).GetLeftPart([UriPartial]::Authority)
    $hdr  = @{ Authorization="Bearer $($s.sessionId)"; Accept='application/json' }
    $r = Invoke-RestMethod -Uri ("$inst/services/data/v$SF_API/query?q=" + [Uri]::EscapeDataString($q)) -Headers $hdr
  }
  $recs = @($r.records)
  while ($r -and -not $r.done -and $r.nextRecordsUrl) {
    $r = Invoke-RestMethod -Uri ($inst + $r.nextRecordsUrl) -Headers $hdr
    $recs += @($r.records)
  }
  return ,$recs
}
function SoqlEsc($s){ ("$s" -replace "\\","\\\\") -replace "'","\'" }

# ============================ ZSALES (MCP) ============================
function Get-ZsToken {
  $f = Join-Path $sfDir 'zs-token.txt'
  if (Test-Path $f) { $t = (Get-Content -Raw $f).Trim(); if ($t) { return $t } }
  foreach ($n in @('Lancar-Cliente.ps1','Buscar-Clientes-Vitoria.ps1')) {
    $p = Join-Path $RAIZ $n
    if (Test-Path $p) { $m = [regex]::Match((Get-Content -Raw $p), "Token\s*=\s*'(mcp_[^']+)'"); if ($m.Success) { return $m.Groups[1].Value } }
  }
  throw 'Token do Zsales nao encontrado.'
}
# PEGADINHA: quando a tool devolve VARIOS registros, o MCP manda os objetos JSON
# concatenados no MESMO texto ("{...}\n{...}"). ConvertFrom-Json do PS 5.1 engasga e o
# resultado vinha VAZIO sem erro (foi o que escondeu as turmas do FCIS 31).
# Aqui separamos os objetos contando chaves fora de string.
function Split-Json($texto) {
  $t = "$texto".Trim()
  if (-not $t) { return @() }
  if ($t -notmatch '^\s*[\{\[]') { return @($t) }        # nao e JSON (mensagem de erro)
  $blocos = @(); $ini = -1; $prof = 0; $emStr = $false; $escape = $false
  for ($i = 0; $i -lt $t.Length; $i++) {
    $ch = $t[$i]
    if ($emStr) {
      if ($escape) { $escape = $false }
      elseif ($ch -eq '\') { $escape = $true }
      elseif ($ch -eq '"') { $emStr = $false }
      continue
    }
    if ($ch -eq '"') { $emStr = $true; continue }
    if ($ch -eq '{' -or $ch -eq '[') { if ($prof -eq 0) { $ini = $i }; $prof++; continue }
    if ($ch -eq '}' -or $ch -eq ']') {
      $prof--
      if ($prof -eq 0 -and $ini -ge 0) { $blocos += $t.Substring($ini, $i - $ini + 1); $ini = -1 }
    }
  }
  if ($blocos.Count -eq 0) { $blocos = @($t) }
  return $blocos
}

$script:zsH = $null
function ZS-Init {
  if ($script:zsH) { return }
  $tok = Get-ZsToken
  $base = @{ Authorization="Bearer $tok"; Accept='application/json, text/event-stream' }
  $ri = Invoke-WebRequest -Uri 'https://mcp.zsales.com.br/mcp' -Method Post -Headers $base -ContentType 'application/json' `
        -Body '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"lancamentos-zs","version":"1"}}}' -UseBasicParsing
  $sid = $ri.Headers['Mcp-Session-Id']; if ($sid -is [array]) { $sid = $sid[0] }
  $h = $base.Clone(); $h['Mcp-Session-Id'] = $sid
  Invoke-WebRequest -Uri 'https://mcp.zsales.com.br/mcp' -Method Post -Headers $h -ContentType 'application/json' -Body '{"jsonrpc":"2.0","method":"notifications/initialized"}' -UseBasicParsing | Out-Null
  $script:zsH = $h
}
function ZS($tool, $argsObj) {
  ZS-Init
  if (-not $argsObj.ContainsKey('organization_id')) { $argsObj['organization_id'] = $ORG }
  $call = [ordered]@{ jsonrpc='2.0'; id=2; method='tools/call'; params=[ordered]@{ name=$tool; arguments=$argsObj } }
  $b = [Text.Encoding]::UTF8.GetBytes(($call | ConvertTo-Json -Depth 14 -Compress))
  try { $rc = Invoke-WebRequest -Uri 'https://mcp.zsales.com.br/mcp' -Method Post -Headers $script:zsH -ContentType 'application/json' -Body $b -UseBasicParsing }
  catch { return [pscustomobject]@{ __erro = $_.Exception.Message } }
  $txt = [Text.Encoding]::UTF8.GetString($rc.RawContentStream.ToArray())
  $linha = ($txt -split "`n" | Where-Object { $_ -like 'data: *' } | Select-Object -First 1)
  if (-not $linha) { return [pscustomobject]@{ __erro = 'resposta vazia do MCP' } }
  $p = $linha.Substring(6) | ConvertFrom-Json
  if ($p.error) { return [pscustomobject]@{ __erro = $p.error.message } }
  $itens = @()
  foreach ($x in $p.result.content) {
    foreach ($bloco in (Split-Json $x.text)) {
      try { $o = $bloco | ConvertFrom-Json } catch { $itens += [pscustomobject]@{ __erro = ($bloco -replace '^Error executing tool [a-z_]+:\s*','') }; continue }
      if ($o.PSObject.Properties.Name -contains 'results') { foreach ($r in $o.results) { $itens += $r } }
      else { $itens += $o }
    }
  }
  # SEM a virgula: quem chama usa @(ZS ...). Com "return ,$itens" o @() enxerga UM elemento
  # (o array inteiro) e a lista vira 1 item — foi o que escondeu as turmas do FCIS 31.
  return $itens
}
function ZS1($tool, $argsObj) { $r = @(ZS $tool $argsObj); if ($r.Count) { return $r[0] }; return $null }

# ---- API REST web: para o que o MCP nao permite (excluir pagamento, editar item/nota) ----
$script:webTok = $null
function Web-Token {
  if ($script:webTok) { return $script:webTok }
  $f = Join-Path $RAIZ 'sc-web-auth.json'
  if (-not (Test-Path $f)) { throw 'sc-web-auth.json ausente (necessario para a API web).' }
  $c = Get-Content -Raw -Encoding UTF8 $f | ConvertFrom-Json
  $l = Invoke-RestMethod -Uri 'https://api.zsales.com.br/api/auth/login/' -Method Post -ContentType 'application/json' -Body (@{ email=$c.email; password=$c.password } | ConvertTo-Json) -TimeoutSec 25
  $script:webTok = $l.access
  return $script:webTok
}
function Web-Get($path) {
  $h = @{ Authorization = "Bearer $(Web-Token)"; 'X-Organization-Id' = "$ORG" }
  try { return Invoke-RestMethod -Uri "https://api.zsales.com.br$path" -Headers $h -TimeoutSec 30 } catch { return $null }
}
# Vendas ja existentes DO CLIENTE. O MCP nao filtra por cliente (e o limit dele e 100),
# entao a checagem de duplicidade vai pela API web, que filtra direto.
function Vendas-Do-Cliente($cid) {
  if ([int]$cid -le 0) { return @() }
  $r = Web-Get "/api/opportunities/?customer=$([int]$cid)"
  if (-not $r) { return @() }
  return @($r.results)
}

# ============================ RELATORIO DO SF (.xls) ============================
# O "xls" exportado pelo Salesforce e, na verdade, uma TABELA HTML em ISO-8859-1.
function Ler-Relatorio($path) {
  if (-not (Test-Path $path)) { throw "Arquivo nao encontrado: $path" }
  $html = [IO.File]::ReadAllText($path, [Text.Encoding]::GetEncoding('ISO-8859-1'))
  function Limpa($s) { $t = $s -replace '<[^>]+>',''; $t = [System.Net.WebUtility]::HtmlDecode($t); ($t -replace '\s+',' ').Trim() }
  $linhas = @()
  foreach ($tr in [regex]::Matches($html, '(?is)<tr[^>]*>(.*?)</tr>')) {
    $cels = @()
    foreach ($c in [regex]::Matches($tr.Groups[1].Value, '(?is)<t[hd][^>]*>(.*?)</t[hd]>')) { $cels += (Limpa $c.Groups[1].Value) }
    if ($cels.Count -gt 0) { $linhas += ,$cels }
  }
  if ($linhas.Count -lt 2) { throw 'Nao encontrei linhas no relatorio. Exporte como "Detalhes apenas" (.xls).' }
  $cab = $linhas[0]
  $obrig = @('Nome do cliente','CPF','Turma','Nome da venda')
  foreach ($o in $obrig) {
    if (-not ($cab | Where-Object { $_ -like "*$o*" })) { throw "O relatorio nao tem a coluna '$o'. Colunas: $($cab -join ' | ')" }
  }
  function Col($arr, $nome) { for ($i=0; $i -lt $cab.Count; $i++) { if ($cab[$i] -like "*$nome*") { if ($i -lt $arr.Count) { return $arr[$i] } } }; return '' }
  $out = @()
  for ($r=1; $r -lt $linhas.Count; $r++) {
    $l = $linhas[$r]
    if (@($l | Where-Object { $_ -ne '' }).Count -eq 0) { continue }
    $cpf = OnlyDigits (Col $l 'CPF')
    if ($cpf.Length -ne 11) { continue }
    $out += [pscustomobject]@{
      nome       = (Col $l 'Nome do cliente')
      cpf        = $cpf
      telefone   = (Col $l 'Telefone')
      turma      = (Col $l 'Turma')
      venda_nome = (Col $l 'Nome da venda')
      valor_rel  = (Col $l 'Valor')
      criado     = (Col $l 'Data de cria')
    }
  }
  if ($out.Count -eq 0) { throw 'Nenhuma linha com CPF valido no relatorio.' }
  return ,$out
}

# ---- venda avulsa: mesma estrutura do relatorio, lida direto da Opportunity ----
# Aceita o Id (006...) ou o link do Lightning (.../Opportunity/<id>/view).
function Ler-VendaSF($idOuUrl) {
  $id = "$idOuUrl".Trim()
  $m = [regex]::Match($id, '(006[A-Za-z0-9]{12,15})')
  if (-not $m.Success) { throw "Nao reconheci o Id da venda em '$idOuUrl' (esperado 006... ou o link do Salesforce)." }
  $id = $m.Groups[1].Value
  $recs = SF-Soql ("SELECT Id, Name, StageName, Amount, CloseDate, Account.Name, Account.CPFun__c, Account.PersonMobilePhone " +
                   "FROM Opportunity WHERE Id = '$(SoqlEsc $id)'")
  if (@($recs).Count -eq 0) { throw "Venda $id nao encontrada no Salesforce (ou sem acesso)." }
  $o = @($recs)[0]
  $cpf = OnlyDigits $o.Account.CPFun__c
  if ($cpf.Length -ne 11) { throw "O cliente '$($o.Account.Name)' esta sem CPF valido no Salesforce — cadastre antes de lancar." }
  # a turma sai da Forma de Pag. Venda (campo Turma__c), que e o mesmo que o relatorio traz
  $fs = SF-Soql "SELECT Turma__c FROM Forma_Pag_Venda__c WHERE Venda__c = '$(SoqlEsc $id)' AND Turma__c != null LIMIT 1"
  $turma = $(if (@($fs).Count) { "$(@($fs)[0].Turma__c)" } else { '' })
  if (-not $turma) { throw "Nao achei a turma na Forma de Pag. Venda de '$($o.Name)'." }
  return ,@([pscustomobject]@{
    nome       = "$($o.Account.Name)"
    cpf        = $cpf
    telefone   = "$($o.Account.PersonMobilePhone)"
    turma      = $turma
    venda_nome = "$($o.Name)"
    valor_rel  = "$($o.Amount)"
    criado     = "$($o.CloseDate)"
  })
}

# ============================ FORMAS DE PAGAMENTO (anexo 1) ============================
$FPV_CAMPOS = "Id, Name, RecordType.Name, Unidade__r.Name, Forma_de_Pagamento__r.Name, Valor_cada_Parcela__c, " +
              "Data_de_Vencimento_Inicial__c, DataContrato__c, EmailCliente__c, Promocao__c, Id_Form_Pag_Completo__c, " +
              "Payment_Id__c, Venda__c, Venda__r.Name, Venda__r.Amount, Venda__r.CloseDate, Parcelas__c, Valor__c, " +
              "ResponsavelFinanceiro__r.Name, CPF_do_Respons_vel__c, MoedaTexto__c, MoedaNumero__c, Status__c, CreatedDate, Turma__c"
function Formas-Da-Venda($nomes) {
  $lista = ($nomes | ForEach-Object { "'" + (SoqlEsc $_) + "'" }) -join ','
  return ,(SF-Soql "SELECT $FPV_CAMPOS FROM Forma_Pag_Venda__c WHERE Venda__r.Name IN ($lista) ORDER BY Venda__r.Name, CreatedDate")
}
function Metodo-Zs($nomeForma) {
  if ($nomeForma -match '(?i)cart(a|ã)o de cr(e|é)dito') { return 'Cartão de crédito' }
  if ($nomeForma -match '(?i)cart(a|ã)o de d(e|é)bito')  { return 'Cartão de débito' }
  if ($nomeForma -match '(?i)^pix')                      { return 'PIX' }
  if ($nomeForma -match '(?i)boleto')                    { return 'Boleto' }
  if ($nomeForma -match '(?i)dinheiro')                  { return 'Dinheiro' }
  return ''
}
function E-Cashback($nomeForma) { return ("$nomeForma" -match '(?i)cashback') }

# ============================ TURMA: SF -> ZS ============================
# "2026 - FCIS31" -> sigla FCIS + numero 31 -> procura "FCIS 31" nas turmas do produto.
function Resolver-Turma($turmaSf) {
  $chave = "$turmaSf".Trim()
  # 1) de-para manual do config.json vence sempre
  if ($CFG.turmas -and $CFG.turmas.PSObject.Properties.Name -contains $chave) {
    $m = $CFG.turmas.$chave
    return [ordered]@{ ok=$true; product_id=[int]$m.product_id; class_id=[int]$m.class_id; class_name="$($m.class_name)"; origem='config.json' }
  }
  $t = ($chave -replace '^\s*\d{4}\s*-\s*','').Trim()          # tira o "2026 - "
  # lazy + hifen: separa "BHP19"->BHP/19, "FCIS31"->FCIS/31 e tambem "CIS-GL252"->CIS-GL/252
  $m = [regex]::Match($t, '^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\-]*?)\s*-?\s*(\d+)')
  if (-not $m.Success) { return [ordered]@{ ok=$false; motivo="Nao consegui separar sigla/numero de '$turmaSf'." } }
  $sigla = $m.Groups[1].Value.ToUpper().TrimEnd('-'); $num = $m.Groups[2].Value

  # apelidos: a sigla do SF nem sempre e a do ZS (ex.: CIS-GL252 no SF = MCIS 252 no ZS,
  # produto "Método CIS - Global" — cujo nome nem contem "MCIS", por isso o product_id vem junto)
  $prodFixo = 0
  if ($CFG.siglas -and $CFG.siglas.PSObject.Properties.Name -contains $sigla) {
    $ap = $CFG.siglas.$sigla
    if ($ap.turma)      { $sigla = "$($ap.turma)".ToUpper() }
    if ($ap.product_id) { $prodFixo = [int]$ap.product_id }
  }
  $busca = "$sigla $num"
  $prods = if ($prodFixo -gt 0) { @([pscustomobject]@{ id=$prodFixo; name="(config) produto $prodFixo" }) }
           else { @(ZS 'search_opportunity_products' @{ query=$sigla; limit=10 }) }
  $cands = @()
  foreach ($p in $prods) {
    if ($p.__erro -or -not $p.id) { continue }
    $cls = @(ZS 'search_opportunity_product_classes' @{ product_id=[int]$p.id; query=$busca; limit=10 })
    foreach ($c in $cls) {
      if ($c.__erro -or -not $c.id) { continue }
      $nome = "$($c.name)"
      # exige o numero exato: "FCIS 3" nao pode casar com "FCIS 31"
      if ($nome -notmatch "(?i)$sigla\s*$num(\D|$)") { continue }
      $cands += [ordered]@{ product_id=[int]$p.id; product_name="$($p.name)"; class_id=[int]$c.id; class_name=$nome; start=$c.start_date }
    }
  }
  if ($cands.Count -eq 0) { return [ordered]@{ ok=$false; motivo="Nenhuma turma '$busca' encontrada no ZS (produto/turma pode nao existir ainda)." } }
  if ($cands.Count -eq 1) { $c = $cands[0]; return [ordered]@{ ok=$true; product_id=$c.product_id; class_id=$c.class_id; class_name=$c.class_name; origem='automatico' } }
  # varias: so decide sozinho quando a diferenca e o MODULO (1o vence); senao pergunta
  $prim = @($cands | Where-Object { "$($_.class_name)" -match '(?i)1\s*(º|o|°)?\s*m(ó|o)dulo' })
  if ($prim.Count -eq 1) {
    $c = $prim[0]
    return [ordered]@{ ok=$true; product_id=$c.product_id; class_id=$c.class_id; class_name=$c.class_name; origem='1o modulo'; alternativas=$cands }
  }
  return [ordered]@{ ok=$false; ambigua=$true; motivo="Mais de uma turma casa com '$busca' — escolha no config.json."; alternativas=$cands }
}

# ============================ ANOTACOES ============================
function Bloco-Forma($c) {
  $link = "https://febracis.lightning.force.com/lightning/r/Forma_Pag_Venda__c/$($c.Id)/view"
  $h = "<p><strong><a href=`"$link`">$(Esc $c.Name) — $(Mo $c.Valor__c)</a></strong></p>" +
       "<p><strong>Informações do anexo 1 (Forma de Pag. Venda):</strong></p><ul>" +
       "<li>Nome de Forma Pag. Venda: $(Vl $c.Name)</li>" +
       "<li>Tipo de registro: $(Vl $c.RecordType.Name)</li>" +
       "<li>Venda: $(Vl $c.Venda__r.Name)</li>" +
       "<li>Unidade Realizadora do Curso: $(Vl $c.Unidade__r.Name)</li>" +
       "<li>Forma de Pagamento: $(Vl $c.Forma_de_Pagamento__r.Name)</li>" +
       "<li>Parcelas: $([int]$c.Parcelas__c)</li>" +
       "<li>Valor: $(Mo $c.Valor__c)</li>" +
       "<li>Valor em cada Parcela: $(Mo $c.Valor_cada_Parcela__c)</li>" +
       "<li>Responsável financeiro: $(Vl $c.ResponsavelFinanceiro__r.Name)</li>" +
       "<li>CPF do Responsável: $(Vl $c.CPF_do_Respons_vel__c)</li>" +
       "<li>Data de Vencimento Inicial: $(Dt $c.Data_de_Vencimento_Inicial__c)</li>" +
       "<li>Data da Matrícula: $(DtH $c.DataContrato__c)</li>" +
       "<li>E-mail Cliente: $(Vl $c.EmailCliente__c)</li>" +
       "<li>Promoção: $(Vl $c.Promocao__c)</li>" +
       "<li>Moeda Texto: $(Vl $c.MoedaTexto__c) — Moeda Numero: $(if($null -ne $c.MoedaNumero__c){[int]$c.MoedaNumero__c}else{'—'})</li>" +
       "<li>Status: $(Vl $c.Status__c)</li>" +
       "<li>Data de criação: $(DtH $c.CreatedDate)</li>"
  if ($c.Payment_Id__c) { $h += "<li>Payment Id: $(Vl $c.Payment_Id__c)</li>" }
  $h += "<li>Id Form Pag Completo: $(Vl $c.Id_Form_Pag_Completo__c)</li></ul>"
  return $h
}
function Nota-Principal($formas, $turmaSf) {
  $v = $formas[0].Venda__r
  $link = "https://febracis.lightning.force.com/lightning/r/Opportunity/$($formas[0].Venda__c)/view"
  $h = "<p><strong>$(Esc $CFG.texto_anotacao)</strong></p><p>Venda no Salesforce: <a href=`"$link`">$(Esc $v.Name)</a></p>"
  foreach ($f in $formas) { $h += (Bloco-Forma $f) }
  $h += "<p>Total da venda no Salesforce: <strong>$(Mo $v.Amount)</strong> — Turma: $(Vl $turmaSf) — Fechamento: $(Dt $v.CloseDate)</p>"
  return $h
}
function Nota-Cashback($cb) { return ("<p><strong>$(Esc $CFG.texto_cashback)</strong></p>" + (Bloco-Forma $cb)) }

# ============================ PREVIA (HTML) ============================
function Gerar-Html($rod, $path) {
  $linhas = ''
  foreach ($it in $rod.itens) {
    $cls = if ($it.bloqueios.Count) { 'bloq' } elseif ($it.ja_lancada) { 'ok' } else { '' }
    $blo = if ($it.bloqueios.Count) { ($it.bloqueios | ForEach-Object { Esc $_ }) -join '<br>' } else { '—' }
    $linhas += "<tr class=`"$cls`">" +
      "<td>$(Esc $it.nome_zs)</td>" +
      "<td>$(Esc $it.turma_sf)<br><small>$(Esc $it.turma_zs)</small></td>" +
      "<td class=`"num`">$('{0:N2}' -f [double]$it.valor)</td>" +
      "<td>$(Esc $it.metodo)$(if($it.parcelas -gt 1){" $($it.parcelas)x"}else{''})</td>" +
      "<td class=`"num`">$(if($it.cashback -gt 0){'{0:N2}' -f [double]$it.cashback}else{'—'})</td>" +
      "<td>$(Esc $it.responsavel)</td>" +
      "<td>$(if($it.cliente_id -gt 0){"existe ($($it.cliente_id))"}else{'CRIAR'})</td>" +
      "<td>$(if($it.ja_lancada){"JÁ LANÇADA ($($it.opp_id))"}else{'a lançar'})</td>" +
      "<td>$blo</td></tr>"
  }
  $tot = Somar $rod.itens 'valor'
  $nBloq = @($rod.itens | Where-Object { $_.bloqueios.Count }).Count
  $nJa   = @($rod.itens | Where-Object { $_.ja_lancada }).Count
  $html = @"
<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Prévia de lançamentos — $($rod.gerado_em)</title>
<style>
 body{font:14px/1.5 system-ui,Segoe UI,Arial;margin:24px;color:#111;background:#fff}
 h1{font-size:20px;margin:0 0 4px} .sub{color:#666;margin-bottom:18px}
 table{border-collapse:collapse;width:100%;font-size:13px}
 th,td{border:1px solid #ddd;padding:6px 8px;vertical-align:top}
 th{background:#f4f4f5;text-align:left;position:sticky;top:0}
 .num{text-align:right;white-space:nowrap}
 tr.bloq{background:#fff5f5} tr.ok{background:#f5faf5;color:#666}
 .cards{display:flex;gap:12px;margin:14px 0 20px;flex-wrap:wrap}
 .card{border:1px solid #ddd;border-radius:8px;padding:10px 14px;min-width:130px}
 .card b{display:block;font-size:20px} small{color:#666}
 .aviso{border-left:4px solid #e11;background:#fff5f5;padding:10px 14px;margin:14px 0}
</style></head><body>
<h1>Prévia de lançamentos — Salesforce → Zsales</h1>
<div class="sub">Arquivo: $(Esc $rod.arquivo) · Unidade: org $($rod.org) · Gerado em $($rod.gerado_em) · <strong>nada foi gravado</strong></div>
<div class="cards">
  <div class="card"><b>$($rod.itens.Count)</b><small>vendas no relatório</small></div>
  <div class="card"><b>$('{0:N2}' -f [double]$tot)</b><small>total a lançar (R$)</small></div>
  <div class="card"><b>$nJa</b><small>já lançadas antes</small></div>
  <div class="card"><b>$nBloq</b><small>com bloqueio</small></div>
</div>
$(if ($nBloq) { "<div class=`"aviso`"><strong>$nBloq linha(s) com bloqueio.</strong> Resolva antes de aplicar — elas não serão lançadas.</div>" })
<table><thead><tr>
<th>Cliente</th><th>Turma (SF / ZS)</th><th>Valor</th><th>Pagamento</th><th>Cashback</th>
<th>Responsável</th><th>Cadastro</th><th>Venda</th><th>Bloqueios</th>
</tr></thead><tbody>$linhas</tbody></table>
<p class="sub" style="margin-top:18px">Próximos passos:<br>
1) <code>.\Lancar-Vendas-SF.ps1 -Acao cadastro -Aplicar</code><br>
2) <code>.\Lancar-Vendas-SF.ps1 -Acao vendas -Aplicar</code></p>
</body></html>
"@
  [IO.File]::WriteAllText($path, $html, (New-Object Text.UTF8Encoding($false)))
}

function Rodada-Recente {
  $f = Get-ChildItem -Path $PREVIAS -Filter 'rodada-*.json' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $f) { throw "Nenhuma rodada encontrada. Rode primeiro: .\Lancar-Vendas-SF.ps1 -Arquivo <relatorio.xls>" }
  return $f.FullName
}
function Ler-Rodada { if ($Rodada) { if (-not (Test-Path $Rodada)) { throw "Rodada nao encontrada: $Rodada" }; return $Rodada } ; return (Rodada-Recente) }

# ============================ ACAO: STATUS ============================
if ($Acao -eq 'status') {
  Titulo 'STATUS DO AMBIENTE'
  Write-Host ("Salesforce : " + $(try { $s = SF-Sessao; $n = @(SF-Soql "SELECT Id FROM Account LIMIT 1"); 'OK' } catch { "FALHOU — $($_.Exception.Message)" }))
  Write-Host ("Zsales     : " + $(try { $u = @(ZS 'list_users' @{ limit=1 }); if ($u -and -not $u[0].__erro) { "OK (org $ORG)" } else { "FALHOU — $($u[0].__erro)" } } catch { "FALHOU — $($_.Exception.Message)" }))
  Write-Host ("API web    : " + $(try { $t = Web-Token; if ($t) { 'OK' } else { 'sem token' } } catch { "indisponivel — $($_.Exception.Message)" }))
  Write-Host ("Config     : $CFGFILE " + $(if (Test-Path $CFGFILE) { '(carregado)' } else { '(usando padroes)' }))
  Write-Host ("Previas    : $PREVIAS")
  exit 0
}

# ============================ ACAO: PREVIA ============================
if ($Acao -eq 'previa') {
  if (-not $Arquivo -and -not $Venda) {
    $ult = Get-ChildItem "$env:USERPROFILE\Downloads" -Filter 'report*.xls' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($ult) { $Arquivo = $ult.FullName; Write-Host "Usando o relatorio mais recente de Downloads: $($ult.Name)" -ForegroundColor Cyan }
    else { throw 'Informe -Arquivo "<relatorio .xls>" ou -Venda "<link/Id da venda no SF>".' }
  }
  Titulo 'ETAPA 1 — LEITURA E CONFERENCIA (nada e gravado)'
  if ($Venda) {
    $rel = Ler-VendaSF $Venda
    $Arquivo = "venda avulsa: $($rel[0].venda_nome)"
    Write-Host "Venda avulsa: $($rel[0].venda_nome)"
  } else {
    $rel = Ler-Relatorio $Arquivo
    Write-Host "Relatorio: $($rel.Count) venda(s)."
  }

  Write-Host 'Lendo as formas de pagamento no Salesforce...'
  $formasTodas = Formas-Da-Venda @($rel | ForEach-Object { $_.venda_nome })

  Write-Host 'Conferindo cadastros e vendas no Zsales...'

  $itens = @()
  foreach ($r in $rel) {
    $bloq = @()
    $formas = @($formasTodas | Where-Object { $_.Venda__r.Name -eq $r.venda_nome })
    if ($formas.Count -eq 0) { $bloq += "Sem 'Forma de Pag. Venda' no Salesforce para '$($r.venda_nome)'." }
    $pgto = @($formas | Where-Object { (Metodo-Zs $_.Name) -ne '' -and -not (E-Cashback $_.Name) })
    $cbs  = @($formas | Where-Object { E-Cashback $_.Name })
    if ($formas.Count -gt 0 -and $pgto.Count -eq 0) { $bloq += 'Nenhuma forma de pagamento reconhecida (cartao/pix/boleto).' }

    # cliente no ZS (as 3 unidades, para avisar de cadastro em outra)
    $cli = $null; $outras = @()
    foreach ($oid in 1,2,3) {
      $achado = @(ZS 'list_customers' @{ search=$r.cpf; limit=3; organization_id=$oid } | Where-Object { $_.id })
      if ($achado.Count -eq 0) { continue }
      if ($oid -eq $ORG) { $cli = $achado[0] } else { $outras += "org $oid (id $($achado[0].id))" }
    }
    $resp = ''; $respId = [int]$CFG.responsavel_padrao_id; $endOk = $false
    if ($cli) {
      $det = ZS1 'get_customer' @{ customer_id=[int]$cli.id }
      if ($det -and -not $det.__erro) {
        if ($det.assignee_name) { $resp = $det.assignee_name }
        if ($det.assignee_user_id) { $respId = [int]$det.assignee_user_id }
        $endOk = [bool]($det.address_street -and $det.address_city -and $det.address_state)
      }
    }
    if (-not $resp) { $resp = '(padrão) id ' + $CFG.responsavel_padrao_id }

    # turma
    $t = Resolver-Turma $r.turma
    if (-not $t.ok) {
      $msg = $t.motivo
      if ($t.alternativas) { $msg += ' Opções: ' + (($t.alternativas | ForEach-Object { "$($_.class_name) [product $($_.product_id) / class $($_.class_id)]" }) -join ' · ') }
      $bloq += $msg
    }

    $nomeAlvo = $(if ($cli) { "$($cli.name)" } else { $r.nome })
    $valor = R2 $(if ($pgto.Count) { $pgto[0].Valor__c } else { 0 })

    # ja lancada? mesma turma OU mesmo valor no cliente = nao lancar de novo
    $ja = $null
    if ($cli) {
      foreach ($v in (Vendas-Do-Cliente $cli.id)) {
        if ([Math]::Abs([double]$v.value - $valor) -lt 0.01) { $ja = $v; break }
        if ($t.ok -and $v.products) {
          foreach ($pp in $v.products) { if ([int]$pp.class_ref -eq [int]$t.class_id) { $ja = $v; break } }
          if ($ja) { break }
        }
      }
    }
    if ($valor -le 0 -and $bloq.Count -eq 0) { $bloq += 'Valor zerado — confira o relatorio.' }

    $itens += [ordered]@{
      nome_rel   = $r.nome
      nome_zs    = $nomeAlvo
      cpf        = $r.cpf
      cpf_fmt    = (FmtCpf $r.cpf)
      turma_sf   = $r.turma
      turma_zs   = $(if ($t.ok) { "$($t.class_name) [$($t.origem)]" } else { '—' })
      product_id = $(if ($t.ok) { [int]$t.product_id } else { 0 })
      class_id   = $(if ($t.ok) { [int]$t.class_id } else { 0 })
      venda_nome = $r.venda_nome
      valor      = $valor
      metodo     = $(if ($pgto.Count) { Metodo-Zs $pgto[0].Name } else { '' })
      parcelas   = $(if ($pgto.Count) { [int]$pgto[0].Parcelas__c } else { 0 })
      pago_em    = $(if ($pgto.Count) { ([datetime]$pgto[0].CreatedDate).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ') } else { '' })
      close_date = $(if ($formas.Count) { ([datetime]$formas[0].Venda__r.CloseDate).ToString('yyyy-MM-dd') } else { '' })
      cashback   = $(if ($cbs.Count) { R2 $cbs[0].Valor__c } else { 0 })
      cashback_id= $(if ($cbs.Count) { "$($cbs[0].Id)" } else { '' })
      cliente_id = $(if ($cli) { [int]$cli.id } else { 0 })
      outras_orgs= $outras
      responsavel= $resp
      resp_id    = $respId
      endereco_ok= $endOk
      ja_lancada = [bool]$ja
      opp_id     = $(if ($ja) { [int]$ja.id } else { 0 })
      bloqueios  = $bloq
    }
    Write-Host ("  · {0,-38} {1,-14} R$ {2,10:N2}  {3}" -f $r.nome, $r.turma, $valor, $(if ($bloq.Count) { "BLOQUEIO: $($bloq[0])" } elseif ($ja) { 'ja lancada' } else { 'ok' }))
  }

  $carimbo = (Get-Date).ToString('yyyy-MM-dd-HHmm')
  $rod = [ordered]@{
    gerado_em = (Get-Date).ToString('dd/MM/yyyy HH:mm')
    arquivo   = $Arquivo
    org       = $ORG
    itens     = $itens
  }
  $jsonPath = Join-Path $PREVIAS "rodada-$carimbo.json"
  $htmlPath = Join-Path $PREVIAS "previa-$carimbo.html"
  GravarJson $rod $jsonPath
  Gerar-Html $rod $htmlPath

  $nBloq = @($itens | Where-Object { $_.bloqueios.Count }).Count
  $nJa   = @($itens | Where-Object { $_.ja_lancada }).Count
  $nNovo = @($itens | Where-Object { -not $_.bloqueios.Count -and -not $_.ja_lancada }).Count
  Titulo 'RESUMO DA PREVIA'
  Write-Host ("  vendas no relatorio : {0}" -f $itens.Count)
  Write-Host ("  a lancar            : {0}  (R$ {1:N2})" -f $nNovo, (Somar (@($itens | Where-Object { -not $_.bloqueios.Count -and -not $_.ja_lancada })) 'valor'))
  Write-Host ("  ja lancadas         : {0}" -f $nJa)
  Write-Host ("  com bloqueio        : {0}" -f $nBloq) -ForegroundColor $(if ($nBloq) { 'Yellow' } else { 'Gray' })
  Write-Host ''
  Write-Host "  rodada: $jsonPath"
  Write-Host "  previa: $htmlPath"
  Write-Host ''
  Write-Host '  Proximo passo: .\Lancar-Vendas-SF.ps1 -Acao cadastro -Aplicar'
  if ($Abrir) { Start-Process $htmlPath }
  exit 0
}

# ============================ ACAO: CADASTRO ============================
if ($Acao -eq 'cadastro') {
  $rPath = Ler-Rodada
  $rod = Get-Content -Raw -Encoding UTF8 $rPath | ConvertFrom-Json
  Titulo ("ETAPA 2 — CADASTRO DOS CLIENTES" + $(if (-not $Aplicar) { '  (previa — nada sera gravado)' } else { '' }))
  Write-Host "rodada: $rPath"
  $ponte = Join-Path $RAIZ 'Ponte-ZS.ps1'
  if (-not (Test-Path $ponte)) { throw "Ponte-ZS.ps1 nao encontrado em $RAIZ" }
  $tmpDir = Join-Path $PSScriptRoot '.tmp'
  if (-not (Test-Path $tmpDir)) { New-Item -ItemType Directory -Path $tmpDir | Out-Null }

  $res = @()
  foreach ($it in $rod.itens) {
    if (-not $Aplicar) {
      Write-Host ("  · {0,-38} {1}" -f $it.nome_zs, $(if ($it.cliente_id -gt 0) { "ja existe (id $($it.cliente_id)) — completa o que estiver vazio" } else { 'CRIAR cliente + contato' }))
      continue
    }
    $plano = [ordered]@{ cpf=$it.cpf; org=$ORG; assignee_user_id=[int]$CFG.responsavel_padrao_id; usar_email=$true; forcar_responsavel=$false }
    $pf = Join-Path $tmpDir "plano-$($it.cpf).json"
    GravarJson $plano $pf
    $out = & powershell -NoProfile -ExecutionPolicy Bypass -File $ponte -Acao aplicar -PlanoFile $pf *>&1 | Out-String
    Remove-Item $pf -ErrorAction SilentlyContinue
    $a = $out.IndexOf('{'); $b = $out.LastIndexOf('}')
    if ($a -lt 0 -or $b -le $a) { Write-Host ("  !! {0}: sem resposta" -f $it.nome_zs) -ForegroundColor Red; continue }
    $j = $out.Substring($a, $b-$a+1) | ConvertFrom-Json
    if (-not $j.ok) { Write-Host ("  !! {0}: {1}" -f $it.nome_zs, $j.erro) -ForegroundColor Red; continue }
    $criado = @($j.passos | Where-Object { $_.passo -eq 'cliente' -and $_.situacao -eq 'criado' }).Count -gt 0
    $it.cliente_id = [int]$j.customer_id
    $falta = @()
    if (-not $j.cliente.telefone)  { $falta += 'telefone' }
    if (-not $j.cliente.nascimento){ $falta += 'nascimento' }
    if (-not $j.cliente.rua -or -not $j.cliente.cidade) { $falta += 'endereço' }
    Write-Host ("  · {0,-38} {1,-9} id {2,-7} {3}" -f $it.nome_zs, $(if ($criado) { 'CRIADO' } else { 'existia' }), $j.customer_id, $(if ($falta.Count) { "falta: $($falta -join ', ')" } else { 'completo' }))
    $res += [pscustomobject]@{ nome=$it.nome_zs; id=$j.customer_id; criado=$criado; falta=($falta -join ', '); nao_gravados=$j.nao_gravados }
  }
  if ($Aplicar) {
    GravarJson $rod $rPath      # guarda os customer_id para a etapa 3
    Titulo 'RESUMO DO CADASTRO'
    $res | Format-Table -AutoSize | Out-String -Width 200 | Write-Host
    $inc = @($res | Where-Object { $_.falta -match 'endereço' })
    if ($inc.Count) { Write-Host ("ATENCAO: {0} cliente(s) sem endereco — a venda deles NAO vai fechar: {1}" -f $inc.Count, (($inc | ForEach-Object { $_.nome }) -join ', ')) -ForegroundColor Yellow }
    Write-Host ''
    Write-Host '  Proximo passo: .\Lancar-Vendas-SF.ps1 -Acao vendas -Aplicar'
  } else {
    Write-Host ''
    Write-Host '  (previa) para gravar: .\Lancar-Vendas-SF.ps1 -Acao cadastro -Aplicar'
  }
  exit 0
}

# ============================ ACAO: VENDAS ============================
if ($Acao -eq 'vendas') {
  $rPath = Ler-Rodada
  $rod = Get-Content -Raw -Encoding UTF8 $rPath | ConvertFrom-Json
  Titulo ("ETAPA 3 — LANCAMENTO DAS VENDAS" + $(if (-not $Aplicar) { '  (previa — nada sera gravado)' } else { '' }))
  Write-Host "rodada: $rPath"

  # as formas de pagamento sao relidas do SF na hora (a previa e informativa, nao autorizativa)
  $formasTodas = $null
  if ($Aplicar) { $formasTodas = Formas-Da-Venda @($rod.itens | ForEach-Object { $_.venda_nome }) }

  $feitas = @(); $abertas = @(); $puladas = @()
  foreach ($it in $rod.itens) {
    $rotulo = "{0,-38}" -f $it.nome_zs
    if ($it.bloqueios.Count) { Write-Host ("  - $rotulo PULADA — $($it.bloqueios[0])") -ForegroundColor Yellow; $puladas += $it.nome_zs; continue }
    if ($it.ja_lancada)      { Write-Host ("  - $rotulo PULADA — ja existe a venda $($it.opp_id)") -ForegroundColor Gray; $puladas += $it.nome_zs; continue }
    if ([int]$it.cliente_id -le 0) { Write-Host ("  - $rotulo PULADA — cliente ainda nao cadastrado (rode a etapa 2)") -ForegroundColor Yellow; $puladas += $it.nome_zs; continue }

    if (-not $Aplicar) {
      Write-Host ("  · $rotulo R$ {0,10:N2}  {1} {2}  turma {3}{4}" -f $it.valor, $it.metodo, $(if($it.parcelas -gt 1){"$($it.parcelas)x"}else{''}), $it.turma_zs, $(if ($it.cashback -gt 0) { "  (cashback R$ $('{0:N2}' -f $it.cashback) fora do valor)" } else { '' }))
      continue
    }

    $formas = @($formasTodas | Where-Object { $_.Venda__r.Name -eq $it.venda_nome })
    if ($formas.Count -eq 0) { Write-Host ("  !! $rotulo sem formas de pagamento no SF") -ForegroundColor Red; continue }

    # 1) oportunidade — nome = nome do cliente; responsavel = o do cliente
    $opp = ZS1 'create_opportunity' @{
      name=$it.nome_zs; funnel_stage_id=[int]$CFG.funnel_stage_id; customer_id=[int]$it.cliente_id
      assignee_user_id=[int]$it.resp_id; close_date=$it.close_date; value=(R2 $it.valor)
    }
    if (-not $opp -or $opp.__erro -or -not $opp.id) { Write-Host ("  !! $rotulo create_opportunity: $($opp.__erro)") -ForegroundColor Red; continue }
    $oppId = [int]$opp.id

    # 2) produto
    $prod = ZS1 'create_opportunity_product' @{
      opportunity_id=$oppId; product_id=[int]$it.product_id; class_id=[int]$it.class_id
      price=(R2 $it.valor); beneficiary_profile_id=[int]$it.cliente_id
    }
    if ($prod -and $prod.__erro) { Write-Host ("  !! $rotulo create_opportunity_product: $($prod.__erro)") -ForegroundColor Red; continue }

    # 3) pagamento (so o que entrou em dinheiro; cashback NAO entra)
    $argsPg = @{
      opportunity_id=$oppId; method=$it.metodo; amount=(R2 $it.valor)
      financial_institution=$CFG.instituicao; gateway=$CFG.gateway
      payer_profile_id=[int]$it.cliente_id
    }
    if ($it.pago_em) { $argsPg['paid_at'] = $it.pago_em }
    if ([int]$it.parcelas -gt 1) { $argsPg['protocol'] = "$([int]$it.parcelas)x" }
    $pg = ZS1 'create_payment' $argsPg
    if (-not $pg -or $pg.__erro -or -not $pg.id) { Write-Host ("  !! $rotulo create_payment: $($pg.__erro)") -ForegroundColor Red; continue }

    # 4) anotacao principal (+ a do cashback, quando houver)
    $n1 = ZS1 'create_opportunity_note' @{ opportunity_id=$oppId; content_html=(Nota-Principal $formas $it.turma_sf) }
    if ($n1 -and $n1.__erro) { Write-Host ("  !! $rotulo nota: $($n1.__erro)") -ForegroundColor Red }
    if ($it.cashback -gt 0 -and $it.cashback_id) {
      $cb = @($formas | Where-Object { "$($_.Id)" -eq "$($it.cashback_id)" })
      if ($cb.Count) { ZS1 'create_opportunity_note' @{ opportunity_id=$oppId; content_html=(Nota-Cashback $cb[0]) } | Out-Null }
    }

    # 5) fechar (tolerante: sem endereco o ZS recusa e a venda fica aberta)
    $fim = ZS1 'close_opportunity' @{ opportunity_id=$oppId; outcome='won' }
    $ok  = ($fim -and -not $fim.__erro)
    $it.opp_id = $oppId; $it.ja_lancada = $true
    if ($ok) {
      Write-Host ("  · $rotulo GANHA    R$ {0,10:N2}  opp {1}" -f $it.valor, $oppId) -ForegroundColor Green
      $feitas += [pscustomobject]@{ nome=$it.nome_zs; opp=$oppId; valor=$it.valor }
    } else {
      Write-Host ("  · $rotulo ABERTA   R$ {0,10:N2}  opp {1} — {2}" -f $it.valor, $oppId, $fim.__erro) -ForegroundColor Yellow
      $abertas += [pscustomobject]@{ nome=$it.nome_zs; opp=$oppId; valor=$it.valor; motivo="$($fim.__erro)" }
    }
  }

  if ($Aplicar) {
    GravarJson $rod $rPath
    Titulo 'RESUMO DAS VENDAS'
    Write-Host ("  ganhas : {0}  (R$ {1:N2})" -f $feitas.Count,  (Somar $feitas 'valor'))
    Write-Host ("  abertas: {0}  (R$ {1:N2})" -f $abertas.Count, (Somar $abertas 'valor'))
    Write-Host ("  puladas: {0}" -f $puladas.Count)
    if ($abertas.Count) {
      Write-Host ''
      Write-Host '  EM ABERTO (falta endereco do cliente):' -ForegroundColor Yellow
      foreach ($a in $abertas) { Write-Host ("    - {0} — opp {1} — https://app.zsales.com.br/organization/{2}/opportunities/{1}" -f $a.nome, $a.opp, $ORG) }
    }
    Write-Host ''
    foreach ($f in $feitas) { Write-Host ("  {0,-38} https://app.zsales.com.br/organization/{1}/opportunities/{2}" -f $f.nome, $ORG, $f.opp) }
  } else {
    Write-Host ''
    Write-Host '  (previa) para gravar: .\Lancar-Vendas-SF.ps1 -Acao vendas -Aplicar'
  }
  exit 0
}
