<#
.SYNOPSIS
  Atualiza a lista de consultores de Vitoria em TODOS os scripts do Sales Cube de uma vez.

.DESCRIPTION
  Fonte da verdade: bloco $Equipe do Acoes-Leads-Vitoria.ps1 (val + nome + user_id).
  A partir dele o script regrava:
    - $Equipe        -> Acoes-Leads-Vitoria.ps1
    - $Consultores   -> Faturamento-Vitoria.ps1, Leads-Vitoria.ps1, Leads-Vitoria-Campanha.ps1,
                        Negociacoes-Vitoria.ps1, Meta-Vitoria.ps1, Movimentacao-Leads.ps1,
                        meta-master\Gerar-Dados-MetaMaster.ps1
    - Linha "Mapa de consultores -> user_id" -> COMANDOS.md

.EXAMPLE
  .\Consultores-Vitoria.ps1
    Lista os consultores atuais e confere se todos os scripts estao iguais.

.EXAMPLE
  .\Consultores-Vitoria.ps1 -Incluir 'Fulano de Tal Silva' -Id 9999
    PREVIA da inclusao (nao grava). Adicione -Aplicar para gravar.
    -Val 'Fulano' define o apelido curto do app (padrao: primeiro nome).

.EXAMPLE
  .\Consultores-Vitoria.ps1 -Excluir 3 -Aplicar
    Remove o consultor numero 3 da lista (numeracao mostrada ao rodar sem parametros).
    Tambem aceita parte do nome: -Excluir 'Karla' (precisa casar com 1 so).
#>
param(
  [string]$Incluir = '',   # nome EXATO como no Sales Cube
  [int]$Id = 0,            # user_id do Sales Cube (obrigatorio com -Incluir)
  [string]$Val = '',       # apelido curto usado pelo app (padrao: primeiro nome)
  [string]$Excluir = '',   # numero(s) da lista (1..N) e/ou parte(s) de nome, separados por virgula. Ex.: '4,5,6,7' ou 'Karla,Filipe'
  [switch]$Aplicar         # sem -Aplicar = so mostra a previa
)

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

# Arquivos que tem o bloco $Consultores = @( ... )
$ArquivosConsultores = @(
  'Faturamento-Vitoria.ps1'
  'Leads-Vitoria.ps1'
  'Leads-Vitoria-Campanha.ps1'
  'Negociacoes-Vitoria.ps1'
  'Meta-Vitoria.ps1'
  'Movimentacao-Leads.ps1'
  'meta-master\Gerar-Dados-MetaMaster.ps1'
)
$ArquivoEquipe   = 'Acoes-Leads-Vitoria.ps1'
$ArquivoComandos = 'COMANDOS.md'

$Utf8Bom    = New-Object System.Text.UTF8Encoding($true)    # .ps1 SEMPRE com BOM (PS 5.1 + acentos)
$Utf8SemBom = New-Object System.Text.UTF8Encoding($false)   # .md sem BOM

function Read-Texto([string]$rel) {
  $p = Join-Path $Root $rel
  if (-not (Test-Path $p)) { return $null }
  return [System.IO.File]::ReadAllText($p)
}
function Write-Texto([string]$rel, [string]$texto) {
  $enc = $Utf8Bom
  if ($rel -match '\.md$') { $enc = $Utf8SemBom }
  [System.IO.File]::WriteAllText((Join-Path $Root $rel), $texto, $enc)
}
# Substitui a 1a ocorrencia do padrao sem interpretar $ no texto novo
function Update-Bloco([string]$texto, [string]$padrao, [string]$novo) {
  $m = [regex]::Match($texto, $padrao)
  if (-not $m.Success) { return $null }
  return $texto.Substring(0, $m.Index) + $novo + $texto.Substring($m.Index + $m.Length)
}

