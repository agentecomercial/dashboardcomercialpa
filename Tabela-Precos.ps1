<#
  Tabela-Precos.ps1
  Tabela de precos dos treinamentos da rede (valor de tabela, a vista, grade de 1x a 12x e
  condicao de reciclagem). Dados FIXOS, extraidos da planilha oficial em 11/09/2026 —
  o script nao acessa rede nenhuma; alteracao de preco e edicao manual deste arquivo.

  IMPORTANTE: salvar com BOM UTF-8 (PowerShell 5.1 corrompe os acentos sem BOM).

  USO:
    .\Tabela-Precos.ps1                  -> consolidado (Novos Alunos + Reciclagem)
    .\Tabela-Precos.ps1 -Curso BHP       -> grade completa de 1x a 12x daquele treinamento
    .\Tabela-Precos.ps1 -Json            -> so o objeto, para o app / conferencia

  SAIDA:
    Markdown puro (o app renderiza pelo mdToHtml genérico da aba Comandos).

  POR QUE A GRADE E FIXA E NAO CALCULADA:
    O percentual de desconto exibido na planilha e arredondado; recalcular por
    "De x (1 - desconto)" erra centavos (FCIS em 2x daria 9.392,95 em vez de 9.393,37).
    Em tabela de preco isso e inaceitavel, entao as 12 duplas de cada curso sao copia fiel.
#>
param(
  [string]$Curso = '',   # sigla (BHP) ou pedaco do nome (gestao de negocios); vazio = consolidado
  [switch]$Json          # emite so o objeto e sai
)

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$EXTRACAO = '11/09/2026'
$PLANILHA = 'https://docs.google.com/spreadsheets/d/1oVKOZfYd17baiceSdTGi5UkE-Xvnr-Rua7Vk-zZ77Zc/edit'
$TAXA_CISPAY = '2,923%'

# desconto por numero de parcelas — mesma escala em todos os 11 cursos
$DESCONTOS = @('16,67%','13,00%','11,75%','10,49%','9,22%','7,94%','6,64%','5,34%','4,02%','2,69%','1,35%','0,00%')

