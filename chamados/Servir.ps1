<#
  Servir.ps1  -  APP CHAMADO
  Servidor local (HttpListener / PowerShell 5.1) para o sistema de Abertura e Gestao
  de Chamados do Setor Comercial. E a FONTE DA VERDADE (multiusuario):
    - Autenticacao por token (login / logout / recuperar senha)
    - API REST de chamados, usuarios, anexos
    - Persistencia em JSON no proprio PC (pasta .\dados)
    - Uploads em .\dados\anexos

  USO:
    Duplo-clique em "Abrir Chamados.vbs"  (sobe escondido e abre o navegador)
    ou:  powershell -ExecutionPolicy Bypass -File .\Servir.ps1
  Encerrar: Ctrl+C (ou feche a janela).

  Outros PCs da rede acessam por http://IP-DO-SERVIDOR:8790/  (mesma rede/VPN).
#>
param([int]$Porta = 8790, [switch]$NaoAbrir)

# --------------------------------------------------- instancia unica --------
# Dois servidores ao mesmo tempo gravariam nos MESMOS arquivos JSON (um
# sobrescrevendo o outro). Se ja houver um rodando, apenas abre o navegador.
$primeiro = $false
$script:instancia = New-Object System.Threading.Mutex($true, 'AppChamadoServidorUnico', [ref]$primeiro)
if (-not $primeiro) {
  Write-Host "Ja existe um APP CHAMADO rodando." -ForegroundColor Yellow
  if (-not $NaoAbrir) { try { Start-Process "http://localhost:$Porta/index.html" } catch {} }
  return
}

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$root      = $PSScriptRoot
$dataDir   = Join-Path $root 'dados'
$anexoDir  = Join-Path $dataDir 'anexos'
$fileUsers = Join-Path $dataDir 'usuarios.json'
$fileTk    = Join-Path $dataDir 'chamados.json'
$fileDeps  = Join-Path $dataDir 'departamentos.json'
if (-not (Test-Path $dataDir))  { New-Item -ItemType Directory -Path $dataDir  | Out-Null }
if (-not (Test-Path $anexoDir)) { New-Item -ItemType Directory -Path $anexoDir | Out-Null }

# ---------------------------------------------------------------- infra JSON --
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
function Read-TextFile($p) { if (Test-Path $p) { [IO.File]::ReadAllText($p, [Text.Encoding]::UTF8) } else { '' } }
function Write-TextFile($p, $t) { [IO.File]::WriteAllText($p, $t, $Utf8NoBom) }

# ConvertTo-Json de um array com 1 item devolve objeto -> forcamos colchetes na mao
function To-JsonArray($arr, $depth = 30) {
  if ($null -eq $arr) { return '[]' }
  $a = @($arr)
  if ($a.Count -eq 0) { return '[]' }
  if ($a.Count -eq 1) { return '[' + ($a[0] | ConvertTo-Json -Depth $depth) + ']' }
  return ($a | ConvertTo-Json -Depth $depth)
}
function Load-Array($p) {
  $t = Read-TextFile $p
  if ([string]::IsNullOrWhiteSpace($t)) { return @() }
  try { $o = $t | ConvertFrom-Json } catch { return @() }
  return @($o)
}
function Hash-Senha($s) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  $b = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes([string]$s))
  ($b | ForEach-Object { $_.ToString('x2') }) -join ''
}
function Now-Iso { (Get-Date).ToString('yyyy-MM-ddTHH:mm:ss') }
function New-Id { [Guid]::NewGuid().ToString('N').Substring(0, 12) }

# lock simples para serializar gravacoes concorrentes
$script:mux = New-Object System.Threading.Mutex($false, 'AppChamadoStoreMutex')

# ------------------------------------------------------------- seed usuarios --
if (-not (Test-Path $fileUsers)) {
  $seed = @(
    [ordered]@{ id = 'u_adm'; nome = 'Administrador'; cargo = 'Administrador'; perfil = 'adm'; login = 'adm'; email = ''; senhaHash = (Hash-Senha 'adm123'); ativo = $true; criadoEm = (Now-Iso) },
    [ordered]@{ id = 'u_gestor'; nome = 'Gestor Comercial'; cargo = 'Gestor Comercial'; perfil = 'gestor';    login = 'gestor';    email = ''; senhaHash = (Hash-Senha 'gestor123');    ativo = $true; criadoEm = (Now-Iso) },
    [ordered]@{ id = 'u_consultor'; nome = 'Consultor Comercial'; cargo = 'Consultor Comercial'; perfil = 'consultor'; login = 'consultor'; email = ''; senhaHash = (Hash-Senha 'consultor123'); ativo = $true; criadoEm = (Now-Iso) }
  )
  Write-TextFile $fileUsers (To-JsonArray $seed)
}
if (-not (Test-Path $fileTk)) { Write-TextFile $fileTk '[]' }

# --------------------------------------------------------- seed departamentos --
# O ADM cadastra os demais pelo proprio app (aba Usuarios > Departamentos).
if (-not (Test-Path $fileDeps)) {
  Write-TextFile $fileDeps (To-JsonArray @([ordered]@{ id = 'd_comercial'; nome = 'Comercial'; ativo = $true; criadoEm = (Now-Iso) }))
}

# ------------------------------------------------------------------ sessoes ---
$script:sessions = @{}   # token -> userId
function Get-Users { Load-Array $fileUsers }
function Save-Users($arr) { Write-TextFile $fileUsers (To-JsonArray $arr) }
function Get-Tickets { Load-Array $fileTk }
function Save-Tickets($arr) { Write-TextFile $fileTk (To-JsonArray $arr) }
# "versao" dos dados = gravacao mais recente entre os 3 arquivos (ticks UTC).
# Serve para o app saber se ha novidade sem baixar o estado inteiro.
function Versao-Dados {
  $v = 0
  foreach ($f in @($fileTk, $fileUsers, $fileDeps)) {
    if (Test-Path $f) { $t = (Get-Item $f).LastWriteTimeUtc.Ticks; if ($t -gt $v) { $v = $t } }
  }
  return $v
}
function Get-Deps { Load-Array $fileDeps }
function Save-Deps($arr) { Write-TextFile $fileDeps (To-JsonArray $arr) }

# departamento do usuario ('' = sem departamento; o ADM e global por natureza)
function Dep-Of($u) { if ($u -and $u.departamentoId) { [string]$u.departamentoId } else { '' } }
# mapa userId -> departamentoId (evita reler o arquivo dentro de laco)
function Dep-Map($users) {
  $m = @{}
  foreach ($x in @($users)) { $m[[string]$x.id] = (Dep-Of $x) }
  return $m
}

