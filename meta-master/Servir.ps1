<#
  Servir.ps1
  Servidor local para o gerador Meta Master.
  - Serve os arquivos estaticos da pasta (index.html, dados.js, fotos, etc.)
  - Expoe a rota /api/atualizar?periodo=AAAA-MM que roda o Gerar-Dados-MetaMaster.ps1
    (puxa o faturamento atual do Sales Cube e regenera o dados.js).
  O botao "RECARREGAR DADOS" do index.html chama essa rota e depois recarrega a pagina.

  USO:
    pwsh ./Servir.ps1            (ou duplo-clique no Servir.bat)
  Mantenha a janela aberta enquanto usa. Encerre com Ctrl+C.
#>
param([int]$Porta = 8765)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$root = $PSScriptRoot
$prefix = "http://localhost:$Porta/"

# Autenticacao opcional (Basic Auth). Se existir o arquivo .auth (formato usuario:senha),
# o servidor exige login. Sem o arquivo, roda aberto (uso local). Necessario para expor via tunel.
$authFile = Join-Path $root '.auth'
$authCred = if (Test-Path $authFile) { (Get-Content $authFile -Raw).Trim() } else { $null }
if ($authCred) { Write-Host "Login exigido (arquivo .auth presente)." -ForegroundColor Yellow }