# Grade: uma entrada por parcela (1x a 12x), no formato 'Total|Valor da parcela'.
$PRECOS = @(
  @{
    Nome='Formação em Coaching'; Sigla='FCIS'
    Apelidos=@('fcis','formacao em coaching','coaching')
    De='R$ 10.796,49'; Vista='R$ 8.997,00'; Doze='R$ 899,71'
    Recicla='R$ 5.398,25'; ReciclaDoze='R$ 449,85'
    Campanha='FCIS - NOVOS ALUNOS - BRL'; CampanhaRec='FCIS - RECICLAGEM - BRL'
    Vigencia='20/01/2026 a 20/12/2026'; Split=''
    Grade=@(
      'R$ 8.997,00|R$ 8.997,00','R$ 9.393,37|R$ 4.696,68','R$ 9.528,02|R$ 3.176,01',
      'R$ 9.663,92|R$ 2.415,98','R$ 9.801,10|R$ 1.960,22','R$ 9.939,53|R$ 1.656,59',
      'R$ 10.079,22|R$ 1.439,89','R$ 10.220,16|R$ 1.277,52','R$ 10.362,37|R$ 1.151,37',
      'R$ 10.505,82|R$ 1.050,58','R$ 10.650,53|R$ 968,23','R$ 10.796,49|R$ 899,71')
  },
  @{
    Nome='Master Coaching'; Sigla='MASTER'
    Apelidos=@('master','master coaching')
    De='R$ 7.796,47'; Vista='R$ 6.497,00'; Doze='R$ 649,71'
    Recicla='R$ 3.898,24'; ReciclaDoze='R$ 324,85'
    Campanha='MASTER - NOVOS ALUNOS - BRL'; CampanhaRec='MASTER - RECICLAGEM - BRL'
    Vigencia='Até 31/12/2027'; Split=''
    Grade=@(
      'R$ 6.497,00|R$ 6.497,00','R$ 6.783,23|R$ 3.391,61','R$ 6.880,46|R$ 2.293,49',
      'R$ 6.978,61|R$ 1.744,65','R$ 7.077,66|R$ 1.415,53','R$ 7.177,63|R$ 1.196,27',
      'R$ 7.278,50|R$ 1.039,79','R$ 7.380,28|R$ 922,54','R$ 7.482,97|R$ 831,44',
      'R$ 7.586,57|R$ 758,66','R$ 7.691,07|R$ 699,19','R$ 7.796,47|R$ 649,71')
  },
  @{
    Nome='ML5 - Formação de Líderes'; Sigla='ML5'
    Apelidos=@('ml5','formacao de lideres','lideres','lideranca')
    De='R$ 7.196,46'; Vista='R$ 5.997,00'; Doze='R$ 599,71'
    Recicla='R$ 3.598,23'; ReciclaDoze='R$ 299,85'
    Campanha='ML5 - NOVOS ALUNOS - BRL'; CampanhaRec='ML5 - RECICLAGEM - BRL'
    Vigencia='Até 31/12/2027'; Split=''
    Grade=@(
      'R$ 5.997,00|R$ 5.997,00','R$ 6.261,20|R$ 3.130,60','R$ 6.350,95|R$ 2.116,98',
      'R$ 6.441,54|R$ 1.610,39','R$ 6.532,97|R$ 1.306,59','R$ 6.625,25|R$ 1.104,21',
      'R$ 6.718,36|R$ 959,77','R$ 6.812,31|R$ 851,54','R$ 6.907,09|R$ 767,45',
      'R$ 7.002,71|R$ 700,27','R$ 7.099,17|R$ 645,38','R$ 7.196,46|R$ 599,71')
  },
  @{
    Nome='Formação em Gestão de Pessoas com Perfil Comportamental'; Sigla='FGPC'
    Apelidos=@('fgpc','gestao de pessoas','perfil comportamental')
    De='R$ 5.996,45'; Vista='R$ 4.997,00'; Doze='R$ 499,70'
    Recicla='R$ 2.998,23'; ReciclaDoze='R$ 249,85'
    Campanha='FGPC - NOVOS ALUNOS - BRL'; CampanhaRec='FGPC - RECICLAGEM - BRL'
    Vigencia='Até 31/12/2027'; Split=''
    Grade=@(
      'R$ 4.997,00|R$ 4.997,00','R$ 5.217,15|R$ 2.608,57','R$ 5.291,93|R$ 1.763,98',
      'R$ 5.367,41|R$ 1.341,85','R$ 5.443,60|R$ 1.088,72','R$ 5.520,49|R$ 920,08',
      'R$ 5.598,07|R$ 799,72','R$ 5.676,35|R$ 709,54','R$ 5.755,33|R$ 639,48',
      'R$ 5.835,01|R$ 583,50','R$ 5.915,38|R$ 537,76','R$ 5.996,45|R$ 499,70')
  },
  @{
    Nome='Comunicação Eficaz e Oratória Persuasiva'; Sigla='CEOP'
    Apelidos=@('ceop','fop','oratoria','comunicacao eficaz')
    De='R$ 5.996,45'; Vista='R$ 4.997,00'; Doze='R$ 499,70'
    Recicla='R$ 2.998,23'; ReciclaDoze='R$ 249,85'
    Campanha='FOP - NOVOS ALUNOS - BRL'; CampanhaRec='FOP - RECICLAGEM - BRL'
    Vigencia='Até 31/12/2027'; Split=''
    Grade=@(
      'R$ 4.997,00|R$ 4.997,00','R$ 5.217,15|R$ 2.608,57','R$ 5.291,93|R$ 1.763,98',
      'R$ 5.367,41|R$ 1.341,85','R$ 5.443,60|R$ 1.088,72','R$ 5.520,49|R$ 920,08',
      'R$ 5.598,07|R$ 799,72','R$ 5.676,35|R$ 709,54','R$ 5.755,33|R$ 639,48',
      'R$ 5.835,01|R$ 583,50','R$ 5.915,38|R$ 537,76','R$ 5.996,45|R$ 499,70')
  },
  @{
    Nome='BHP - Gestão de Negócios'; Sigla='BHP'
    Apelidos=@('bhp','gestao de negocios','high performance')
    De='R$ 5.996,45'; Vista='R$ 4.997,00'; Doze='R$ 499,70'
    Recicla='R$ 2.998,23'; ReciclaDoze='R$ 249,85'
    Campanha='BHP - NOVOS ALUNOS - BRL'; CampanhaRec='BHP - RECICLAGEM - BRL'
    Vigencia='Até 31/12/2027'; Split=''
    Grade=@(
      'R$ 4.997,00|R$ 4.997,00','R$ 5.217,15|R$ 2.608,57','R$ 5.291,93|R$ 1.763,98',
      'R$ 5.367,41|R$ 1.341,85','R$ 5.443,60|R$ 1.088,72','R$ 5.520,49|R$ 920,08',
      'R$ 5.598,07|R$ 799,72','R$ 5.676,35|R$ 709,54','R$ 5.755,33|R$ 639,48',
      'R$ 5.835,01|R$ 583,50','R$ 5.915,38|R$ 537,76','R$ 5.996,45|R$ 499,70')
  },
  @{
    Nome='Inteligência Financeira'; Sigla='IF'
    Apelidos=@('if','inteligencia financeira')
    De='R$ 3.596,40'; Vista='R$ 2.997,00'; Doze='R$ 299,70'
    Recicla='R$ 1.798,20'; ReciclaDoze='R$ 149,85'
    Campanha='IF - NOVOS ALUNOS - BRL'; CampanhaRec='IF - RECICLAGEM - BRL'
    Vigencia='Até 31/12/2027'; Split=''
    Grade=@(
      'R$ 2.997,00|R$ 2.997,00','R$ 3.129,03|R$ 1.564,52','R$ 3.173,89|R$ 1.057,96',
      'R$ 3.219,16|R$ 804,79','R$ 3.264,85|R$ 652,97','R$ 3.310,97|R$ 551,83',
      'R$ 3.357,50|R$ 479,64','R$ 3.404,45|R$ 425,56','R$ 3.451,82|R$ 383,54',
      'R$ 3.499,61|R$ 349,96','R$ 3.547,81|R$ 322,53','R$ 3.596,40|R$ 299,70')
  },
  @{
    Nome='Planejador Estratégico na Prática'; Sigla='PE'
    Apelidos=@('pe','planejador estrategico','planejamento estrategico')
    De='R$ 13.753,02'; Vista='R$ 9.164,09'; Doze='R$ 916,42'
    Recicla=''; ReciclaDoze=''
    Campanha='PE - NOVOS ALUNOS - BRL'; CampanhaRec=''
    Vigencia='20/01/2026 a 20/12/2026'; Split=''
    Grade=@(
      'R$ 9.164,09|R$ 9.164,09','R$ 9.567,82|R$ 4.783,91','R$ 9.704,97|R$ 3.234,99',
      'R$ 9.843,40|R$ 2.460,85','R$ 9.983,12|R$ 1.996,62','R$ 10.124,12|R$ 1.687,35',
      'R$ 10.266,41|R$ 1.466,63','R$ 10.409,97|R$ 1.301,25','R$ 10.554,81|R$ 1.172,76',
      'R$ 10.700,94|R$ 1.070,09','R$ 10.848,33|R$ 986,21','R$ 10.997,01|R$ 916,42')
  },
  @{
    Nome='Growth'; Sigla='GV'
    Apelidos=@('gv','growth')
    De='R$ 8.750,58'; Vista='R$ 5.830,80'; Doze='R$ 583,09'
    Recicla=''; ReciclaDoze=''
    Campanha='GV - NOVOS ALUNOS - BRL'; CampanhaRec=''
    Vigencia='20/01/2026 a 20/12/2026'; Split=''
    Grade=@(
      'R$ 5.830,80|R$ 5.830,80','R$ 6.087,68|R$ 3.043,84','R$ 6.174,94|R$ 2.058,31',
      'R$ 6.263,02|R$ 1.565,76','R$ 6.351,92|R$ 1.270,38','R$ 6.441,63|R$ 1.073,61',
      'R$ 6.532,17|R$ 933,17','R$ 6.623,51|R$ 827,94','R$ 6.715,67|R$ 746,19',
      'R$ 6.808,64|R$ 680,86','R$ 6.902,43|R$ 627,49','R$ 6.997,02|R$ 583,09')
  },
  @{
    Nome='Formação em Planejador Financeiro'; Sigla='FPF'
    Apelidos=@('fpf','planejador financeiro')
    De='R$ 5.998,50'; Vista='R$ 3.997,00'; Doze='R$ 399,70'
    Recicla=''; ReciclaDoze=''
    Campanha='FPF - NOVOS ALUNOS - BRL'; CampanhaRec=''
    Vigencia='20/01/2026 a 20/12/2026'; Split='1x a 6x = Vertuz 20% · 7x a 12x = Franquia 80%'
    Grade=@(
      'R$ 3.997,00|R$ 3.997,00','R$ 4.173,09|R$ 2.086,54','R$ 4.232,91|R$ 1.410,97',
      'R$ 4.293,29|R$ 1.073,32','R$ 4.354,22|R$ 870,84','R$ 4.415,72|R$ 735,95',
      'R$ 4.477,78|R$ 639,68','R$ 4.540,40|R$ 567,55','R$ 4.603,57|R$ 511,51',
      'R$ 4.667,31|R$ 466,73','R$ 4.731,60|R$ 430,15','R$ 4.796,44|R$ 399,70')
  },
  @{
    Nome='Técnica de Vendas'; Sigla='TV'
    Apelidos=@('tv','tecnica de vendas','tav')
    De='R$ 2.997,00'; Vista='R$ 1.997,00'; Doze='R$ 199,70'
    Recicla=''; ReciclaDoze=''
    Campanha='TV - NOVOS ALUNOS - 2025 - BRL'; CampanhaRec=''
    Vigencia='Até 31/12/2026'; Split=''
    Grade=@(
      'R$ 1.997,00|R$ 1.997,00','R$ 2.084,98|R$ 1.042,49','R$ 2.114,87|R$ 704,96',
      'R$ 2.145,03|R$ 536,26','R$ 2.175,48|R$ 435,10','R$ 2.206,21|R$ 367,70',
      'R$ 2.237,21|R$ 319,60','R$ 2.268,50|R$ 283,56','R$ 2.300,06|R$ 255,56',
      'R$ 2.331,90|R$ 233,19','R$ 2.364,02|R$ 214,91','R$ 2.396,42|R$ 199,70')
  }
)

