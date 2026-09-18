<#
════════════════════════════════════════════════════════════════════════════
 Vendas-ZS.ps1 — lançar vendas no Zsales a partir de linhas coladas.

 ETAPA 1 (este arquivo): CLASSIFICAR. Para cada linha decide o que falta antes
 de poder lançar, sem gravar NADA:

   PRONTO        cliente confirmado no ZS por DOIS fatores (nome+CPF ou nome+telefone)
   CONFERIR      achado no ZS só pelo nome — falta o 2º fator, precisa confirmação
   COMPLETAR     está no ZS mas sem CPF/telefone — puxar do SF ou perguntar
   CANDIDATO_SF  não está no ZS; o SF tem candidato(s) — confirmar e cadastrar
   NOVO          não existe em lugar nenhum — cadastro novo (11 campos)
   LINK          a linha traz link CISPay/FRZPAY — os dados vêm do link

 REGRAS (definidas pelo Pablo em 17/08/2026)
 ───────────────────────────────────────────
 • NUNCA identificar só pelo nome: sempre nome + CPF ou nome + telefone.
   Homônimo lançando venda na pessoa errada é o pior erro possível aqui.
 • O SALESFORCE É SOMENTE LEITURA. Ele alimenta o ZS e nunca o contrário.
 • Nada é gravado nesta etapa. A gravação só acontece depois da prévia + Confirmar.

 Uso
 ───
   .\Vendas-ZS.ps1 -Acao classificar -LinhasFile linhas.txt -Json
   .\Vendas-ZS.ps1 -Acao classificar -Linhas "nome | produto | valor" -Json
════════════════════════════════════════════════════════════════════════════
#>
param(
  [ValidateSet('classificar','vagas','consumidores','fechar','remover','ler','etapa5')][string]$Acao = 'classificar',
  [int]$Opp = 0,             # oportunidade (acao vagas/consumidores)
  [int]$Org = 2,
  [string]$PlanoFile = '',   # consumidores: [{vaga_id, profile_id, nome}]
  [int]$Vaga = 0,            # acao remover: id da vaga (opportunity-product)
  [switch]$Aplicar,          # sem isto NADA e gravado
  [string]$LinhasFile = '',
  [string]$Linhas = '',
  [string]$Relatorio = '',   # report*.xls do SF/CISPay: vira lista automaticamente
  [switch]$Json
)
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ErrorActionPreference = 'Stop'

$RAIZ      = Split-Path -Parent $PSScriptRoot
$BUSCAR_ZS = Join-Path $RAIZ 'Buscar-Clientes-Vitoria.ps1'
$PONTE_SF  = Join-Path $RAIZ 'Ponte-SF.ps1'

function Msg($t){ if (-not $Json) { Write-Host $t } }
function Sair($obj){
  if ($Json) { [Console]::Out.Write(($obj | ConvertTo-Json -Depth 10 -Compress)) }
  else { $obj | ConvertTo-Json -Depth 10 }
}
# MESMA ARMADILHA DO PS 5.1 do Servir.ps1: com EAP 'Stop', uma linha no stderr de um
# powershell.exe filho (Ponte-SF, Buscar-Clientes) vira erro terminante e derruba tudo.
function Rodar-Filho([string]$Arquivo, [object[]]$Argumentos) {
  & { $ErrorActionPreference = 'Continue'
      & powershell -NoProfile -ExecutionPolicy Bypass -File $Arquivo @Argumentos 2>&1
    } | ForEach-Object { "$_" } | Out-String
}
function Dig($s){ ("$s" -replace '\D','') }
function Norm($s){
  $t = [string]$s
  $n = $t.Normalize([Text.NormalizationForm]::FormD)
  $sb = New-Object Text.StringBuilder
  foreach ($c in $n.ToCharArray()) {
    if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($c) -ne 'NonSpacingMark') { [void]$sb.Append($c) }
  }
  return (($sb.ToString().ToUpper()) -replace '\s+',' ').Trim()
}
function CpfValido($cpf){
  $c = Dig $cpf
  if ($c.Length -ne 11) { return $false }
  if ($c -match '^(\d)\1{10}$') { return $false }
  $s=0; for($i=0;$i -lt 9;$i++){ $s += [int][string]$c[$i]*(10-$i) }
  $d1=11-($s%11); if($d1 -ge 10){$d1=0}
  if ($d1 -ne [int][string]$c[9]) { return $false }
  $s=0; for($i=0;$i -lt 10;$i++){ $s += [int][string]$c[$i]*(11-$i) }
  $d2=11-($s%11); if($d2 -ge 10){$d2=0}
  return ($d2 -eq [int][string]$c[10])
}
# telefone brasileiro: 10 ou 11 digitos (com DDD), ou 12/13 com o 55 na frente
function TelValido($t){
  $d = Dig $t
  if ($d.StartsWith('55') -and ($d.Length -eq 12 -or $d.Length -eq 13)) { $d = $d.Substring(2) }
  return ($d.Length -eq 10 -or $d.Length -eq 11)
}
function Moeda($s){
  $t = ("$s" -replace '[^\d,\.]','')
  if (-not $t) { return 0.0 }
  if ($t -match ',\d{1,2}$') { $t = ($t -replace '\.','') -replace ',','.' }  # 1.234,56
  else { $t = $t -replace ',','' }                                            # 1,234.56
  try { return [double]::Parse($t, [Globalization.CultureInfo]::InvariantCulture) } catch { return 0.0 }
}

