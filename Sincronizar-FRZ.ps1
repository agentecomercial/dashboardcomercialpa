# Sincronizar-FRZ.ps1  (APOSENTADO em 06/10/2026)
# A Pipeline Comercial deixou de espelhar o FRZ // PIPELINE HUD: a fonte agora
# e o ZS, pelo Sincronizar-ZS.ps1 (o mesmo que o botao "Sincronizar ZS" roda).
# Este arquivo so repassa para la. Rodar a logica antiga do HUD de novo traria
# de volta os lancamentos frz_* e APAGARIA as vendas vindas do ZS.
# A versao antiga esta no historico do git (commit anterior a 06/10/2026).
param(
  [string]$Periodo = (Get-Date -Format 'yyyy-MM'),
  [switch]$Aplicar,
  [switch]$ForcarMesAntigo
)
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
Write-Output 'AVISO: desde 06/10/2026 a Pipeline sincroniza com o ZS. Repassando para o Sincronizar-ZS.ps1.'
Write-Output ''
& (Join-Path $PSScriptRoot 'Sincronizar-ZS.ps1') -Periodo $Periodo -Aplicar:$Aplicar -ForcarMesAntigo:$ForcarMesAntigo