# ---------- helpers ----------
function Norm([string]$s) {
  if ($null -eq $s) { return '' }
  $t = $s.Normalize([Text.NormalizationForm]::FormD)
  $sb = New-Object Text.StringBuilder
  foreach ($ch in $t.ToCharArray()) {
    if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch) -ne [Globalization.UnicodeCategory]::NonSpacingMark) { [void]$sb.Append($ch) }
  }
  ($sb.ToString() -replace '\s+',' ').Trim().ToLowerInvariant()
}

# ---------- modo JSON ----------
if ($Json) {
  $cursosJson = @()
  foreach ($c in $PRECOS) {
    $g = @()
    for ($n = 0; $n -lt 12; $n++) {
      $par = $c.Grade[$n] -split '\|'
      $g += [ordered]@{ n=($n+1); desc=$DESCONTOS[$n]; total=$par[0]; parcela=$par[1] }
    }
    $cursosJson += [ordered]@{
      sigla=$c.Sigla; nome=$c.Nome; de=$c.De; vista=$c.Vista; doze=$c.Doze
      totalDoze=($c.Grade[11] -split '\|')[0]
      recicla=$c.Recicla; reciclaDoze=$c.ReciclaDoze
      campanha=$c.Campanha; campanhaRec=$c.CampanhaRec; vigencia=$c.Vigencia; split=$c.Split
      grade=$g
    }
  }
  $objJson = [ordered]@{
    extracao   = $EXTRACAO
    planilha   = $PLANILHA
    taxaCispay = $TAXA_CISPAY
    descontos  = $DESCONTOS
    cursos     = $cursosJson
  }
  Write-Output ($objJson | ConvertTo-Json -Depth 8 -Compress)
  exit 0
}

