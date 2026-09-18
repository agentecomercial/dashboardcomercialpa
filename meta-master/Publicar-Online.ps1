<#
  Publicar-Online.ps1
  Liga o servidor do Meta Master (com login) + o tunel Cloudflare e mostra a URL publica.
  Para PARAR: feche esta janela (o tunel cai; o app volta a ser so local).
  Use pelo atalho "Publicar Online.bat".
#>
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$root  = $PSScriptRoot
$porta = 8765

function Porta-Ativa {
  $c = New-Object System.Net.Sockets.TcpClient
  try {
    $iar = $c.BeginConnect('127.0.0.1', $porta, $null, $null)
    if ($iar.AsyncWaitHandle.WaitOne(700)) { $c.EndConnect($iar); return $true }  # EndConnect confirma (ou lanca)
    return $false
  } catch { return $false }
  finally { $c.Close() }
}

Write-Host ''
Write-Host '  Iniciando o Meta Master para publicacao...' -ForegroundColor Cyan

# 1) garante o servidor (Servir.ps1) rodando
# Quem abre o localhost no navegador e o proprio Servir.ps1 QUANDO ELE SOBE. Se o servidor
# ja estava no ar (outra janela, ou um processo esquecido segurando a porta), essa etapa e
# pulada e so a URL publica abria — por isso guardamos aqui quem subiu o servidor.
$subimosOServidor = $false
if (-not (Porta-Ativa)) {
  # lanca o Servir.bat (ele ja faz cd e -File "..." com aspas; robusto p/ caminhos com espaco/acento)
  Start-Process -FilePath (Join-Path $root 'Servir.bat') -WindowStyle Minimized
  $subimosOServidor = $true
  for ($i=0; $i -lt 30; $i++) { Start-Sleep -Milliseconds 700; if (Porta-Ativa) { break } }
}
if (-not (Porta-Ativa)) { Write-Host '  ERRO: o servidor (porta 8765) nao subiu. Veja o Servir.ps1.' -ForegroundColor Red; pause; exit 1 }
Write-Host '  Servidor OK (porta 8765, com login).' -ForegroundColor Green

# Porta ocupada nao garante servidor bom: um processo pendurado tambem prende a porta.
# Se ele nao responder, avisamos com o caminho da solucao em vez de seguir para o tunel.
if (-not $subimosOServidor) {
  $respondeu = $false
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:$porta/index.html" -TimeoutSec 8 -UseBasicParsing
    $respondeu = ($r.StatusCode -eq 200 -or $r.StatusCode -eq 401)
  } catch {
    # 401 (login) tambem conta como servidor vivo
    if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 401) { $respondeu = $true }
  }
  if (-not $respondeu) {
    Write-Host ''
    Write-Host '  ATENCAO: a porta 8765 esta ocupada por um processo que NAO responde.' -ForegroundColor Red
    Write-Host '  Feche a janela preta antiga do servidor (ou rode o comando abaixo) e tente de novo:' -ForegroundColor Yellow
    Write-Host '    Get-Process powershell | Where-Object { $_.MainWindowTitle -like "*Servir*" } | Stop-Process -Force' -ForegroundColor DarkGray
    Write-Host ''
    pause; exit 1
  }
  # servidor de outra janela: abre o localhost aqui, senao so o online abriria
  Write-Host '  Abrindo tambem o endereco local...' -ForegroundColor DarkGray
  try { Start-Process "http://localhost:$porta/index.html" } catch {}
}

# 2) localiza o cloudflared
$cf = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $cf) {
  $cand = @("$env:LOCALAPPDATA\Microsoft\WinGet\Links\cloudflared.exe")
  $cf = $cand | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $cf) { $cf = (Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter cloudflared.exe -ErrorAction SilentlyContinue | Select-Object -First 1).FullName }
if (-not $cf) { Write-Host '  ERRO: cloudflared nao encontrado. Instale com:  winget install Cloudflare.cloudflared' -ForegroundColor Red; pause; exit 1 }

# 3) evita tuneis duplicados e sobe um novo, capturando a URL
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
$log = Join-Path $env:TEMP 'metamaster-tunnel.log'
if (Test-Path $log) { Remove-Item $log -Force -ErrorAction SilentlyContinue }
Write-Host '  Abrindo o tunel (alguns segundos)...' -ForegroundColor Cyan
$proc = Start-Process $cf -ArgumentList 'tunnel','--url',"http://localhost:$porta",'--http-host-header',"localhost:$porta",'--logfile',$log -PassThru -WindowStyle Hidden

$url = $null
for ($i=0; $i -lt 40; $i++) {
  Start-Sleep -Milliseconds 800
  if (Test-Path $log) { $m = [regex]::Match((Get-Content $log -Raw -ErrorAction SilentlyContinue), 'https://[a-z0-9-]+\.trycloudflare\.com'); if ($m.Success) { $url = $m.Value; break } }
}

Clear-Host
Write-Host '==================================================================' -ForegroundColor Cyan
Write-Host '   META MASTER - PUBLICADO ONLINE' -ForegroundColor Green
Write-Host '==================================================================' -ForegroundColor Cyan
if ($url) {
  Write-Host ''
  Write-Host "   URL:      $url" -ForegroundColor Yellow
  Write-Host '   Usuario:  comercial'
  Write-Host '   Senha:    (a que voce definiu no arquivo .auth)'
  Write-Host ''
  Write-Host '   (selecione a URL acima com o mouse e Enter para copiar)' -ForegroundColor DarkGray
  Write-Host ''
  # Espera o DNS do tunel publicar ANTES de abrir o navegador (evita NXDOMAIN cacheado).
  Write-Host '   Aguardando o DNS publicar a URL...' -ForegroundColor DarkGray
  $hostName = ([Uri]$url).Host
  for ($i=0; $i -lt 25; $i++) {
    try { Resolve-DnsName -Name $hostName -Server '1.1.1.1' -Type A -ErrorAction Stop | Out-Null; break }
    catch { Start-Sleep -Milliseconds 800 }
  }
  ipconfig /flushdns | Out-Null   # limpa qualquer NXDOMAIN cacheado antes de abrir
  Write-Host '   Abrindo no navegador...' -ForegroundColor DarkGray
  try { Start-Process $url } catch {}
} else {
  Write-Host '   Nao consegui capturar a URL automaticamente.' -ForegroundColor Red
  Write-Host "   Veja o log: $log"
}
Write-Host ''
Write-Host '------------------------------------------------------------------'
Write-Host '   IMPORTANTE:' -ForegroundColor Yellow
Write-Host '   - Mantenha o PC LIGADO (sem hibernar) e ESTA janela ABERTA.'
Write-Host '   - Fechar esta janela = o app sai do ar (volta a ser so local).'
Write-Host '   - A URL muda cada vez que voce republica (tunel gratuito).'
Write-Host '------------------------------------------------------------------'
Write-Host ''

# mantem vivo enquanto o tunel estiver de pe; ao fechar a janela, derruba o tunel
try { Wait-Process -Id $proc.Id } finally { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
