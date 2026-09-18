<#
  Liberar-Acesso-Rede.ps1  -  APP CHAMADO
  Libera o acesso dos colegas ao servidor local (porta 8790) na MESMA rede.
  Faz duas coisas:
    1) Reserva de URL (urlacl) para http://+:8790/  (aceita a rede toda)
    2) Regra de Firewall (entrada) liberando a porta TCP 8790 nas redes Privada/Dominio

  COMO USAR: clique com o botao direito neste arquivo -> "Executar com o PowerShell"
  como ADMINISTRADOR. (Se pedir, confirme o UAC.)
#>
param([int]$Porta = 8790)

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

# 2) Regra de Firewall (idempotente)
$nome = "APP CHAMADO $Porta"
$regra = Get-NetFirewallRule -DisplayName $nome -ErrorAction SilentlyContinue
if (-not $regra) {
  New-NetFirewallRule -DisplayName $nome -Direction Inbound -Protocol TCP -LocalPort $Porta `
    -Action Allow -Profile Private, Domain -Description "Acesso ao APP CHAMADO na rede local" | Out-Null
  Write-Host "Regra de firewall criada (TCP $Porta, redes Privada/Dominio)." -ForegroundColor Green
} else {
  Write-Host "Regra de firewall ja existia (TCP $Porta)." -ForegroundColor DarkGray
}

# --- mostra os enderecos para repassar aos colegas ---
Write-Host ""
Write-Host "PRONTO! Peca para os colegas (na MESMA rede/Wi-Fi) abrirem no navegador:" -ForegroundColor Cyan
$ips = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
  $_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '169.*' -and $_.PrefixOrigin -ne 'WellKnown'
}
foreach ($ip in $ips) { Write-Host ("   http://{0}:{1}/" -f $ip.IPAddress, $Porta) -ForegroundColor White }
Write-Host ""
Write-Host "Lembre-se: seu PC precisa estar LIGADO e com o servidor aberto (Abrir Chamados)." -ForegroundColor Yellow
Read-Host "Pressione ENTER para sair"