# ---------- 1) Le a equipe atual (fonte da verdade) ----------
$eqTexto = Read-Texto $ArquivoEquipe
if (-not $eqTexto) { Write-Output "ERRO: $ArquivoEquipe nao encontrado."; return }

$PadraoEquipe = '(?ms)^\$Equipe = @\(\r?\n.*?^\)'
$mEq = [regex]::Match($eqTexto, $PadraoEquipe)
if (-not $mEq.Success) { Write-Output "ERRO: bloco `$Equipe nao encontrado em $ArquivoEquipe."; return }

$Equipe = @()
foreach ($m in [regex]::Matches($mEq.Value, "val='([^']*)';\s*nome='([^']*)';\s*id=(\d+)")) {
  $Equipe += [pscustomobject]@{
    val  = $m.Groups[1].Value.Trim()
    nome = $m.Groups[2].Value.Trim()
    id   = [int]$m.Groups[3].Value
  }
}
if ($Equipe.Count -eq 0) { Write-Output "ERRO: nao consegui ler os consultores do `$Equipe."; return }

# ---------- 2) Monta a nova equipe ----------
$acao = ''
$novaEquipe = @() + $Equipe

if ($Incluir -and $Excluir) { Write-Output "ERRO: use -Incluir OU -Excluir, nao os dois."; return }

if ($Incluir) {
  $acao = 'incluir'
  if ($Id -le 0) {
    Write-Output "ERRO: -Incluir exige -Id <user_id do Sales Cube>."
    Write-Output "Dica: o user_id aparece no Sales Cube (usuario/assignee) ou pode ser consultado via MCP."
    return
  }
  $jaExiste = @($Equipe | Where-Object { $_.nome -eq $Incluir -or $_.id -eq $Id })
  if ($jaExiste.Count -gt 0) {
    Write-Output ("ERRO: ja cadastrado -> {0} (id {1})." -f $jaExiste[0].nome, $jaExiste[0].id)
    return
  }
  if (-not $Val) { $Val = ($Incluir -split '\s+')[0] }
  $valDup = @($Equipe | Where-Object { $_.val -eq $Val })
  if ($valDup.Count -gt 0) {
    Write-Output ("ERRO: apelido '{0}' ja usado por {1}. Passe outro com -Val." -f $Val, $valDup[0].nome)
    return
  }
  $novaEquipe += [pscustomobject]@{ val = $Val; nome = $Incluir; id = $Id }
}

