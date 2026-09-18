<#
  Liberar-Acesso-Rede.ps1  -  META MASTER
  Libera o acesso do CELULAR (e dos colegas) ao servidor local (porta 8765) na MESMA rede Wi-Fi.
  Faz duas coisas:
    1) Reserva de URL (urlacl) para http://+:8765/  (aceita a rede toda)
    2) Regra de Firewall (entrada) liberando a porta TCP 8765 nas redes Privada/Dominio

  COMO USAR: clique com o botao direito neste arquivo -> "Executar com o PowerShell"
  como ADMINISTRADOR. (Se pedir, confirme o UAC.) Roda UMA VEZ so.
  Depois: feche e reabra o servidor pelo "Meta Master.vbs".
#>
param([int]$Porta = 8765)

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

# --- exige administrador ---
$id = [Security.Principal.WindowsIdentity]::GetCurrent()
$pr = New-Object Security.Principal.WindowsPrincipal($id)
if (-not $pr.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host "Precisa rodar como ADMINISTRADOR." -ForegroundColor Red
  Write-Host "Feche esta janela, clique com o botao direito no arquivo e escolha 'Executar com o PowerShell' (Admin)." -ForegroundColor Yellow
  Read-Host "Pressione ENTER para sair"
  exit 1
}

# 1) Reserva de URL (idempotente) - Everyone via SID (independe do idioma do Windows)
$url = "http://+:$Porta/"
$temUrl = (netsh http show urlacl) -match [Regex]::Escape($url)
if (-not $temUrl) {
  netsh http add urlacl url=$url sddl="D:(A;;GX;;;S-1-1-0)" | Out-Null
  Write-Host "Reserva de URL criada: $url" -ForegroundColor Green
} else {
  Write-Host "Reserva de URL ja existia: $url" -ForegroundColor DarkGray
}

# 1B) Rede atual como PRIVADA. Toda rede Wi-Fi nova entra como "Publica" no Windows, e a regra
#     de firewall abaixo so vale para Privada/Dominio — por isso o celular para de acessar
#     quando voce troca de Wi-Fi. Rodar este script de novo na rede nova resolve.
$pubs = @(Get-NetConnectionProfile | Where-Object { $_.NetworkCategory -eq 'Public' })
foreach ($pf in $pubs) {
  try {
    Set-NetConnectionProfile -InterfaceIndex $pf.InterfaceIndex -NetworkCategory Private -ErrorAction Stop
    Write-Host ("Rede '{0}' marcada como PRIVADA." -f $pf.Name) -ForegroundColor Green
  } catch {
    Write-Host ("Nao consegui mudar a rede '{0}' para Privada: {1}" -f $pf.Name, $_.Exception.Message) -ForegroundColor Yellow
  }
}
if (-not $pubs) { Write-Host "Rede ja estava como Privada." -ForegroundColor DarkGray }

# 2) Regra de Firewall — perfil ANY (vale em qualquer rede).
#    Motivo: cada Wi-Fi novo entra como "Publica" e uma regra so de Privada/Dominio faz o celular
#    parar de acessar a cada troca de rede. Com Any nao precisa reconfigurar nada ao trocar.
#    A protecao continua sendo o login (arquivo .auth), exigido em todo acesso que nao seja deste PC.
$nome = "META MASTER $Porta"
$regra = Get-NetFirewallRule -DisplayName $nome -ErrorAction SilentlyContinue
if (-not $regra) {
  New-NetFirewallRule -DisplayName $nome -Direction Inbound -Protocol TCP -LocalPort $Porta `
    -Action Allow -Profile Any -Description "Acesso ao Meta Master na rede local" | Out-Null
  Write-Host "Regra de firewall criada (TCP $Porta, qualquer rede)." -ForegroundColor Green
} else {
  Set-NetFirewallRule -DisplayName $nome -Profile Any -Enabled True | Out-Null
  Write-Host "Regra de firewall atualizada para valer em qualquer rede (TCP $Porta)." -ForegroundColor Green
}

# --- mostra os enderecos para abrir no celular ---
Write-Host ""
Write-Host "PRONTO! No celular (mesma rede/Wi-Fi), abra no navegador:" -ForegroundColor Cyan
$ips = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
  $_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '169.*' -and $_.PrefixOrigin -ne 'WellKnown'
}
foreach ($ip in $ips) { Write-Host ("   http://{0}:{1}/" -f $ip.IPAddress, $Porta) -ForegroundColor White }
Write-Host ""
Write-Host "Depois: iPhone -> Compartilhar -> 'Adicionar a Tela de Inicio'." -ForegroundColor Yellow
Write-Host "        Android -> menu (3 pontinhos) -> 'Adicionar a tela inicial'." -ForegroundColor Yellow
Write-Host ""
Write-Host "IMPORTANTE: feche e reabra o servidor (Meta Master.vbs) para valer a liberacao." -ForegroundColor Yellow
Write-Host "Seu PC precisa ficar LIGADO e com o servidor aberto." -ForegroundColor Yellow
Write-Host "Acesso de fora do PC pede login (arquivo .auth)." -ForegroundColor DarkGray
Read-Host "Pressione ENTER para sair"
