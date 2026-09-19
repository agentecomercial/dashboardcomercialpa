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

# ---- Fase 4.4: rodar um script com limite de tempo ----
# O servidor atende uma requisicao por vez; uma chamada ao CRM que trava, travava tudo.
# Aqui o filho e morto no prazo e a rota responde um erro legivel em vez de ficar pendurada.
$script:ultimoExit = 0
# ---- registro de falha em arquivo ----
# O servir-erros.log so recebia o que estourava como excecao na rota. Falha que o codigo
# "tratava" (script filho voltando erro, snapshot recusado) nao deixava rastro — foi o que
# tornou o incidente de 18/09/2026 dificil de diagnosticar: o painel zerou e o log ficou mudo.
function Log-Erro($contexto, $detalhe) {
  try {
    $linha = "[{0}] {1}`r`n  {2}`r`n" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $contexto, ([string]$detalhe).Trim()
    [IO.File]::AppendAllText((Join-Path $root 'servir-erros.log'), $linha, [Text.Encoding]::UTF8)
  } catch {}
}

# ---- gravacao atomica de dado do usuario (auditoria 18/09/2026) ----
# O padrao antigo era WriteAllText direto no arquivo final. Tres problemas:
#   1. interrupcao no meio (Ctrl+C no servidor, disco cheio) deixa o arquivo
#      truncado -- e /api/estado le com catch vazio, enxerga {} e o POST
#      seguinte grava so o patch, apagando 1 MB de fotos e preferencias;
#   2. nao havia backup de nada;
#   3. gravar "{}" por cima de um arquivo cheio passava sem reclamar.
# Aqui: recusa vazio por cima de cheio, guarda o .prev e so entao troca o
# arquivo. O padrao ja existia em /api/leads (snapshot) -- faltava valer para
# o dado DIGITADO, que e o insubstituivel.
function Gravar-Atomico {
  param(
    [string]$Arquivo,
    [string]$Conteudo,
    [switch]$PermitirVazio   # so para quem quer mesmo esvaziar
  )
  if ($null -eq $Conteudo) { throw 'conteudo nulo' }

  $novoVazio = ($Conteudo.Trim() -in @('', '{}', '[]'))
  if ($novoVazio -and -not $PermitirVazio -and (Test-Path $Arquivo)) {
    if ((Get-Item $Arquivo).Length -gt 4) {
      Log-Erro "Gravar-Atomico RECUSADO" "$Arquivo : tentativa de gravar vazio por cima de arquivo com conteudo"
      throw "recusado: gravar vazio por cima de $([IO.Path]::GetFileName($Arquivo)) que tem conteudo"
    }
  }

  $dir = Split-Path $Arquivo -Parent
  if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

  # passo atras antes de qualquer troca
  if (Test-Path $Arquivo) {
    try { [IO.File]::Copy($Arquivo, "$Arquivo.prev", $true) } catch {}
  }

  # grava no temporario e SO ENTAO troca: interrupcao aqui nao deixa o arquivo
  # final pela metade -- no pior caso sobra o .tmp, que ninguem le
  $tmp = "$Arquivo.tmp"
  [IO.File]::WriteAllText($tmp, $Conteudo, (New-Object Text.UTF8Encoding($false)))
  [IO.File]::Copy($tmp, $Arquivo, $true)
  Remove-Item $tmp -Force -ErrorAction SilentlyContinue
}

function Invoke-ScriptTimeout {
  param([string]$Arquivo, [string[]]$Argumentos, [int]$TimeoutSeg = 240)
  # stdout e stderr em arquivos separados: sem capturar o stderr, um erro do script filho virava
  # uma resposta 500 com {"erro":""} e o app nao tinha o que mostrar.
  $tmpOut = [IO.Path]::GetTempFileName()
  $tmpErr = [IO.Path]::GetTempFileName()
  $pr = $null
  try {
    $partes = @()
    foreach ($a in @($Argumentos)) { if ($a -match '[\s"]') { $partes += ('"' + ($a -replace '"','\"') + '"') } else { $partes += $a } }
    $argLine = '-NoProfile -ExecutionPolicy Bypass -File "' + $Arquivo + '" ' + ($partes -join ' ')
    $pr = Start-Process -FilePath 'powershell.exe' -ArgumentList $argLine -NoNewWindow -PassThru `
            -RedirectStandardOutput $tmpOut -RedirectStandardError $tmpErr
    # Tocar em .Handle AGORA (com o filho ainda vivo) e o que faz o .NET reter o handle do
    # processo. Sem isto o ExitCode volta $null depois que ele termina — e como o chamador
    # tratava $null como sucesso, a checagem por codigo de saida nunca valeu nada: um filho
    # que morria de verdade era lido como carga boa.
    try { $null = $pr.Handle } catch {}
    if (-not $pr.WaitForExit($TimeoutSeg * 1000)) {
      try { $pr.Kill() } catch {}
      $script:ultimoExit = 124
      return ('{"erro":"tempo esgotado (' + $TimeoutSeg + ' s) consultando o CRM — tente de novo"}')
    }
    # WaitForExit(ms) devolve o controle, mas o objeto do Start-Process -PassThru ainda nao
    # tem o ExitCode populado — ele vinha $null, e o chamador tratava $null como SUCESSO. Ou
    # seja: a checagem por codigo de saida nunca valeu nada. Este WaitForExit() sem argumento
    # (o processo ja terminou, nao bloqueia) e o Refresh preenchem o campo de verdade.
    try { $pr.WaitForExit() } catch {}
    try { $pr.Refresh() } catch {}
    $script:ultimoExit = $null
    try { $script:ultimoExit = $pr.ExitCode } catch {}
    $txt = ''; $err = ''
    try { $txt = [IO.File]::ReadAllText($tmpOut, [Text.Encoding]::UTF8) } catch {}
    try { $err = [IO.File]::ReadAllText($tmpErr, [Text.Encoding]::UTF8) } catch {}
    # O stderr NUNCA MAIS e jogado fora. Em 18/09/2026 o filho gritou "no available server" em
    # 4 linhas de stderr, o stdout tinha um JSON (de zeros) e este if descartou o diagnostico
    # inteiro: a falha nao deixou uma linha sequer no log e o painel mostrou "0 leads".
    $script:ultimoErr = $err.Trim()
    if ($script:ultimoErr) {
      Log-Erro ("[filho] " + (Split-Path $Arquivo -Leaf) + " exit=" + $script:ultimoExit) $script:ultimoErr
    }
    # so devolve o stderr quando o filho falhou E nao produziu saida util
    if ((-not $txt.Trim()) -and $err.Trim()) { return $err }
    return $txt
  } finally {
    try { Remove-Item $tmpOut -Force -ErrorAction SilentlyContinue } catch {}
    try { Remove-Item $tmpErr -Force -ErrorAction SilentlyContinue } catch {}
  }
}
# ---- JSON valido? (usado antes de servir um snapshot do disco) ----
function Json-Valido($t){
  if (-not $t) { return $false }
  try { $null = ($t | ConvertFrom-Json); return $true } catch { return $false }
}
# ---- O payload de leads merece ser gravado? ----
# Devolve '' se o dado e confiavel, ou o motivo da recusa. Existe por causa de 18/09/2026:
# o CRM caiu (503), o coletor devolveu zeros com exit 0, e "exit 0 + JSON parseavel" bastou
# para o snapshot bom ser sobrescrito. Aqui o payload precisa PROVAR que veio de leitura
# completa — e ainda ha uma conferencia contra o que ja havia em disco.
function Leads-PayloadSuspeito($Json, $Snapshot) {
  if (-not $Json) { return 'o coletor nao devolveu JSON' }
  $o = $null
  try { $o = $Json | ConvertFrom-Json } catch { return 'JSON ilegivel' }
  if (-not $o) { return 'JSON vazio' }
  if ($o.PSObject.Properties['erro'])             { return ([string]$o.erro) }
  if ($o.PSObject.Properties['fonteIndisponivel'] -and $o.fonteIndisponivel) { return 'o coletor marcou fonte indisponivel' }
  if (-not $o.PSObject.Properties['consultores']) { return 'payload sem consultores' }
  $av = $o.avisos
  if ($av) {
    if ($av.PSObject.Properties['fonteIndisponivel'] -and $av.fonteIndisponivel) { return 'avisos.fonteIndisponivel' }
    if ($av.PSObject.Properties['etapasSemLeitura'] -and ([int]$av.etapasSemLeitura) -gt 0) {
      return ("$([int]$av.etapasSemLeitura) etapa(s) nao lida(s)")
    }
  }
  $total = 0; if ($o.PSObject.Properties['totalGeral']) { $total = [int]$o.totalGeral }
  # --- carga DEGRADADA (auditoria 19/09/2026, Fase 2) --------------------------
  # Antes bastava "totalGeral > 0" para o payload ser aceito. Se o CRM caisse DEPOIS
  # das 6 etapas, durante o enriquecimento (produtos/notas), a carga entrava com os
  # leads certos mas com vendas CIS, conversao e "parado" degradados -- e ficava
  # 2 h no snapshot, carimbada como fresca.
  # Calibragem com dado real (19/09/2026): 439 leads, 3 produtos sem leitura (0,7%).
  # Falha pontual e normal; o que denuncia queda no meio e a falha em MASSA.
  if ($av -and $total -gt 0) {
    $fn = 0; if ($av.PSObject.Properties['notasSemLeitura'])    { $fn = [int]$av.notasSemLeitura }
    $fp = 0; if ($av.PSObject.Properties['produtosSemLeitura']) { $fp = [int]$av.produtosSemLeitura }
    $limite = [Math]::Max(10, [int]($total * 0.10))
    if (($fn + $fp) -gt $limite) {
      return ("leitura degradada: $fn nota(s) e $fp produto(s) sem leitura em $total leads (limite $limite)")
    }
  }
  if ($total -gt 0) { return '' }          # tem lead e enriquecimento sadio: carga boa
  # --- daqui para baixo, o payload diz "zero". Zero pode ser verdade, mas exige prova. ---
  # Impressao digital do CRM mudo: nenhum nome de etapa veio do CRM (nome == curto nas 6) e
  # nenhum lead. Numa leitura real os rotulos do Sales Cube sao diferentes dos de fallback.
  $etapas = @($o.etapas)
  if ($etapas.Count -gt 0) {
    $iguais = 0
    foreach ($e in $etapas) { if ([string]$e.nome -eq [string]$e.curto) { $iguais++ } }
    if ($iguais -eq $etapas.Count) { return 'zero leads e nenhum nome de etapa vindo do CRM' }
  }
  # Zero onde antes havia movimento: nao sobrescreve sem confirmacao explicita (?forcar=1).
  if ($Snapshot -and (Test-Path $Snapshot)) {
    try {
      $ant = [IO.File]::ReadAllText($Snapshot, [Text.Encoding]::UTF8) | ConvertFrom-Json
      if ($ant -and $ant.PSObject.Properties['totalGeral'] -and ([int]$ant.totalGeral) -gt 0) {
        return ('zero leads onde o snapshot anterior tinha ' + [int]$ant.totalGeral)
      }
    } catch {}
  }
  return ''
}
# ---- Fase 4.5: metas de leads em arquivo, anexadas ao JSON servido ----
# metas-leads-vitoria.json (raiz) por competencia AAAA-MM; vale a mais recente <= periodo.
# A insercao e textual, no inicio do objeto: parsear e reserializar o JSON dos leads no
# PowerShell 5.1 desembrulha arrays de 1 item e quebraria o app.
function Anexar-MetasLeads {
  param([string]$Json, [string]$Periodo, [bool]$DoSnapshot)
  try {
    $mJson = 'null'
    $arq = Join-Path (Split-Path $root -Parent) 'metas-leads-vitoria.json'
    if (Test-Path $arq) {
      $all = Get-Content $arq -Raw -Encoding UTF8 | ConvertFrom-Json
      $chaves = @($all.PSObject.Properties.Name | Where-Object { $_ -match '^\d{4}-\d{2}$' -and $_ -le $Periodo } | Sort-Object)
      if ($chaves.Count) { $mJson = ($all.($chaves[-1]) | ConvertTo-Json -Depth 8 -Compress) }
    }
    $flag = if ($DoSnapshot) { 'true' } else { 'false' }
    $j = $Json.TrimStart()
    if ($j.StartsWith('{')) { return ('{"metasLeads":' + $mJson + ',"doSnapshot":' + $flag + ',' + $j.Substring(1)) }
    return $Json
  } catch { return $Json }
}
# Aceita a rede local (celular via http://IP:8765) quando existe a reserva de urlacl para "+".
# Sem a reserva (ou sem admin), o Start() falha e caimos para localhost. NUNCA registrar os dois
# prefixos no MESMO listener: eles conflitam no http.sys e tudo cai no fallback.
$prefix    = "http://+:$Porta/"
$prefixUrl = "http://localhost:$Porta/"

# Desliga o QuickEdit do console: um clique/selecao na janela preta congela o processo no proximo
# Write-Host e o servidor para de responder (no navegador aparece "Failed to fetch" nas abas).
try {
  if (-not ('Win32.ConsoleQE' -as [type])) {
    Add-Type -Namespace Win32 -Name ConsoleQE -MemberDefinition @'
[DllImport("kernel32.dll", SetLastError=true)] public static extern IntPtr GetStdHandle(int nStdHandle);
[DllImport("kernel32.dll", SetLastError=true)] public static extern bool GetConsoleMode(IntPtr hConsoleHandle, out uint lpMode);
[DllImport("kernel32.dll", SetLastError=true)] public static extern bool SetConsoleMode(IntPtr hConsoleHandle, uint dwMode);
'@
  }
  $hIn = [Win32.ConsoleQE]::GetStdHandle(-10)   # STD_INPUT_HANDLE
  $modo = 0
  if ([Win32.ConsoleQE]::GetConsoleMode($hIn, [ref]$modo)) {
    # tira ENABLE_QUICK_EDIT_MODE (0x40) e liga ENABLE_EXTENDED_FLAGS (0x80)
    [void][Win32.ConsoleQE]::SetConsoleMode($hIn, (($modo -band (-bnot 0x40)) -bor 0x80))
  }
} catch {}

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
  '.webmanifest'='application/manifest+json; charset=utf-8'
}

# A QueryString do HttpListener chega em Latin1: acento vira lixo. Ler da query BRUTA e decodificar UTF-8.
function QsUtf8($req, [string]$chave) {
  try {
    $m = [regex]::Match($req.Url.Query, '(?:^\?|&)' + [regex]::Escape($chave) + '=([^&]*)')
    if (-not $m.Success) { return '' }
    return [Uri]::UnescapeDataString($m.Groups[1].Value.Replace('+','%20'))
  } catch { return '' }
}

# ARMADILHA DO PS 5.1: com $ErrorActionPreference='Stop', UMA linha escrita no stderr por um
# processo nativo (powershell.exe filho) vira ERRO TERMINANTE ao usar 2>&1 / *>&1. Resultado:
# a rota morria no catch geral e devolvia 500 SEM CORPO, mesmo tendo o filho funcionado.
# Aqui o EAP cai para 'Continue' durante a chamada, e o stderr vira texto normal.
# Ponto unico por onde as demais rotas chamam script filho. Ganhou limite de tempo: o servidor
# atende uma requisicao por vez, entao um filho travado congelava tudo, sem erro nem fim.
# Mantem o comportamento antigo de juntar stderr na saida (EAP Continue + 2>&1).
# ---- executor unico de script filho (auditoria 18/09/2026, concluida em 19/09/2026) ----
# Existiam TRES formas de rodar um .ps1 aqui, com garantias diferentes:
#   Invoke-ScriptTimeout  -> timeout + exit code confiavel (usada por 1 rota)
#   Rodar-Filho           -> Start-Job, sem exit code  [REMOVIDA em 19/09/2026]
#   & powershell ... *>&1 -> 17 rotas: SEM TIMEOUT e sem exit code util
# Hoje TODAS as rotas usam Exec-Filho. A ultima a migrar foi /api/vendas-zs, que
# fecha Ganho e remove vaga no ZS -- a rota de maior poder de escrita estava no
# mecanismo que nao sabia dizer se o filho tinha falhado.
# Num servidor que atende uma requisicao por vez, um filho travado congela o
# app inteiro -- e era o caso em 17 das 23 rotas.
#
# Exec-Filho devolve exatamente o mesmo texto que o "*>&1 | Out-String" devolvia
# (stdout + stderr juntos, na ordem), para nao mudar o parsing de quem chama.
# O que muda e o que vem DE BRINDE: timeout, $script:ultimoExit confiavel e
# stderr registrado no log em vez de descartado.
function Exec-Filho {
  param(
    [string]$Arquivo,
    [object[]]$Argumentos = @(),
    [int]$TimeoutSeg = 240,
    [switch]$SoStdout       # para quem quer o JSON limpo, sem ruido de stderr
  )
  $txt = Invoke-ScriptTimeout -Arquivo $Arquivo -Argumentos ([string[]]$Argumentos) -TimeoutSeg $TimeoutSeg
  if ($SoStdout) { return $txt }
  # o *>&1 antigo juntava stderr no texto; varias rotas dependem disso
  # (a /api/lancamentos, por exemplo, procura "ERRO" no log do filho)
  if ($script:ultimoErr) { return ($txt + "`r`n" + $script:ultimoErr) }
  return $txt
}

# ---- a resposta de uma rota que chamou filho ----
# Regra unica, para nao repetir criterio de sucesso em 22 lugares diferentes.
# Devolve $null se esta tudo bem; senao devolve o motivo da falha.
function Falha-DoFilho {
  param([string]$Saida, [int]$CodigoSaida = 0)
  if ($CodigoSaida -ne 0 -and $CodigoSaida -ne 124) { return "o script terminou com codigo $CodigoSaida" }
  if ($CodigoSaida -eq 124) { return 'tempo esgotado consultando o CRM' }
  # sinais de fonte fora do ar no stderr do filho -- era exatamente o que
  # acontecia em 18/09/2026 e o servidor descartava
  if ($Saida -match '(?i)no available server|503|service unavailable|nao foi possivel resolver|timed out') {
    if ($Saida -notmatch '"ok"\s*:\s*true') { return 'CRM indisponivel' }
  }
  return $null
}


$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$naRede = $true
try {
  $listener.Start()
} catch {
  # sem reserva de urlacl para "+": volta para o modo so-local
  $naRede = $false
  $listener = New-Object System.Net.HttpListener
  $listener.Prefixes.Add($prefixUrl)
  try {
    $listener.Start()
  } catch {
    Write-Host "Nao consegui abrir a porta $Porta. Feche outro servidor ou use outra porta (-Porta)." -ForegroundColor Red
    return
  }
}
Write-Host "Meta Master rodando em $prefixUrl" -ForegroundColor Green

# ---- copia diaria dos dados (auditoria 18/09/2026) ----
# estado.json, metas e fotos sao reescritos INTEIROS a cada gravacao e estao no
# .gitignore: ate aqui nao existia copia nenhuma. Uma gravacao interrompida
# levava tudo junto. Roda ao subir, e uma vez por dia basta.
try {
  $bkpScript = Join-Path $root 'Backup-Dados.ps1'
  if (Test-Path $bkpScript) {
    $bkpMsg = & $bkpScript -Raiz $root
    if ($bkpMsg) { Write-Host "  $bkpMsg" -ForegroundColor DarkGray }
  }
} catch {
  # nunca impedir o servidor de subir por causa do backup
  Write-Host "  backup falhou: $($_.Exception.Message)" -ForegroundColor DarkYellow
}

# ── Acesso pela rede: conferido a cada vez que o servidor sobe ────────────────
# Trocar de Wi-Fi nao pode exigir reconfiguracao. Aqui so CONFERIMOS (sem admin) se a
# reserva de URL e a regra de firewall estao de pe e valendo em qualquer perfil de rede;
# faltando alguma, chamamos o Liberar-Acesso-Rede.ps1 elevado (uma confirmacao do UAC)
# em vez de deixar o celular fora do ar sem explicacao.
function Acesso-Rede-Ok([int]$p) {
  try {
    $temUrl = @(netsh http show urlacl) -match [Regex]::Escape("http://+:$p/")
    if (-not $temUrl) { return $false }
    $fw = Get-NetFirewallRule -DisplayName "META MASTER $p" -ErrorAction SilentlyContinue
    if (-not $fw) { return $false }
    if ($fw.Enabled -ne 'True' -and $fw.Enabled -ne $true) { return $false }
    # 'Any' cobre a rede nova que o Windows marca como Publica ao conectar
    if ("$($fw.Profile)" -notmatch 'Any') { return $false }
    return $true
  } catch { return $false }
}

$acessoOk = Acesso-Rede-Ok $Porta
if ($naRede -and -not $acessoOk) {
  Write-Host "Liberacao de rede incompleta - pedindo permissao para ajustar (UAC)..." -ForegroundColor Yellow
  try {
    $lib = Join-Path $PSScriptRoot 'Liberar-Acesso-Rede.ps1'
    Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',"`"$lib`"",'-Porta',$Porta -ErrorAction Stop
    Write-Host "Confirme na janela que abriu; depois feche e reabra o Meta Master." -ForegroundColor Yellow
  } catch {
    Write-Host "Nao consegui elevar. Rode o Liberar-Acesso-Rede.ps1 como administrador." -ForegroundColor DarkGray
  }
}

