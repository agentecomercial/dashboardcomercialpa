# Configurar-SF.ps1
# Grava as credenciais do Salesforce (Grupo FRZ) CIFRADAS na maquina, fora do repositorio.
# Roda UMA VEZ por PC. Depois disso o comando "SF x SC" do Meta Master se vira sozinho.
#
# Onde grava:  %LOCALAPPDATA%\MetaMaster\sf-creds.xml
#   - Export-Clixml de um PSCredential -> a senha vai cifrada por DPAPI (usuario + maquina do Windows).
#   - Fora do repositorio POR CAMINHO, nao por .gitignore (gitignore ja falhou aqui antes).
#   - So o mesmo usuario do Windows, no mesmo PC, consegue ler de volta.
#
# USO:
#   .\Configurar-SF.ps1                                   -> pergunta usuario/senha/token
#   .\Configurar-SF.ps1 -DeArquivo C:\...\sf-creds.txt    -> migra de um arquivo antigo (SF_USERNAME/SF_PASSWORD/SF_TOKEN)
#   .\Configurar-SF.ps1 -Testar                           -> so testa o login com o que ja esta gravado
#
# IMPORTANTE: salvar com BOM UTF-8.
param(
  [string]$Usuario = '',
  [string]$Senha   = '',
  [string]$Token   = '',
  [string]$DeArquivo = '',
  [switch]$Testar
)
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$dir  = Join-Path $env:LOCALAPPDATA 'MetaMaster'
$path = Join-Path $dir 'sf-creds.xml'
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

function TestarLogin($user, $passToken) {
  function XmlEsc($s){ $s -replace '&','&amp;' -replace '<','&lt;' -replace '>','&gt;' -replace '"','&quot;' }
  $body = @"
<?xml version="1.0" encoding="utf-8"?>
<env:Envelope xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:env="http://schemas.xmlsoap.org/soap/envelope/">
  <env:Body>
    <n1:login xmlns:n1="urn:partner.soap.sforce.com">
      <n1:username>$(XmlEsc $user)</n1:username>
      <n1:password>$(XmlEsc $passToken)</n1:password>
    </n1:login>
  </env:Body>
</env:Envelope>
"@
  $r = Invoke-WebRequest -Uri 'https://login.salesforce.com/services/Soap/u/59.0' -Method Post -Body $body ` -ErrorAction Stop
        -ContentType 'text/xml; charset=UTF-8' -Headers @{ SOAPAction = 'login' } -UseBasicParsing -ErrorAction Stop
  $xml = [xml]$r.Content
  return $xml.Envelope.Body.loginResponse.result
}

if ($Testar) {
  if (-not (Test-Path $path)) { Write-Host "Nada gravado ainda em $path" -ForegroundColor Yellow; exit 1 }
  $cred = Import-Clixml $path
  try {
    $res = TestarLogin $cred.UserName $cred.GetNetworkCredential().Password
    Write-Host "OK - login funcionando" -ForegroundColor Green
    Write-Host "  usuario : $($res.userInfo.userName)"
    Write-Host "  org     : $($res.userInfo.organizationName)"
    exit 0
  } catch { Write-Host "FALHOU: $($_.Exception.Message)" -ForegroundColor Red; exit 1 }
}

# ---- coleta das credenciais ----
if ($DeArquivo) {
  if (-not (Test-Path $DeArquivo)) { Write-Host "Arquivo nao encontrado: $DeArquivo" -ForegroundColor Red; exit 1 }
  $c = Get-Content -Raw $DeArquivo | ConvertFrom-StringData
  $Usuario = $c.SF_USERNAME; $Senha = $c.SF_PASSWORD; $Token = $c.SF_TOKEN
  Write-Host "Lido de $DeArquivo (usuario: $Usuario)"
}
if (-not $Usuario) { $Usuario = Read-Host 'Usuario do Salesforce (ex.: fulano@febracis.com.br.producao)' }
if (-not $Senha)   { $ss = Read-Host 'Senha' -AsSecureString; $Senha = (New-Object PSCredential('x',$ss)).GetNetworkCredential().Password }
if (-not $Token)   { $Token = Read-Host 'Security token (o que a Salesforce manda por e-mail)' }

if (-not $Usuario -or -not $Senha) { Write-Host 'Usuario e senha sao obrigatorios.' -ForegroundColor Red; exit 1 }

# a API SOAP quer senha + token concatenados: guardo ja concatenado (e so isso sai do DPAPI)
$passToken = $Senha + $Token

Write-Host 'Testando o login antes de gravar...' -ForegroundColor Cyan
try {
  $res = TestarLogin $Usuario $passToken
  if (-not $res.sessionId) { throw 'login sem sessionId' }
} catch {
  Write-Host "FALHOU o login - nada foi gravado. $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

$cred = New-Object System.Management.Automation.PSCredential($Usuario, (ConvertTo-SecureString $passToken -AsPlainText -Force))
$cred | Export-Clixml $path

Write-Host ''
Write-Host "Gravado (cifrado por DPAPI) em: $path" -ForegroundColor Green
Write-Host "  usuario : $($res.userInfo.userName)"
Write-Host "  org     : $($res.userInfo.organizationName)  ($($res.userInfo.organizationId))"
Write-Host ''
Write-Host 'Agora APAGUE qualquer arquivo de credencial em texto plano que ainda exista.' -ForegroundColor Yellow
