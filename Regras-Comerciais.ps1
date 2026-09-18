<#
  Regras-Comerciais.ps1
  Le o regras-comerciais.md (fonte unica, editada a mao) e devolve a rotina de UM topico,
  pronta para o gestor repassar ao consultor. Sem parametro, lista os topicos disponiveis.

  Nao acessa MCP nem rede: e so leitura de arquivo. Responde na hora e nao usa token.

  USO:
    powershell ./Regras-Comerciais.ps1                        # lista os topicos (numerados)
    powershell ./Regras-Comerciais.ps1 -Topico 3              # o topico 3
    powershell ./Regras-Comerciais.ps1 -Topico "treinamento"  # por pedaco do nome
    powershell ./Regras-Comerciais.ps1 -Listar                # forca a listagem

  SAIDA:
    Markdown (titulo + atividades numeradas) + marcador oculto <!--REGRAS:{...}-->
    que alimenta o card de imagem e o botao de copiar texto no app.

  ONDE EDITAR O CONTEUDO: regras-comerciais.md (mesma pasta). Adicionar topico = criar um
  "## <emoji> <Nome>" la; adicionar atividade = uma linha "- texto". Nada aqui muda.
#>
param(
  [string]$Topico = '',   # numero (1..N) ou pedaco do nome; vazio = lista os topicos
  [switch]$Listar         # forca a listagem mesmo com -Topico preenchido
)

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$arquivo = Join-Path $PSScriptRoot 'regras-comerciais.md'
if (-not (Test-Path $arquivo)) {
  Write-Output "**Nao encontrei o arquivo de regras.** Esperado em: ``$arquivo``"
  Write-Output ''
  Write-Output 'Crie o arquivo com pelo menos um topico no formato:'
  Write-Output '```'
  Write-Output '## 🔁 Tratamento de leads ZS (CRM)'
  Write-Output '- Conferir leads novos sem primeiro contato'
  Write-Output '```'
  exit 1
}

# ---------- parser ----------
# Formato aceito (deliberadamente minimo):
#   "## <emoji> <Nome>"  abre um topico
#   "- texto"            e uma atividade
#   "- ! texto"          e uma atividade CRITICA (sai em coral nas tres saidas; o "!" some)
#   linha solta logo apos um item  = CONTINUACAO dele (quebra de linha DENTRO da atividade)
# Qualquer outra linha e ignorada, entao o cabecalho explicativo do .md nao atrapalha.
$linhas  = [System.IO.File]::ReadAllLines($arquivo, [System.Text.Encoding]::UTF8)
$topicos = New-Object System.Collections.ArrayList
$atual   = $null
$aberto  = $false   # o item anterior ainda aceita continuacao? (linha em branco fecha)

foreach ($ln in $linhas) {
  # "##" abre topico. "###" ou mais nao abre: fica reservado para subtitulo dentro do .md.
  $mt = [regex]::Match($ln, '^\s*##(?!#)\s*(?<titulo>.+?)\s*$')
  if ($mt.Success) {
    $titulo = $mt.Groups['titulo'].Value
    # separa o emoji (tudo que vem antes da primeira letra/numero) do nome do topico
    $me = [regex]::Match($titulo, '^(?<emo>[^\p{L}\p{N}]*)(?<nome>.*)$')
    $emo  = $me.Groups['emo'].Value.Trim()
    $nome = $me.Groups['nome'].Value.Trim()
    if (-not $nome) { $nome = $titulo.Trim(); $emo = '' }
    # `criticos` guarda os INDICES (base 0) das atividades marcadas com "!". Fica separado de
    # `itens` de proposito: os itens seguem sendo texto puro, entao o markdown, o card e o texto
    # do WhatsApp continuam funcionando sem saber que a marcacao existe.
    $atual = [ordered]@{ emoji = $emo; nome = $nome; itens = (New-Object System.Collections.ArrayList);
                         criticos = (New-Object System.Collections.ArrayList) }
    [void]$topicos.Add($atual)
    $aberto = $false
    continue
  }
  if ($null -eq $atual) { continue }   # linhas antes do 1o topico = cabecalho do arquivo
  $mi = [regex]::Match($ln, '^\s*[-*]\s+(?<txt>.+?)\s*$')
  if ($mi.Success) {
    $txt = $mi.Groups['txt'].Value
    # "!" logo no inicio marca a atividade como critica e e removido do texto
    $mc = [regex]::Match($txt, '^!\s*(?<resto>.+)$')
    if ($mc.Success) { [void]$atual.criticos.Add($atual.itens.Count); $txt = $mc.Groups['resto'].Value }
    [void]$atual.itens.Add($txt)
    $aberto = $true
    continue
  }
  # Continuacao: linha solta LOGO depois de um item vira uma segunda linha DENTRO dele.
  # E o jeito de escrever o desdobramento de uma atividade sem inventar um item novo (o gestor
  # escreve assim). Fica de fora tudo que ja tem significado no arquivo (titulo, citacao) e,
  # principalmente, o que vem DEPOIS de uma linha em branco: a linha em branco encerra o item,
  # senao qualquer paragrafo solto no meio do arquivo seria engolido pela ultima atividade.
  if ($aberto -and $ln -notmatch '^\s*$' -and $ln -notmatch '^\s*[#>]') {
    $ultimo = $atual.itens.Count - 1
    $atual.itens[$ultimo] = $atual.itens[$ultimo] + "`n" + $ln.Trim()
    continue
  }
  $aberto = $false
}

