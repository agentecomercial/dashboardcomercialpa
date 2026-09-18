<#
  Abrir-Chamado.ps1  -  abre um chamado no APP CHAMADO a partir do IDE (via API REST).

  Loga com uma conta de servico (ADM) e cria o chamado EM NOME DO solicitante escolhido
  (o servidor so aceita isso quando quem loga e ADM/Gestor). Destinatario e solicitante
  sao usuarios existentes, resolvidos por login OU nome.

  USO (o fluxo do IDE normalmente monta isto por voce):
    # 1) listar usuarios para escolher solicitante/destinatario:
    powershell -ExecutionPolicy Bypass -File .\Abrir-Chamado.ps1 -Listar

    # 2) abrir o chamado:
    powershell -ExecutionPolicy Bypass -File .\Abrir-Chamado.ps1 `
      -De "pablo" -Para "gestor" -Assunto "Tecnologia" -Prioridade "Alta" `
      -Titulo "Erro no CRM" -Relato "Descricao detalhada..."

  Config opcional: crie um arquivo abrir-chamado.config.json ao lado deste script com
  { "base": "...", "svcLogin": "...", "svcSenha": "..." } para sobrescrever os padroes.
#>
param(
  [string]$Titulo,
  [string]$Relato,
  [string]$Assunto = 'Comercial',
  [string]$Prioridade = 'Média',
  [string]$Para = '',                 # destinatario (Enviar para): login OU nome
  [string]$De = '',                   # solicitante (quem abre): login OU nome
  [string]$Base = 'http://localhost:8790',
  [string]$SvcLogin = 'adm',
  [string]$SvcSenha = 'adm123',
  [switch]$Listar,                    # so lista os usuarios e sai (para o IDE mostrar opcoes)
  [switch]$Json                       # saida em JSON (para o IDE parsear)
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

# config opcional
$cfgPath = Join-Path $PSScriptRoot 'abrir-chamado.config.json'
if (Test-Path $cfgPath) {
  try {
    $cfg = Get-Content $cfgPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($cfg.base)     { $Base = $cfg.base }
    if ($cfg.svcLogin) { $SvcLogin = $cfg.svcLogin }
    if ($cfg.svcSenha) { $SvcSenha = $cfg.svcSenha }
  } catch {}
}

function Fail($msg) {
  if ($Json) { @{ ok = $false; erro = $msg } | ConvertTo-Json -Compress }
  else { Write-Host "ERRO: $msg" -ForegroundColor Red }
  exit 1
}
function Find-User($users, $q) {
  if (-not $q) { return $null }
  $ql = ([string]$q).Trim().ToLower()
  $u = $users | Where-Object { $_.login -and $_.login.ToLower() -eq $ql } | Select-Object -First 1
  if (-not $u) { $u = $users | Where-Object { $_.nome -and $_.nome.ToLower() -eq $ql } | Select-Object -First 1 }
  if (-not $u) { $u = $users | Where-Object { $_.nome -and $_.nome.ToLower() -like "*$ql*" } | Select-Object -First 1 }
  return $u
}

# 1) login de servico
try {
  $login = Invoke-RestMethod "$Base/api/login" -Method Post -TimeoutSec 8 -ContentType 'application/json' `
             -Body (@{ login = $SvcLogin; senha = $SvcSenha } | ConvertTo-Json)
} catch { Fail "Nao consegui logar no servidor ($Base). O APP CHAMADO esta rodando? Detalhe: $($_.Exception.Message)" }
$token = $login.token
$hdr = @{ 'X-Token' = $token }

# 2) usuarios
$state = Invoke-RestMethod "$Base/api/state" -Headers $hdr -TimeoutSec 8
$users = @($state.usuarios | Where-Object { $_.ativo })

# modo listar (para o IDE mostrar as opcoes de quem solicita / para quem enviar)
if ($Listar) {
  $lista = $users | ForEach-Object { [ordered]@{ login = $_.login; nome = $_.nome; perfil = $_.perfil } }
  if ($Json) { @{ ok = $true; usuarios = @($lista) } | ConvertTo-Json -Depth 6 -Compress }
  else {
    Write-Host "Usuarios ativos:" -ForegroundColor Cyan
    $users | ForEach-Object { Write-Host ("  - {0,-20} {1,-10} ({2})" -f $_.login, $_.perfil, $_.nome) }
  }
  exit 0
}

# 3) validacoes
if (-not $Titulo) { Fail "Informe -Titulo." }
if (-not $Relato) { Fail "Informe -Relato." }
$sol  = Find-User $users $De
if (-not $sol)  { Fail "Solicitante nao encontrado para -De '$De'. Use -Listar para ver as opcoes." }
$dest = Find-User $users $Para
if (-not $dest) { Fail "Destinatario nao encontrado para -Para '$Para'. Use -Listar para ver as opcoes." }

$assuntosOk = @('Comercial','CRM','Matrículas','Financeiro','Marketing','Eventos','Tecnologia','Outros')
if ($assuntosOk -notcontains $Assunto) { $Assunto = 'Outros' }
$prioOk = @('Baixa','Média','Alta','Urgente')
if ($prioOk -notcontains $Prioridade) { $Prioridade = 'Média' }

# 4) monta o chamado (mesma forma do app). historico com 1 item = array garantido no JSON
$agora = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ss')
$hist = @(
  [ordered]@{ quando = $agora; usuarioId = $sol.id; usuarioNome = $sol.nome; acao = 'Chamado aberto'; detalhe = ('Aberto pelo IDE · Enviado para ' + $dest.nome) }
)
$chamado = [ordered]@{
  numero = 0
  titulo = $Titulo
  assunto = $Assunto
  relato = $Relato
  prioridade = $Prioridade
  status = 'Aberto'
  responsavelId = $dest.id
  responsavelNome = $dest.nome
  responsavelPerfil = $dest.perfil
  solicitanteId = $sol.id
  solicitanteNome = $sol.nome
  solicitanteCargo = $sol.cargo
  anexos = @()
  favoritos = @()
  historico = $hist
  comentarios = @()
}
# ConvertTo-Json colapsa array de 1 item -> forcamos colchetes no historico
$histJson = '[' + ($hist[0] | ConvertTo-Json -Depth 6 -Compress) + ']'
$bodyJson = $chamado | ConvertTo-Json -Depth 8 -Compress
$bodyJson = $bodyJson -replace '"historico":\{[^}]*\}', ('"historico":' + $histJson)

# 5) cria
try {
  $novo = Invoke-RestMethod "$Base/api/chamado" -Method Post -Headers $hdr -TimeoutSec 8 -ContentType 'application/json' -Body $bodyJson
} catch { Fail "Falha ao criar o chamado: $($_.Exception.Message)" }

if ($Json) {
  @{ ok = $true; numero = $novo.numero; titulo = $novo.titulo; assunto = $novo.assunto; prioridade = $novo.prioridade; de = $sol.nome; para = $dest.nome; url = "$Base/index.html" } | ConvertTo-Json -Compress
} else {
  Write-Host ""
  Write-Host ("Chamado #{0} aberto com sucesso!" -f $novo.numero) -ForegroundColor Green
  Write-Host ("  Titulo    : {0}" -f $novo.titulo)
  Write-Host ("  Assunto   : {0}  |  Prioridade: {1}" -f $novo.assunto, $novo.prioridade)
  Write-Host ("  Solicitante: {0}" -f $sol.nome)
  Write-Host ("  Enviado para: {0}" -f $dest.nome)
  Write-Host ("  Abra em    : {0}/index.html" -f $Base)
}