function User-Public($u) {
  if ($null -eq $u) { return $null }
  [ordered]@{ id = $u.id; nome = $u.nome; cargo = $u.cargo; perfil = $u.perfil; login = $u.login; email = $u.email
              departamentoId = (Dep-Of $u); ativo = ([bool]$u.ativo); mustReset = ([bool]$u.mustReset) }
}
function User-ByToken($token) {
  if (-not $token) { return $null }
  if (-not $script:sessions.ContainsKey($token)) { return $null }
  $uid = $script:sessions[$token]
  (Get-Users) | Where-Object { $_.id -eq $uid } | Select-Object -First 1
}
# SOMENTE O ADM VE TUDO.
# Gestor: o que envolve ele + a demanda do PROPRIO departamento (quem abriu ou
#         quem atende pertence ao departamento dele). Nao ve a demanda interna
#         dos outros departamentos.
# Consultor: somente a propria (abriu ou foi atribuido nominalmente a ele).
function Can-See($u, $t, $map = $null) {
  if ($u.perfil -eq 'adm') { return $true }
  if ($t.solicitanteId -eq $u.id) { return $true }
  if ($t.responsavelId -eq $u.id) { return $true }
  if ($u.perfil -eq 'gestor') {
    $meuDep = Dep-Of $u
    if (-not $meuDep) { return $false }
    if ($null -eq $map) { $map = Dep-Map (Get-Users) }
    if ($t.solicitanteId -and $map[[string]$t.solicitanteId] -eq $meuDep) { return $true }
    if ($t.responsavelId -and $map[[string]$t.responsavelId] -eq $meuDep) { return $true }
  }
  return $false
}
# Quais USUARIOS cada perfil enxerga na lista (base do campo "Enviar para").
# ADM: todos. Gestor: gestores/ADM + o proprio time. Consultor: ele + o gestor dele.
function Can-SeeUser($me, $u) {
  if ($me.perfil -eq 'adm') { return $true }
  if ($u.id -eq $me.id) { return $true }
  if ($me.perfil -eq 'gestor') {
    if ($u.perfil -eq 'adm' -or $u.perfil -eq 'gestor') { return $true }
    return ((Dep-Of $u) -eq (Dep-Of $me) -and (Dep-Of $me) -ne '')
  }
  # consultor: so o(s) gestor(es) do proprio departamento
  return ($u.perfil -eq 'gestor' -and (Dep-Of $u) -eq (Dep-Of $me) -and (Dep-Of $me) -ne '')
}
# Para quem cada perfil PODE enviar chamado (validado no servidor, nao so na tela).
function Can-Send($me, $alvo, $users) {
  if ($null -eq $alvo) { return $true }                     # destino por perfil, sem nome
  if ($me.perfil -eq 'adm') { return $true }
  if ($me.perfil -eq 'gestor') { return ($alvo.perfil -eq 'gestor' -or $alvo.perfil -eq 'adm') }
  if ($alvo.perfil -eq 'gestor' -and (Dep-Of $alvo) -eq (Dep-Of $me)) { return $true }
  # sem gestor no departamento, o consultor fica sem saida: liberamos o ADM
  $temGestor = @($users | Where-Object { $_.ativo -and $_.perfil -eq 'gestor' -and (Dep-Of $_) -eq (Dep-Of $me) }).Count -gt 0
  return ($alvo.perfil -eq 'adm' -and -not $temGestor)
}
# ADM = acesso total (inclui gerenciar gestores/ADMs). Gestor so gerencia consultores.
function Can-ManageUsers($u) { return ($u.perfil -eq 'adm' -or $u.perfil -eq 'gestor') }

# ------------------------------------------------- chamado fechado ----------
# Resolvido/Encerrado = FIM. Nao aceita comentario, anexo, troca de status nem
# edicao. A continuacao e um chamado NOVO, vinculado ao antigo.
$script:HorasParaEncerrar = 24
function Esta-Fechado($t) { return ([string]$t.status -eq 'Resolvido' -or [string]$t.status -eq 'Encerrado') }
function Data-Ps($s) {
  $d = [datetime]::MinValue
  if ([datetime]::TryParse([string]$s, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::None, [ref]$d)) { return $d }
  return [datetime]::MinValue
}
# Resolvido ha mais de N horas vira Encerrado sozinho (roda a cada /api/state).
function Auto-Encerrar($arr) {
  $mudou = $false
  foreach ($t in @($arr)) {
    if ([string]$t.status -ne 'Resolvido') { continue }
    $quando = Data-Ps $t.atualizadoEm
    if ($quando -eq [datetime]::MinValue) { continue }
    if (((Get-Date) - $quando).TotalHours -lt $script:HorasParaEncerrar) { continue }
    $t.status = 'Encerrado'
    $h = @($t.historico)
    $h += [pscustomobject]@{ quando = (Now-Iso); usuarioId = ''; usuarioNome = 'Sistema'
                             acao = 'Status alterado'; detalhe = ("Resolvido -> Encerrado (automatico apos " + $script:HorasParaEncerrar + " horas)") }
    $t.historico = $h
    $t | Add-Member -NotePropertyName atualizadoEm -NotePropertyValue (Now-Iso) -Force
    $mudou = $true
  }
  return $mudou
}

# migracao: garante que exista ao menos um ADM (instalacoes criadas antes do perfil ADM)
$__users = @(Get-Users)
if ($__users.Count -gt 0 -and -not ($__users | Where-Object { $_.perfil -eq 'adm' })) {
  $__adm = [pscustomobject][ordered]@{ id = 'u_adm'; nome = 'Administrador'; cargo = 'Administrador'; perfil = 'adm'; login = 'adm'; email = ''; senhaHash = (Hash-Senha 'adm123'); ativo = $true; criadoEm = (Now-Iso) }
  # evita colidir com um login 'adm' ja existente
  if (-not ($__users | Where-Object { $_.login.ToLower() -eq 'adm' })) {
    Save-Users (@($__adm) + $__users)
    Write-Host "Perfil ADM criado (login: adm / adm123)." -ForegroundColor Yellow
  }
}

# migracao: quem ja existia entra no 1o departamento (Comercial). O ADM fica global.
$__users = @(Get-Users)
$__dep1 = @(Get-Deps | Where-Object { $_.ativo } | Select-Object -First 1).id
if ($__dep1) {
  $__mudou = $false
  foreach ($__u in $__users) {
    if ($__u.perfil -ne 'adm' -and -not $__u.departamentoId) {
      $__u | Add-Member -NotePropertyName departamentoId -NotePropertyValue $__dep1 -Force
      $__mudou = $true
    }
  }
  if ($__mudou) { Save-Users $__users; Write-Host "Usuarios existentes vinculados ao departamento inicial." -ForegroundColor Yellow }
}