# ── Parser tolerante ────────────────────────────────────────────────────────
# Aceita separador | ; ou TAB. Não exige ordem: descobre cada pedaço pelo formato
# (CPF valida dígito, telefone tem DDD, valor tem moeda, link começa com http).
function Parse-Linha($txt, $n){
  $bruto = "$txt".Trim()
  $partes = @($bruto -split '\s*[\|;]\s*|\t+' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
  $o = [ordered]@{
    n = $n; bruto = $bruto; nome=''; cpf=''; telefone=''; turma=''; produto=''; valor=0.0
    pagamento=''; link=''; linkTipo=''; oppOrg=0; oppId=0; sobra=@()
  }
  foreach ($p in $partes) {
    if ($p -match '(?i)^https?://') {
      $o.link = $p
      # link de OPORTUNIDADE do Zsales e outra coisa: e uma venda que JA existe
      # (ex.: comprador ja lancado, faltando os consumidores de vaga).
      $mOpp = [regex]::Match($p, '(?i)zsales\.com\.br/organization/(\d+)/opportunities/(\d+)')
      if ($mOpp.Success) {
        $o.linkTipo = 'OPORTUNIDADE'
        $o.oppOrg = [int]$mOpp.Groups[1].Value
        $o.oppId  = [int]$mOpp.Groups[2].Value
      }
      elseif ($p -match '(?i)pay\.frzgroup|frzpay|frz-pay') { $o.linkTipo = 'FRZPAY' }
      elseif ($p -match '(?i)cispay|cis-pay') { $o.linkTipo = 'CISPAY' }
      else { $o.linkTipo = 'LINK' }
      continue
    }
    $d = Dig $p
    if ($d.Length -eq 11 -and (CpfValido $d) -and -not $o.cpf) { $o.cpf = $d; continue }
    if (-not $o.telefone -and $p -notmatch '[A-Za-zÀ-ÿ]' -and (TelValido $p)) { $o.telefone = $d; continue }
    # Valor exige FORMATO DE MOEDA (centavos ou R$). Sem isso, a turma "2026 - BHP19" virava
    # valor 202.619 — dígitos soltos não bastam para dizer que é dinheiro.
    $ehMoeda = ($p -match '(?i)r\$') -or ($p -match '^\s*\d{1,3}(\.\d{3})*,\d{2}\s*$') -or
               ($p -match '^\s*\d+,\d{2}\s*$') -or ($p -match '^\s*\d{1,3}(,\d{3})*\.\d{2}\s*$')
    if ($ehMoeda -and (Moeda $p) -gt 0 -and $o.valor -eq 0.0) { $o.valor = (Moeda $p); continue }
    # turma do relatorio vem como "2026 - BHP19" / "2026 - BHP20": nao e produto
    if (-not $o.turma -and $p -match '^\s*\d{4}\s*-\s*[A-Za-z0-9][\w\s\-\.]*$') { $o.turma = $p; continue }
    # forma de pagamento tem vocabulario proprio — senao "CARTAO DE CREDITO CISPAY" virava produto
    if (-not $o.pagamento -and $p -match '(?i)(cispay|frz\s*pay|frzpay|^pix\b|cart(a|ã)o|boleto|dinheiro|transfer|d[eé]bito|cr[eé]dito|cashback)') {
      $o.pagamento = $p; continue
    }
    if (-not $o.nome) { $o.nome = $p; continue }
    if (-not $o.produto) { $o.produto = $p; continue }
    if (-not $o.pagamento) { $o.pagamento = $p; continue }
    $o.sobra += $p
  }
  # o nome pode ter vindo colado com o CPF/telefone na mesma célula
  if (-not $o.cpf) {
    $m = [regex]::Match($o.nome, '\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b')
    if ($m.Success -and (CpfValido $m.Value)) { $o.cpf = Dig $m.Value; $o.nome = ($o.nome -replace [regex]::Escape($m.Value),'').Trim(' ','-','|') }
  }
  return $o
}

# ── Entrada ─────────────────────────────────────────────────────────────────
# O "report*.xls" do Salesforce/CISPay e HTML em ISO-8859-1 (nao e Excel de verdade).
# Colunas: Nome, CPF, Telefone, Un.Geradora, Un.Realizadora, Data, Forma Pag., Moeda, Valor, Turma, Nome da venda.
function Ler-RelatorioCisPay($caminho) {
  $txt = [IO.File]::ReadAllText($caminho, [Text.Encoding]::GetEncoding('iso-8859-1'))
  function LimpaCel($s){ $x = $s -replace '<[^>]+>',''; $x = [Net.WebUtility]::HtmlDecode($x); ($x -replace '\s+',' ').Trim() }
  $trs = [regex]::Matches($txt, '(?is)<tr[^>]*>(.*?)</tr>')
  $out = @()
  for ($i = 1; $i -lt $trs.Count; $i++) {
    $c = [regex]::Matches($trs[$i].Groups[1].Value, '(?is)<t[dh][^>]*>(.*?)</t[dh]>')
    if ($c.Count -lt 11) { continue }
    $nome  = LimpaCel $c[0].Groups[1].Value
    $cpf   = LimpaCel $c[1].Groups[1].Value
    $tel   = LimpaCel $c[2].Groups[1].Value
    $forma = LimpaCel $c[6].Groups[1].Value
    $val   = LimpaCel $c[8].Groups[1].Value
    $turma = LimpaCel $c[9].Groups[1].Value
    if (-not $nome) { continue }
    $p = @($nome)
    if ($cpf) { $p += $cpf }
    if ($tel) { $p += $tel }
    if ($turma) { $p += $turma }
    if ($val) { $p += $val }
    if ($forma) { $p += $forma }
    $out += ($p -join ' | ')
  }
  return ,$out
}
if ($Relatorio) {
  if (-not (Test-Path $Relatorio)) { Sair @{ ok=$false; erro="Relatorio nao encontrado: $Relatorio" }; return }
  try { $Linhas = ((Ler-RelatorioCisPay $Relatorio) -join "`r`n") }
  catch { Sair @{ ok=$false; erro='Falha ao ler o relatorio: ' + $_.Exception.Message }; return }
}
if ($LinhasFile -and (Test-Path $LinhasFile)) { $Linhas = Get-Content -Raw -Encoding UTF8 $LinhasFile }
$brutas = @($Linhas -split "`r?`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ })
# so a classificacao precisa de linhas; as acoes 'vagas'/'consumidores' trabalham sobre a venda
if ($brutas.Count -eq 0 -and $Acao -eq 'classificar') { Sair @{ ok=$false; erro='Cole as linhas (uma venda por linha).' }; return }
if ($brutas.Count -gt 120) { $brutas = $brutas[0..119] }

$itens = @()
$i = 0
foreach ($b in $brutas) { $i++; $itens += (Parse-Linha $b $i) }

# ── 1) Busca no ZS (uma chamada para todas as linhas) ───────────────────────
# Preferimos CPF como termo: é o identificador forte. Sem CPF, telefone. Sem os dois, o nome
# (e aí a linha nunca fica PRONTO sozinha — cai em CONFERIR, por causa da regra dos 2 fatores).
$termos = @()
foreach ($it in $itens) {
  $termos += $(if ($it.cpf) { $it.cpf } elseif ($it.telefone) { $it.telefone } else { $it.nome })
}
$zsPorTermo = @{}
if (Test-Path $BUSCAR_ZS) {
  $tmp = Join-Path $env:TEMP ('vzs_' + [Guid]::NewGuid().ToString('N') + '.txt')
  [IO.File]::WriteAllText($tmp, ($termos -join "`r`n"), (New-Object Text.UTF8Encoding($false)))
  try {
    $saida = Rodar-Filho $BUSCAR_ZS @('-ListaFile', $tmp, '-Json')
    $k = $saida.IndexOf('{'); $j = $saida.LastIndexOf('}')
    if ($k -ge 0 -and $j -gt $k) {
      $rz = $saida.Substring($k, $j-$k+1) | ConvertFrom-Json
      foreach ($c in @($rz.clientes)) { if (-not $zsPorTermo.ContainsKey([string]$c.termo)) { $zsPorTermo[[string]$c.termo] = $c } }
    }
    else { $script:zsMcpFalhou = $true; Msg '  (busca no ZS nao devolveu JSON — MCP fora do ar?)' }
  } catch { $script:zsMcpFalhou = $true; Msg "  (busca no ZS falhou: $($_.Exception.Message))" }
  finally { Remove-Item $tmp -Force -ErrorAction SilentlyContinue }
}

# ── 2) Classifica cada linha ────────────────────────────────────────────────
# ── API web do Zsales (so leitura aqui) ─────────────────────────────────────
# O MCP nao expoe as vagas ja criadas com o campo de consumidor editavel, entao a
# consulta da venda existente vai pela API web, que lista cada vaga com id proprio.
$script:webTok = $null
function Web-Token {
  if ($script:webTok) { return $script:webTok }
  $f = Join-Path $RAIZ 'sc-web-auth.json'
  if (-not (Test-Path $f)) { return $null }
  try {
    $c = Get-Content -Raw -Encoding UTF8 $f | ConvertFrom-Json
    $l = Invoke-RestMethod -Uri 'https://api.zsales.com.br/api/auth/login/' -Method Post -ContentType 'application/json' `
         -Body (@{ email=$c.email; password=$c.password } | ConvertTo-Json) -TimeoutSec 25
    $script:webTok = $l.access
    return $script:webTok
  } catch { return $null }
}
function Web-Get($caminho, $org) {
  $tk = Web-Token; if (-not $tk) { return $null }
  $h = @{ Authorization = "Bearer $tk"; 'X-Organization-Id' = "$org" }
  try {
    # PS 5.1 assume Latin1 quando a resposta nao declara charset, e os acentos viram "â".
    # Por isso lemos os BYTES e decodificamos como UTF-8 na mao.
    $r = Invoke-WebRequest -Uri "https://api.zsales.com.br$caminho" -Headers $h -TimeoutSec 30 -UseBasicParsing
    $txt = [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
    return ($txt | ConvertFrom-Json)
  } catch { return $null }
}
# Venda existente + as vagas (para lancar os consumidores que faltam)
function Venda-Existente($oppId, $org) {
  $o = Web-Get "/api/opportunities/$oppId/" $org
  if (-not $o) { return $null }
  $prods = Web-Get "/api/opportunity-products/?opportunity=$oppId" $org
  $lista = @()
  foreach ($p in @($(if ($prods.results) { $prods.results } else { $prods }))) {
    $lista += [ordered]@{
      id = $p.id; produto = [string]$p.product_name; turma = [string]$p.class_name
      turmaId = $p.class_ref
      preco = [double]$p.price
      consumidorId = $p.beneficiary_profile
      consumidor = [string]$p.beneficiary_name
      temConsumidor = [bool]([string]$p.beneficiary_name)
    }
  }
  # para onde a venda vai antes de fechar (a previa mostra atual -> posterior)
  $alvo = Etapa-VendaFeita $org
  return [ordered]@{
    id = $o.id; nome = [string]$o.name; valor = [double]$o.value
    comprador = [string]$o.customer_name; compradorId = $o.customer
    compradorCpf = ("$($o.customer_document_number)" -replace '\D','')
    consultor = [string]$o.assignee_name; etapa = [string]$o.funnel_stage_label
    etapaId = $o.funnel_stage
    etapaAlvo = $(if ($alvo) { [string]$alvo.label } else { '' })
    etapaAlvoId = $(if ($alvo) { $alvo.id } else { $null })
    outcome = [string]$o.outcome
    ganha   = ([string]$o.outcome -eq 'won')
    fechada = ([string]$o.outcome -eq 'won')
    wonAt   = [string]$o.won_at
    vagas = $lista
    vagasSemConsumidor = @($lista | Where-Object { -not $_.temConsumidor }).Count
  }
}

# ── ESCRITA: grava o consumidor numa vaga que ja existe ─────────────────────
# O MCP nao tem update_opportunity_product (so create), entao a unica via e a API web.
# So roda com -Aplicar. Devolve o resultado de cada vaga, uma a uma.
function Web-Patch($caminho, $org, $corpo) {
  $tk = Web-Token; if (-not $tk) { return @{ ok=$false; erro='sem login na API web (sc-web-auth.json)' } }
  $h = @{ Authorization = "Bearer $tk"; 'X-Organization-Id' = "$org" }
  try {
    $b = [Text.Encoding]::UTF8.GetBytes(($corpo | ConvertTo-Json -Depth 5 -Compress))
    $r = Invoke-WebRequest -Uri "https://api.zsales.com.br$caminho" -Method Patch -Headers $h `
         -ContentType 'application/json' -Body $b -TimeoutSec 30 -UseBasicParsing
    $txt = [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
    return @{ ok=$true; status=[int]$r.StatusCode; dados=($txt | ConvertFrom-Json) }
  } catch {
    $st = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
    # o corpo do erro do ZS diz o MOTIVO (ex.: consumidor ja em outra venda ativa).
    # ErrorDetails costuma trazer; o stream do PS 5.1 precisa voltar ao inicio antes de ler.
    $det = [string]$_.ErrorDetails.Message
    if (-not $det -and $_.Exception.Response) {
      try {
        $stm = $_.Exception.Response.GetResponseStream()
        if ($stm.CanSeek) { $stm.Position = 0 }
        $sr = New-Object IO.StreamReader($stm, [Text.Encoding]::UTF8)
        $det = $sr.ReadToEnd()
      } catch {}
    }
    $msg = ''
    try {
      $j = $det | ConvertFrom-Json
      $msg = [string]@($j.non_field_errors)[0]
      if (-not $msg) { $msg = ($j.PSObject.Properties | ForEach-Object { "$($_.Name): $($_.Value)" }) -join ' · ' }
    } catch {}
    return @{ ok=$false; status=$st; erro=$(if ($msg) { $msg } else { $_.Exception.Message }); detalhe=$det }
  }
}
function Gravar-Consumidores($plano, $org, $oppAtual) {
  $res = @()
  foreach ($p in @($plano)) {
    $vagaId = [int]$p.vaga_id
    $perfil = $p.profile_id
    if (-not $vagaId) { continue }
    if (-not $perfil) {
      $res += @{ vaga_id=$vagaId; ok=$false; nome=[string]$p.nome; erro='consumidor sem cadastro no ZS' }
      continue
    }
    # esta pessoa ja consome vaga NESTA TURMA (em qualquer venda ativa)? entao pula.
    $turmaAlvo = $null
    try {
      $vg = Web-Get "/api/opportunity-products/$vagaId/" $org
      $turmaAlvo = $vg.class_ref
    } catch {}
    if ($turmaAlvo) {
      try {
        $ja = Web-Get "/api/opportunity-products/?beneficiary_profile=$perfil" $org
        $lja = @($(if ($ja.results) { $ja.results } else { $ja }))
        $conflito = $null
        foreach ($x in $lja) {
          if ("$($x.id)" -eq "$vagaId") { continue }
          if ("$($x.class_ref)" -eq "$turmaAlvo") { $conflito = $x; break }
        }
        if ($conflito) {
          $res += @{ vaga_id=$vagaId; ok=$false; pulado=$true; nome=[string]$p.nome
                     erro="ja esta nesta turma ($([string]$conflito.class_name))"
                     jaEm=@(@{ opp=$conflito.opportunity; vaga=$conflito.id
                               turma=[string]$conflito.class_name; produto=[string]$conflito.product_name
                               link=("https://app.zsales.com.br/organization/$org/opportunities/$($conflito.opportunity)") }) }
          continue
        }
      } catch {}
    }
    $r = Web-Patch "/api/opportunity-products/$vagaId/" $org @{ beneficiary_profile = [int]$perfil }
    if ($r.ok) {
      $res += @{ vaga_id=$vagaId; ok=$true; nome=[string]$p.nome
                 gravado=[string]$r.dados.beneficiary_name; profile=[int]$perfil }
    } else {
      $item = @{ vaga_id=$vagaId; ok=$false; nome=[string]$p.nome
                 erro=("HTTP $($r.status) — " + $(if ($r.erro) { $r.erro } else { ($r.detalhe -replace '\s+',' ') })).Trim() }
      # "ja esta associado a esta turma em uma venda ativa" -> localizar ONDE, para o
      # usuario abrir a venda e decidir (remover de la ou deixar como esta)
      if ("$($r.erro)" -match 'associad') {
        try {
          $ja = Web-Get "/api/opportunity-products/?beneficiary_profile=$perfil" $org
          $lja = @($(if ($ja.results) { $ja.results } else { $ja }))
          $links = @()
          foreach ($x in $lja) {
            if ("$($x.opportunity)" -eq "$oppAtual") { continue }
            $links += @{ opp=$x.opportunity; vaga=$x.id
                         turma=[string]$x.class_name; produto=[string]$x.product_name
                         link=("https://app.zsales.com.br/organization/$org/opportunities/$($x.opportunity)") }
          }
          if ($links.Count) { $item.jaEm = $links }
        } catch {}
      }
      $res += $item
    }
  }
  return ,$res
}

function SF-PorCpf($cpf){
  if (-not (Test-Path $PONTE_SF)) { return $null }
  try {
    $s = Rodar-Filho $PONTE_SF @('-Acao','consultaCpf','-Cpf',$cpf)
    $k=$s.IndexOf('{'); $j=$s.LastIndexOf('}'); if ($k -lt 0 -or $j -le $k) { return $null }
    $o = $s.Substring($k,$j-$k+1) | ConvertFrom-Json
    if ($o.ok -and $o.achou) { return $o.cliente }
  } catch {}
  return $null
}
function SF-PorNome($nome){
  if (-not (Test-Path $PONTE_SF)) { return @() }
  try {
    $s = Rodar-Filho $PONTE_SF @('-Acao','consultaNome','-Nome',$nome)
    $k=$s.IndexOf('{'); $j=$s.LastIndexOf('}'); if ($k -lt 0 -or $j -le $k) { return @() }
    $o = $s.Substring($k,$j-$k+1) | ConvertFrom-Json
    # `return @(...)` ENUMERA: com 1 candidato o chamador recebia um objeto solto, e como
    # PSCustomObject.Count e $null no 5.1, o `if ($cand.Count)` dava falso — o aluno com UM
    # candidato no SF era classificado como NOVO. A virgula preserva o array.
    if ($o.ok -and $o.achou) { return ,@($o.candidatos) }
  } catch {}
  return ,@()
}

# ── Acoes da venda existente (vagas / consumidores) ─────────────────────────
# Fica AQUI, depois das funcoes: em PS 5.1 o script roda de cima para baixo e chamar
# Venda-Existente antes da definicao dava "termo nao reconhecido".
if ($Acao -eq 'vagas') {
  if (-not $Opp) { Sair @{ ok=$false; erro='informe -Opp <id da oportunidade>' }; return }
  $v = Venda-Existente $Opp $Org
  if (-not $v) { Sair @{ ok=$false; erro="Nao consegui ler a venda $Opp." }; return }
  Sair @{ ok=$true; acao='vagas'; venda=$v }
  return
}
# A etapa "5. Venda Feita/Convertido" tem id DIFERENTE por unidade (Vitoria 5000532,
# Teresina 5000463). Buscamos pelo NOME para nao fixar numero que quebra na outra org.
$script:CacheEtapa = @{}
function Etapa-VendaFeita($org) {
  if ($script:CacheEtapa.ContainsKey("$org")) { return $script:CacheEtapa["$org"] }
  $r = Web-Get "/api/funnel-stages/" $org
  $lista = $(if ($r.results) { $r.results } else { $r })
  foreach ($e in @($lista)) {
    $lb = [string]$e.label
    if ($lb -match '(?i)venda\s*feita|convertid') { $script:CacheEtapa["$org"] = $e; return $e }
  }
  $script:CacheEtapa["$org"] = $null
  return $null
}
function Fechar-Ganho($oppId, $org) {
  # PATCH outcome=won. ATENCAO: em Vitoria (org 2) vale; em TERESINA (org 3) a venda
  # costuma reverter sozinha depois — por isso conferimos o estado logo apos gravar.
  # 1) MOVER para "5. Venda Feita/Convertido" — o fechamento so vale depois disso
  $etapa = Etapa-VendaFeita $org
  $movida = $null
  if ($etapa) {
    $atual = Web-Get "/api/opportunities/$oppId/" $org
    if ("$($atual.funnel_stage)" -ne "$($etapa.id)") {
      $mv = Web-Patch "/api/opportunities/$oppId/" $org @{ funnel_stage = [int]$etapa.id }
      Start-Sleep -Milliseconds 800
      $movida = @{ ok=[bool]$mv.ok; para=[string]$etapa.label; status=$mv.status
                   erro=[string]$mv.erro; detalhe=[string]$mv.detalhe }
    } else {
      $movida = @{ ok=$true; para=[string]$etapa.label; jaEstava=$true }
    }
  } else {
    $movida = @{ ok=$false; erro='nao achei a etapa "Venda Feita/Convertido" nesta unidade' }
  }
  # 2) so entao fecha como Ganho
  $r = Web-Patch "/api/opportunities/$oppId/" $org @{ outcome = 'won' }
  Start-Sleep -Seconds 2
  $dep = Web-Get "/api/opportunities/$oppId/" $org
  return [ordered]@{
    ok        = [bool]$r.ok
    movida    = $movida
    status    = $r.status
    erro      = [string]$r.erro
    detalhe   = [string]$r.detalhe
    outcome   = [string]$dep.outcome
    etapa     = [string]$dep.funnel_stage_label
    won_at    = [string]$dep.won_at
    reverteu  = ([bool]$r.ok -and "$($dep.outcome)" -ne 'won')
  }
}

if ($Acao -eq 'remover') {
  # tira o consumidor da vaga (grava beneficiary_profile = null). Reversivel: e so lancar de novo.
  if (-not $Vaga) { Sair @{ ok=$false; erro='informe -Vaga <id>' }; return }
  if (-not $Aplicar) { Sair @{ ok=$true; simulacao=$true; vaga=$Vaga }; return }
  $r = Web-Patch "/api/opportunity-products/$Vaga/" $Org @{ beneficiary_profile = $null }
  $v = $(if ($Opp) { Venda-Existente $Opp $Org } else { $null })
  Sair @{ ok=[bool]$r.ok; acao='remover'; vaga=$Vaga; status=$r.status
          erro=[string]$r.erro; detalhe=[string]$r.detalhe; venda=$v }
  return
}

# acao=ler: SO LEITURA. Existe para a tela nunca decidir por estado velho de memoria.
if ($Acao -eq 'ler') {
  if (-not $Opp) { Sair @{ ok=$false; erro='informe -Opp' }; return }
  $orgL = $(if ($Org) { $Org } else { 2 })
  $vL = Venda-Existente $Opp $orgL
  if (-not $vL) { Sair @{ ok=$false; erro="nao consegui ler a venda $Opp na unidade $orgL" }; return }
  Sair @{ ok=$true; venda=$vL; org=$orgL }
  return
}
# acao=etapa5: venda que JA esta ganha mas ficou parada em outra etapa -> move para
# "5. Venda Feita/Convertido". So mexe em venda fechada; venda aberta sai intacta.
if ($Acao -eq 'etapa5') {
  if (-not $Opp) { Sair @{ ok=$false; erro='informe -Opp' }; return }
  $orgE = $(if ($Org) { $Org } else { 2 })
  $v0 = Venda-Existente $Opp $orgE
  if (-not $v0) { Sair @{ ok=$false; erro="nao consegui ler a venda $Opp na unidade $orgE" }; return }
  if (-not $v0.ganha) { Sair @{ ok=$true; pulado='a venda nao esta fechada como Ganho'; venda=$v0 }; return }
  if (-not $Aplicar) { Sair @{ ok=$true; simulacao=$true; venda=$v0 }; return }
  $et = Etapa-VendaFeita $orgE
  if (-not $et) { Sair @{ ok=$false; erro='nao achei a etapa "Venda Feita/Convertido" nesta unidade' }; return }
  if ("$($v0.etapaId)" -eq "$($et.id)") { Sair @{ ok=$true; movida=@{ ok=$true; jaEstava=$true; para=[string]$et.label }; venda=$v0 }; return }
  $rE = Web-Patch "/api/opportunities/$Opp/" $orgE @{ funnel_stage = [int]$et.id }
  Start-Sleep -Milliseconds 800
  $v1 = Venda-Existente $Opp $orgE
  Sair @{ ok=[bool]$rE.ok
          movida=@{ ok=[bool]$rE.ok; para=[string]$et.label; status=$rE.status; erro=[string]$rE.erro }
          venda=$v1 }
  return
}
if ($Acao -eq 'fechar') {
  if (-not $Opp) { Sair @{ ok=$false; erro='informe -Opp' }; return }
  if (-not $Aplicar) { Sair @{ ok=$true; simulacao=$true; aviso='sem -Aplicar nada e fechado' }; return }
  $res = Fechar-Ganho $Opp $Org
  $v = Venda-Existente $Opp $Org
  Sair @{ ok=$res.ok; acao='fechar'; resultado=$res; venda=$v; org=$Org }
  return
}

if ($Acao -eq 'consumidores') {
  if (-not $Opp) { Sair @{ ok=$false; erro='informe -Opp <id da oportunidade>' }; return }
  if (-not $PlanoFile -or -not (Test-Path $PlanoFile)) { Sair @{ ok=$false; erro='plano de consumidores ausente' }; return }
  # PEGADINHA PS 5.1: ConvertFrom-Json NAO enumera — emite o array inteiro como UM objeto.
  # Com @(pipeline), o @() conta objetos emitidos: vinha 1 item que era o array de 3, e o
  # foreach iterava uma vez com $p = array -> [int]$p.vaga_id explodia.
  # O PARENTESE INTERNO transforma o pipeline em expressao e o @() copia os elementos, plano.
  $plano = @((Get-Content -Raw -Encoding UTF8 $PlanoFile | ConvertFrom-Json))
  if (-not $Aplicar) { Sair @{ ok=$true; acao='consumidores'; simulacao=$true; plano=$plano }; return }
  $antes  = Venda-Existente $Opp $Org
  $res    = Gravar-Consumidores $plano $Org $Opp
  $depois = Venda-Existente $Opp $Org
  Sair @{ ok=$true; acao='consumidores'; aplicado=$true
          gravadas=@($res | Where-Object { $_.ok }).Count
          falhas=@($res | Where-Object { -not $_.ok })
          resultado=$res
          antes=$(if ($antes) { $antes.vagasSemConsumidor } else { $null })
          depois=$(if ($depois) { $depois.vagasSemConsumidor } else { $null })
          venda=$depois }
  return
}

# Fallback: quando o MCP nao responde (ou nao acha), a API REST resolve pelo CPF/telefone.
# Sem isso, MCP fora do ar virava "aluno NOVO" e o fluxo mandaria criar cadastro duplicado.
function ZS-RestBusca($termo, $org) {
  $d = Dig $termo
  if (-not $d) { return $null }
  try {
    $r = Web-Get ("/api/customers/?search=" + [uri]::EscapeDataString($d)) $org
    $lst = @($(if ($r.results) { $r.results } else { $r }))
    foreach ($x in $lst) {
      $doc = Dig $x.document_number
      $tel = Dig $x.phone
      if ($doc -eq $d -or ($tel -and $tel.EndsWith($d) -and $d.Length -ge 10)) {
        return [ordered]@{ achou=$true; id=$x.id; nome=[string]$x.name
                           cpf=$doc; telefone=$tel; consultor=[string]$x.assignee_name; via='REST' }
      }
    }
  } catch {}
  return $null
}

$saidaItens = @()
foreach ($it in $itens) {
  $termo = $(if ($it.cpf) { $it.cpf } elseif ($it.telefone) { $it.telefone } else { $it.nome })
  $zs = $zsPorTermo[[string]$termo]
  if (-not ($zs -and $zs.achou)) {
    $alt = ZS-RestBusca $termo $(if ($it.oppOrg) { $it.oppOrg } else { 2 })
    if ($alt) { $zs = [pscustomobject]$alt }
  }
  $estado=''; $motivo=''; $falta=@(); $cand=@(); $sfCli=$null
  $zsNome = $(if ($zs) { [string]$zs.nome } else { '' })
  $zsCpf  = $(if ($zs) { Dig $zs.cpf } else { '' })
  $zsTel  = $(if ($zs) { Dig $zs.telefone } else { '' })

  # confere se o nome do ZS combina com o nome da linha (quando a linha tem nome)
  $nomeBate = $true
  if ($it.nome -and $zsNome) {
    $a = Norm $it.nome; $b = Norm $zsNome
    $nomeBate = ($a -eq $b -or $a.Contains($b) -or $b.Contains($a))
  }

  $venda = $null
  if ($it.linkTipo -eq 'OPORTUNIDADE') {
    # venda que JA existe no ZS: o que costuma faltar sao os consumidores de vaga
    $venda = Venda-Existente $it.oppId $(if ($it.oppOrg) { $it.oppOrg } else { 2 })
    if (-not $venda) {
      $estado='LINK'; $motivo="Não consegui ler a venda $($it.oppId). Confira o link (ou o login da API web)."
    } elseif ($venda.vagasSemConsumidor -gt 0) {
      $estado='VAGAS'
      $motivo="Venda de $($venda.comprador): $($venda.vagasSemConsumidor) de $(@($venda.vagas).Count) vaga(s) sem consumidor."
    } else {
      $estado='PRONTO'
      $motivo="Venda de $($venda.comprador) — todas as $(@($venda.vagas).Count) vaga(s) já têm consumidor."
    }
  }
  elseif ($it.link) {
    $estado='LINK'; $motivo="Pagamento por link ($($it.linkTipo)) — os dados vêm do link."
  }
  else {
    # ORDEM (definida pelo Pablo em 17/08/2026): ZSALES PRIMEIRO, pelo CPF.
    # Batendo o CPF num único cadastro, a ficha do ZS já resolve e o Salesforce nem é
    # consultado — economiza a consulta mais cara. O SF entra só quando o ZS não resolve:
    # não achou, achou sem o 2º fator, ou achou com dados faltando.
    $doisFatores = $false
    if ($zs -and $zs.achou) {
      if ($it.cpf -and $zsCpf -and $it.cpf -eq $zsCpf) { $doisFatores = $true }
      elseif ($it.telefone -and $zsTel -and (Dig $it.telefone) -eq $zsTel) { $doisFatores = $true }
    }

    if ($zs -and $zs.achou -and $nomeBate -and $doisFatores) {
      # resolvido só com o ZS — não consulta o Salesforce
      $estado='PRONTO'
      $motivo='Confirmado no Zsales por ' + $(if ($it.cpf) { 'CPF' } else { 'telefone' }) + ' — cadastro completo.'
    }
    else {
      # o ZS não resolveu: agora sim vai ao Salesforce buscar a ficha
      if ($it.cpf) { $sfCli = SF-PorCpf $it.cpf }
      if (-not $sfCli -and $it.nome) { $cand = @(SF-PorNome $it.nome) }
      if (-not $sfCli -and $cand.Count -eq 1 -and $it.nome -and (Norm $cand[0].nome) -eq (Norm $it.nome)) {
        if ($cand[0].cpf) { $sfCli = SF-PorCpf (Dig $cand[0].cpf) }   # candidato único e exato
      }
      $faltaSf = @()
      if ($sfCli) {
        foreach ($c in @('nome','nascimento','cpf','telefone','uf','cidade','bairro','cep','cargo','email','rua')) {
          if (-not ("$($sfCli.$c)").Trim()) { $faltaSf += $c }
        }
      }

      if ($zs -and $zs.achou -and -not $nomeBate) {
        $estado='CONFERIR'; $motivo="O ZS achou '$zsNome', diferente do nome da linha. Confirme se é a mesma pessoa."
      }
      elseif ($zs -and $zs.achou) {
        if (-not $zsCpf) { $falta += 'CPF' }
        if (-not $zsTel) { $falta += 'telefone' }
        if ($falta.Count) {
          $estado='COMPLETAR'
          $motivo='Está no ZS, mas falta ' + (($falta | Select-Object -Unique) -join ' e ') + '.'
          $motivo += $(if ($sfCli) { ' O Salesforce tem os dados para completar.' }
                       else { ' O Salesforce não tem ficha — informe o que falta.' })
        } else {
          $estado='CONFERIR'; $motivo='Achado só pelo nome — informe CPF ou telefone para confirmar.'
        }
      }
      elseif ($sfCli) {
        $estado='CANDIDATO_SF'
        $motivo = $(if ($faltaSf.Count -eq 0) { 'Não está no ZS. O Salesforce tem a ficha completa — dá para cadastrar direto.' }
                    else { 'Não está no ZS. O Salesforce tem a ficha, mas falta ' + ($faltaSf -join ', ') + '.' })
      }
      elseif ($cand.Count) {
        $estado='CANDIDATO_SF'; $motivo="Não está no ZS. O Salesforce tem $($cand.Count) candidato(s) — confirme qual."
      }
      else {
        $estado='NOVO'; $motivo='Não existe no Salesforce nem no ZS — informe os dados para cadastrar no ZS.'
      }
    }
  }

  $saidaItens += [ordered]@{
    n = $it.n; bruto = $it.bruto
    nome = $it.nome; cpf = $it.cpf; telefone = $it.telefone
    turma = $it.turma; produto = $it.produto; valor = $it.valor; pagamento = $it.pagamento
    link = $it.link; linkTipo = $it.linkTipo; oppId = $it.oppId; oppOrg = $it.oppOrg
    estado = $estado; motivo = $motivo
    zs = $(if ($zs -and $zs.achou) { @{ id=$zs.id; nome=$zsNome; cpf=$zsCpf; telefone=$zsTel; consultor=[string]$zs.consultor } } else { $null })
    sf = $(if ($sfCli) { $sfCli } else { $null })
    candidatos = @($cand | Select-Object -First 5)
    venda = $venda
  }
}

$cont = @{}
foreach ($e in @('PRONTO','CONFERIR','COMPLETAR','CANDIDATO_SF','NOVO','LINK','VAGAS')) {
  $cont[$e] = @($saidaItens | Where-Object { $_.estado -eq $e }).Count
}
Sair @{ ok=$true; acao='classificar'; total=$saidaItens.Count; resumo=$cont; itens=$saidaItens }