if ($naRede) {
  $ips = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
           Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '169.*' -and $_.PrefixOrigin -ne 'WellKnown' })
  $rede = (Get-NetConnectionProfile -ErrorAction SilentlyContinue | Select-Object -First 1).Name
  if ($rede) { Write-Host ("Rede atual: {0}{1}" -f $rede, $(if($acessoOk){' (liberada)'}else{''})) -ForegroundColor DarkGray }
  # O IP muda a cada rede/DHCP. NAO adianta anunciar o nome .local: o Chrome no Android nao
  # resolve mDNS. Quem resolve de verdade e o QR do app (clique no endereco no topo do Ranking),
  # que sempre traz o endereco de agora - basta apontar a camera.
  foreach ($ip in $ips) { Write-Host ("No celular (mesma rede): http://{0}:{1}/" -f $ip.IPAddress, $Porta) -ForegroundColor Yellow }
  Write-Host "  Trocou de rede? No app, clique no endereco no topo do Ranking e leia o QR." -ForegroundColor DarkGray
} else {
  Write-Host "So local. Para abrir no celular, rode o Liberar-Acesso-Rede.ps1 como administrador." -ForegroundColor DarkGray
}
Write-Host "Abra: ${prefixUrl}index.html  |  Encerrar: Ctrl+C" -ForegroundColor DarkGray
try { Start-Process "${prefixUrl}index.html" } catch {}

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request
  $res = $ctx.Response
  $res.Headers['Cache-Control'] = 'no-store'

  # ---- login (Basic Auth): exige em todo acesso que NAO seja deste PC (tunel Cloudflare ou
  #      celular/colega na rede local). O proprio computador (localhost) continua livre. ----
  $viaCloudflare = ([bool]$req.Headers['Cf-Connecting-Ip']) -or ([bool]$req.Headers['Cf-Ray'])
  # Atras de um proxy local (tunel Cloudflare, "tailscale serve") a request chega como se fosse
  # deste PC e o login seria pulado — o X-Forwarded-For denuncia que veio de fora.
  $viaProxy = [bool]$req.Headers['X-Forwarded-For']
  $deFora = $viaCloudflare -or $viaProxy -or (-not $req.IsLocal)
  if ($authCred -and $deFora) {
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
      # ---- Fase 4.1: snapshot em disco ----
      # Abrir a aba le o snapshot do periodo (fracao de segundo). So ?fresh=1 — "Atualizar agora",
      # trocar periodo, depois de aplicar uma acao — consulta o CRM e regrava o snapshot.
      # Validade: mes corrente = mesmo dia; mes fechado = 7 dias (o filtro e por created_at, entao
      # um mes fechado ainda muda quando um lead antigo fecha depois).
      $snapDir = Join-Path $root '_tmp\snapshots'
      if (-not (Test-Path $snapDir)) { New-Item -ItemType Directory -Path $snapDir -Force | Out-Null }
      # CHAVE ROTULADA. A versao anterior concatenava os campos crus e "?de=2026-09-20" colidia
      # com "?periodo=2026-09&ate=2026-09-20" — mesmo arquivo, dados diferentes. Agora cada
      # campo tem prefixo, e a campanha configurada no .ps1 entra: trocar de campanha invalida
      # os snapshots antigos em vez de servir dado da campanha anterior.
      $campCfg = ''
      try {
        $srcCfg = Get-Content $leadsScript -Raw -Encoding UTF8
        $mCfg = [regex]::Match($srcCfg, '\$CampRegex\s*=\s*''([^'']+)''')
        if ($mCfg.Success) { $campCfg = ($mCfg.Groups[1].Value -replace '[^0-9A-Za-z]','') }
      } catch {}
      $snapKey = ('p=' + $per + '_d=' + $(if ($lde) { $lde } else { '-' }) + '_a=' + $(if ($late) { $late } else { '-' }) +
                  '_f=' + $(if ($lcamp -match '^[a-z,]+$') { ($lcamp -replace ',','+') } else { '-' }) +
                  '_c=' + $(if ($campCfg) { $campCfg } else { '-' })) -replace '[^0-9A-Za-z_+=\-]',''
      $snapArq = Join-Path $snapDir "leads-$snapKey.json"
      $fresh = ($req.QueryString['fresh'] -eq '1')
      # "Atualizar agora" tambem ignora o cache local de anotacoes/produtos do script filho:
      # quem clica quer o estado de agora, nao o da ultima leitura.
      if ($fresh) { $leadsArgs += '-SemCache' }
      # valvula de escape do gate de sanidade: se um dia o zero for verdadeiro e a conferencia
      # contra o snapshot anterior atrapalhar, ?forcar=1 grava assim mesmo. Nunca e automatico.
      $forcar = ($req.QueryString['forcar'] -eq '1')
      $jsonTxt = ''; $doSnap = $false; $out = ''; $code = 0; $snapDe = ''
      if (-not $fresh -and (Test-Path $snapArq)) {
        $itemSnap = Get-Item $snapArq
        # janela que cobre o periodo pedido; se ela alcanca hoje, o dado ainda muda -> 2 h.
        # Senao (periodo inteiramente no passado), 7 dias — o filtro e por created_at, entao
        # ate um mes fechado ainda muda quando um lead antigo avanca.
        $fimJanela = if ($late) { [datetime]::ParseExact($late,'yyyy-MM-dd',$null) }
                     else { ([datetime]::ParseExact("$per-01",'yyyy-MM-dd',$null)).AddMonths(1).AddDays(-1) }
        $emAberto = ($fimJanela.Date -ge (Get-Date).Date)
        $idadeH = ((Get-Date) - $itemSnap.LastWriteTime).TotalHours
        $valido = if ($emAberto) { $idadeH -lt 2 } else { $idadeH -lt (7*24) }
        if ($valido) {
          try { $jsonTxt = [IO.File]::ReadAllText($snapArq, [Text.Encoding]::UTF8) } catch { $jsonTxt = '' }
          # snapshot truncado (queda no meio da gravacao) era servido do mesmo jeito e so
          # estourava no navegador; agora e descartado e o CRM assume.
          if ((Json-Valido $jsonTxt)) { $doSnap = $true } else { $jsonTxt = '' }
          # O MESMO CRIVO VALE PARA O QUE JA ESTA EM DISCO. Snapshot envenenado gravado antes
          # desta correcao (ou por outra via) seguia sendo servido com 200 na abertura da aba —
          # o gate de gravacao sozinho nao alcanca o passado. Suspeito: descarta e vai ao CRM.
          if ($doSnap) {
            $motivoSnap = Leads-PayloadSuspeito -Json $jsonTxt -Snapshot ''
            if ($motivoSnap -ne '') {
              Log-Erro "/api/leads periodo=$per SNAPSHOT DESCARTADO" $motivoSnap
              $jsonTxt = ''; $doSnap = $false
            }
          }
        }
      }
      $fonteFora = $false
      if (-not $jsonTxt) {
        $out = Invoke-ScriptTimeout -Arquivo $leadsScript -Argumentos $leadsArgs -TimeoutSeg 240
        $code = $script:ultimoExit
        # extrai so o objeto JSON (descarta qualquer ruido antes/depois)
        $i = $out.IndexOf('{'); $j = $out.LastIndexOf('}')
        $jsonTxt = if ($i -ge 0 -and $j -gt $i) { $out.Substring($i, $j - $i + 1) } else { '' }
        # ---- GATE DE SANIDADE (18/09/2026) ----
        # Exit 0 + JSON parseavel NAO e prova de carga boa: foi exatamente o que o CRM fora do
        # ar produziu, e este ponto gravou os zeros por cima do snapshot bom. Agora o payload
        # precisa se declarar completo, e ainda passa por uma conferencia independente.
        $motivo = Leads-PayloadSuspeito -Json $jsonTxt -Snapshot $(if ($forcar) { '' } else { $snapArq })
        if ($forcar -and $motivo -eq '') { Log-Erro "/api/leads periodo=$per" 'gravado com ?forcar=1' }
        $fonteFora = ($code -ne 0 -and $null -ne $code) -or ($motivo -ne '')
        if ($fonteFora) {
          if ($motivo) { Log-Erro "/api/leads periodo=$per RECUSADO" "snapshot preservado: $motivo" }
          $jsonBruto = $jsonTxt        # guardado para extrair a frase do erro la embaixo
          # nao gravar nada. Servir o ultimo snapshot bom, marcado, ou assumir a falha.
          $jsonTxt = ''
          if (Test-Path $snapArq) {
            try {
              $velho = [IO.File]::ReadAllText($snapArq, [Text.Encoding]::UTF8)
              if ((Json-Valido $velho) -and ((Leads-PayloadSuspeito -Json $velho -Snapshot '') -eq '')) {
                $jsonTxt = $velho; $doSnap = $true; $code = 0
                $snapDe = (Get-Item $snapArq).LastWriteTime.ToString('dd/MM/yyyy HH:mm')
              }
            } catch {}
          }
        } elseif ($jsonTxt -and (Json-Valido $jsonTxt)) {
          # carga boa: guarda o passo atras antes de sobrescrever, e so entao grava
          try {
            if (Test-Path $snapArq) { [IO.File]::Copy($snapArq, "$snapArq.prev", $true) }
            $tmpSnap = "$snapArq.tmp"
            [IO.File]::WriteAllText($tmpSnap, $jsonTxt, (New-Object Text.UTF8Encoding($false)))
            [IO.File]::Copy($tmpSnap, $snapArq, $true)
            Remove-Item $tmpSnap -Force -ErrorAction SilentlyContinue
          } catch {}
        }
      }
      $okLeads = (($code -eq 0 -or $null -eq $code) -and $jsonTxt)
      if ($okLeads) {
        $jsonTxt = Anexar-MetasLeads -Json $jsonTxt -Periodo $per -DoSnapshot $doSnap
        # o front precisa saber que esta olhando dado antigo PORQUE a fonte caiu — e nao
        # confundir isso com uma leitura normal de snapshot
        if ($fonteFora -and $jsonTxt.StartsWith('{')) {
          $jsonTxt = '{"fonteIndisponivel":true,"snapshotDe":"' + $snapDe + '",' + $jsonTxt.Substring(1)
        }
      }
      # 503 (nao 500) quando e a FONTE que esta fora: e indisponibilidade temporaria de um
      # servico de terceiro, nao defeito do app. O front usa isso para escolher a mensagem.
      $res.StatusCode = if ($okLeads) { 200 } elseif ($fonteFora) { 503 } else { 500 }
      $res.ContentType = 'application/json; charset=utf-8'
      $body = if ($okLeads) { $jsonTxt }
              elseif ($fonteFora) {
                # o filho ja devolve {"erro":...,"detalhe":"..."}; repassar o JSON inteiro como
                # "detalhe" deixava um JSON dentro do outro na tela. Extrai so a frase.
                $det = $motivo
                try {
                  $oErr = $jsonBruto | ConvertFrom-Json
                  if ($oErr -and $oErr.PSObject.Properties['detalhe'] -and $oErr.detalhe) { $det = [string]$oErr.detalhe }
                } catch {}
                if (-not $det) { $det = $out.Trim() }
                (@{ erro='CRM indisponivel'; fonteIndisponivel=$true; detalhe=$det } | ConvertTo-Json -Compress)
              }
              else { (@{ erro = ($out.Trim()) } | ConvertTo-Json -Compress) }
      $buf = [Text.Encoding]::UTF8.GetBytes($body)
      $res.OutputStream.Write($buf, 0, $buf.Length)
      $res.Close()
      $stamp = (Get-Date -Format 'HH:mm:ss')
      Write-Host "[$stamp] /api/leads periodo=$per -> $($res.StatusCode)$(if ($doSnap) { ' (snapshot)' } else { '' })$(if ($fonteFora) { ' [CRM fora]' } else { '' })" -ForegroundColor Cyan
      continue
    }

    if ($path -eq '/api/carteira-leads') {
      # leads individuais da carteira (drill-down da Transferencia): acao=leads (lista) | detalhe (telefone+anotacao de 1 lead)
      $raiz = Split-Path $root -Parent
      $script = Join-Path $raiz 'Carteira-Leads-Vitoria.ps1'
      $acao = $req.QueryString['acao']; if ($acao -notin 'leads','detalhe') { $acao = 'leads' }
      $psArgs = @('-Acao', $acao)
      $qd = $req.QueryString['de'];  if ($qd  -match '^\d{4}-\d{2}-\d{2}$') { $psArgs += @('-De', $qd) }
      $qa = $req.QueryString['ate']; if ($qa -match '^\d{4}-\d{2}-\d{2}$') { $psArgs += @('-Ate', $qa) }
      if ($req.QueryString['campanha'])  { $psArgs += @('-Campanha', $req.QueryString['campanha']) }
      if ($req.QueryString['consultor']) { $psArgs += @('-Consultor', $req.QueryString['consultor']) }
      if ($req.QueryString['busca'])     { $psArgs += @('-Busca', $req.QueryString['busca']) }
      $qe = $req.QueryString['etapa']; if ($qe -match '^[1-6]$') { $psArgs += @('-Etapa', $qe) }
      $qes = $req.QueryString['etapas']; if ($qes -match '^[1-6](,[1-6])*$') { $psArgs += @('-Etapas', $qes) }
      $qo = $req.QueryString['oppid']; if ($qo -match '^\d+$') { $psArgs += @('-OppId', $qo) }
      # drill de Vendas: funde as oportunidades do mesmo cliente numa linha so
      if ($req.QueryString['dedup'] -eq '1') { $psArgs += @('-Dedup') }
      $out = Exec-Filho $script $psArgs
      $i = $out.IndexOf('{'); $j = $out.LastIndexOf('}')
      $body = if ($i -ge 0 -and $j -gt $i) { $out.Substring($i, $j - $i + 1) } else { '{"erro":"sem resposta"}' }
      $res.StatusCode = 200; $res.ContentType = 'application/json; charset=utf-8'
      $buf = [Text.Encoding]::UTF8.GetBytes($body); $res.OutputStream.Write($buf, 0, $buf.Length); $res.Close()
      Write-Host "[$((Get-Date -Format 'HH:mm:ss'))] /api/carteira-leads acao=$acao -> 200" -ForegroundColor DarkYellow
      continue
    }

    if ($path -eq '/api/treinamento') {
      # aba Treinamento: busca produto (JSON) / vendas / cross-sell (Markdown) via Buscar-Treinamento.ps1
      $raiz = Split-Path $root -Parent
      $script = Join-Path $raiz 'Buscar-Treinamento.ps1'
      $acao = $req.QueryString['acao']
      if ($acao -notin 'buscar','vendas','crosssell') {
        $res.StatusCode = 400; $res.ContentType = 'application/json; charset=utf-8'
        $b = [Text.Encoding]::UTF8.GetBytes((@{ erro = "Acao invalida: $acao" } | ConvertTo-Json -Compress))
        $res.OutputStream.Write($b, 0, $b.Length); $res.Close(); continue
      }
      $psArgs = @('-Acao', $acao)
      if ($req.QueryString['query'])     { $psArgs += @('-Query', $req.QueryString['query']) }
      if ($req.QueryString['produto'])   { $psArgs += @('-Produto', $req.QueryString['produto']) }
      $qProdId = $req.QueryString['produtoid']; if ($qProdId -match '^\d+$') { $psArgs += @('-ProdutoId', $qProdId) }
      $qtDe = $req.QueryString['de'];  if ($qtDe  -match '^\d{4}-\d{2}-\d{2}$') { $psArgs += @('-De', $qtDe) }
      $qtAte = $req.QueryString['ate']; if ($qtAte -match '^\d{4}-\d{2}-\d{2}$') { $psArgs += @('-Ate', $qtAte) }
      if ($req.QueryString['consultor']) { $psArgs += @('-Consultor', $req.QueryString['consultor']) }
      if ($req.QueryString['link'])      { $psArgs += @('-Link', $req.QueryString['link']) }
      $cid = $req.QueryString['classid']; if ($cid -match '^\d+$') { $psArgs += @('-ClassId', $cid) }
      if ($req.QueryString['todas'] -eq '1') { $psArgs += @('-TodasSituacoes') }
      $out = Exec-Filho $script $psArgs
      if ($acao -eq 'buscar') {
        $i = $out.IndexOf('{'); $j = $out.LastIndexOf('}')
        $body = if ($i -ge 0 -and $j -gt $i) { $out.Substring($i, $j - $i + 1) } else { '{"erro":"sem resposta"}' }
        $res.ContentType = 'application/json; charset=utf-8'
      } else {
        $body = $out.Trim()
        $res.ContentType = 'text/markdown; charset=utf-8'
      }
      $res.StatusCode = 200
      $buf = [Text.Encoding]::UTF8.GetBytes($body); $res.OutputStream.Write($buf, 0, $buf.Length); $res.Close()
      Write-Host "[$((Get-Date -Format 'HH:mm:ss'))] /api/treinamento acao=$acao -> 200" -ForegroundColor Green
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
      $lst = $req.QueryString['lista']
      # praca dos comandos do Sales Cube: VITORIA (padrao) ou BELEM. Qualquer outro valor e ignorado.
      $uni = $req.QueryString['unidade']; if ($uni -notin 'VITORIA','BELEM') { $uni = '' }
      $tmpLista = $null
      $raiz = Split-Path $root -Parent
      $script = $null; $psArgs = @()
      switch ($id) {
        'faturamento'     { $script='Faturamento-Vitoria.ps1';    $psArgs=@('-Periodo',$per,'-Por',$por); if($uni){$psArgs+=@('-Unidade',$uni)}; if($con){$psArgs+=@('-Consultor',$con)}; if($det -eq '1'){$psArgs+='-Detalhe'} }
        'metaUnidade'     { $script='Meta-Vitoria.ps1';           $psArgs=@('-Escopo','Unidade','-Periodo',$per,'-Por',$por) }
        'metaConsultores' { $script='Meta-Vitoria.ps1';           $psArgs=@('-Escopo','Consultores','-Periodo',$per,'-Por',$por); if($con){$psArgs+=@('-Consultor',$con)} }
        'metaGeral'       { $script='Meta-Vitoria.ps1';           $psArgs=@('-Escopo','Geral','-Periodo',$per,'-Por',$por) }
        'leads'           { $script='Leads-Vitoria.ps1';          $psArgs=@('-Periodo',$per); if($etp -match '^[1-6]$'){$psArgs+=@('-Etapa',$etp)} }
        'leadsCampanha'   { $script='Leads-Vitoria-Campanha.ps1'; $psArgs=@('-Periodo',$per) }
        'movimentacao'    { $script='Movimentacao-Leads.ps1';     $psArgs=@('-Periodo',$per) }
        'negociacoes'     { $script='Negociacoes-Vitoria.ps1';    $psArgs=@(); if($con){$psArgs+=@('-Consultor',$con)}
                            # a faixa personalizada manda centavos ("99.99-1497.00"): o regex TEM de
                            # aceitar decimal. So inteiro fazia o filtro ser descartado em silencio.
                            if($fxs){
                              if($fxs -match '^\d+(\.\d{1,2})?-(\d+(\.\d{1,2})?)?(,\d+(\.\d{1,2})?-(\d+(\.\d{1,2})?)?)*$'){ $psArgs+=@('-Faixas',$fxs) }
                              else { Write-Host ("[{0}] /api/comando negociacoes: faixa IGNORADA (formato invalido): '{1}'" -f (Get-Date -Format 'HH:mm:ss'), $fxs) -ForegroundColor Red }
                            } }
        'painel'          { $script='Painel-Vitoria.ps1';        $psArgs=@(); $stt=$req.QueryString['status']; if($stt -in 'proximas','scheduled','active','completed','canceled','todas'){ $psArgs+=@('-Status',$stt) } }
        'leituraFrz'      { $script='Leitura-FRZ-Vitoria.ps1';    $psArgs=@(); $tf=$req.QueryString['turma']; if($tf -match '^\d+$' -or $tf -eq 'todas'){ $psArgs+=@('-TurmaId',$tf) }
                            # unidade (praca do FRZ): VITORIA (padrao) ou BELEM. Qualquer outro valor cai no padrao do script.
                            $cd=$req.QueryString['cidade']; if($cd -in 'VITORIA','BELEM'){ $psArgs+=@('-Cidade',$cd) }
                            # consultor vem como a chave normalizada do ranking (sem acento); vazio = todos
                            $cf=QsUtf8 $req 'consultor'; if($cf){ $psArgs+=@('-Consultor',$cf) }
                            # situacao: lista de neg/ent/fin. Vazio = todas.
                            $sf=$req.QueryString['situacao']; if($sf -match '^(neg|ent|fin)(,(neg|ent|fin))*$'){ $psArgs+=@('-Status',$sf) } }
        'leituraFrzTurmas'{ $script='Leitura-FRZ-Vitoria.ps1';    $psArgs=@('-Listar'); $cd=$req.QueryString['cidade']; if($cd -in 'VITORIA','BELEM'){ $psArgs+=@('-Cidade',$cd) } }
        'leituraTurma'    { $script='Leitura-Turma.ps1';          $psArgs=@('-Link',$lnk)
                            # quem entra na leitura: turma inteira / so presentes / so ausentes (coluna PRESENCA da planilha)
                            $pz=$req.QueryString['presenca']; if($pz -in 'presentes','ausentes'){ $psArgs+=@('-Presenca',$pz) } }
        'relatorioTurma'  { if ($lnk -match 'zsales\.com\.br' -and $lnk -match '/classes/\d+') { $script='Confirmacao-WS.ps1' } else { $script='Relatorio-Turma.ps1' }; $psArgs=@('-Link',$lnk) }
        'pesqSocio'       { $script='Pesquisa-Socioeconomica.ps1'; $psArgs=@('-Link',$lnk); $lmapa=$req.QueryString['linkMapa']; if($lmapa){ $psArgs+=@('-LinkMapa',$lmapa) }; $prod=QsUtf8 $req 'produto'; if($prod){ $psArgs+=@('-Produto',$prod) }; $prc=QsUtf8 $req 'praca'; if($prc){ $psArgs+=@('-Praca',$prc) } }
        'buscarClientes'  { $script='Buscar-Clientes-Vitoria.ps1'; $listaTxt=''; try { $mq=[regex]::Match($req.Url.Query,'(?:^\?|&)lista=([^&]*)'); if($mq.Success){ $listaTxt=[Uri]::UnescapeDataString($mq.Groups[1].Value.Replace('+','%20')) } } catch {}; $tmpLista = Join-Path $env:TEMP ('busca_' + [Guid]::NewGuid().ToString('N') + '.txt'); [System.IO.File]::WriteAllText($tmpLista, $listaTxt, (New-Object System.Text.UTF8Encoding($true))); $psArgs=@('-ListaFile',$tmpLista) }
        'tabelaPrecos'    { $script='Tabela-Precos.ps1';          $psArgs=@(); $cur=QsUtf8 $req 'curso'; if($cur){ $psArgs+=@('-Curso',$cur) } }   # dados fixos no script; curso com acento exige QsUtf8
        # Regras Comerciais: le o regras-comerciais.md. So o NUMERO do topico entra (o seletor do
        # app sempre manda numero); vazio = lista os topicos, que e o que popula o proprio seletor.
        'regrasComerciais'{ $script='Regras-Comerciais.ps1';       $psArgs=@(); $tp=$req.QueryString['topico']; if($tp -match '^\d{1,3}$'){ $psArgs+=@('-Topico',$tp) } }
      }
      if (-not $script) {
        $res.StatusCode = 400; $res.ContentType = 'text/plain; charset=utf-8'
        $b = [Text.Encoding]::UTF8.GetBytes("Comando desconhecido: $id")
        $res.OutputStream.Write($b, 0, $b.Length); $res.Close(); continue
      }
      if (($de -or $ate) -and $id -notin 'leituraTurma','relatorioTurma','pesqSocio','painel','leituraFrz','leituraFrzTurmas','tabelaPrecos') { if($de){$psArgs+=@('-De',$de)}; if($ate){$psArgs+=@('-Ate',$ate)} }   # intervalo de datas
      $full = Join-Path $raiz $script
      $out  = Exec-Filho $full $psArgs
      # $LASTEXITCODE nao e populado por Start-Process: ficava travado no valor de outro
      # processo e TODA falha do filho virava 200 (auditoria 19/09/2026). O codigo real
      # esta em $script:ultimoExit. A heuristica de texto le o STDERR, nunca o stdout:
      # um relatorio com "R$ 2.503,00" casaria com o padrao '503' e viraria 500 falso.
      $falha = Falha-DoFilho $script:ultimoErr $script:ultimoExit
      if ($tmpLista) { Remove-Item $tmpLista -ErrorAction SilentlyContinue }
      if ($falha) { Log-Erro "/api/cmd id=$id -> $falha" $script:ultimoErr }
      $res.StatusCode = if ($falha) { 500 } else { 200 }
      $res.ContentType = 'text/plain; charset=utf-8'
      $buf = [Text.Encoding]::UTF8.GetBytes($out)
      $res.OutputStream.Write($buf, 0, $buf.Length); $res.Close()
      $stamp = (Get-Date -Format 'HH:mm:ss')
      Write-Host "[$stamp] /api/cmd id=$id periodo=$per -> $($res.StatusCode)" -ForegroundColor Cyan
      continue
    }

    if ($path -eq '/api/turma') {
      # drill do Painel de Turmas: alunos de UMA turma (Painel-Turma.ps1 -ClassId N). Devolve JSON.
      $cid = $req.QueryString['classId']
      $res.ContentType = 'application/json; charset=utf-8'
      if ($cid -notmatch '^\d+$') {
        $res.StatusCode = 400
        $b = [Text.Encoding]::UTF8.GetBytes((@{ erro = 'classId invalido' } | ConvertTo-Json -Compress))
        $res.OutputStream.Write($b, 0, $b.Length); $res.Close(); continue
      }
      $raiz = Split-Path $root -Parent
      $full = Join-Path $raiz 'Painel-Turma.ps1'
      $ptArgs = @('-ClassId', $cid); if ($req.QueryString['contatos'] -eq '0') { $ptArgs += '-SemContatos' }   # Painel TV pede sem contatos (rapido)
      $out  = Exec-Filho $full $ptArgs
      $falha = Falha-DoFilho $script:ultimoErr $script:ultimoExit   # ver comentario em /api/cmd
      if ($falha) { Log-Erro "/api/turma classId=$cid -> $falha" $script:ultimoErr }
      $res.StatusCode = if ($falha) { 500 } else { 200 }
      $buf = [Text.Encoding]::UTF8.GetBytes($out.Trim())
      $res.OutputStream.Write($buf, 0, $buf.Length); $res.Close()
      $stamp = (Get-Date -Format 'HH:mm:ss')
      Write-Host "[$stamp] /api/turma classId=$cid -> $($res.StatusCode)" -ForegroundColor Cyan
      continue
    }

    if ($path -eq '/api/turma-acao') {
      # Acoes da aba "Turmas": consulta no Salesforce (leitura) e troca de responsavel (escrita no ZS).
      #   GET  acao=sfCpf   &cpf=...            -> Ponte-SF.ps1 consultaCpf   (ficha completa)
      #   GET  acao=sfNome  &nome=...           -> Ponte-SF.ps1 consultaNome  (candidatos, p/ quem esta sem CPF)
      #   GET  acao=opps    &customerId=...     -> oportunidades do cliente (p/ escolher qual reatribuir)
      #   POST acao=responsavel {customer_id, assignee_user_id, org}          -> Ponte-ZS.ps1 responsavel
      #   POST acao=assignOpp  {opportunity_ids:[...], assignee_user_id}      -> Acoes-Leads-Vitoria.ps1
      $raiz = Split-Path $root -Parent
      $acao = $req.QueryString['acao']
      $res.ContentType = 'application/json; charset=utf-8'
      function Rec-Json2($txt) { $i=$txt.IndexOf('{'); $j=$txt.LastIndexOf('}'); if ($i -ge 0 -and $j -gt $i) { return $txt.Substring($i, $j-$i+1) }; return '' }
      $saidaTA = ''
      if ($acao -eq 'sfCpf') {
        $cpfTA = ''; if ($req.QueryString['cpf']) { $cpfTA = ($req.QueryString['cpf'] -replace '\D','') }
        $o = Exec-Filho (Join-Path $raiz 'Ponte-SF.ps1') @('-Acao', 'consultaCpf', '-Cpf', $cpfTA)
        $saidaTA = Rec-Json2 $o
      }
      elseif ($acao -eq 'sfNome') {
        # nome vem da query em UTF-8 (HttpListener assume Latin1 -> le da query bruta)
        $nomeTA = ''
        try { $mq=[regex]::Match($req.Url.Query,'(?:^\?|&)nome=([^&]*)'); if($mq.Success){ $nomeTA=[Uri]::UnescapeDataString($mq.Groups[1].Value.Replace('+','%20')) } } catch {}
        $o = Exec-Filho (Join-Path $raiz 'Ponte-SF.ps1') @('-Acao', 'consultaNome', '-Nome', $nomeTA)
        $saidaTA = Rec-Json2 $o
      }
      elseif ($acao -eq 'credenc') {
        # 1 aluno: historico de credenciamento no SF (participou = N_de_impressoes__c > 0)
        $cpfTA = ''; if ($req.QueryString['cpf']) { $cpfTA = ($req.QueryString['cpf'] -replace '\D','') }
        $psC = @('-Acao','credenciamentos','-Cpf',$cpfTA)
        $tA = $req.QueryString['turmaAtual']; if ($tA) { $psC += @('-TurmaAtual', $tA) }
        $o = Exec-Filho (Join-Path $raiz 'Ponte-SF.ps1') $psC
        $saidaTA = Rec-Json2 $o
      }
      elseif ($acao -eq 'credencLote') {
        # turma inteira: POST { cpfs:[...], curso, turmaAtual } -> 1 unica consulta SOQL
        if ($req.HttpMethod -ne 'POST') {
          $res.StatusCode = 405
          $b = [Text.Encoding]::UTF8.GetBytes((@{ ok=$false; erro='use POST' } | ConvertTo-Json -Compress))
          $res.OutputStream.Write($b, 0, $b.Length); $res.Close(); continue
        }
        $rd = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
        $bIn = $rd.ReadToEnd(); $rd.Close()
        $plano = $null; try { $plano = $bIn | ConvertFrom-Json } catch {}
        $tmpC = Join-Path $env:TEMP ('cpfs_' + [Guid]::NewGuid().ToString('N') + '.txt')
        $linhas = @(); foreach ($c in @($plano.cpfs)) { $d = ("$c" -replace '\D',''); if ($d.Length -eq 11) { $linhas += $d } }
        [System.IO.File]::WriteAllLines($tmpC, $linhas, (New-Object System.Text.UTF8Encoding($false)))
        $psC = @('-Acao','credenciamentos','-CpfsFile',$tmpC)
        if ($plano.curso)      { $psC += @('-Curso', [string]$plano.curso) }
        if ($plano.turmaAtual) { $psC += @('-TurmaAtual', [string]$plano.turmaAtual) }
        $o = Exec-Filho (Join-Path $raiz 'Ponte-SF.ps1') $psC
        Remove-Item $tmpC -ErrorAction SilentlyContinue
        $saidaTA = Rec-Json2 $o
      }
      elseif ($acao -eq 'opps') {
        $cidTA = $req.QueryString['customerId']; if ($cidTA -notmatch '^\d+$') { $cidTA = '0' }
        $rspTA = $req.QueryString['respId'];     if ($rspTA -notmatch '^\d+$') { $rspTA = '0' }
        $nmTA = ''
        try { $mq=[regex]::Match($req.Url.Query,'(?:^\?|&)nome=([^&]*)'); if($mq.Success){ $nmTA=[Uri]::UnescapeDataString($mq.Groups[1].Value.Replace('+','%20')) } } catch {}
        $o = Exec-Filho (Join-Path $raiz 'Turma-Aluno.ps1') @('-Acao', 'oportunidades', '-CustomerId', $cidTA, '-Nome', $nmTA, '-RespId', $rspTA)
        $saidaTA = Rec-Json2 $o
      }
      elseif ($acao -in @('responsavel','assignOpp','completar')) {
        if ($req.HttpMethod -ne 'POST') {
          $res.StatusCode = 405
          $b = [Text.Encoding]::UTF8.GetBytes((@{ ok=$false; erro='use POST' } | ConvertTo-Json -Compress))
          $res.OutputStream.Write($b, 0, $b.Length); $res.Close(); continue
        }
        $reader = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
        $bodyTA = $reader.ReadToEnd(); $reader.Close()
        $tmpTA = Join-Path $env:TEMP ('turmaacao_' + [Guid]::NewGuid().ToString('N') + '.json')
        [System.IO.File]::WriteAllText($tmpTA, $bodyTA, (New-Object System.Text.UTF8Encoding($false)))
        if ($acao -eq 'responsavel') {
          $o = Exec-Filho (Join-Path $raiz 'Ponte-ZS.ps1') @('-Acao', 'responsavel', '-PlanoFile', $tmpTA)
        } elseif ($acao -eq 'completar') {
          $o = Exec-Filho (Join-Path $raiz 'Turma-Aluno.ps1') @('-Acao', 'completar', '-PlanoFile', $tmpTA)
        } else {
          $o = Exec-Filho (Join-Path $raiz 'Turma-Aluno.ps1') @('-Acao', 'assign', '-PlanoFile', $tmpTA)
        }
        Remove-Item $tmpTA -ErrorAction SilentlyContinue
        $saidaTA = Rec-Json2 $o
        if (-not $saidaTA) { $saidaTA = (@{ ok=$false; erro=$o.Trim() } | ConvertTo-Json -Compress) }
      }
      else {
        $res.StatusCode = 400
        $b = [Text.Encoding]::UTF8.GetBytes((@{ ok=$false; erro="Acao invalida: $acao" } | ConvertTo-Json -Compress))
        $res.OutputStream.Write($b, 0, $b.Length); $res.Close(); continue
      }
      if (-not $saidaTA) { $saidaTA = '{"ok":false,"erro":"sem resposta do script"}' }
      $res.StatusCode = 200
      $buf = [Text.Encoding]::UTF8.GetBytes($saidaTA)
      $res.OutputStream.Write($buf, 0, $buf.Length); $res.Close()
      Write-Host "[$((Get-Date -Format 'HH:mm:ss'))] /api/turma-acao acao=$acao -> 200" -ForegroundColor Cyan
      continue
    }

    if ($path -eq '/api/lancar') {
      # Fluxo "Lancar Cliente" (multi-unidade). GET=leitura (buscar/detalhe/catalogo/etapas/usuarios),
      # POST=escrita (criarCliente/oportunidade/produto/pagamento/fechar) com corpo JSON -> -PlanoFile.
      $raiz   = Split-Path $root -Parent
      $script = Join-Path $raiz 'Lancar-Cliente.ps1'
      $acao   = $req.QueryString['acao']
      $leitura = @('buscar','detalhe','catalogo','etapas','usuarios','turmas','oportunidades')
      $escrita = @('criarCliente','oportunidade','produto','pagamento','fechar','cancelarOportunidade','excluirOportunidade','editarOportunidade','anexarOportunidade','nota','enderecoCliente','vincularContatoCliente')
      if ($acao -notin ($leitura + $escrita)) {
        $res.StatusCode = 400; $res.ContentType = 'application/json; charset=utf-8'
        $b = [Text.Encoding]::UTF8.GetBytes((@{ ok=$false; erro="Acao invalida: $acao" } | ConvertTo-Json -Compress))
        $res.OutputStream.Write($b, 0, $b.Length); $res.Close(); continue
      }
      # A whitelist acima junta leitura+escrita, entao um GET com acao de
      # escrita passava por ela, caia no ramo de leitura mais abaixo e RODAVA o
      # script -- so que sem -PlanoFile. Quem recusava era o filho ("opportunity_id
      # e obrigatorio"), nao o servidor: a protecao dependia da sorte. Agora acao
      # de escrita exige POST aqui, antes de qualquer execucao.
      if ($acao -in $escrita -and $req.HttpMethod -ne 'POST') {
        $res.StatusCode = 405; $res.ContentType = 'application/json; charset=utf-8'
        $b = [Text.Encoding]::UTF8.GetBytes((@{ ok=$false; erro="A acao '$acao' altera dados: use POST." } | ConvertTo-Json -Compress))
        $res.OutputStream.Write($b, 0, $b.Length); $res.Close(); continue
      }
      $psArgs = @('-Acao', $acao)
      $qOrg = $req.QueryString['org']; if ($qOrg -match '^[123]$') { $psArgs += @('-Org', $qOrg) }
      if ($req.HttpMethod -eq 'POST' -and $acao -in $escrita) {
        # LER SEMPRE COMO UTF-8: o fetch manda application/json sem charset e o HttpListener assume Latin1,
        # o que corrompe acentos e travessões (ex.: "—" vira "â€"") em nomes/caminhos.
        $reader = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
        $bodyIn = $reader.ReadToEnd(); $reader.Close()
        $tmp = Join-Path $env:TEMP ('lancar_' + [Guid]::NewGuid().ToString('N') + '.json')
        [System.IO.File]::WriteAllText($tmp, $bodyIn, (New-Object System.Text.UTF8Encoding($false)))
        $psArgs += @('-PlanoFile', $tmp)
      } else {
        # leitura: termo/query lidos em UTF8 direto da query (evita mojibake em nomes com acento)
        function Q1($nome){ try { $mq=[regex]::Match($req.Url.Query,'(?:^\?|&)'+$nome+'=([^&]*)'); if($mq.Success){ return [Uri]::UnescapeDataString($mq.Groups[1].Value.Replace('+','%20')) } } catch {}; return '' }
        $qTermo = Q1 'termo'; if ($qTermo) { $psArgs += @('-Termo', $qTermo) }
        $qQuery = Q1 'query'; if ($qQuery) { $psArgs += @('-Query', $qQuery) }
        $qOrgs = $req.QueryString['orgs']; if ($qOrgs -match '^[123](,[123])*$') { $psArgs += @('-Orgs', $qOrgs) }
        $qCid = $req.QueryString['customerId']; if ($qCid -match '^\d+$') { $psArgs += @('-CustomerId', $qCid) }
        $qPid = $req.QueryString['productId']; if ($qPid -match '^\d+$') { $psArgs += @('-ProductId', $qPid) }
      }
      $out  = Exec-Filho $script $psArgs
      if ($tmp) { Remove-Item $tmp -ErrorAction SilentlyContinue; $tmp = $null }
      $i = $out.IndexOf('{'); $j = $out.LastIndexOf('}')
      $jsonTxt = if ($i -ge 0 -and $j -gt $i) { $out.Substring($i, $j - $i + 1) } else { '' }
      $res.StatusCode = if ($jsonTxt) { 200 } else { 500 }
      $res.ContentType = 'application/json; charset=utf-8'
      $body2 = if ($jsonTxt) { $jsonTxt } else { (@{ ok=$false; erro = ($out.Trim()) } | ConvertTo-Json -Compress) }
      $buf = [Text.Encoding]::UTF8.GetBytes($body2)
      $res.OutputStream.Write($buf, 0, $buf.Length); $res.Close()
      Write-Host "[$((Get-Date -Format 'HH:mm:ss'))] /api/lancar $($req.HttpMethod) acao=$acao -> $($res.StatusCode)" -ForegroundColor Magenta
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
        $out  = Exec-Filho $script @('-Acao', $acao, '-Modo', 'apply', '-PlanoFile', $tmp)
        Remove-Item $tmp -ErrorAction SilentlyContinue
      } else {
        # PREVIEW: monta os argumentos a partir da querystring (so os preenchidos)
        $psArgs = @('-Acao', $acao, '-Modo', 'preview')
        $qDe  = $req.QueryString['de'];  if ($qDe  -match '^\d{4}-\d{2}-\d{2}$') { $psArgs += @('-De', $qDe) }
        $qAte = $req.QueryString['ate']; if ($qAte -match '^\d{4}-\d{2}-\d{2}$') { $psArgs += @('-Ate', $qAte) }
        if ($req.QueryString['base'])         { $psArgs += @('-Base', $req.QueryString['base']) }
        if ($req.QueryString['cruzamento'] -eq '1') { $psArgs += @('-Cruzamento') }
        if ($req.QueryString['participantes']){ $psArgs += @('-Participantes', $req.QueryString['participantes']) }
        if ($req.QueryString['zerados'])      { $psArgs += @('-Zerados', $req.QueryString['zerados']) }
        if ($req.QueryString['campanha'])     { $psArgs += @('-Campanha', $req.QueryString['campanha']) }
        if ($req.QueryString['ordem'])        { $psArgs += @('-Ordem', $req.QueryString['ordem']) }
        if ($req.QueryString['origem'])       { $psArgs += @('-Origem', $req.QueryString['origem']) }
        if ($req.QueryString['destino'])      { $psArgs += @('-Destino', $req.QueryString['destino']) }
        if ($req.QueryString['etapaOrigem'])  { $psArgs += @('-EtapaOrigem', $req.QueryString['etapaOrigem']) }
        if ($req.QueryString['etapaDestino']) { $psArgs += @('-EtapaDestino', $req.QueryString['etapaDestino']) }
        $qtd = $req.QueryString['quantidade']; if ($qtd -match '^\d+$') { $psArgs += @('-Quantidade', $qtd) }
        $out  = Exec-Filho $script $psArgs
      }
      # Esta rota ESCREVE no CRM. Antes, o sucesso era so "tem { e } na saida" -- um script
      # morto por timeout no meio da gravacao ainda podia devolver 200. Agora o codigo de
      # saida real (via $script:ultimoExit) manda, e a heuristica le o stderr.
      $falha = Falha-DoFilho $script:ultimoErr $script:ultimoExit
      # extrai so o objeto JSON (descarta ruido antes/depois)
      $i = $out.IndexOf('{'); $j = $out.LastIndexOf('}')
      $jsonTxt = if ($i -ge 0 -and $j -gt $i) { $out.Substring($i, $j - $i + 1) } else { '' }
      if ($falha) { Log-Erro "/api/acao acao=$acao metodo=$($req.HttpMethod) -> $falha" $script:ultimoErr }
      $res.StatusCode = if ($falha -or -not $jsonTxt) { 500 } else { 200 }
      $res.ContentType = 'application/json; charset=utf-8'
      $body2 = if ($falha) { (@{ ok=$false; erro=$falha; detalhe=($out.Trim()) } | ConvertTo-Json -Compress) }
               elseif ($jsonTxt) { $jsonTxt }
               else { (@{ ok=$false; erro = ($out.Trim()) } | ConvertTo-Json -Compress) }
      $buf = [Text.Encoding]::UTF8.GetBytes($body2)
      $res.OutputStream.Write($buf, 0, $buf.Length); $res.Close()
      $stamp = (Get-Date -Format 'HH:mm:ss')
      Write-Host "[$stamp] /api/acao $($req.HttpMethod) acao=$acao -> $($res.StatusCode)" -ForegroundColor Magenta
      continue
    }

    if ($path -eq '/api/sfxsc') {
      # Comando "SF x SC": consulta o MESMO CPF nos dois sistemas.
      #   SF (Salesforce) = SOMENTE LEITURA  -> Ponte-SF.ps1   (nao existe acao de escrita nessa rota)
      #   SC (Sales Cube) = leitura aqui     -> Lancar-Cliente.ps1 (as ESCRITAS no SC continuam em /api/lancar)
      # acao: consulta (os dois) | sf | sc | scDetalhe | status
      $raiz    = Split-Path $root -Parent
      $scriptSF = Join-Path $raiz 'Ponte-SF.ps1'
      $scriptSC = Join-Path $raiz 'Lancar-Cliente.ps1'
      $scriptZS = Join-Path $raiz 'Ponte-ZS.ps1'
      $acao    = $req.QueryString['acao']; if (-not $acao) { $acao = 'consulta' }
      if ($acao -notin @('consulta','sf','sc','scDetalhe','status','usuarios','espelharPrevia','espelhar','responsavel')) {
        $res.StatusCode = 400; $res.ContentType = 'application/json; charset=utf-8'
        $b = [Text.Encoding]::UTF8.GetBytes((@{ ok=$false; erro="Acao invalida: $acao" } | ConvertTo-Json -Compress))
        $res.OutputStream.Write($b, 0, $b.Length); $res.Close(); continue
      }
      $cpf = ''; if ($req.QueryString['cpf']) { $cpf = ($req.QueryString['cpf'] -replace '\D','') }
      function Rec-Json($txt) {
        $i = $txt.IndexOf('{'); $j = $txt.LastIndexOf('}')
        if ($i -ge 0 -and $j -gt $i) { return $txt.Substring($i, $j - $i + 1) }
        return ''
      }
      $bodyOut = ''
      $orgQ = $req.QueryString['org']; if ($orgQ -notmatch '^[123]$') { $orgQ = '2' }
      if ($acao -eq 'status') {
        $o = Exec-Filho $scriptSF @('-Acao', 'status')
        $bodyOut = Rec-Json $o
      }
      elseif ($acao -eq 'usuarios') {
        # lista de consultores da unidade (seletor de responsavel)
        $o = Exec-Filho $scriptZS @('-Acao', 'usuarios', '-Org', $orgQ)
        $bodyOut = Rec-Json $o
      }
      elseif ($acao -eq 'espelharPrevia') {
        # LEITURA: monta o antes->depois de levar o cadastro do SF para o ZS (nao grava nada)
        if ($cpf.Length -ne 11) {
          $res.StatusCode = 400; $res.ContentType = 'application/json; charset=utf-8'
          $b = [Text.Encoding]::UTF8.GetBytes((@{ ok=$false; erro='Informe um CPF com 11 digitos.' } | ConvertTo-Json -Compress))
          $res.OutputStream.Write($b, 0, $b.Length); $res.Close(); continue
        }
        $o = Exec-Filho $scriptZS @('-Acao', 'previa', '-Cpf', $cpf, '-Org', $orgQ)
        $bodyOut = Rec-Json $o
      }
      elseif ($acao -in @('espelhar','responsavel')) {
        # ESCRITA no Zsales (o Salesforce nunca e tocado). POST com corpo JSON -> -PlanoFile
        if ($req.HttpMethod -ne 'POST') {
          $res.StatusCode = 405; $res.ContentType = 'application/json; charset=utf-8'
          $b = [Text.Encoding]::UTF8.GetBytes((@{ ok=$false; erro='use POST' } | ConvertTo-Json -Compress))
          $res.OutputStream.Write($b, 0, $b.Length); $res.Close(); continue
        }
        # UTF-8 na marra: o fetch manda application/json sem charset e o HttpListener assume Latin1
        $reader = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
        $bodyIn = $reader.ReadToEnd(); $reader.Close()
        $tmpZ = Join-Path $env:TEMP ('sfz_' + [Guid]::NewGuid().ToString('N') + '.json')
        [System.IO.File]::WriteAllText($tmpZ, $bodyIn, (New-Object System.Text.UTF8Encoding($false)))
        $acaoZS = if ($acao -eq 'espelhar') { 'aplicar' } else { 'responsavel' }
        $o = Exec-Filho $scriptZS @('-Acao', $acaoZS, '-PlanoFile', $tmpZ)
        Remove-Item $tmpZ -ErrorAction SilentlyContinue
        $bodyOut = Rec-Json $o
        if (-not $bodyOut) { $bodyOut = (@{ ok=$false; erro=("Ponte-ZS: " + $o.Trim()) } | ConvertTo-Json -Compress) }
      }
      elseif ($acao -eq 'scDetalhe') {
        $cid = $req.QueryString['customerId']; $org = $req.QueryString['org']
        if ($cid -notmatch '^\d+$') { $cid = '0' }
        if ($org -notmatch '^[123]$') { $org = '2' }
        $o = Exec-Filho $scriptSC @('-Acao', 'detalhe', '-CustomerId', $cid, '-Org', $org)
        $bodyOut = Rec-Json $o
      }
      else {
        if ($cpf.Length -ne 11) {
          $res.StatusCode = 400; $res.ContentType = 'application/json; charset=utf-8'
          $b = [Text.Encoding]::UTF8.GetBytes((@{ ok=$false; erro='Informe um CPF com 11 digitos.' } | ConvertTo-Json -Compress))
          $res.OutputStream.Write($b, 0, $b.Length); $res.Close(); continue
        }
        $sfJson = '{"ok":false,"erro":"nao consultado"}'
        $scJson = '{"ok":false,"erro":"nao consultado"}'
        if ($acao -in @('consulta','sf')) {
          $o = Exec-Filho $scriptSF @('-Acao', 'consultaCpf', '-Cpf', $cpf)
          $t = Rec-Json $o
          $sfJson = if ($t) { $t } else { (@{ ok=$false; erro=("Ponte-SF: " + $o.Trim()) } | ConvertTo-Json -Compress) }
        }
        if ($acao -in @('consulta','sc')) {
          $o = Exec-Filho $scriptSC @('-Acao', 'buscar', '-Termo', $cpf, '-Orgs', '1,2,3')
          $t = Rec-Json $o
          $scJson = if ($t) { $t } else { (@{ ok=$false; erro=("Lancar-Cliente: " + $o.Trim()) } | ConvertTo-Json -Compress) }
        }
        if     ($acao -eq 'sf') { $bodyOut = $sfJson }
        elseif ($acao -eq 'sc') { $bodyOut = $scJson }
        else { $bodyOut = '{"ok":true,"cpf":"' + $cpf + '","sf":' + $sfJson + ',"sc":' + $scJson + '}' }
      }
      if (-not $bodyOut) { $bodyOut = '{"ok":false,"erro":"sem resposta dos scripts"}' }
      $res.StatusCode = 200; $res.ContentType = 'application/json; charset=utf-8'
      $buf = [Text.Encoding]::UTF8.GetBytes($bodyOut)
      $res.OutputStream.Write($buf, 0, $buf.Length); $res.Close()
      Write-Host "[$((Get-Date -Format 'HH:mm:ss'))] /api/sfxsc acao=$acao cpf=$cpf -> 200" -ForegroundColor Cyan
      continue
    }

    if ($path -eq '/api/link-sf') {
      # Comando "Pegar link SF": ofertas ativas do painel Links do Salesforce + link de pagamento
      # ja montado (utm_sellerId + MD5 + origem do lead em Base64). SOMENTE LEITURA no SF.
      # Uma chamada devolve clusters (produto+qtd) E todas as ofertas com o link pronto: a tela
      # navega cluster -> oferta -> link sem bater no servidor de novo.
      $raiz = Split-Path $root -Parent
      $scriptLK = Join-Path $raiz 'Pegar-Link-SF.ps1'
      $argsLK = @('-Json')
      $orig = $req.QueryString['origem']
      if ($orig) { $argsLK += @('-Origem', $orig) }
      $esc = $req.QueryString['escopo']
      if ($esc -in 'todas','rede','unidade') { $argsLK += @('-Escopo', $esc) }
      $prod = $req.QueryString['produto']
      if ($prod -match '^[A-Za-z0-9\-\+ ]{1,40}$') { $argsLK += @('-Produto', $prod) }
      $o = Exec-Filho $scriptLK $argsLK
      $i = $o.IndexOf('{'); $j = $o.LastIndexOf('}')
      $bodyLK = if ($i -ge 0 -and $j -gt $i) { $o.Substring($i, $j - $i + 1) } else { '' }
      if (-not $bodyLK) { $bodyLK = (@{ ok=$false; erro=("Pegar-Link-SF: " + $o.Trim()) } | ConvertTo-Json -Compress) }
      $res.StatusCode = 200; $res.ContentType = 'application/json; charset=utf-8'
      $buf = [Text.Encoding]::UTF8.GetBytes($bodyLK)
      $res.OutputStream.Write($buf, 0, $buf.Length); $res.Close()
      Write-Host "[$((Get-Date -Format 'HH:mm:ss'))] /api/link-sf produto=$prod -> 200" -ForegroundColor Cyan
      continue
    }

    if ($path -eq '/api/mover-etapa') {
      # Move oportunidades para uma etapa do funil (escrita no CRM). POST { stageId, ids:[...] }.
      if ($req.HttpMethod -ne 'POST') {
        $res.StatusCode = 405; $res.ContentType = 'application/json; charset=utf-8'
        $b = [Text.Encoding]::UTF8.GetBytes((@{ erro = 'use POST' } | ConvertTo-Json -Compress))
        $res.OutputStream.Write($b, 0, $b.Length); $res.Close(); continue
      }
      $reader = New-Object System.IO.StreamReader($req.InputStream, $req.ContentEncoding)
      $body = $reader.ReadToEnd(); $reader.Close()
      $tmp = Join-Path $env:TEMP ('mover_etapa_' + [Guid]::NewGuid().ToString('N') + '.json')
      [System.IO.File]::WriteAllText($tmp, $body, (New-Object System.Text.UTF8Encoding($false)))
      $raiz   = Split-Path $root -Parent
      $script = Join-Path $raiz 'Mover-Etapa-Vitoria.ps1'
      $out  = Exec-Filho $script @('-PlanoFile', $tmp)
      Remove-Item $tmp -ErrorAction SilentlyContinue
      $i = $out.IndexOf('{'); $j = $out.LastIndexOf('}')
      $jsonTxt = if ($i -ge 0 -and $j -gt $i) { $out.Substring($i, $j - $i + 1) } else { '' }
      $res.StatusCode = if ($jsonTxt) { 200 } else { 500 }
      $res.ContentType = 'application/json; charset=utf-8'
      $body2 = if ($jsonTxt) { $jsonTxt } else { (@{ erro = ($out.Trim()) } | ConvertTo-Json -Compress) }
      $buf = [Text.Encoding]::UTF8.GetBytes($body2)
      $res.OutputStream.Write($buf, 0, $buf.Length); $res.Close()
      Write-Host "[$((Get-Date -Format 'HH:mm:ss'))] /api/mover-etapa -> $($res.StatusCode)" -ForegroundColor Magenta
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
          # metas sao DIGITADAS pelo usuario: nao se reconstroem de lugar nenhum
          Gravar-Atomico -Arquivo $arq -Conteudo $json
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

    # ---- Lancar vendas no ZS: classifica as linhas coladas (ZS -> SF -> novo) ----
    # POST com as linhas no corpo. NAO grava nada: so diz o que falta para cada venda.
    if ($path -eq '/api/vendas-zs') {
      $res.ContentType = 'application/json; charset=utf-8'
      $raiz   = Split-Path $root -Parent
      $script = Join-Path $raiz 'lancamentos-zs\Vendas-ZS.ps1'
      function RespVZ($obj, $code) {
        $res.StatusCode = $code
        $b = [Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $obj -Depth 20 -Compress))
        $res.OutputStream.Write($b, 0, $b.Length); $res.Close()
      }
      if (-not (Test-Path $script)) { RespVZ @{ ok=$false; erro='Vendas-ZS.ps1 nao encontrado' } 500; continue }
      if ($req.HttpMethod -ne 'POST') { RespVZ @{ ok=$false; erro='use POST com as linhas no corpo' } 405; continue }

      # acao=remover -> tira o consumidor de UMA vaga
      if (([string]$req.QueryString['acao']) -eq 'remover') {
        $qV = [string]$req.QueryString['vaga']
        $qO = [string]$req.QueryString['opp']
        $qG = [string]$req.QueryString['org']; if ($qG -notmatch '^[123]$') { $qG = '2' }
        if ($qV -notmatch '^\d{1,12}$') { RespVZ @{ ok=$false; erro='vaga invalida' } 400; continue }
        if ($qO -notmatch '^\d{1,12}$') { $qO = '0' }
        $sR = Exec-Filho $script @('-Acao','remover','-Vaga',$qV,'-Opp',$qO,'-Org',$qG,'-Aplicar','-Json')
        $kr = $sR.IndexOf('{'); $mr = $sR.LastIndexOf('}')
        if ($kr -ge 0 -and $mr -gt $kr) {
          $res.StatusCode = 200
          $br = [Text.Encoding]::UTF8.GetBytes($sR.Substring($kr, $mr - $kr + 1))
          $res.OutputStream.Write($br, 0, $br.Length); $res.Close()
        } else { RespVZ @{ ok=$false; erro='O script nao devolveu JSON'; log=$sR } 500 }
        Write-Host ("[{0}] /api/vendas-zs remover vaga={1} org={2}" -f (Get-Date -Format 'HH:mm:ss'), $qV, $qG) -ForegroundColor Cyan
        continue
      }

      # acao=ler -> reconsulta a venda no ZS (SO LEITURA). A tela chama antes de decidir
      # se ja esta ganha: estado guardado em memoria envelhece e mente.
      if (([string]$req.QueryString['acao']) -eq 'ler') {
        $qOppL = [string]$req.QueryString['opp']
        $qOrgL = [string]$req.QueryString['org']; if ($qOrgL -notmatch '^[123]$') { $qOrgL = '2' }
        if ($qOppL -notmatch '^\d{1,12}$') { RespVZ @{ ok=$false; erro='opp invalida' } 400; continue }
        $sL = Exec-Filho $script @('-Acao','ler','-Opp',$qOppL,'-Org',$qOrgL,'-Json')
        $kl = $sL.IndexOf('{'); $ml = $sL.LastIndexOf('}')
        if ($kl -ge 0 -and $ml -gt $kl) {
          $res.StatusCode = 200
          $bl = [Text.Encoding]::UTF8.GetBytes($sL.Substring($kl, $ml - $kl + 1))
          $res.OutputStream.Write($bl, 0, $bl.Length); $res.Close()
        } else { RespVZ @{ ok=$false; erro='O script nao devolveu JSON'; log=$sL } 500 }
        Write-Host ("[{0}] /api/vendas-zs ler opp={1} org={2}" -f (Get-Date -Format 'HH:mm:ss'), $qOppL, $qOrgL) -ForegroundColor DarkCyan
        continue
      }

      # acao=etapa5 -> venda ja ganha parada em etapa errada: move para a 5 (Venda Feita)
      if (([string]$req.QueryString['acao']) -eq 'etapa5') {
        $qOppE = [string]$req.QueryString['opp']
        $qOrgE = [string]$req.QueryString['org']; if ($qOrgE -notmatch '^[123]$') { $qOrgE = '2' }
        if ($qOppE -notmatch '^[0-9]{1,12}$') { RespVZ @{ ok=$false; erro='opp invalida' } 400; continue }
        $sE = Exec-Filho $script @('-Acao','etapa5','-Opp',$qOppE,'-Org',$qOrgE,'-Aplicar','-Json')
        $ke = $sE.IndexOf('{'); $me = $sE.LastIndexOf('}')
        if ($ke -ge 0 -and $me -gt $ke) {
          $res.StatusCode = 200
          $be = [Text.Encoding]::UTF8.GetBytes($sE.Substring($ke, $me - $ke + 1))
          $res.OutputStream.Write($be, 0, $be.Length); $res.Close()
        } else { RespVZ @{ ok=$false; erro='O script nao devolveu JSON'; log=$sE } 500 }
        Write-Host ("[{0}] /api/vendas-zs etapa5 opp={1} org={2}" -f (Get-Date -Format 'HH:mm:ss'), $qOppE, $qOrgE) -ForegroundColor Cyan
        continue
      }

      # acao=fechar -> fecha a oportunidade como Ganho (depois de conferida a previa)
      if (([string]$req.QueryString['acao']) -eq 'fechar') {
        $qOpp2 = [string]$req.QueryString['opp']
        $qOrg2 = [string]$req.QueryString['org']; if ($qOrg2 -notmatch '^[123]$') { $qOrg2 = '2' }
        if ($qOpp2 -notmatch '^\d{1,12}$') { RespVZ @{ ok=$false; erro='opp invalida' } 400; continue }
        $sF = Exec-Filho $script @('-Acao','fechar','-Opp',$qOpp2,'-Org',$qOrg2,'-Aplicar','-Json')
        $kf = $sF.IndexOf('{'); $mf = $sF.LastIndexOf('}')
        if ($kf -ge 0 -and $mf -gt $kf) {
          $res.StatusCode = 200
          $bf = [Text.Encoding]::UTF8.GetBytes($sF.Substring($kf, $mf - $kf + 1))
          $res.OutputStream.Write($bf, 0, $bf.Length); $res.Close()
        } else { RespVZ @{ ok=$false; erro='O script nao devolveu JSON'; log=$sF } 500 }
        Write-Host ("[{0}] /api/vendas-zs fechar opp={1} org={2}" -f (Get-Date -Format 'HH:mm:ss'), $qOpp2, $qOrg2) -ForegroundColor Cyan
        continue
      }

      # acao=consumidores -> grava os consumidores nas vagas da venda (unica escrita desta rota)
      if (([string]$req.QueryString['acao']) -eq 'consumidores') {
        $qOpp = [string]$req.QueryString['opp']
        if ($qOpp -notmatch '^\d{1,12}$') { RespVZ @{ ok=$false; erro='opp invalida' } 400; continue }
        $sr2 = New-Object IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)
        $planoTxt = $sr2.ReadToEnd(); $sr2.Close()
        if (-not $planoTxt -or $planoTxt.Trim().Length -lt 2) { RespVZ @{ ok=$false; erro='plano vazio' } 400; continue }
        $tmpP = Join-Path $env:TEMP ('vzcons_' + [Guid]::NewGuid().ToString('N') + '.json')
        [IO.File]::WriteAllText($tmpP, $planoTxt, (New-Object Text.UTF8Encoding($false)))
        # a venda pode ser de outra unidade (2=Vitoria 3=Teresina 1=Belem): sem o org certo
        # a API nao acha as vagas e devolve 404 em todas.
        $qOrg = [string]$req.QueryString['org']
        if ($qOrg -notmatch '^[123]$') { $qOrg = '2' }
        $sOut = Exec-Filho $script @('-Acao','consumidores','-Opp',$qOpp,'-Org',$qOrg,'-PlanoFile',$tmpP,'-Aplicar','-Json')
        Remove-Item $tmpP -Force -ErrorAction SilentlyContinue
        $k = $sOut.IndexOf('{'); $m = $sOut.LastIndexOf('}')
        if ($k -ge 0 -and $m -gt $k) {
          $res.StatusCode = 200
          $b = [Text.Encoding]::UTF8.GetBytes($sOut.Substring($k, $m - $k + 1))
          $res.OutputStream.Write($b, 0, $b.Length); $res.Close()
        } else {
          # sem JSON = o script filho falhou; guarda a saida bruta para dar para diagnosticar
          try {
            [IO.File]::AppendAllText((Join-Path $root 'servir-erros.log'),
              ("[{0}] /api/vendas-zs consumidores opp={1}`r`n  SAIDA BRUTA DO SCRIPT:`r`n{2}`r`n---`r`n" -f `
               (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $qOpp, $sOut), [Text.Encoding]::UTF8)
          } catch {}
          RespVZ @{ ok=$false; erro='O script nao devolveu JSON'; log=$sOut } 500
        }
        Write-Host ("[{0}] /api/vendas-zs consumidores opp={1}" -f (Get-Date -Format 'HH:mm:ss'), $qOpp) -ForegroundColor Cyan
        continue
      }

      # ?arquivo=<caminho do report*.xls>  -> le o relatorio; senao, usa as linhas do corpo
      $qArq = ''
      try { $mq = [regex]::Match($req.Url.Query, '(?:^\?|&)arquivo=([^&]*)'); if ($mq.Success) { $qArq = [Uri]::UnescapeDataString($mq.Groups[1].Value.Replace('+','%20')) } } catch {}
      $tmpL = $null
      if ($qArq) {
        if (-not (Test-Path $qArq)) { RespVZ @{ ok=$false; erro="Arquivo nao encontrado: $qArq" } 400; continue }
        $saida = Exec-Filho $script @('-Acao','classificar','-Relatorio',$qArq,'-Json')
      } else {
        $sr = New-Object IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)
        $linhasTxt = $sr.ReadToEnd(); $sr.Close()
        if (-not $linhasTxt -or -not $linhasTxt.Trim()) { RespVZ @{ ok=$false; erro='Cole as linhas ou escolha um relatorio.' } 400; continue }
        $tmpL = Join-Path $env:TEMP ('vendaszs_' + [Guid]::NewGuid().ToString('N') + '.txt')
        [IO.File]::WriteAllText($tmpL, $linhasTxt, (New-Object Text.UTF8Encoding($false)))
        $saida = Exec-Filho $script @('-Acao','classificar','-LinhasFile',$tmpL,'-Json')
      }
      if ($tmpL) { Remove-Item $tmpL -Force -ErrorAction SilentlyContinue }
      $i = $saida.IndexOf('{'); $j = $saida.LastIndexOf('}')
      if ($i -ge 0 -and $j -gt $i) {
        $res.StatusCode = 200
        $b = [Text.Encoding]::UTF8.GetBytes($saida.Substring($i, $j - $i + 1))
        $res.OutputStream.Write($b, 0, $b.Length); $res.Close()
      } else { RespVZ @{ ok=$false; erro='O script nao devolveu JSON'; log=$saida } 500 }
      Write-Host ("[{0}] /api/vendas-zs classificar" -f (Get-Date -Format 'HH:mm:ss')) -ForegroundColor DarkCyan
      continue
    }

    # ---- Lancar turma: HUD/Pipeline -> vendas da turma (FRZ) ----
    #   GET  sem turma           -> lista as turmas
    #   GET  ?turma=&data=       -> PREVIA (nao grava nada) + o "plano" que sera gravado
    #   POST ?turma=&data= + plano no corpo -> grava EXATAMENTE o plano que estava na tela
    # O plano vai e volta de proposito: sem isso o Confirmar recalcularia e poderia gravar
    # algo diferente do que o usuario aprovou. O script ainda reconfere contra o banco.
    # Consumidores das vagas (bloco "Clientes que fecharam" da Leitura FRZ).
    # So leitura: o Consumidores-Vaga.ps1 nao grava nada no ZS.
    if ($path -eq '/api/mapeamento-turma') {
      # Mapeamento da turma (planilha ADQUIRIDO/PENDENTE) vinculado a uma turma do FRZ, para o
      # selo "Novo Green/Golden Belt" do bloco Clientes que fecharam (Leitura FRZ).
      #   GET  ?praca=&turma=<id FRZ>        -> {ok, link, salvoEm, mapa:{det,cons,pres}}  (mapa so se houver link)
      #   POST {praca, turma, link}          -> grava o link (vazio = remove) e responde como o GET
      # O link fica em meta-master/mapeamentos-turma.json (chave "praca|turma"); a leitura da
      # planilha e a mesma do comando Leitura de Turma (Leitura-Turma.ps1 -> <!--LT-DET:...-->).
      $res.ContentType = 'application/json; charset=utf-8'
      $arqMT = Join-Path $root 'mapeamentos-turma.json'
      function RespMT($txt, $code) {
        $res.StatusCode = $code
        $b = [Text.Encoding]::UTF8.GetBytes($txt)
        $res.OutputStream.Write($b, 0, $b.Length); $res.Close()
      }
      $mapMT = [ordered]@{}
      if (Test-Path $arqMT) {
        try { (Get-Content $arqMT -Raw -Encoding UTF8 | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $mapMT[$_.Name] = $_.Value } } catch {}
      }
      $pracaMT = ''; $turmaMT = ''; $linkMT = $null
      if ($req.HttpMethod -eq 'POST') {
        $srMT = New-Object IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)
        $cMT = $null; try { $cMT = $srMT.ReadToEnd() | ConvertFrom-Json } catch {}; $srMT.Close()
        if ($cMT) { $pracaMT = [string]$cMT.praca; $turmaMT = [string]$cMT.turma; $linkMT = ([string]$cMT.link).Trim() }
      } else {
        $pracaMT = QsUtf8 $req 'praca'; $turmaMT = [string]$req.QueryString['turma']
      }
      if ($turmaMT -notmatch '^\d+$') { RespMT '{"ok":false,"erro":"turma invalida"}' 400; continue }
      $chaveMT = ($pracaMT.Trim() + '|' + $turmaMT)
      if ($null -ne $linkMT) {
        if (-not $linkMT) { $mapMT.Remove($chaveMT) }
        elseif ($linkMT -notmatch 'docs\.google\.com/spreadsheets/d/') { RespMT '{"ok":false,"erro":"use o link da planilha do Google Sheets"}' 400; continue }
        else { $mapMT[$chaveMT] = [ordered]@{ link = $linkMT; salvoEm = (Get-Date -Format 'dd/MM/yyyy HH:mm') } }
        try { Gravar-Atomico -Arquivo $arqMT -Conteudo ($mapMT | ConvertTo-Json -Depth 4) -PermitirVazio } catch { Log-Erro "/api/mapeamento-turma gravacao" $_.Exception.Message }
      }
      $entMT = $mapMT[$chaveMT]
      if (-not $entMT -or -not $entMT.link) { RespMT '{"ok":true,"link":""}' 200; continue }
      $outMT = Exec-Filho (Join-Path (Split-Path $root -Parent) 'Leitura-Turma.ps1') @('-Link', ([string]$entMT.link))
      $mMT = [regex]::Match($outMT, '<!--LT-DET:([\s\S]*?)-->')
      $linkJs = ([string]$entMT.link | ConvertTo-Json -Compress); $salvoJs = ([string]$entMT.salvoEm | ConvertTo-Json -Compress)
      if ($mMT.Success) {
        RespMT ('{"ok":true,"link":' + $linkJs + ',"salvoEm":' + $salvoJs + ',"lidoEm":"' + (Get-Date -Format 'dd/MM/yyyy HH:mm') + '","mapa":' + $mMT.Groups[1].Value + '}') 200
      } else {
        $errMT = ($outMT.Trim() -split "`n" | Select-Object -First 3) -join ' '
        RespMT ('{"ok":false,"link":' + $linkJs + ',"erro":' + ('Nao consegui ler a planilha: ' + $errMT | ConvertTo-Json -Compress) + '}') 200
      }
      Write-Host ("[{0}] /api/mapeamento-turma {1}" -f (Get-Date -Format 'HH:mm:ss'), $chaveMT) -ForegroundColor DarkCyan
      continue
    }

    if ($path -eq '/api/consumidores-vaga') {
      $res.ContentType = 'application/json; charset=utf-8'
      $raiz   = Split-Path $root -Parent
      $script = Join-Path $raiz 'Consumidores-Vaga.ps1'
      function RespCV($obj, $code) {
        $res.StatusCode = $code
        $b = [Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $obj -Depth 20 -Compress))
        $res.OutputStream.Write($b, 0, $b.Length); $res.Close()
      }
      if (-not (Test-Path $script))   { RespCV @{ ok=$false; erro='Consumidores-Vaga.ps1 nao encontrado' } 500; continue }
      if ($req.HttpMethod -ne 'POST') { RespCV @{ ok=$false; erro='use POST com os clientes no corpo' } 405; continue }
      $srCV = New-Object IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)
      $corpoCV = $srCV.ReadToEnd(); $srCV.Close()
      if (-not $corpoCV -or $corpoCV.Trim().Length -lt 2) { RespCV @{ ok=$false; erro='corpo vazio' } 400; continue }
      $tmpCV = Join-Path $env:TEMP ('consvaga_' + [Guid]::NewGuid().ToString('N') + '.json')
      [IO.File]::WriteAllText($tmpCV, $corpoCV, (New-Object Text.UTF8Encoding($false)))
      $saidaCV = Exec-Filho $script @('-ClientesFile', $tmpCV, '-Json')
      Remove-Item $tmpCV -Force -ErrorAction SilentlyContinue
      $iCV = $saidaCV.IndexOf('{'); $jCV = $saidaCV.LastIndexOf('}')
      if ($iCV -ge 0 -and $jCV -gt $iCV) {
        $res.StatusCode = 200
        $bCV = [Text.Encoding]::UTF8.GetBytes($saidaCV.Substring($iCV, $jCV - $iCV + 1))
        $res.OutputStream.Write($bCV, 0, $bCV.Length); $res.Close()
      } else { RespCV @{ ok=$false; erro='O script nao devolveu JSON'; log=$saidaCV } 500 }
      Write-Host ("[{0}] /api/consumidores-vaga" -f (Get-Date -Format 'HH:mm:ss')) -ForegroundColor DarkCyan
      continue
    }

    if ($path -eq '/api/turma-frz') {
      $res.ContentType = 'application/json; charset=utf-8'
      $raiz   = Split-Path $root -Parent
      $script = Join-Path $raiz 'Turma-Lancar-FRZ.ps1'
      $tmpPlano = $null
      function RespTF($obj, $code) {
        $res.StatusCode = $code
        $b = [Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $obj -Depth 20 -Compress))
        $res.OutputStream.Write($b, 0, $b.Length); $res.Close()
      }
      if (-not (Test-Path $script)) { RespTF @{ ok=$false; erro='Turma-Lancar-FRZ.ps1 nao encontrado' } 500; continue }

      $qTurma = [string]$req.QueryString['turma']
      $qData  = [string]$req.QueryString['data']
      $qTodos = ([string]$req.QueryString['todos']) -eq '1'
      if ($qTurma -and $qTurma -notmatch '^[\p{L}\d \-\.\/]{1,60}$') { RespTF @{ ok=$false; erro='turma invalida' } 400; continue }
      if ($qData  -and $qData  -notmatch '^\d{4}-\d{2}(-\d{2})?$')   { RespTF @{ ok=$false; erro='data invalida (AAAA-MM ou AAAA-MM-DD)' } 400; continue }

      $psArgs = @('-Json')
      if ($qTurma) { $psArgs += @('-Turma', $qTurma) }
      if ($qData)  { $psArgs += @('-Data',  $qData) }
      if ($qTodos) { $psArgs += '-Todos' }

      if ($req.HttpMethod -eq 'POST') {
        if (-not $qTurma) { RespTF @{ ok=$false; erro='turma obrigatoria para aplicar' } 400; continue }
        $sr = New-Object IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)
        $corpoPlano = $sr.ReadToEnd(); $sr.Close()
        if (-not $corpoPlano -or $corpoPlano.Trim().Length -lt 2) { RespTF @{ ok=$false; erro='plano vazio' } 400; continue }
        $tmpPlano = Join-Path $env:TEMP ('turmafrz_' + [Guid]::NewGuid().ToString('N') + '.json')
        [IO.File]::WriteAllText($tmpPlano, $corpoPlano, (New-Object Text.UTF8Encoding($false)))
        $psArgs += @('-Aplicar', '-PlanoFile', $tmpPlano)
      }

      $saida = Exec-Filho $script $psArgs
      if ($tmpPlano) { Remove-Item $tmpPlano -Force -ErrorAction SilentlyContinue }
      $i = $saida.IndexOf('{'); $j = $saida.LastIndexOf('}')
      if ($i -ge 0 -and $j -gt $i) {
        $res.StatusCode = 200
        $b = [Text.Encoding]::UTF8.GetBytes($saida.Substring($i, $j - $i + 1))
        $res.OutputStream.Write($b, 0, $b.Length); $res.Close()
      } else {
        RespTF @{ ok=$false; erro='O script nao devolveu JSON'; log=$saida } 500
      }
      Write-Host ("[{0}] /api/turma-frz {1} turma={2} data={3}" -f (Get-Date -Format 'HH:mm:ss'), $req.HttpMethod, $qTurma, $qData) -ForegroundColor DarkCyan
      continue
    }

    if ($path -eq '/api/lancamentos') {
      # Fluxo "Lancar vendas do SF" (pasta lancamentos-zs). 3 etapas, sempre com previa antes:
      #   GET  acao=arquivos          -> lista os report*.xls de Downloads (o navegador nao da o caminho real)
      #   GET  acao=previa            -> &arquivo=<caminho> OU &venda=<link/Id>   (NAO grava nada)
      #   POST acao=cadastro|vendas   -> grava (equivale ao -Aplicar)
      # Resposta: { ok, log, rodada } — a rodada e o JSON gravado pelo script em previas\.
      $raiz   = Split-Path $root -Parent
      $pasta  = Join-Path $raiz 'lancamentos-zs'
      $script = Join-Path $pasta 'Lancar-Vendas-SF.ps1'
      $acao   = $req.QueryString['acao']
      $res.ContentType = 'application/json; charset=utf-8'
      function Responder($obj, $code) {
        $res.StatusCode = $code
        $b = [Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $obj -Depth 20 -Compress))
        $res.OutputStream.Write($b, 0, $b.Length); $res.Close()
      }
      if (-not (Test-Path $script)) { Responder @{ ok=$false; erro="Lancar-Vendas-SF.ps1 nao encontrado em $pasta" } 500; continue }

      if ($acao -eq 'arquivos') {
        $dl = Join-Path $env:USERPROFILE 'Downloads'
        $lista = @()
        foreach ($f in (Get-ChildItem $dl -Filter '*.xls' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 15)) {
          $lista += @{ nome=$f.Name; caminho=$f.FullName; kb=[Math]::Round($f.Length/1KB,1); data=$f.LastWriteTime.ToString('dd/MM/yyyy HH:mm') }
        }
        Responder @{ ok=$true; arquivos=$lista } 200
        Write-Host "[$((Get-Date -Format 'HH:mm:ss'))] /api/lancamentos arquivos -> $($lista.Count)" -ForegroundColor DarkGreen
        continue
      }
      if ($acao -notin 'previa','cadastro','vendas','status') { Responder @{ ok=$false; erro="Acao invalida: $acao" } 400; continue }

      $psArgs = @()
      if ($acao -eq 'previa') {
        function Qp($nome){ try { $mq=[regex]::Match($req.Url.Query,'(?:^\?|&)'+$nome+'=([^&]*)'); if($mq.Success){ return [Uri]::UnescapeDataString($mq.Groups[1].Value.Replace('+','%20')) } } catch {}; return '' }
        $qArq = Qp 'arquivo'; $qVen = Qp 'venda'
        if ($qVen) { $psArgs = @('-Venda', $qVen) }
        elseif ($qArq) {
          if (-not (Test-Path $qArq -PathType Leaf)) { Responder @{ ok=$false; erro="Arquivo nao encontrado: $qArq" } 400; continue }
          $psArgs = @('-Arquivo', $qArq)
        } else { Responder @{ ok=$false; erro='Escolha o relatorio ou informe o link da venda.' } 400; continue }
      } elseif ($acao -eq 'status') {
        $psArgs = @('-Acao','status')
      } else {
        if ($req.HttpMethod -ne 'POST') { Responder @{ ok=$false; erro='Cadastro e vendas exigem POST (evita gravar sem querer).' } 405; continue }
        $psArgs = @('-Acao', $acao, '-Aplicar')
      }

      $log = Exec-Filho $script $psArgs
      $rodada = $null
      try {
        $ult = Get-ChildItem (Join-Path $pasta 'previas') -Filter 'rodada-*.json' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($ult) { $rodada = Get-Content -Raw -Encoding UTF8 $ult.FullName | ConvertFrom-Json }
      } catch {}
      $falhou = ($log -match '(?im)^\s*(ERRO|Erro ao|Exception)')
      Responder @{ ok=(-not $falhou); acao=$acao; log=$log; rodada=$rodada } 200
      Write-Host "[$((Get-Date -Format 'HH:mm:ss'))] /api/lancamentos $($req.HttpMethod) acao=$acao -> 200" -ForegroundColor Green
      continue
    }

    if ($path -eq '/api/atualizar') {
      # Esta rota ESCREVE (regera o dados.js). Sem checagem de metodo, um GET qualquer
      # -- link, <img src>, pre-fetch do navegador -- disparava o gerador. Mesma correcao
      # ja feita em /api/lancar (auditoria 19/09/2026).
      if ($req.HttpMethod -ne 'POST') {
        $res.StatusCode = 405; $res.ContentType = 'application/json; charset=utf-8'
        $b = [Text.Encoding]::UTF8.GetBytes((@{ ok=$false; erro='/api/atualizar regera o dados.js: use POST.' } | ConvertTo-Json -Compress))
        $res.OutputStream.Write($b, 0, $b.Length); $res.Close(); continue
      }
      # roda o gerador (faturamento atual -> dados.js)
      $per = $req.QueryString['periodo']
      if ([string]::IsNullOrWhiteSpace($per)) { $per = (Get-Date -Format 'yyyy-MM') }
      if ($per -notmatch '^\d{4}-\d{2}$') { $per = (Get-Date -Format 'yyyy-MM') }
      $gerador = Join-Path $root 'Gerar-Dados-MetaMaster.ps1'
      $saida = Exec-Filho $gerador @('-Periodo', $per)
      # Era aqui que o botao RECARREGAR DADOS devolvia "OK" com o gerador quebrado:
      # $LASTEXITCODE nunca e do filho. Agora vale o codigo real + stderr.
      $falhaGen = Falha-DoFilho $script:ultimoErr $script:ultimoExit
      if ($falhaGen) { Log-Erro "/api/atualizar periodo=$per -> $falhaGen" $script:ultimoErr }
      $okGen = (-not $falhaGen)
      $res.StatusCode = if ($okGen) { 200 } else { 500 }
      $res.ContentType = 'text/plain; charset=utf-8'
      $buf = [Text.Encoding]::UTF8.GetBytes($saida)
      $res.OutputStream.Write($buf, 0, $buf.Length)
      $res.Close()
      $stamp = (Get-Date -Format 'HH:mm:ss')
      Write-Host "[$stamp] /api/atualizar periodo=$per -> $($res.StatusCode)" -ForegroundColor Cyan
      continue
    }

    # ---- guarda o PNG gerado e devolve uma URL de verdade ----
    # POR QUE: no celular em http nao da para copiar por codigo; o caminho e o menu do navegador
    # (segurar o dedo -> "Copiar imagem"). Esse menu so fica completo em imagem servida por URL
    # normal — numa <img src="blob:..."> o Chrome nao oferece copiar. Entao gravamos o arquivo.
    if ($path -eq '/api/img') {
      $res.ContentType = 'application/json; charset=utf-8'
      if ($req.HttpMethod -ne 'POST') {
        $res.StatusCode = 405
        $b = [Text.Encoding]::UTF8.GetBytes('{"ok":false,"erro":"use POST"}')
        $res.OutputStream.Write($b, 0, $b.Length); $res.Close(); continue
      }
      $sr = New-Object IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)
      $corpo = $sr.ReadToEnd(); $sr.Close()
      try {
        $b64 = $corpo -replace '^data:image/png;base64,', ''
        $bytes = [Convert]::FromBase64String($b64)
        $dir = Join-Path $root '_tmp'
        if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
        # limpa o que ficou de antes (mais de 2h) para a pasta nao crescer
        Get-ChildItem $dir -Filter '*.png' -ErrorAction SilentlyContinue |
          Where-Object { $_.LastWriteTime -lt (Get-Date).AddHours(-2) } |
          Remove-Item -Force -ErrorAction SilentlyContinue
        $nome = 'img-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + (Get-Random -Maximum 9999) + '.png'
        [IO.File]::WriteAllBytes((Join-Path $dir $nome), $bytes)
        $res.StatusCode = 200
        $b = [Text.Encoding]::UTF8.GetBytes('{"ok":true,"url":"/_tmp/' + $nome + '"}')
        Write-Host ("[{0}] /api/img -> _tmp/{1} ({2} KB)" -f (Get-Date -Format 'HH:mm:ss'), $nome, [math]::Round($bytes.Length/1KB)) -ForegroundColor Cyan
      } catch {
        $res.StatusCode = 500
        $b = [Text.Encoding]::UTF8.GetBytes('{"ok":false,"erro":"' + ($_.Exception.Message -replace '"','') + '"}')
      }
      $res.OutputStream.Write($b, 0, $b.Length); $res.Close(); continue
    }

    # ---- endereco para abrir no celular (o IP muda a cada rede/DHCP) ----
    # ---- erro de JavaScript vira linha de log (auditoria 18/09/2026) ----
    # O front nao tem teste automatizado; o que da para ter e rastro. window.onerror
    # e unhandledrejection mandam para ca, e o erro que hoje some no console fica
    # registrado junto com os erros do servidor.
    if ($path -eq '/api/log-front') {
      $res.ContentType = 'application/json; charset=utf-8'
      if ($req.HttpMethod -ne 'POST') {
        $res.StatusCode = 405
        $b = [Text.Encoding]::UTF8.GetBytes('{"ok":false,"erro":"use POST"}')
        $res.OutputStream.Write($b, 0, $b.Length); $res.Close(); continue
      }
      try {
        $srLF = New-Object IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)
        $corpoLF = $srLF.ReadToEnd(); $srLF.Close()
        $oLF = $corpoLF | ConvertFrom-Json
        $msgLF = [string]$oLF.msg
        if ($msgLF.Length -gt 500) { $msgLF = $msgLF.Substring(0,500) }
        $ondeLF = [string]$oLF.onde
        Log-Erro "[front] $ondeLF" $msgLF
      } catch {}
      $res.StatusCode = 204
      $res.Close(); continue
    }

    if ($path -eq '/api/ip') {
      $ips = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
               Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '169.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
               Select-Object -ExpandProperty IPAddress)
      $rede = ''
      try { $rede = (Get-NetConnectionProfile -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Name) } catch {}
      $res.StatusCode = 200; $res.ContentType = 'application/json; charset=utf-8'
      # host = endereco fixo (mDNS). Sobrevive a troca de rede; o IP nao.
      $obj = [ordered]@{ porta = $Porta; rede = [string]$rede; ips = @($ips)
                         hostLocal = ($env:COMPUTERNAME.ToLower() + '.local') }
      $b = [Text.Encoding]::UTF8.GetBytes(($obj | ConvertTo-Json -Compress))
      $res.OutputStream.Write($b, 0, $b.Length); $res.Close(); continue
    }

    # ---- estado compartilhado (o localStorage e separado por origem: localhost x IP x tunel) ----
    # GET  /api/estado          -> devolve tudo (menos as fotos, que vao pelo mm-fotos.js)
    # POST /api/estado {sets,dels} -> aplica o patch em estado.json
    if ($path -eq '/api/estado') {
      $res.ContentType = 'application/json; charset=utf-8'
      $arqEstado = Join-Path $root 'estado.json'
      $estado = @{}
      # RAIZ DO MAIOR RISCO DE PERDA DE DADO DO APP (auditoria 18/09/2026):
      # este catch era vazio. Arquivo truncado -> $estado fica {} -> o POST
      # seguinte grava so o patch e apaga 1 MB de fotos e preferencias, sem
      # ninguem notar. Agora a falha e lembrada e o POST se recusa a gravar
      # por cima de um estado que nao conseguiu ler.
      $estadoLidoOk = $true
      if (Test-Path $arqEstado) {
        try {
          $o = Get-Content $arqEstado -Raw -Encoding UTF8 | ConvertFrom-Json
          foreach ($pr in $o.PSObject.Properties) { $estado[$pr.Name] = [string]$pr.Value }
        } catch {
          $estadoLidoOk = $false
          Log-Erro "/api/estado LEITURA FALHOU" $_.Exception.Message
        }
      }

      if ($req.HttpMethod -eq 'GET') {
        # as fotos sao pesadas (base64) e ja tem canal proprio -> nao entram nesta resposta
        #
        # ?leve=1 tira TAMBEM a curadoria da apresentacao de turma (turmaFcis): sao as fotos
        # dos alunos em base64, ~93 KB cada, 1 MB hoje. O index.html le este endpoint no boot
        # de forma SINCRONA -- estava baixando 1 MB que so a turma-apresentacao.html usa, a
        # cada abertura do app (auditoria 19/09/2026, Fase 4). A apresentacao continua pedindo
        # o estado completo (sem o parametro), entao nada muda para ela.
        $pesadas = @('turmaFcis')
        $soLeve  = ($req.QueryString['leve'] -eq '1')
        $leve = @{}
        foreach ($k in $estado.Keys) {
          if ($k -like 'mmfoto_*') { continue }
          if ($soLeve -and ($pesadas -contains $k)) { continue }
          $leve[$k] = $estado[$k]
        }
        $txt = if ($leve.Count) { $leve | ConvertTo-Json -Depth 4 -Compress } else { '{}' }
        $b = [Text.Encoding]::UTF8.GetBytes($txt)
        $res.StatusCode = 200
        $res.OutputStream.Write($b, 0, $b.Length); $res.Close(); continue
      }

      if ($req.HttpMethod -eq 'POST') {
        $sr = New-Object IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)
        $corpo = $sr.ReadToEnd(); $sr.Close()
        try {
          $patch = $corpo | ConvertFrom-Json
          $nSet = 0; $nDel = 0
          if ($patch.sets) { foreach ($pr in $patch.sets.PSObject.Properties) { $estado[$pr.Name] = [string]$pr.Value; $nSet++ } }
          if ($patch.dels) { foreach ($k in @($patch.dels)) { if ($estado.ContainsKey($k)) { $estado.Remove($k); $nDel++ } } }
          # estado ilegivel + arquivo com conteudo = NAO GRAVAR. Melhor devolver
          # erro e manter o que esta la do que trocar 1 MB por um patch.
          if (-not $estadoLidoOk -and (Test-Path $arqEstado) -and (Get-Item $arqEstado).Length -gt 4) {
            $res.StatusCode = 500
            $b = [Text.Encoding]::UTF8.GetBytes('{"ok":false,"erro":"nao consegui ler o estado atual; gravacao recusada para nao apagar o que esta la. Veja o .prev e o _backup."}')
            $res.OutputStream.Write($b, 0, $b.Length); $res.Close(); continue
          }
          $json = if ($estado.Count) { $estado | ConvertTo-Json -Depth 4 -Compress } else { '{}' }
          Gravar-Atomico -Arquivo $arqEstado -Conteudo $json
          $res.StatusCode = 200
          $b = [Text.Encoding]::UTF8.GetBytes("{""ok"":true,""gravadas"":$nSet,""apagadas"":$nDel}")
          Write-Host ("[{0}] /api/estado <- {1} chave(s), {2} apagada(s)" -f (Get-Date -Format 'HH:mm:ss'), $nSet, $nDel) -ForegroundColor DarkCyan
        } catch {
          $res.StatusCode = 500
          $b = [Text.Encoding]::UTF8.GetBytes('{"ok":false,"erro":"' + ($_.Exception.Message -replace '"','') + '"}')
        }
        $res.OutputStream.Write($b, 0, $b.Length); $res.Close(); continue
      }

      $res.StatusCode = 405
      $b = [Text.Encoding]::UTF8.GetBytes('{"ok":false,"erro":"use GET ou POST"}')
      $res.OutputStream.Write($b, 0, $b.Length); $res.Close(); continue
    }

    # ---- grava o mm-fotos.js (botao PUBLICAR FOTOS) ----
    # As fotos ficam no localStorage, que e SEPARADO por origem (localhost x IP da rede x tunel).
    # Publicar = escrever o arquivo servido a todos, para a foto aparecer no celular tambem.
    if ($path -eq '/api/fotos') {
      $res.ContentType = 'application/json; charset=utf-8'
      if ($req.HttpMethod -ne 'POST') {
        $res.StatusCode = 405
        $b = [Text.Encoding]::UTF8.GetBytes('{"ok":false,"erro":"use POST"}')
        $res.OutputStream.Write($b, 0, $b.Length); $res.Close(); continue
      }
      $sr = New-Object IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)
      $corpo = $sr.ReadToEnd(); $sr.Close()
      # A validacao era so o cabecalho: um corpo contendo APENAS o comentario
      # passava e zerava todas as fotos (e o unico .bak seria sobrescrito no
      # publish seguinte). Agora tambem exige ter foto de verdade la dentro.
      $temFoto = ($corpo -match 'mmfoto_|data:image/')
      if ($corpo -notmatch '^//\s*Fotos do Meta Master' -or -not $temFoto) {
        $res.StatusCode = 400
        $b = [Text.Encoding]::UTF8.GetBytes('{"ok":false,"erro":"conteudo invalido (cabecalho ou fotos ausentes)"}')
        $res.OutputStream.Write($b, 0, $b.Length); $res.Close(); continue
      }
      $alvo = Join-Path $root 'mm-fotos.js'
      try {
        if (Test-Path $alvo) { Copy-Item $alvo (Join-Path $root 'mm-fotos.bak.js') -Force }
        Gravar-Atomico -Arquivo $alvo -Conteudo $corpo
        $qtd = ([regex]::Matches($corpo, '"[^"]+"\s*:\s*"data:image')).Count
        $res.StatusCode = 200
        $b = [Text.Encoding]::UTF8.GetBytes("{""ok"":true,""fotos"":$qtd}")
        Write-Host ("[{0}] /api/fotos -> mm-fotos.js gravado ({1} fotos, {2} KB)" -f (Get-Date -Format 'HH:mm:ss'), $qtd, [math]::Round($corpo.Length/1KB)) -ForegroundColor Cyan
      } catch {
        $res.StatusCode = 500
        $b = [Text.Encoding]::UTF8.GetBytes('{"ok":false,"erro":"' + ($_.Exception.Message -replace '"','') + '"}')
      }
      $res.OutputStream.Write($b, 0, $b.Length); $res.Close(); continue
    }

    # arquivos estaticos
    if ($path -eq '/' ) { $path = '/index.html' }
    $rel = $path.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
    $full = Join-Path $root $rel
    # Nao servir o que nao e da pagina. A lista cobria so .ps1/.bat/.cmd, entao
    # GET /estado.json entregava 1 MB do estado do app, /.auth entregava a
    # credencial em texto claro e /servir-erros.log entregava saida bruta com
    # dado de cliente (auditoria 18/09/2026).
    # O front nao carrega NENHUM .json estatico (so dados.js e mm-fotos.js),
    # entao bloquear a extensao inteira nao tira nada dele.
    $ext = [IO.Path]::GetExtension($full).ToLower()
    if ($ext -in '.ps1','.bat','.cmd','.vbs','.json','.log','.auth','.prev','.tmp','.bak','.psm1') {
      $res.StatusCode = 403; $res.Close(); continue
    }
    # pastas internas: backups, temporarios e o proprio .git
    # comparacao por SEGMENTO em vez de regex: o caminho pode vir com \ ou /,
    # e regex com barra invertida escapada aqui e receita de erro silencioso
    $segs = $rel -split '[\\/]'
    $proibidas = @('_tmp','_backup','_backups','_bkp','.git','previas')
    $temProibida = $false
    foreach ($sg in $segs) { if ($sg.ToLower() -in $proibidas) { $temProibida = $true; break } }
    if ($temProibida) { $res.StatusCode = 403; $res.Close(); continue }

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
    # ANTES devolvia 500 SEM CORPO: no navegador virava "Unexpected end of JSON input", sem pista
    # nenhuma. Agora o erro vai para servir-erros.log e volta como JSON para a tela.
    $ex = $_
    try {
      $linha = "[{0}] {1} {2}`r`n  ERRO: {3}`r`n  STACK: {4}`r`n" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), `
               $req.HttpMethod, $req.Url.PathAndQuery, $ex.Exception.Message, $ex.ScriptStackTrace
      [IO.File]::AppendAllText((Join-Path $root 'servir-erros.log'), $linha, [Text.Encoding]::UTF8)
    } catch {}
    try {
      $res.StatusCode = 500
      $res.ContentType = 'application/json; charset=utf-8'
      $b = [Text.Encoding]::UTF8.GetBytes((@{ ok=$false; erro=$ex.Exception.Message; rota=$req.Url.AbsolutePath } | ConvertTo-Json -Compress))
      $res.OutputStream.Write($b, 0, $b.Length)
    } catch {}
    try { $res.Close() } catch {}
    Write-Host "Erro em $($req.Url.AbsolutePath): $($ex.Exception.Message)" -ForegroundColor Red
  }
}