# --------------------------------------------------------------- http helpers -
function Send-Bytes($res, $bytes, $ct, $code = 200) {
  $res.StatusCode = $code; $res.ContentType = $ct
  $res.OutputStream.Write($bytes, 0, $bytes.Length); $res.Close()
}
function Send-JsonText($res, $jsonText, $code = 200) {
  Send-Bytes $res ([Text.Encoding]::UTF8.GetBytes([string]$jsonText)) 'application/json; charset=utf-8' $code
}
function Send-Json($res, $obj, $code = 200) {
  Send-JsonText $res ($obj | ConvertTo-Json -Depth 30 -Compress) $code
}
function Send-Err($res, $msg, $code = 400) { Send-Json $res (@{ erro = [string]$msg }) $code }
# O corpo SEMPRE vem em UTF-8 (fetch/JSON.stringify). Nao usar $req.ContentEncoding:
# sem "charset" no Content-Type o HttpListener assume o ANSI do Windows (cp1252) e o
# texto chega duplamente codificado (ç -> Ã§, ã -> Ã£).
function Read-Body($req) {
  $r = New-Object System.IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)
  $t = $r.ReadToEnd(); $r.Close(); $t
}
function Get-Token($req) {
  $t = $req.QueryString['token']
  if (-not $t) { $t = $req.Headers['X-Token'] }
  $t
}

$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'application/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json; charset=utf-8'
  '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.gif' = 'image/gif'
  '.svg' = 'image/svg+xml'; '.webp' = 'image/webp'; '.ico' = 'image/x-icon'; '.pdf' = 'application/pdf'
  '.webmanifest' = 'application/manifest+json; charset=utf-8'
}