if ($topicos.Count -eq 0) {
  Write-Output '**O arquivo de regras esta vazio.**'
  Write-Output ''
  Write-Output "Abra ``regras-comerciais.md`` e crie ao menos um topico com ``## <emoji> <Nome>``."
  exit 1
}

# lista compacta dos topicos: vai no marcador para o app montar o seletor sem outra chamada
$indice = @()
for ($i = 0; $i -lt $topicos.Count; $i++) {
  $t = $topicos[$i]
  $indice += [ordered]@{ n = ($i + 1); emoji = $t.emoji; nome = $t.nome; qtd = $t.itens.Count }
}

function Write-Marcador($dados) {
  $json = $dados | ConvertTo-Json -Depth 6 -Compress
  Write-Output ''
  Write-Output "<!--REGRAS:$json-->"
}

# ---------- modo lista ----------
# Sem topico (ou com -Listar): devolve o menu numerado. E o que alimenta o seletor do app
# e o menu do chat.
if ($Listar -or -not $Topico) {
  Write-Output '## 📋 Regras Comerciais'
  Write-Output ''
  Write-Output "**$($topicos.Count) tópicos.** Escolha um para ver a rotina."
  Write-Output ''
  Write-Output '| # | Tópico | Atividades |'
  Write-Output '|---|---|---|'
  foreach ($t in $indice) {
    $rot = (($t.emoji + ' ' + $t.nome).Trim())
    $qtd = if ($t.qtd -eq 0) { '_(vazio)_' } else { "$($t.qtd)" }
    Write-Output "| $($t.n) | $rot | $qtd |"
  }
  Write-Output ''
  Write-Output '_Conteúdo editável em `regras-comerciais.md` — adicionar tópico ou atividade não exige mexer em código._'
  Write-Marcador ([ordered]@{ modo = 'lista'; topicos = $indice; gerado = (Get-Date -Format 'dd/MM/yyyy HH:mm') })
  exit 0
}

# ---------- resolve o topico pedido ----------
# Aceita numero (o que o app manda) ou pedaco do nome (o que e comodo no chat).
$alvo = $null
if ($Topico -match '^\d+$') {
  $n = [int]$Topico
  if ($n -ge 1 -and $n -le $topicos.Count) { $alvo = $topicos[$n - 1]; $num = $n }
} else {
  # busca sem acento e sem caixa, para "negociacao" achar "Negociação"
  $norm = {
    param($s)
    $d = [string]$s
    $d = $d.Normalize([Text.NormalizationForm]::FormD)
    ($d.ToCharArray() | Where-Object {
      [Globalization.CharUnicodeInfo]::GetUnicodeCategory($_) -ne [Globalization.UnicodeCategory]::NonSpacingMark
    }) -join '' | ForEach-Object { $_.ToLowerInvariant() }
  }
  $q = & $norm $Topico
  for ($i = 0; $i -lt $topicos.Count; $i++) {
    if ((& $norm $topicos[$i].nome).Contains($q)) { $alvo = $topicos[$i]; $num = $i + 1; break }
  }
}

if ($null -eq $alvo) {
  Write-Output "**Não achei o tópico ``$Topico``.** Os que existem:"
  Write-Output ''
  foreach ($t in $indice) { Write-Output "$($t.n). $((($t.emoji + ' ' + $t.nome)).Trim())" }
  Write-Output ''
  Write-Output '_Use o número ou um pedaço do nome._'
  # exit 0 de proposito: nao e falha do script, e escolha errada. Saindo com 1 o /api/cmd
  # devolveria 500 e o app mostraria "Falhou:" em vez desta lista, que e o que ajuda.
  Write-Marcador ([ordered]@{ modo = 'erro'; topicos = $indice; gerado = (Get-Date -Format 'dd/MM/yyyy HH:mm') })
  exit 0
}

# ---------- saida do topico ----------
$rotulo = (($alvo.emoji + ' ' + $alvo.nome).Trim())
Write-Output "## $rotulo"
Write-Output ''
if ($alvo.itens.Count -eq 0) {
  Write-Output '_Este tópico ainda não tem atividades._'
  Write-Output ''
  Write-Output "Abra ``regras-comerciais.md``, ache o ``## $rotulo`` e escreva as atividades — uma por linha, começando com ``- ``."
} else {
  $i = 1
  # o "!!" na frente sobrevive ate o renderizador de markdown do app, que o troca pela classe
  # da linha critica. No chat (fora do app) ele apareceria como ruido, entao so vai quando ha
  # marcacao — e o app o remove antes de exibir.
  foreach ($it in $alvo.itens) {
    $marca = $(if ($alvo.criticos -contains ($i - 1)) { '!!' } else { '' })
    # a continuacao vira "<br>" NO MARKDOWN: escrita como quebra de verdade ela sairia da lista
    # e viraria paragrafo solto. No marcador (JSON) o item segue com "\n", que e o que o card
    # e o texto do WhatsApp entendem.
    $txtMd = $it -replace "`n", '<br>'
    Write-Output "$i. $marca$txtMd"; $i++
  }
  Write-Output ''
  Write-Output "_$($alvo.itens.Count) atividade(s) · tópico $num de $($topicos.Count)._"
}

Write-Marcador ([ordered]@{
  modo    = 'topico'
  n       = $num
  topico  = $alvo.nome
  emoji   = $alvo.emoji
  itens   = @($alvo.itens)
  criticos = @($alvo.criticos)
  topicos = $indice
  gerado  = (Get-Date -Format 'dd/MM/yyyy HH:mm')
})