if ($Excluir) {
  $acao = 'excluir'
  # Aceita VARIOS, separados por virgula/ponto-e-virgula: numeros da lista (1..N) e/ou partes de nome
  # Os numeros se referem SEMPRE a lista atual (antes de qualquer exclusao) — sem renumeracao no meio.
  $termos = @($Excluir -split '[;,]' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
  $alvos = @()
  foreach ($termo in $termos) {
    if ($termo -match '^\d+$') {
      $n = [int]$termo
      if ($n -lt 1 -or $n -gt $Equipe.Count) {
        Write-Output ("ERRO: numero {0} fora da lista (1..{1}). Atuais:" -f $n, $Equipe.Count)
        $i = 0; $Equipe | ForEach-Object { $i++; Write-Output ("  {0}. {1}" -f $i, $_.nome) }
        return
      }
      $alvos += $Equipe[$n - 1]
    } else {
      $match = @($Equipe | Where-Object { $_.nome -match [regex]::Escape($termo) })
      if ($match.Count -eq 0) {
        Write-Output "ERRO: nenhum consultor casa com '$termo'. Atuais:"
        $i = 0; $Equipe | ForEach-Object { $i++; Write-Output ("  {0}. {1}" -f $i, $_.nome) }
        return
      }
      if ($match.Count -gt 1) {
        Write-Output "ERRO: '$termo' casa com mais de um consultor. Seja mais especifico:"
        $match | ForEach-Object { Write-Output ("  - {0}" -f $_.nome) }
        return
      }
      $alvos += $match[0]
    }
  }
  $nomesAlvo = @($alvos | ForEach-Object { $_.nome } | Select-Object -Unique)
  if ($nomesAlvo.Count -ge $Equipe.Count) {
    Write-Output 'ERRO: nao da para excluir a equipe inteira — precisa sobrar pelo menos 1 consultor.'
    return
  }
  $novaEquipe = @($Equipe | Where-Object { $nomesAlvo -notcontains $_.nome })
}

# ---------- 3) Modo listagem (sem -Incluir/-Excluir) ----------
$wNome = (@($Equipe | ForEach-Object { $_.nome.Length }) | Measure-Object -Maximum).Maximum
$wVal  = (@($Equipe | ForEach-Object { $_.val.Length })  | Measure-Object -Maximum).Maximum

if (-not $acao) {
  Write-Output ''
  Write-Output ("CONSULTORES DE VITORIA ({0})" -f $Equipe.Count)
  Write-Output ('=' * ($wNome + $wVal + 20))
  Write-Output (("{0,3}  {1,-$wNome}  {2,-$wVal}  {3}" -f 'N', 'NOME', 'APELIDO', 'USER_ID'))
  Write-Output ('-' * ($wNome + $wVal + 20))
  $i = 0
  foreach ($c in $Equipe) {
    $i++
    Write-Output (("{0,2}.  {1,-$wNome}  {2,-$wVal}  {3}" -f $i, $c.nome, $c.val, $c.id))
  }
  Write-Output ''
  # Consistencia: cada script deve ter exatamente os mesmos nomes
  $ref = @($Equipe | ForEach-Object { $_.nome } | Sort-Object)
  Write-Output 'CONSISTENCIA DOS SCRIPTS'
  foreach ($rel in $ArquivosConsultores) {
    $t = Read-Texto $rel
    if (-not $t) { Write-Output ("  [FALTA ] {0} (arquivo nao encontrado)" -f $rel); continue }
    $mc = [regex]::Match($t, '(?ms)^\$Consultores = @\(\r?\n(.*?)^\)')
    if (-not $mc.Success) { Write-Output ("  [ERRO  ] {0} (bloco nao encontrado)" -f $rel); continue }
    $nomes = @([regex]::Matches($mc.Groups[1].Value, "'([^']+)'") | ForEach-Object { $_.Groups[1].Value } | Sort-Object)
    $dif = @(Compare-Object $ref $nomes)
    if ($dif.Count -eq 0) { Write-Output ("  [OK    ] {0}" -f $rel) }
    else {
      Write-Output ("  [DIFERE] {0}:" -f $rel)
      foreach ($d in $dif) {
        $lado = 'so aqui'; if ($d.SideIndicator -eq '<=') { $lado = 'falta aqui' }
        Write-Output ("           - {0} ({1})" -f $d.InputObject, $lado)
      }
    }
  }
  Write-Output ''
  Write-Output "Para alterar: -Incluir 'Nome Exato' -Id <user_id> [-Val Apelido] | -Excluir <numero da lista ou parte do nome>  (+ -Aplicar para gravar)"
  return
}

# ---------- 4) Previa antes -> depois ----------
Write-Output ''
Write-Output ("ACAO: {0}" -f $acao.ToUpper())
Write-Output ''
Write-Output ("ANTES  ({0}):" -f $Equipe.Count)
$Equipe     | ForEach-Object { Write-Output ("  - {0} (id {1})" -f $_.nome, $_.id) }
Write-Output ''
Write-Output ("DEPOIS ({0}):" -f $novaEquipe.Count)
$novaEquipe | ForEach-Object { Write-Output ("  - {0} (id {1})" -f $_.nome, $_.id) }
Write-Output ''

# ---------- 5) Gera os novos blocos ----------
$NL = "`r`n"

$linhasCons = @()
foreach ($c in $novaEquipe) { $linhasCons += ("  '{0}'" -f $c.nome) }
$BlocoConsultores = '$Consultores = @(' + $NL + ($linhasCons -join $NL) + $NL + ')'

$wVal2  = (@($novaEquipe | ForEach-Object { $_.val.Length })  | Measure-Object -Maximum).Maximum
$wNome2 = (@($novaEquipe | ForEach-Object { $_.nome.Length }) | Measure-Object -Maximum).Maximum
$linhasEq = @()
foreach ($c in $novaEquipe) {
  $pv = "val='" + $c.val + "';" + (' ' * ($wVal2 - $c.val.Length + 1))
  $pn = "nome='" + $c.nome + "';" + (' ' * ($wNome2 - $c.nome.Length + 1))
  $linhasEq += ("  [pscustomobject]@{{ {0} {1} id={2} }}" -f $pv, $pn, $c.id)
}
$BlocoEquipe = '$Equipe = @(' + $NL + ($linhasEq -join $NL) + $NL + ')'

$MapaComandos = (@($novaEquipe | ForEach-Object { '{0} {1}' -f $_.val, $_.id }) -join ' · ')

# ---------- 6) Aplica (ou avisa que e so previa) ----------
$PadraoConsultores = '(?ms)^\$Consultores = @\(\r?\n.*?^\)'

if (-not $Aplicar) {
  Write-Output 'PREVIA (nada gravado). Arquivos que serao atualizados com -Aplicar:'
  Write-Output ("  - {0} (bloco `$Equipe + user_id)" -f $ArquivoEquipe)
  foreach ($rel in $ArquivosConsultores) { Write-Output ("  - {0}" -f $rel) }
  Write-Output ("  - {0} (linha do mapa consultor -> user_id)" -f $ArquivoComandos)
  Write-Output ''
  Write-Output 'Rode novamente com -Aplicar para gravar.'
  return
}

$ok = @(); $falha = @()

# 6a) Acoes-Leads-Vitoria.ps1 ($Equipe)
$novo = Update-Bloco $eqTexto $PadraoEquipe $BlocoEquipe
if ($novo) { Write-Texto $ArquivoEquipe $novo; $ok += $ArquivoEquipe } else { $falha += $ArquivoEquipe }

# 6b) Scripts com $Consultores
foreach ($rel in $ArquivosConsultores) {
  $t = Read-Texto $rel
  if (-not $t) { $falha += "$rel (nao encontrado)"; continue }
  $novo = Update-Bloco $t $PadraoConsultores $BlocoConsultores
  if ($novo) { Write-Texto $rel $novo; $ok += $rel } else { $falha += "$rel (bloco nao encontrado)" }
}

# 6c) COMANDOS.md (linha do mapa) — melhor esforco, nao e critico
$cmdTexto = Read-Texto $ArquivoComandos
if ($cmdTexto) {
  $padraoMapa = '(?m)^(\*\*Mapa de consultores → user_id\*\*[^:]*: ).*$'
  $mMapa = [regex]::Match($cmdTexto, $padraoMapa)
  if ($mMapa.Success) {
    $novo = $cmdTexto.Substring(0, $mMapa.Index) + $mMapa.Groups[1].Value + $MapaComandos + '.' + $cmdTexto.Substring($mMapa.Index + $mMapa.Length)
    Write-Texto $ArquivoComandos $novo
    $ok += $ArquivoComandos
  } else { $falha += "$ArquivoComandos (linha do mapa nao encontrada)" }
}

Write-Output 'GRAVADO:'
$ok | ForEach-Object { Write-Output ("  [OK] {0}" -f $_) }
if ($falha.Count -gt 0) {
  Write-Output 'FALHOU:'
  $falha | ForEach-Object { Write-Output ("  [!!] {0}" -f $_) }
}
Write-Output ''
Write-Output 'Obs.: metas em metas-vitoria.json nao sao alteradas (consultor sem meta aparece como "—").'
Write-Output 'Novo consultor: cadastre a meta com "Atualizar Meta" quando quiser.'