$linhas = New-Object System.Collections.Generic.List[string]

# ---------- grade de um curso ----------
if ($Curso -ne '') {
  $alvo = Norm $Curso
  # 1) sigla exata
  $achados = @($PRECOS | Where-Object { (Norm $_.Sigla) -eq $alvo })
  # 2) pedaco do nome ou de um apelido
  if ($achados.Count -eq 0) {
    $achados = @($PRECOS | Where-Object {
      $n = Norm $_.Nome
      $bate = $n.Contains($alvo)
      if (-not $bate) { foreach ($a in $_.Apelidos) { if ((Norm $a).Contains($alvo)) { $bate = $true; break } } }
      $bate
    })
  }

  if ($achados.Count -eq 0) {
    $linhas.Add('# TABELA DE PREÇOS')
    $linhas.Add('')
    $linhas.Add("**Não achei treinamento com ``$Curso``.** Os 11 disponíveis:")
    $linhas.Add('')
    foreach ($c in $PRECOS) { $linhas.Add("- **$($c.Sigla)** — $($c.Nome)") }
    $linhas.Add('')
    $linhas.Add('_Sem curso, o comando mostra a tabela consolidada._')
    Write-Output ($linhas -join "`r`n")
    exit 0
  }

  if ($achados.Count -gt 1) {
    $linhas.Add('# TABELA DE PREÇOS')
    $linhas.Add('')
    $linhas.Add("**``$Curso`` casa com $($achados.Count) treinamentos.** Diga qual:")
    $linhas.Add('')
    foreach ($c in $achados) { $linhas.Add("- **$($c.Sigla)** — $($c.Nome)") }
    Write-Output ($linhas -join "`r`n")
    exit 0
  }

  $c = $achados[0]
  $linhas.Add("# $($c.Nome) ($($c.Sigla)) — GRADE DE PARCELAS")
  $linhas.Add('')
  $linhas.Add("**Valor de tabela:** $($c.De) · **À vista:** $($c.Vista) · **12x de** $($c.Doze)")
  $linhas.Add('')
  $linhas.Add("Campanha **$($c.Campanha)** · Turmas: Franquias · Vigência: **$($c.Vigencia)**")
  $linhas.Add('')
  $linhas.Add('| Parcelas | Desconto | Total | Valor da parcela |')
  $linhas.Add('|:--|:--|:--|:--|')
  for ($n = 0; $n -lt 12; $n++) {
    $par = $c.Grade[$n] -split '\|'
    $linhas.Add("| **$($n+1)x** | $($DESCONTOS[$n]) | $($par[0]) | $($par[1]) |")
  }
  $linhas.Add('')
  if ($c.Recicla -ne '') {
    $linhas.Add('## Reciclagem (aluno que já fez)')
    $linhas.Add('')
    $linhas.Add("**$($c.Recicla)** (50% do valor de tabela) em até **12x de $($c.ReciclaDoze)** · campanha **$($c.CampanhaRec)**")
  } else {
    $linhas.Add("_$($c.Sigla) não tem condição de reciclagem na planilha._")
  }
  $linhas.Add('')
  if ($c.Split -ne '') { $linhas.Add("**SPLIT:** $($c.Split)"); $linhas.Add('') }
  $linhas.Add("_Taxa CISPay $TAXA_CISPAY · valores da planilha da rede, extração de $EXTRACAO._")
  Write-Output ($linhas -join "`r`n")
  exit 0
}

