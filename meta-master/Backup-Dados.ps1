<#
  Backup-Dados.ps1
  Cópia diária dos arquivos de dados do Meta Master.

  POR QUE EXISTE (auditoria de 18/09/2026):
  O estado.json tem ~1 MB, é lido com catch vazio e REESCRITO INTEIRO a cada
  POST em /api/estado. Se o arquivo estiver truncado (Ctrl+C no servidor no
  meio da gravação, disco cheio), a leitura devolve {} e o próximo POST grava
  só o patch — apagando fotos, enquadramentos e preferências de uma vez.
  E não havia cópia em lugar nenhum: esses arquivos estão no .gitignore
  (corretamente — 1 MB por clique inflaria o repositório).

  Isso é mais provável do que qualquer queda do CRM, e era o único risco do
  sistema sem NENHUMA recuperação. Git não serve para dado; cópia serve.

  Chamado pelo Servir.ps1 quando o servidor sobe. Roda em silêncio e nunca
  derruba o servidor: qualquer falha aqui é avisada e ignorada.
#>
param(
  [string]$Raiz = $PSScriptRoot,
  [int]$ManterDias = 30
)

# A pasta-pai guarda metas-vitoria.json e metas-leads-vitoria.json
$pai = Split-Path $Raiz -Parent

# Só dado que não se reconstrói sozinho, ou que custa caro reconstruir.
# dados.js e os snapshots entram porque, mesmo sendo derivados, refazê-los
# depende do CRM estar no ar — e é justamente quando ele cai que dão falta.
$alvos = @(
  (Join-Path $Raiz 'estado.json')                  # fotos, enquadramentos, preferências
  (Join-Path $Raiz 'mm-fotos.js')                  # fotos publicadas
  (Join-Path $Raiz 'dados.js')                     # painel (derivado, mas caro)
  (Join-Path $Raiz 'mapeamentos-turma.json')       # links de planilha por turma
  (Join-Path $pai  'metas-vitoria.json')           # DIGITADO pelo usuário — insubstituível
  (Join-Path $pai  'metas-leads-vitoria.json')     # idem
)

$hoje    = Get-Date -Format 'yyyy-MM-dd'
$destino = Join-Path $Raiz ('_backup\' + $hoje)

try {
  if (-not (Test-Path $destino)) { New-Item -ItemType Directory -Path $destino -Force | Out-Null }

  $copiados = 0
  foreach ($arq in $alvos) {
    if (-not (Test-Path $arq)) { continue }
    $nome = Split-Path $arq -Leaf
    $dest = Join-Path $destino $nome
    # Já existe cópia de hoje e o arquivo não mudou depois dela? Não repete.
    if (Test-Path $dest) {
      if ((Get-Item $arq).LastWriteTime -le (Get-Item $dest).LastWriteTime) { continue }
    }
    # NUNCA trocar uma cópia boa por um arquivo vazio: se a origem está com
    # 0 bytes, ela já é a vítima do problema que este script existe para cobrir.
    if ((Get-Item $arq).Length -eq 0) { continue }
    Copy-Item $arq $dest -Force
    $copiados++
  }

  # snapshots de leads: pasta inteira, é pequena
  $snapOrig = Join-Path $Raiz '_tmp\snapshots'
  if (Test-Path $snapOrig) {
    $snapDest = Join-Path $destino 'snapshots'
    if (-not (Test-Path $snapDest)) { New-Item -ItemType Directory -Path $snapDest -Force | Out-Null }
    Copy-Item (Join-Path $snapOrig '*.json') $snapDest -Force -ErrorAction SilentlyContinue
  }

  # expurgo por idade — a pasta é nomeada pela data, então basta ler o nome.
  # (ParseExact dentro de try: o TryParseExact do .NET exige [ref][datetime]
  #  tipado e DateTimeStyles, e falha em silêncio quando chamado com $null.)
  $limite = (Get-Date).AddDays(-$ManterDias)
  Get-ChildItem (Join-Path $Raiz '_backup') -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $pasta = $_
    if ($pasta.Name -notmatch '^\d{4}-\d{2}-\d{2}$') { return }
    try {
      $d = [datetime]::ParseExact($pasta.Name, 'yyyy-MM-dd', $null)
      if ($d -lt $limite) { Remove-Item $pasta.FullName -Recurse -Force -ErrorAction SilentlyContinue }
    } catch { }
  }

  Write-Output "backup: $copiados arquivo(s) em _backup\$hoje"
} catch {
  # backup que derruba o servidor seria pior que não ter backup
  Write-Output "backup falhou (seguindo assim mesmo): $($_.Exception.Message)"
}