$mime = @{
  '.html'='text/html; charset=utf-8'; '.htm'='text/html; charset=utf-8'
  '.js'='application/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8'
  '.json'='application/json; charset=utf-8'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'
  '.png'='image/png'; '.gif'='image/gif'; '.svg'='image/svg+xml'; '.ico'='image/x-icon'
  '.webp'='image/webp'; '.woff'='font/woff'; '.woff2'='font/woff2'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  Write-Host "Nao consegui abrir a porta $Porta. Feche outro servidor ou use outra porta (-Porta)." -ForegroundColor Red
  return
}
Write-Host "Meta Master rodando em $prefix" -ForegroundColor Green
Write-Host "Abra: ${prefix}index.html  |  Encerrar: Ctrl+C" -ForegroundColor DarkGray
try { Start-Process "${prefix}index.html" } catch {}

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request
  $res = $ctx.Response
  $res.Headers['Cache-Control'] = 'no-store'

  # ---- login (Basic Auth): só exige no acesso EXTERNO (via túnel Cloudflare); local fica livre ----
  $viaCloudflare = ([bool]$req.Headers['Cf-Connecting-Ip']) -or ([bool]$req.Headers['Cf-Ray'])
  if ($authCred -and $viaCloudflare) {
    $hdr = $req.Headers['Authorization']
    $okAuth = $false
    if ($hdr -and $hdr.StartsWith('Basic ')) {
      try { $dec = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($hdr.Substring(6))); if ($dec -eq $authCred) { $okAuth = $true } } catch {}
    }
    if (-not $okAuth) {
      try {
        $res.StatusCode = 401
        $res.AddHeader('WWW-Authenticate', 'Basic realm="Meta Master - acesso restrito"')
        $m = [Text.Encoding]::UTF8.GetBytes('401 - login necessario')
        $res.OutputStream.Write($m, 0, $m.Length)
      } catch {}
      try { $res.Close() } catch {}
      continue
    }
  }

  try {
    $path = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)

    if ($path -eq '/api/leads') {
      # roda o Leads-Vitoria-Campanha.ps1 -Json (consultor x etapa 1-6 + campanhas MCIS/TCE/Outros) e devolve o JSON
      $lde  = $req.QueryString['de'];  if ($lde  -notmatch '^\d{4}-\d{2}-\d{2}$') { $lde = '' }
      $late = $req.QueryString['ate']; if ($late -notmatch '^\d{4}-\d{2}-\d{2}$') { $late = '' }
      $per = if ($lde) { $lde.Substring(0,7) } else { $lp=$req.QueryString['periodo']; if ($lp -match '^\d{4}-\d{2}$') { $lp } else { (Get-Date -Format 'yyyy-MM') } }
      $leadsArgs = @('-Periodo', $per, '-Json')
      if ($lde)  { $leadsArgs += @('-De', $lde) }
      if ($late) { $leadsArgs += @('-Ate', $late) }
      $lcamp = $req.QueryString['campanha']; if ($lcamp -match '^[a-z,]+$') { $leadsArgs += @('-Campanha', $lcamp) }
      $leadsScript = Join-Path (Split-Path $root -Parent) 'Leads-Vitoria-Campanha.ps1'
      $out = & powershell -NoProfile -ExecutionPolicy Bypass -File $leadsScript @leadsArgs *>&1 | Out-String
      $code = $LASTEXITCODE
      # extrai so o objeto JSON (descarta qualquer ruido antes/depois)
      $i = $out.IndexOf('{'); $j = $out.LastIndexOf('}')
      $jsonTxt = if ($i -ge 0 -and $j -gt $i) { $out.Substring($i, $j - $i + 1) } else { '' }
      $okLeads = (($code -eq 0 -or $null -eq $code) -and $jsonTxt)
      $res.StatusCode = if ($okLeads) { 200 } else { 500 }
      $res.ContentType = 'application/json; charset=utf-8'
      $body = if ($okLeads) { $jsonTxt } else { (@{ erro = ($out.Trim()) } | ConvertTo-Json -Compress) }
      $buf = [Text.Encoding]::UTF8.GetBytes($body)
      $res.OutputStream.Write($buf, 0, $buf.Length)
      $res.Close()
      $stamp = (Get-Date -Format 'HH:mm:ss')
      Write-Host "[$stamp] /api/leads periodo=$per -> $($res.StatusCode)" -ForegroundColor Cyan
      continue
    }

    if ($path -eq '/api/metas-consultores') {
      # retorna os consultores COM meta cadastrada na competencia (le metas-vitoria.json da raiz)
      $raiz = Split-Path $root -Parent
      $arq  = Join-Path $raiz 'metas-vitoria.json'
      $per  = $req.QueryString['periodo']; if ($per -notmatch '^\d{4}-\d{2}$') { $per = (Get-Date -Format 'yyyy-MM') }
      $nomes = @()
      try {
        if (Test-Path $arq) {
          $j = Get-Content $arq -Raw -Encoding UTF8 | ConvertFrom-Json
          $comp = $j.$per
          if ($comp -and $comp.consultores) { $nomes = @($comp.consultores.PSObject.Properties.Name) }
        }
      } catch {}
      $parts = $nomes | ForEach-Object { $_ | ConvertTo-Json -Compress }   # cada nome vira "..." com escape correto
      $json  = '[' + ($parts -join ',') + ']'
      $res.StatusCode = 200; $res.ContentType = 'application/json; charset=utf-8'
      $b = [Text.Encoding]::UTF8.GetBytes($json)
      $res.OutputStream.Write($b, 0, $b.Length); $res.Close()
      Write-Host "[$((Get-Date -Format 'HH:mm:ss'))] /api/metas-consultores periodo=$per -> $($nomes.Count)" -ForegroundColor DarkCyan
      continue
    }

    if ($path -eq '/api/cmd') {
      # executor generico da aba Comandos: mapeia um id whitelisted -> script + args validados
      $id  = $req.QueryString['id']
      $de  = $req.QueryString['de'];  if ($de  -notmatch '^\d{4}-\d{2}-\d{2}$') { $de = '' }
      $ate = $req.QueryString['ate']; if ($ate -notmatch '^\d{4}-\d{2}-\d{2}$') { $ate = '' }
      # mes de contexto (metas/rotulos) = mes da data inicial; senao 'periodo'; senao mes atual
      $per = if ($de) { $de.Substring(0,7) } else { $p0=$req.QueryString['periodo']; if ($p0 -match '^\d{4}-\d{2}$') { $p0 } else { (Get-Date -Format 'yyyy-MM') } }
      $por = $req.QueryString['por'];     if ($por -ne 'faturamento') { $por = 'fechamento' }
      $etp = $req.QueryString['etapa']
      $con = $req.QueryString['consultor']
      $det = $req.QueryString['detalhe']
      $lnk = $req.QueryString['link']
      $fxs = $req.QueryString['faixas']
      $raiz = Split-Path $root -Parent
      $script = $null; $psArgs = @()
      switch ($id) {
        'faturamento'     { $script='Faturamento-Vitoria.ps1';    $psArgs=@('-Periodo',$per,'-Por',$por); if($con){$psArgs+=@('-Consultor',$con)}; if($det -eq '1'){$psArgs+='-Detalhe'} }
        'metaUnidade'     { $script='Meta-Vitoria.ps1';           $psArgs=@('-Escopo','Unidade','-Periodo',$per,'-Por',$por) }
        'metaConsultores' { $script='Meta-Vitoria.ps1';           $psArgs=@('-Escopo','Consultores','-Periodo',$per,'-Por',$por); if($con){$psArgs+=@('-Consultor',$con)} }
        'metaGeral'       { $script='Meta-Vitoria.ps1';           $psArgs=@('-Escopo','Geral','-Periodo',$per,'-Por',$por) }
        'leads'           { $script='Leads-Vitoria.ps1';          $psArgs=@('-Periodo',$per); if($etp -match '^[1-6]$'){$psArgs+=@('-Etapa',$etp)} }
        'leadsCampanha'   { $script='Leads-Vitoria-Campanha.ps1'; $psArgs=@('-Periodo',$per) }
        'movimentacao'    { $script='Movimentacao-Leads.ps1';     $psArgs=@('-Periodo',$per) }
        'negociacoes'     { $script='Negociacoes-Vitoria.ps1';    $psArgs=@(); if($con){$psArgs+=@('-Consultor',$con)}; if($fxs -match '^[\d]+-[\d]*(,[\d]+-[\d]*)*$'){$psArgs+=@('-Faixas',$fxs)} }
        'leituraTurma'    { $script='Leitura-Turma.ps1';          $psArgs=@('-Link',$lnk) }
        'relatorioTurma'  { $script='Relatorio-Turma.ps1';        $psArgs=@('-Link',$lnk) }
      }
      if (-not $script) {
        $res.StatusCode = 400; $res.ContentType = 'text/plain; charset=utf-8'
        $b = [Text.Encoding]::UTF8.GetBytes("Comando desconhecido: $id")
        $res.OutputStream.Write($b, 0, $b.Length); $res.Close(); continue
      }
      if (($de -or $ate) -and $id -notin 'leituraTurma','relatorioTurma') { if($de){$psArgs+=@('-De',$de)}; if($ate){$psArgs+=@('-Ate',$ate)} }   # intervalo de datas
      $full = Join-Path $raiz $script
      $out  = & powershell -NoProfile -ExecutionPolicy Bypass -File $full @psArgs *>&1 | Out-String
      $code = $LASTEXITCODE
      $okCmd = ($code -eq 0 -or $null -eq $code)
      $res.StatusCode = if ($okCmd) { 200 } else { 500 }
      $res.ContentType = 'text/plain; charset=utf-8'
      $buf = [Text.Encoding]::UTF8.GetBytes($out)
      $res.OutputStream.Write($buf, 0, $buf.Length); $res.Close()
      $stamp = (Get-Date -Format 'HH:mm:ss')
      Write-Host "[$stamp] /api/cmd id=$id periodo=$per -> $($res.StatusCode)" -ForegroundColor Cyan
      continue
    }

    if ($path -eq '/api/acao') {
      # Acoes de leads (escrita no CRM): GET=preview (read-only), POST=apply (grava)
      $raiz   = Split-Path $root -Parent
      $script = Join-Path $raiz 'Acoes-Leads-Vitoria.ps1'
      $acao   = $req.QueryString['acao']
      if ($acao -notin 'equilibrio','equilibrioCampanha','transferencia','transferenciaCampanha','transferenciaIndividual','transferenciaIndividualCampanha') {
        $res.StatusCode = 400; $res.ContentType = 'application/json; charset=utf-8'
        $b = [Text.Encoding]::UTF8.GetBytes((@{ erro = "Acao invalida: $acao" } | ConvertTo-Json -Compress))
        $res.OutputStream.Write($b, 0, $b.Length); $res.Close(); continue
      }

      if ($req.HttpMethod -eq 'POST') {
        # APLICAR: le o plano confirmado do corpo, grava em arquivo temp e roda o script em modo apply
        $reader = New-Object System.IO.StreamReader($req.InputStream, $req.ContentEncoding)
        $body = $reader.ReadToEnd(); $reader.Close()
        $tmp = Join-Path $env:TEMP ('acao_plano_' + [Guid]::NewGuid().ToString('N') + '.json')
        [System.IO.File]::WriteAllText($tmp, $body, (New-Object System.Text.UTF8Encoding($false)))
        $out  = & powershell -NoProfile -ExecutionPolicy Bypass -File $script -Acao $acao -Modo apply -PlanoFile $tmp *>&1 | Out-String
        $code = $LASTEXITCODE
        Remove-Item $tmp -ErrorAction SilentlyContinue
      } else {
        # PREVIEW: monta os argumentos a partir da querystring (so os preenchidos)
        $psArgs = @('-Acao', $acao, '-Modo', 'preview')
        $qDe  = $req.QueryString['de'];  if ($qDe  -match '^\d{4}-\d{2}-\d{2}$') { $psArgs += @('-De', $qDe) }
        $qAte = $req.QueryString['ate']; if ($qAte -match '^\d{4}-\d{2}-\d{2}$') { $psArgs += @('-Ate', $qAte) }
        if ($req.QueryString['base'])         { $psArgs += @('-Base', $req.QueryString['base']) }
        if ($req.QueryString['cruzamento'] -eq '1') { $psArgs += @('-Cruzamento') }
        if ($req.QueryString['participantes']){ $psArgs += @('-Participantes', $req.QueryString['participantes']) }
        if ($req.QueryString['campanha'])     { $psArgs += @('-Campanha', $req.QueryString['campanha']) }
        if ($req.QueryString['ordem'])        { $psArgs += @('-Ordem', $req.QueryString['ordem']) }
        if ($req.QueryString['origem'])       { $psArgs += @('-Origem', $req.QueryString['origem']) }
        if ($req.QueryString['destino'])      { $psArgs += @('-Destino', $req.QueryString['destino']) }
        if ($req.QueryString['etapaOrigem'])  { $psArgs += @('-EtapaOrigem', $req.QueryString['etapaOrigem']) }
        if ($req.QueryString['etapaDestino']) { $psArgs += @('-EtapaDestino', $req.QueryString['etapaDestino']) }
        $qtd = $req.QueryString['quantidade']; if ($qtd -match '^\d+$') { $psArgs += @('-Quantidade', $qtd) }
        $out  = & powershell -NoProfile -ExecutionPolicy Bypass -File $script @psArgs *>&1 | Out-String
        $code = $LASTEXITCODE
      }
      # extrai so o objeto JSON (descarta ruido antes/depois)
      $i = $out.IndexOf('{'); $j = $out.LastIndexOf('}')
      $jsonTxt = if ($i -ge 0 -and $j -gt $i) { $out.Substring($i, $j - $i + 1) } else { '' }
      $res.StatusCode = if ($jsonTxt) { 200 } else { 500 }
      $res.ContentType = 'application/json; charset=utf-8'
      $body2 = if ($jsonTxt) { $jsonTxt } else { (@{ erro = ($out.Trim()) } | ConvertTo-Json -Compress) }
      $buf = [Text.Encoding]::UTF8.GetBytes($body2)
      $res.OutputStream.Write($buf, 0, $buf.Length); $res.Close()
      $stamp = (Get-Date -Format 'HH:mm:ss')
      Write-Host "[$stamp] /api/acao $($req.HttpMethod) acao=$acao -> $($res.StatusCode)" -ForegroundColor Magenta
      continue
    }

    if ($path -eq '/api/metas') {
      # Cadastro/edicao de metas: GET le o bloco da competencia; POST grava (preserva os demais meses)
      $raiz = Split-Path $root -Parent
      $arq  = Join-Path $raiz 'metas-vitoria.json'
      $per  = $req.QueryString['periodo']; if ($per -notmatch '^\d{4}-\d{2}$') { $per = (Get-Date -Format 'yyyy-MM') }

      if ($req.HttpMethod -eq 'POST') {
        $reader = New-Object System.IO.StreamReader($req.InputStream, $req.ContentEncoding)
        $bodyTxt = $reader.ReadToEnd(); $reader.Close()
        try {
          $in = $bodyTxt | ConvertFrom-Json
          $pp = "$($in.periodo)"; if ($pp -notmatch '^\d{4}-\d{2}$') { throw "periodo invalido: $pp" }
          if (Test-Path $arq) { $all = [IO.File]::ReadAllText($arq, [Text.Encoding]::UTF8) | ConvertFrom-Json }
          else { $all = [pscustomobject]@{ _doc = 'Metas Vitoria por competencia (AAAA-MM).' } }
          $bloco = [ordered]@{}
          if ($in.unidade -and $in.unidade.minima) {
            $bloco['unidade'] = [ordered]@{ minima=[double]$in.unidade.minima; basica=[double]$in.unidade.basica; master=[double]$in.unidade.master }
          }
          $cons = [ordered]@{}
          if ($in.consultores) {
            foreach ($p in $in.consultores.PSObject.Properties) {
              $v = $p.Value
              if ($v -and $v.minima) { $cons[$p.Name] = [ordered]@{ minima=[double]$v.minima; basica=[double]$v.basica; master=[double]$v.master } }
            }
          }
          $bloco['consultores'] = $cons
          $all | Add-Member -NotePropertyName $pp -NotePropertyValue ([pscustomobject]$bloco) -Force
          $json = $all | ConvertTo-Json -Depth 8
          [IO.File]::WriteAllText($arq, $json, (New-Object Text.UTF8Encoding($false)))
          $res.StatusCode = 200; $res.ContentType = 'application/json; charset=utf-8'
          $b = [Text.Encoding]::UTF8.GetBytes((@{ ok=$true; periodo=$pp } | ConvertTo-Json -Compress))
          $res.OutputStream.Write($b, 0, $b.Length)
        } catch {
          $res.StatusCode = 500; $res.ContentType = 'application/json; charset=utf-8'
          $b = [Text.Encoding]::UTF8.GetBytes((@{ erro = $_.Exception.Message } | ConvertTo-Json -Compress))
          $res.OutputStream.Write($b, 0, $b.Length)
        }
        $res.Close()
      } else {
        $out = [ordered]@{ periodo=$per; existe=$false; unidade=$null; consultores=[ordered]@{} }
        if (Test-Path $arq) {
          $all = [IO.File]::ReadAllText($arq, [Text.Encoding]::UTF8) | ConvertFrom-Json
          $comp = $all.$per
          if ($comp) {
            $out['existe'] = $true
            if ($comp.unidade) { $out['unidade'] = $comp.unidade }
            if ($comp.consultores) {
              $c = [ordered]@{}; foreach ($p in $comp.consultores.PSObject.Properties) { $c[$p.Name] = $p.Value }
              $out['consultores'] = $c
            }
          }
        }
        $res.StatusCode = 200; $res.ContentType = 'application/json; charset=utf-8'
        $b = [Text.Encoding]::UTF8.GetBytes(([pscustomobject]$out | ConvertTo-Json -Depth 8))
        $res.OutputStream.Write($b, 0, $b.Length); $res.Close()
      }
      $stamp = (Get-Date -Format 'HH:mm:ss')
      Write-Host "[$stamp] /api/metas $($req.HttpMethod) periodo=$per -> $($res.StatusCode)" -ForegroundColor Yellow
      continue
    }

    if ($path -eq '/api/atualizar') {
      # roda o gerador (faturamento atual -> dados.js)
      $per = $req.QueryString['periodo']
      if ([string]::IsNullOrWhiteSpace($per)) { $per = (Get-Date -Format 'yyyy-MM') }
      if ($per -notmatch '^\d{4}-\d{2}$') { $per = (Get-Date -Format 'yyyy-MM') }
      $gerador = Join-Path $root 'Gerar-Dados-MetaMaster.ps1'
      $saida = & powershell -NoProfile -ExecutionPolicy Bypass -File $gerador -Periodo $per *>&1 | Out-String
      $code  = $LASTEXITCODE
      $okGen = ($code -eq 0 -or $code -eq $null)
      $res.StatusCode = if ($okGen) { 200 } else { 500 }
      $res.ContentType = 'text/plain; charset=utf-8'
      $buf = [Text.Encoding]::UTF8.GetBytes($saida)
      $res.OutputStream.Write($buf, 0, $buf.Length)
      $res.Close()
      $stamp = (Get-Date -Format 'HH:mm:ss')
      Write-Host "[$stamp] /api/atualizar periodo=$per -> $($res.StatusCode)" -ForegroundColor Cyan
      continue
    }

    # arquivos estaticos
    if ($path -eq '/' ) { $path = '/index.html' }
    $rel = $path.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
    $full = Join-Path $root $rel
    # nao servir scripts/bat por seguranca
    $ext = [IO.Path]::GetExtension($full).ToLower()
    if ($ext -in '.ps1','.bat','.cmd') { $res.StatusCode = 403; $res.Close(); continue }

    if ((Test-Path $full -PathType Leaf) -and ($full.StartsWith($root))) {
      $ct = $mime[$ext]; if (-not $ct) { $ct = 'application/octet-stream' }
      $res.ContentType = $ct
      $bytes = [IO.File]::ReadAllBytes($full)
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
      $msg = [Text.Encoding]::UTF8.GetBytes('404 - nao encontrado')
      $res.OutputStream.Write($msg, 0, $msg.Length)
    }
    $res.Close()
  } catch {
    try { $res.StatusCode = 500; $res.Close() } catch {}
    Write-Host "Erro: $($_.Exception.Message)" -ForegroundColor Red
  }
}