# ---------- consolidado ----------
$linhas.Add('# TABELA DE PREÇOS — TREINAMENTOS')
$linhas.Add('')
$linhas.Add("**11 treinamentos** · valores da planilha da rede, extração de **$EXTRACAO** · taxa CISPay $TAXA_CISPAY")
$linhas.Add('')
$linhas.Add('## Condição NOVOS ALUNOS')
$linhas.Add('')
$linhas.Add('| # | Treinamento | Sigla | De | À vista | 12x | Total em 12x | Vigência |')
$linhas.Add('|:--|:--|:--|:--|:--|:--|:--|:--|')
$i = 0
foreach ($c in $PRECOS) {
  $i++
  $totalDoze = ($c.Grade[11] -split '\|')[0]
  $linhas.Add("| $i | $($c.Nome) | **$($c.Sigla)** | $($c.De) | **$($c.Vista)** | $($c.Doze) | $totalDoze | $($c.Vigencia) |")
}
$linhas.Add('')
$linhas.Add('## Condição RECICLAGEM (50% do valor de tabela)')
$linhas.Add('')
$linhas.Add('| Treinamento | Sigla | De | Por | 12x | Campanha |')
$linhas.Add('|:--|:--|:--|:--|:--|:--|')
$semRec = @()
foreach ($c in $PRECOS) {
  if ($c.Recicla -ne '') {
    $linhas.Add("| $($c.Nome) | **$($c.Sigla)** | $($c.De) | **$($c.Recicla)** | $($c.ReciclaDoze) | $($c.CampanhaRec) |")
  } else {
    $semRec += $c.Sigla
  }
}
$linhas.Add('')
$linhas.Add("**Sem reciclagem na planilha:** $($semRec -join ' · ')")
$linhas.Add('')
$linhas.Add('## Notas')
$linhas.Add('')
$linhas.Add('- **Grade completa de um treinamento** (1x a 12x): `Tabela de Preços <sigla>` — ex.: `Tabela de Preços BHP`.')
$linhas.Add("- **Desconto por parcela** (igual em todos): 1x = $($DESCONTOS[0]) · 2x = $($DESCONTOS[1]) · 3x = $($DESCONTOS[2]) · 4x = $($DESCONTOS[3]) · 5x = $($DESCONTOS[4]) · 6x = $($DESCONTOS[5]) · 7x = $($DESCONTOS[6]) · 8x = $($DESCONTOS[7]) · 9x = $($DESCONTOS[8]) · 10x = $($DESCONTOS[9]) · 11x = $($DESCONTOS[10]) · 12x = $($DESCONTOS[11]). Menos parcelas, mais desconto.")
$linhas.Add('- **SPLIT (só FPF):** 1x a 6x = Vertuz 20% · 7x a 12x = Franquia 80%.')
$linhas.Add('- **BHP reciclagem:** a planilha traz R$ 499,70 na coluna 12x, que é a parcela do valor cheio e não fecha com o "Por" de R$ 2.998,23. Aqui vale **R$ 249,85** (= Por ÷ 12), padrão dos outros seis.')
$linhas.Add('- **PE e Growth:** a caixa de oferta desses blocos repete "12x R$ 399,70 / à vista R$ 1.997,00" (valores do FPF). Esta tabela usa a grade, que fecha as contas.')
$linhas.Add('- Turmas: **Franquias** nos 11.')
$linhas.Add('')
$linhas.Add("_Planilha de origem: $($PLANILHA)_")
$linhas.Add('')
$linhas.Add('_Preço mudou? A tabela é fixa neste script (`Tabela-Precos.ps1`, bloco `$PRECOS`) — edição manual._')

Write-Output ($linhas -join "`r`n")