# ------------------------------------------------------------------- listener -
# Tenta "+:porta" (aceita a REDE toda; ja inclui o localhost) - precisa da reserva urlacl.
# Se falhar (sem urlacl/admin), cai para "localhost:porta" (so este PC).
# IMPORTANTE: nao registrar os dois prefixos no MESMO listener - eles conflitam no http.sys.
$listener = $null
foreach ($pref in @("http://+:$Porta/", "http://localhost:$Porta/")) {
  try {
    $l = New-Object System.Net.HttpListener
    $l.Prefixes.Add($pref)
    $l.Start()
    $listener = $l
    break
  } catch { }
}
if (-not $listener) {
  Write-Host "Nao consegui abrir a porta $Porta. Feche outro servidor ou use -Porta." -ForegroundColor Red
  return
}
$naRede = ($listener.Prefixes -join '') -like '*+*'
$prefix = "http://localhost:$Porta/"
if ($naRede) {
  $ipRede = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '169.*' -and $_.IPAddress -ne '127.0.0.1' -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object -First 1).IPAddress
  if ($ipRede) { Write-Host "Acesso na rede: http://${ipRede}:$Porta/" -ForegroundColor Green }
} else {
  Write-Host "So neste PC (sem reserva de rede). Rode o setup de rede para liberar aos colegas." -ForegroundColor Yellow
}
Write-Host "APP CHAMADO rodando em $prefix" -ForegroundColor Green
Write-Host "Login inicial:  adm / adm123   |   gestor / gestor123   |   consultor / consultor123" -ForegroundColor DarkGray
Write-Host "Encerrar: Ctrl+C" -ForegroundColor DarkGray
if (-not $NaoAbrir) { try { Start-Process "${prefix}index.html" } catch {} }

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request
  $res = $ctx.Response
  $res.Headers['Cache-Control'] = 'no-store'
  $res.Headers['Access-Control-Allow-Origin'] = '*'
  $res.Headers['Access-Control-Allow-Headers'] = 'Content-Type, X-Token'
  $res.Headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
  if ($req.HttpMethod -eq 'OPTIONS') { $res.StatusCode = 204; $res.Close(); continue }

  try {
    $path = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)

    # ============================ AUTENTICACAO ============================
    if ($path -eq '/api/login') {
      $in = (Read-Body $req) | ConvertFrom-Json
      $u = (Get-Users) | Where-Object { $_.login -and ($_.login.ToLower() -eq ([string]$in.login).ToLower()) } | Select-Object -First 1
      if (-not $u -or -not $u.ativo) { Send-Err $res 'Usuario nao encontrado ou inativo.' 401; continue }
      if ($u.senhaHash -ne (Hash-Senha $in.senha)) { Send-Err $res 'Senha incorreta.' 401; continue }
      $tk = New-Id
      $script:sessions[$tk] = $u.id
      Send-Json $res (@{ token = $tk; user = (User-Public $u) })
      Write-Host "[$((Get-Date -Format 'HH:mm:ss'))] LOGIN $($u.login) -> 200" -ForegroundColor Cyan
      continue
    }
    if ($path -eq '/api/logout') {
      $tk = Get-Token $req
      if ($tk -and $script:sessions.ContainsKey($tk)) { $script:sessions.Remove($tk) }
      Send-Json $res (@{ ok = $true }); continue
    }
    if ($path -eq '/api/recuperar') {
      # "Esqueci minha senha": NAO gera senha aqui. Abre um CHAMADO automatico para o ADM,
      # que definira e enviara a nova senha (o usuario troca no 1o acesso).
      $in = (Read-Body $req) | ConvertFrom-Json
      $script:mux.WaitOne() | Out-Null
      try {
        $users = @(Get-Users)
        $alvo = $users | Where-Object { $_.login -and ($_.login.ToLower() -eq ([string]$in.login).ToLower()) } | Select-Object -First 1
        if (-not $alvo) { Send-Err $res 'Login nao encontrado.' 404; continue }
        $adm = $users | Where-Object { $_.perfil -eq 'adm' -and $_.ativo } | Select-Object -First 1
        $admId = $null; $admNome = 'Administracao'
        if ($adm) { $admId = $adm.id; $admNome = $adm.nome }
        # evita duplicar: se ja existe um chamado de reset ABERTO para este login, reaproveita
        $arr = @(Get-Tickets)
        $jaAberto = $arr | Where-Object { $_.tipo -eq 'reset-senha' -and $_.resetUserId -eq $alvo.id -and $_.status -notin 'Resolvido', 'Encerrado' } | Select-Object -First 1
        if ($jaAberto) { Send-Json $res (@{ ok = $true; chamado = [int]$jaAberto.numero; jaExistia = $true }); continue }
        $max = 0; foreach ($x in $arr) { if ([int]$x.numero -gt $max) { $max = [int]$x.numero } }
        $num = $max + 1
        $tk = [ordered]@{
          numero            = $num
          titulo            = 'Redefinicao de senha'
          assunto           = 'Tecnologia'
          relato            = ("O usuario " + $alvo.nome + " (login: " + $alvo.login + ") solicitou uma nova senha pelo botao 'Esqueci minha senha'. Defina e repasse uma nova senha temporaria; o usuario devera criar a senha pessoal no primeiro acesso.")
          prioridade        = 'Alta'
          status            = 'Aberto'
          tipo              = 'reset-senha'
          resetUserId       = $alvo.id
          resetLogin        = $alvo.login
          responsavelId     = $admId
          responsavelNome   = $admNome
          responsavelPerfil = 'adm'
          solicitanteId     = $alvo.id
          solicitanteNome   = $alvo.nome
          solicitanteCargo  = $alvo.cargo
          anexos            = @()
          favoritos         = @()
          historico         = @(@{ quando = (Now-Iso); usuarioId = $alvo.id; usuarioNome = $alvo.nome; acao = 'Chamado aberto'; detalhe = 'Solicitacao de nova senha' })
          comentarios       = @()
          criadoEm          = (Now-Iso)
          atualizadoEm      = (Now-Iso)
        }
        $novo = @($arr); $novo += [pscustomobject]$tk
        Save-Tickets $novo
        Send-Json $res (@{ ok = $true; chamado = $num })
        Write-Host "[$((Get-Date -Format 'HH:mm:ss'))] RESET solicitado -> chamado #$num ($($alvo.login))" -ForegroundColor Yellow
      } finally { $script:mux.ReleaseMutex() }
      continue
    }

    # a partir daqui exige token valido
    if ($path -like '/api/*') {
      $me = User-ByToken (Get-Token $req)
      if (-not $me) { Send-Err $res 'Sessao invalida. Faca login novamente.' 401; continue }

      # -------------------------- ESTADO GERAL --------------------------
      if ($path -eq '/api/state') {
        $todos = @(Get-Users)
        $map = Dep-Map $todos
        $usersPub = @($todos | Where-Object { Can-SeeUser $me $_ } | ForEach-Object { User-Public $_ })
        $all = @(Get-Tickets)
        if (Auto-Encerrar $all) {                       # Resolvido ha 24h+ -> Encerrado
          $script:mux.WaitOne() | Out-Null
          try { Save-Tickets $all } finally { $script:mux.ReleaseMutex() }
        }
        $vis = @($all | Where-Object { Can-See $me $_ $map })
        $deps = @(Get-Deps)
        Send-JsonText $res (@{ user = (User-Public $me); usuarios = $usersPub; departamentos = $deps; chamados = $vis; versao = (Versao-Dados); serverTime = (Now-Iso) } | ConvertTo-Json -Depth 30 -Compress)
        continue
      }

      # ------ VERSAO: checagem barata "mudou algo?" (poucos bytes) --------
      # O app so baixa o estado inteiro quando este numero muda.
      if ($path -eq '/api/versao') { Send-JsonText $res ("{""v"":" + (Versao-Dados) + "}"); continue }

      # ----------------------- SALVAR CHAMADO (upsert) ------------------
      if ($path -eq '/api/chamado' -and $req.HttpMethod -eq 'POST') {
        $c = (Read-Body $req) | ConvertFrom-Json
        $script:mux.WaitOne() | Out-Null
        try {
          $arr = @(Get-Tickets)
          $isNew = (-not $c.numero) -or ([int]$c.numero -le 0)
          if ($isNew) {
            $max = 0; foreach ($x in $arr) { if ([int]$x.numero -gt $max) { $max = [int]$x.numero } }
            $c.numero = $max + 1
            # Solicitante: normalmente e o proprio usuario do token. Um ADM/Gestor pode abrir
            # EM NOME DE outro (fluxo do IDE) informando solicitanteId; consultor NAO personifica.
            $ehGestor = ($me.perfil -eq 'adm' -or $me.perfil -eq 'gestor')
            if ((-not $c.solicitanteId) -or (-not $ehGestor)) {
              $c | Add-Member -NotePropertyName solicitanteId -NotePropertyValue $me.id -Force
              $c | Add-Member -NotePropertyName solicitanteNome -NotePropertyValue $me.nome -Force
              $c | Add-Member -NotePropertyName solicitanteCargo -NotePropertyValue $me.cargo -Force
            }
            # trava de destino: consultor so aciona o gestor do proprio departamento;
            # gestor so aciona outros gestores e o ADM. Vale no servidor, nao so na tela.
            $usersAll = @(Get-Users)
            $alvoU = $null
            if ($c.responsavelId) {
              $alvoU = $usersAll | Where-Object { $_.id -eq [string]$c.responsavelId } | Select-Object -First 1
              if (-not $alvoU) { Send-Err $res 'Destinatario inexistente.' 400; continue }   # id inventado nao passa
            }
            if (-not (Can-Send $me $alvoU $usersAll)) { Send-Err $res 'Voce nao pode enviar chamado para esse destinatario.' 403; continue }
            # ---- chamado VINCULADO: continua um chamado ja fechado ----
            # Assunto e receptor vem do PAI (nao se escolhe de novo).
            if ($c.vinculadoA) {
              $pai = $arr | Where-Object { [int]$_.numero -eq [int]$c.vinculadoA } | Select-Object -First 1
              if (-not $pai) { Send-Err $res 'Chamado de origem nao encontrado.' 404; continue }
              if (-not (Can-See $me $pai)) { Send-Err $res 'Sem permissao no chamado de origem.' 403; continue }
              $c | Add-Member -NotePropertyName assunto -NotePropertyValue $pai.assunto -Force
              $c | Add-Member -NotePropertyName responsavelId -NotePropertyValue $pai.responsavelId -Force
              $c | Add-Member -NotePropertyName responsavelNome -NotePropertyValue $pai.responsavelNome -Force
              $c | Add-Member -NotePropertyName responsavelPerfil -NotePropertyValue $pai.responsavelPerfil -Force
              $vinc = @()                       # @($null) criaria um item vazio na lista
              if ($pai.vinculos) { foreach ($v in @($pai.vinculos)) { if ($null -ne $v -and "$v" -ne '') { $vinc += [int]$v } } }
              $vinc += [int]$c.numero
              $pai | Add-Member -NotePropertyName vinculos -NotePropertyValue $vinc -Force
              $hp = @($pai.historico)
              $hp += [pscustomobject]@{ quando = (Now-Iso); usuarioId = $me.id; usuarioNome = $me.nome
                                        acao = 'Chamado vinculado'; detalhe = ("Continuacao aberta: #" + [int]$c.numero) }
              $pai.historico = $hp
            }
            $c | Add-Member -NotePropertyName criadoEm -NotePropertyValue (Now-Iso) -Force
          } else {
            $existente = $arr | Where-Object { [int]$_.numero -eq [int]$c.numero } | Select-Object -First 1
            if (-not $existente) { Send-Err $res 'Chamado nao encontrado.' 404; continue }
            if (-not (Can-See $me $existente)) { Send-Err $res 'Sem permissao.' 403; continue }
            if (Esta-Fechado $existente) {
              Send-Err $res ("Chamado " + [string]$existente.status + ": nao aceita mais alteracoes. Abra um chamado vinculado.") 403; continue
            }
          }
          $c | Add-Member -NotePropertyName atualizadoEm -NotePropertyValue (Now-Iso) -Force
          $novo = @(); $achou = $false
          foreach ($x in $arr) {
            if ([int]$x.numero -eq [int]$c.numero) { $novo += $c; $achou = $true } else { $novo += $x }
          }
          if (-not $achou) { $novo += $c }
          Save-Tickets $novo
          Send-JsonText $res ($c | ConvertTo-Json -Depth 30 -Compress)
          Write-Host "[$((Get-Date -Format 'HH:mm:ss'))] SAVE chamado #$($c.numero) por $($me.login)" -ForegroundColor Green
        } finally { $script:mux.ReleaseMutex() }
        continue
      }

      # -------------------------- EXCLUIR CHAMADO -----------------------
      if ($path -eq '/api/chamado/excluir' -and $req.HttpMethod -eq 'POST') {
        $in = (Read-Body $req) | ConvertFrom-Json
        $num = 0; [void][int]::TryParse([string]$in.numero, [ref]$num)
        if ($num -le 0) { Send-Err $res 'Numero invalido.' 400; continue }
        $script:mux.WaitOne() | Out-Null
        try {
          $arr = @(Get-Tickets)
          $alvo = $arr | Where-Object { [int]$_.numero -eq $num } | Select-Object -First 1
          if (-not $alvo) { Send-Err $res 'Chamado nao encontrado.' 404; continue }
          # Permissao: ADM sempre pode. Senao, so o CRIADOR e dentro de 12h da abertura.
          $pode = $false
          if ($me.perfil -eq 'adm') {
            $pode = $true
          } elseif ($alvo.solicitanteId -eq $me.id) {
            $horas = 999.0
            try { $horas = ([datetime]::Now - [datetime]::Parse([string]$alvo.criadoEm, [Globalization.CultureInfo]::InvariantCulture)).TotalHours } catch {}
            if ($horas -lt 12) { $pode = $true }
          }
          if (-not $pode) { Send-Err $res 'Sem permissao para excluir. Apos 12 horas da abertura, somente o ADM pode excluir.' 403; continue }
          # remove os anexos do disco (do chamado e dos comentarios)
          $urls = @()
          if ($alvo.anexos) { $urls += @($alvo.anexos | ForEach-Object { $_.url }) }
          if ($alvo.comentarios) { foreach ($cm in $alvo.comentarios) { if ($cm.anexos) { $urls += @($cm.anexos | ForEach-Object { $_.url }) } } }
          foreach ($u in $urls) {
            if ($u -like '/anexos/*') {
              $fp = Join-Path $anexoDir ([IO.Path]::GetFileName($u))
              if ((Test-Path $fp) -and $fp.StartsWith($anexoDir)) { Remove-Item $fp -Force -ErrorAction SilentlyContinue }
            }
          }
          $novo = @($arr | Where-Object { [int]$_.numero -ne $num })
          Save-Tickets $novo
          Send-Json $res (@{ ok = $true; numero = $num })
          Write-Host "[$((Get-Date -Format 'HH:mm:ss'))] EXCLUIR chamado #$num por $($me.login)" -ForegroundColor Red
        } finally { $script:mux.ReleaseMutex() }
        continue
      }

      # ------------------- ENCERRAR AGORA (so o ADM) ---------------------
      # Atalho do ADM para nao esperar as 24h do Auto-Encerrar. Rota propria
      # porque /api/chamado e upsert do objeto inteiro e segue bloqueado.
      if ($path -eq '/api/chamado/encerrar' -and $req.HttpMethod -eq 'POST') {
        if ($me.perfil -ne 'adm') { Send-Err $res 'Somente o ADM encerra um chamado resolvido.' 403; continue }
        $in = (Read-Body $req) | ConvertFrom-Json
        $num = 0; [void][int]::TryParse([string]$in.numero, [ref]$num)
        if ($num -le 0) { Send-Err $res 'Numero invalido.' 400; continue }
        $script:mux.WaitOne() | Out-Null
        try {
          $arr = @(Get-Tickets)
          $t = $arr | Where-Object { [int]$_.numero -eq $num } | Select-Object -First 1
          if (-not $t) { Send-Err $res 'Chamado nao encontrado.' 404; continue }
          if ([string]$t.status -ne 'Resolvido') { Send-Err $res ("Somente chamado RESOLVIDO pode ser encerrado. Este esta " + [string]$t.status + ".") 409; continue }
          $t.status = 'Encerrado'
          $h = @($t.historico)
          $h += [pscustomobject]@{ quando = (Now-Iso); usuarioId = $me.id; usuarioNome = $me.nome
                                   acao = 'Status alterado'; detalhe = 'Resolvido -> Encerrado' }
          $t.historico = $h
          $t | Add-Member -NotePropertyName atualizadoEm -NotePropertyValue (Now-Iso) -Force
          Save-Tickets $arr
          Send-Json $res (@{ ok = $true; numero = $num; status = 'Encerrado' })
          Write-Host "[$((Get-Date -Format 'HH:mm:ss'))] ENCERRAR chamado #$num por $($me.login)" -ForegroundColor Yellow
        } finally { $script:mux.ReleaseMutex() }
        continue
      }

      # ------------------- REABERTURA (pedido + decisao) ------------------
      # So chamado ENCERRADO aceita pedido. Quem pode ver o chamado pode pedir;
      # somente o ADM aprova. Aprovado, volta para o MESMO receptor.
      if ($path -eq '/api/reabertura' -and $req.HttpMethod -eq 'POST') {
        $in = (Read-Body $req) | ConvertFrom-Json
        $motivo = ([string]$in.motivo).Trim()
        if ($motivo.Length -lt 5) { Send-Err $res 'Explique o motivo da reabertura.' 400; continue }
        $script:mux.WaitOne() | Out-Null
        try {
          $arr = @(Get-Tickets)
          $t = $arr | Where-Object { [int]$_.numero -eq [int]$in.numero } | Select-Object -First 1
          if (-not $t) { Send-Err $res 'Chamado nao encontrado.' 404; continue }
          if (-not (Can-See $me $t)) { Send-Err $res 'Sem permissao.' 403; continue }
          if ([string]$t.status -ne 'Encerrado') { Send-Err $res 'Somente chamado ENCERRADO pode ser reaberto. Um chamado resolvido vira Encerrado em 24 horas.' 403; continue }
          if ($t.reabertura -and [string]$t.reabertura.situacao -eq 'pendente') { Send-Err $res 'Ja existe um pedido de reabertura aguardando o ADM.' 409; continue }
          $t | Add-Member -NotePropertyName reabertura -NotePropertyValue ([pscustomobject]@{
                situacao = 'pendente'; motivo = $motivo; porId = $me.id; porNome = $me.nome; quando = (Now-Iso)
                decididoPor = ''; decididoEm = ''; resposta = '' }) -Force
          $h = @($t.historico)
          $h += [pscustomobject]@{ quando = (Now-Iso); usuarioId = $me.id; usuarioNome = $me.nome
                                   acao = 'Reabertura solicitada'; detalhe = $motivo }
          $t.historico = $h
          $t | Add-Member -NotePropertyName atualizadoEm -NotePropertyValue (Now-Iso) -Force
          Save-Tickets $arr
          Send-Json $res (@{ ok = $true })
          Write-Host "[$((Get-Date -Format 'HH:mm:ss'))] REABERTURA pedida no #$($in.numero) por $($me.login)" -ForegroundColor Yellow
        } finally { $script:mux.ReleaseMutex() }
        continue
      }
      if ($path -eq '/api/reabertura/decidir' -and $req.HttpMethod -eq 'POST') {
        if ($me.perfil -ne 'adm') { Send-Err $res 'Somente o ADM decide reabertura.' 403; continue }
        $in = (Read-Body $req) | ConvertFrom-Json
        $aprovar = [bool]$in.aprovar
        $script:mux.WaitOne() | Out-Null
        try {
          $arr = @(Get-Tickets)
          $t = $arr | Where-Object { [int]$_.numero -eq [int]$in.numero } | Select-Object -First 1
          if (-not $t) { Send-Err $res 'Chamado nao encontrado.' 404; continue }
          if (-not $t.reabertura -or [string]$t.reabertura.situacao -ne 'pendente') { Send-Err $res 'Nao ha pedido pendente neste chamado.' 409; continue }
          $t.reabertura.situacao = $(if ($aprovar) { 'aprovado' } else { 'recusado' })
          $t.reabertura.decididoPor = $me.nome
          $t.reabertura.decididoEm = (Now-Iso)
          $t.reabertura.resposta = ([string]$in.resposta).Trim()
          $h = @($t.historico)
          if ($aprovar) {
            $novoStatus = $(if ($t.responsavelId) { 'Em Atendimento' } else { 'Aberto' })
            $t.status = $novoStatus
            $h += [pscustomobject]@{ quando = (Now-Iso); usuarioId = $me.id; usuarioNome = $me.nome
                                     acao = 'Reabertura aprovada'; detalhe = ("Encerrado -> " + $novoStatus + $(if ($in.resposta) { ' — ' + [string]$in.resposta } else { '' })) }
          } else {
            $h += [pscustomobject]@{ quando = (Now-Iso); usuarioId = $me.id; usuarioNome = $me.nome
                                     acao = 'Reabertura recusada'; detalhe = ([string]$in.resposta) }
          }
          $t.historico = $h
          $t | Add-Member -NotePropertyName atualizadoEm -NotePropertyValue (Now-Iso) -Force
          Save-Tickets $arr
          Send-Json $res (@{ ok = $true })
          Write-Host "[$((Get-Date -Format 'HH:mm:ss'))] REABERTURA $(if($aprovar){'aprovada'}else{'recusada'}) no #$($in.numero)" -ForegroundColor Yellow
        } finally { $script:mux.ReleaseMutex() }
        continue
      }

      # --------- COMENTARIO: o ADM mexe no PROPRIO ULTIMO comentario -------
      # Regra unica: perfil adm + ser o ultimo comentario do chamado + ter
      # sido escrito por ele. Qualquer outra combinacao e recusada aqui.
      if (($path -eq '/api/comentario' -or $path -eq '/api/comentario/excluir') -and $req.HttpMethod -eq 'POST') {
        if ($me.perfil -ne 'adm') { Send-Err $res 'Somente o ADM pode alterar comentario.' 403; continue }
        $in = (Read-Body $req) | ConvertFrom-Json
        $excluir = ($path -eq '/api/comentario/excluir')
        $txt = ''
        if (-not $excluir) {
          $txt = ([string]$in.texto).Trim()
          if (-not $txt) { Send-Err $res 'O comentario nao pode ficar vazio.' 400; continue }
        }
        $script:mux.WaitOne() | Out-Null
        try {
          $arr = @(Get-Tickets)
          $t = $arr | Where-Object { [int]$_.numero -eq [int]$in.numero } | Select-Object -First 1
          if (-not $t) { Send-Err $res 'Chamado nao encontrado.' 404; continue }
          if (Esta-Fechado $t) { Send-Err $res 'Chamado fechado: os comentarios ficam congelados.' 403; continue }
          $coms = @($t.comentarios)
          if ($coms.Count -eq 0) { Send-Err $res 'Este chamado nao tem comentarios.' 404; continue }
          $ult = $coms[$coms.Count - 1]
          if ([string]$ult.id -ne [string]$in.comentarioId) { Send-Err $res 'Somente o ULTIMO comentario pode ser alterado.' 403; continue }
          if ([string]$ult.usuarioId -ne [string]$me.id) { Send-Err $res 'Voce so altera o proprio comentario.' 403; continue }
          if ($excluir) {
            if ($ult.anexos) {                                  # tira os arquivos do disco junto
              foreach ($ax in @($ult.anexos)) {
                if ([string]$ax.url -like '/anexos/*') {
                  $fp = Join-Path $anexoDir ([IO.Path]::GetFileName([string]$ax.url))
                  if ((Test-Path $fp) -and $fp.StartsWith($anexoDir)) { Remove-Item $fp -Force -ErrorAction SilentlyContinue }
                }
              }
            }
            $t.comentarios = @($coms | Where-Object { [string]$_.id -ne [string]$in.comentarioId })
          } else {
            $ult.texto = $txt
            $ult | Add-Member -NotePropertyName editadoEm -NotePropertyValue (Now-Iso) -Force
          }
          $t | Add-Member -NotePropertyName atualizadoEm -NotePropertyValue (Now-Iso) -Force
          Save-Tickets $arr
          Send-Json $res (@{ ok = $true })
          Write-Host "[$((Get-Date -Format 'HH:mm:ss'))] COMENTARIO $(if($excluir){'excluido'}else{'editado'}) no #$($in.numero) por $($me.login)" -ForegroundColor Yellow
        } finally { $script:mux.ReleaseMutex() }
        continue
      }

      # -------------------------- UPLOAD DE ANEXO -----------------------
      if ($path -eq '/api/anexo' -and $req.HttpMethod -eq 'POST') {
        $in = (Read-Body $req) | ConvertFrom-Json
        $nome = [string]$in.nome; if (-not $nome) { $nome = 'arquivo' }
        $ext = [IO.Path]::GetExtension($nome); if (-not $ext) { $ext = '' }
        $ext = ($ext -replace '[^a-zA-Z0-9\.]', '')
        $id = New-Id
        $fname = "$id$ext"
        $dest = Join-Path $anexoDir $fname
        try {
          $b64 = [string]$in.dados
          if ($b64 -match ',') { $b64 = $b64.Substring($b64.IndexOf(',') + 1) }   # tira "data:...;base64,"
          $bytes = [Convert]::FromBase64String($b64)
          [IO.File]::WriteAllBytes($dest, $bytes)
        } catch { Send-Err $res "Falha ao salvar anexo: $($_.Exception.Message)" 500; continue }
        Send-Json $res (@{ id = $id; nome = $nome; tipo = [string]$in.tipo; tamanho = $bytes.Length; url = "/anexos/$fname" })
        continue
      }

      # ------------------------ USUARIOS (gestor) -----------------------
      if ($path -eq '/api/usuario' -and $req.HttpMethod -eq 'POST') {
        if (-not (Can-ManageUsers $me)) { Send-Err $res 'Sem permissao para gerenciar usuarios.' 403; continue }
        $in = (Read-Body $req) | ConvertFrom-Json
        $perfilAlvo = ([string]$in.perfil).ToLower()
        if ($perfilAlvo -notin 'adm', 'gestor', 'consultor') { Send-Err $res 'Perfil invalido.' 400; continue }
        $script:mux.WaitOne() | Out-Null
        try {
          $users = @(Get-Users)
          $existe = $null
          if ($in.id) { $existe = $users | Where-Object { $_.id -eq $in.id } | Select-Object -First 1 }
          # Gestor so pode gerenciar CONSULTORES; ADM pode tudo
          if ($me.perfil -eq 'gestor') {
            if ($perfilAlvo -ne 'consultor') { Send-Err $res 'O Gestor so cadastra/edita consultores. Perfis ADM/Gestor sao geridos pelo ADM.' 403; continue }
            if ($existe -and $existe.perfil -ne 'consultor') { Send-Err $res 'O Gestor nao pode editar usuarios ADM ou Gestor.' 403; continue }
          }
          # ---- departamento ----
          $depAlvo = [string]$in.departamentoId
          if ($me.perfil -eq 'gestor') { $depAlvo = Dep-Of $me }        # gestor so mexe no proprio time
          if ($perfilAlvo -eq 'adm') {
            $depAlvo = ''                                              # o ADM e global
          } else {
            if (-not $depAlvo) { Send-Err $res 'Escolha o departamento do usuario.' 400; continue }
            $depOk = @(Get-Deps) | Where-Object { $_.id -eq $depAlvo -and $_.ativo } | Select-Object -First 1
            if (-not $depOk) { Send-Err $res 'Departamento inexistente ou inativo.' 400; continue }
          }
          $loginNovo = ([string]$in.login).ToLower()
          $colide = $users | Where-Object { $_.login.ToLower() -eq $loginNovo -and (-not $existe -or $_.id -ne $existe.id) }
          if ($colide) { Send-Err $res 'Ja existe um usuario com esse login.' 409; continue }
          # nao permitir remover o ULTIMO ADM (rebaixar ou inativar)
          if ($existe -and $existe.perfil -eq 'adm') {
            $qtdAdmAtivos = @($users | Where-Object { $_.perfil -eq 'adm' -and $_.ativo }).Count
            $vaiDeixarDeSerAdmAtivo = ($perfilAlvo -ne 'adm') -or ($null -ne $in.ativo -and -not [bool]$in.ativo)
            if ($qtdAdmAtivos -le 1 -and $vaiDeixarDeSerAdmAtivo) { Send-Err $res 'Nao e possivel rebaixar/inativar o unico ADM ativo.' 409; continue }
          }
          if ($existe) {
            $existe.nome = [string]$in.nome; $existe.cargo = [string]$in.cargo; $existe.perfil = [string]$in.perfil
            $existe.login = [string]$in.login; $existe.email = [string]$in.email
            $existe | Add-Member -NotePropertyName departamentoId -NotePropertyValue $depAlvo -Force
            if ($null -ne $in.ativo) { $existe.ativo = [bool]$in.ativo }
            if ($in.senha) {
              $existe.senhaHash = (Hash-Senha $in.senha)
              # Definir senha de OUTRO usuario forca a criacao de senha pessoal no 1o acesso.
              $forcar = ($me.id -ne $existe.id)
              $existe | Add-Member -NotePropertyName mustReset -NotePropertyValue $forcar -Force
            }
          } else {
            $novoU = [ordered]@{
              id = ('u_' + (New-Id)); nome = [string]$in.nome; cargo = [string]$in.cargo
              perfil = [string]$in.perfil; login = [string]$in.login; email = [string]$in.email
              departamentoId = $depAlvo
              senhaHash = (Hash-Senha ([string]$in.senha)); ativo = $true; mustReset = $true; criadoEm = (Now-Iso)
            }
            $users += [pscustomobject]$novoU
          }
          Save-Users $users
          Send-Json $res (@{ ok = $true; usuarios = @($users | Where-Object { Can-SeeUser $me $_ } | ForEach-Object { User-Public $_ }) })
        } finally { $script:mux.ReleaseMutex() }
        continue
      }

      # ---------------------- DEPARTAMENTOS (só ADM) --------------------
      if ($path -eq '/api/departamento' -and $req.HttpMethod -eq 'POST') {
        if ($me.perfil -ne 'adm') { Send-Err $res 'Somente o ADM gerencia departamentos.' 403; continue }
        $in = (Read-Body $req) | ConvertFrom-Json
        $nome = ([string]$in.nome).Trim()
        if (-not $nome) { Send-Err $res 'Informe o nome do departamento.' 400; continue }
        $script:mux.WaitOne() | Out-Null
        try {
          $deps = @(Get-Deps)
          $existe = $null
          if ($in.id) { $existe = $deps | Where-Object { $_.id -eq [string]$in.id } | Select-Object -First 1 }
          $colide = $deps | Where-Object { $_.nome.ToLower() -eq $nome.ToLower() -and (-not $existe -or $_.id -ne $existe.id) }
          if ($colide) { Send-Err $res 'Ja existe um departamento com esse nome.' 409; continue }
          if ($existe) {
            $existe.nome = $nome
            if ($null -ne $in.ativo) { $existe.ativo = [bool]$in.ativo }
          } else {
            $deps += [pscustomobject][ordered]@{ id = ('d_' + (New-Id)); nome = $nome; ativo = $true; criadoEm = (Now-Iso) }
          }
          Save-Deps $deps
          Send-Json $res (@{ ok = $true; departamentos = $deps })
          Write-Host "[$((Get-Date -Format 'HH:mm:ss'))] DEPARTAMENTO salvo: $nome" -ForegroundColor Green
        } finally { $script:mux.ReleaseMutex() }
        continue
      }
      if ($path -eq '/api/departamento/excluir' -and $req.HttpMethod -eq 'POST') {
        if ($me.perfil -ne 'adm') { Send-Err $res 'Somente o ADM gerencia departamentos.' 403; continue }
        $in = (Read-Body $req) | ConvertFrom-Json
        $id = [string]$in.id
        $script:mux.WaitOne() | Out-Null
        try {
          $emUso = @(Get-Users | Where-Object { (Dep-Of $_) -eq $id })
          if ($emUso.Count -gt 0) { Send-Err $res ("Ha " + $emUso.Count + " usuario(s) neste departamento. Mova-os antes de excluir (ou apenas desative o departamento).") 409; continue }
          $deps = @(Get-Deps | Where-Object { $_.id -ne $id })
          Save-Deps $deps
          Send-Json $res (@{ ok = $true; departamentos = $deps })
        } finally { $script:mux.ReleaseMutex() }
        continue
      }

      # --------------------- TROCAR A PROPRIA SENHA ---------------------
      if ($path -eq '/api/trocar-senha' -and $req.HttpMethod -eq 'POST') {
        $in = (Read-Body $req) | ConvertFrom-Json
        $nova = [string]$in.senha
        if ($nova.Length -lt 4) { Send-Err $res 'A nova senha deve ter ao menos 4 caracteres.' 400; continue }
        $script:mux.WaitOne() | Out-Null
        try {
          $users = @(Get-Users)
          $u = $users | Where-Object { $_.id -eq $me.id } | Select-Object -First 1
          if (-not $u) { Send-Err $res 'Usuario nao encontrado.' 404; continue }
          $u.senhaHash = (Hash-Senha $nova)
          $u | Add-Member -NotePropertyName mustReset -NotePropertyValue $false -Force
          Save-Users $users
          Send-Json $res (@{ ok = $true; user = (User-Public $u) })
          Write-Host "[$((Get-Date -Format 'HH:mm:ss'))] SENHA trocada por $($u.login)" -ForegroundColor Green
        } finally { $script:mux.ReleaseMutex() }
        continue
      }

      # ------------ ADM/GESTOR DEFINE SENHA DE OUTRO USUARIO ------------
      if ($path -eq '/api/definir-senha' -and $req.HttpMethod -eq 'POST') {
        if (-not (Can-ManageUsers $me)) { Send-Err $res 'Sem permissao.' 403; continue }
        $in = (Read-Body $req) | ConvertFrom-Json
        $nova = [string]$in.senha
        if ($nova.Length -lt 4) { Send-Err $res 'A senha deve ter ao menos 4 caracteres.' 400; continue }
        $script:mux.WaitOne() | Out-Null
        try {
          $users = @(Get-Users)
          $alvo = $users | Where-Object { $_.id -eq [string]$in.userId } | Select-Object -First 1
          if (-not $alvo) { Send-Err $res 'Usuario nao encontrado.' 404; continue }
          if ($me.perfil -eq 'gestor' -and $alvo.perfil -ne 'consultor') { Send-Err $res 'O Gestor so redefine senha de consultores.' 403; continue }
          $alvo.senhaHash = (Hash-Senha $nova)
          $alvo | Add-Member -NotePropertyName mustReset -NotePropertyValue $true -Force
          Save-Users $users
          Send-Json $res (@{ ok = $true })
          Write-Host "[$((Get-Date -Format 'HH:mm:ss'))] SENHA redefinida p/ $($alvo.login) por $($me.login)" -ForegroundColor Yellow
        } finally { $script:mux.ReleaseMutex() }
        continue
      }

      Send-Err $res "Rota nao encontrada: $path" 404; continue
    }

    # ============================ ANEXOS (arquivos) ======================
    if ($path -like '/anexos/*') {
      $fname = [IO.Path]::GetFileName($path)   # bloqueia traversal
      $full = Join-Path $anexoDir $fname
      if ((Test-Path $full -PathType Leaf) -and $full.StartsWith($anexoDir)) {
        $ext = [IO.Path]::GetExtension($full).ToLower()
        $ct = $mime[$ext]; if (-not $ct) { $ct = 'application/octet-stream' }
        Send-Bytes $res ([IO.File]::ReadAllBytes($full)) $ct
      } else { $res.StatusCode = 404; $res.Close() }
      continue
    }

    # ============================ ARQUIVOS ESTATICOS =====================
    if ($path -eq '/') { $path = '/index.html' }
    $rel = $path.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
    $full = Join-Path $root $rel
    $ext = [IO.Path]::GetExtension($full).ToLower()
    if ($ext -in '.ps1', '.bat', '.cmd', '.vbs') { $res.StatusCode = 403; $res.Close(); continue }
    if ((Test-Path $full -PathType Leaf) -and $full.StartsWith($root)) {
      $ct = $mime[$ext]; if (-not $ct) { $ct = 'application/octet-stream' }
      Send-Bytes $res ([IO.File]::ReadAllBytes($full)) $ct
    } else {
      Send-Bytes $res ([Text.Encoding]::UTF8.GetBytes('404 - nao encontrado')) 'text/plain; charset=utf-8' 404
    }
  } catch {
    try { Send-Err $res $_.Exception.Message 500 } catch {}
    Write-Host "Erro: $($_.Exception.Message)" -ForegroundColor Red
  }
}
