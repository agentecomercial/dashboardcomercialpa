# Ponte-SF.ps1
# Camada de LEITURA do Salesforce (Grupo FRZ) para o comando "SF x SC" do Meta Master.
# ESTE SCRIPT NUNCA ESCREVE NO SALESFORCE: so SELECT (SOQL) via REST. Nao existe acao de escrita aqui.
#
# USO:
#   .\Ponte-SF.ps1 -Acao consultaCpf -Cpf 16929941743
#   .\Ponte-SF.ps1 -Acao status
#
# Credenciais: %LOCALAPPDATA%\MetaMaster\sf-creds.xml (cifrado por DPAPI) -> grave com Configurar-SF.ps1.
# Sessao:      %LOCALAPPDATA%\MetaMaster\sf-session.json (cache). Nao confia em validade/timestamp:
#              tenta com o que tem, e se vier HTTP 401 faz o relogin e repete a chamada UMA vez.
# Saida: JSON puro (o Servir.ps1 recorta do primeiro { ao ultimo }).
# IMPORTANTE: salvar com BOM UTF-8.
param(
  [ValidateSet('consultaCpf','consultaNome','credenciamentos','status')][string]$Acao = 'consultaCpf',
  [string]$Cpf = '',
  [string]$Nome = '',
  [string]$CpfsFile = '',   # credenciamentos em lote: 1 CPF por linha (turma inteira)
  [string]$Curso = '',      # curso alvo; vazio = detecta o mais frequente na lista
  [string]$TurmaAtual = ''  # trecho do nome da turma no SF (ex.: CIS-GL251): separa a inscricao atual do historico
)
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$API   = '59.0'
$dir   = Join-Path $env:LOCALAPPDATA 'MetaMaster'
$fCred = Join-Path $dir 'sf-creds.xml'
$fSess = Join-Path $dir 'sf-session.json'

function Out-Json($o){ $o | ConvertTo-Json -Depth 10 -Compress; exit 0 }
function Fail($msg, $extra){
  $o = [ordered]@{ ok=$false; erro="$msg" }
  if ($extra) { foreach($k in $extra.Keys){ $o[$k] = $extra[$k] } }
  $o | ConvertTo-Json -Depth 6 -Compress
  exit 1
}
function OnlyDigits($s){ ("$s" -replace '\D','') }
function FmtCpf($d){ $d=OnlyDigits $d; if($d.Length -eq 11){ '{0}.{1}.{2}-{3}' -f $d.Substring(0,3),$d.Substring(3,3),$d.Substring(6,3),$d.Substring(9,2) } else { $d } }
function FmtTel($p){
  $d = OnlyDigits $p
  if ($d.StartsWith('55') -and $d.Length -ge 12) { $ddd=$d.Substring(2,2); $r=$d.Substring(4) }
  elseif ($d.Length -ge 10) { $ddd=$d.Substring(0,2); $r=$d.Substring(2) }
  else { return $d }
  if ($r.Length -eq 9) { "($ddd) {0}-{1}" -f $r.Substring(0,5),$r.Substring(5) }
  elseif ($r.Length -eq 8) { "($ddd) {0}-{1}" -f $r.Substring(0,4),$r.Substring(4) }
  else { "($ddd) $r" }
}
function CpfValido($cpf){
  $cpf = OnlyDigits $cpf
  if ($cpf.Length -ne 11) { return $false }
  if ($cpf -match '^(\d)\1{10}$') { return $false }
  $s=0; for($i=0;$i -lt 9;$i++){ $s += [int][string]$cpf[$i]*(10-$i) }; $d1=11-($s%11); if($d1 -ge 10){$d1=0}
  if ($d1 -ne [int][string]$cpf[9]) { return $false }
  $s=0; for($i=0;$i -lt 10;$i++){ $s += [int][string]$cpf[$i]*(11-$i) }; $d2=11-($s%11); if($d2 -ge 10){$d2=0}
  return ($d2 -eq [int][string]$cpf[10])
}
function SoqlEsc($s){ ("$s" -replace "\\","\\\\") -replace "'","\'" }
function DataBr($iso){ if(-not $iso){ return '' }; try { ([datetime]$iso).ToString('dd/MM/yyyy') } catch { "$iso" } }

# ---------------- sessao ----------------
$script:sess = $null
function Ler-Sessao {
  if (Test-Path $fSess) { try { return (Get-Content -Raw $fSess | ConvertFrom-Json) } catch { return $null } }
  return $null
}
function Login-SF {
  if (-not (Test-Path $fCred)) {
    Fail 'Credenciais do Salesforce nao configuradas neste PC.' @{ precisa_configurar=$true; como="Rode uma vez: powershell -ExecutionPolicy Bypass -File `"$PSScriptRoot\Configurar-SF.ps1`"" }
  }
  $cred = Import-Clixml $fCred
  $user = $cred.UserName
  $pass = $cred.GetNetworkCredential().Password    # ja e senha+token concatenados
  function XmlEsc($s){ $s -replace '&','&amp;' -replace '<','&lt;' -replace '>','&gt;' -replace '"','&quot;' }
  $body = @"
<?xml version="1.0" encoding="utf-8"?>
<env:Envelope xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:env="http://schemas.xmlsoap.org/soap/envelope/">
  <env:Body>
    <n1:login xmlns:n1="urn:partner.soap.sforce.com">
      <n1:username>$(XmlEsc $user)</n1:username>
      <n1:password>$(XmlEsc $pass)</n1:password>
    </n1:login>
  </env:Body>
</env:Envelope>
"@
  try {
    # Uma linha so: o backtick estava seguido de texto (` -ErrorAction Stop), entao NAO continuava
    # a linha -- o -ContentType virava comando inexistente e todo relogin caia no catch.
    $r = Invoke-WebRequest -Uri "https://login.salesforce.com/services/Soap/u/$API" -Method Post -Body $body -ContentType 'text/xml; charset=UTF-8' -Headers @{ SOAPAction='login' } -UseBasicParsing -ErrorAction Stop -TimeoutSec 60
    $xml = [xml]$r.Content
    $res = $xml.Envelope.Body.loginResponse.result
    if (-not $res.sessionId) { throw 'resposta sem sessionId' }
  } catch {
    Fail "Sessao do Salesforce: relogin falhou. $($_.Exception.Message)" @{ relogin_falhou=$true }
  }
  $script:sess = [pscustomobject]@{ serverUrl=$res.serverUrl; sessionId=$res.sessionId; usuario=$res.userInfo.userName }
  @{ serverUrl=$res.serverUrl; sessionId=$res.sessionId; usuario=$res.userInfo.userName } | ConvertTo-Json | Set-Content $fSess -Encoding UTF8
  return $script:sess
}
function Sessao {
  if ($script:sess) { return $script:sess }
  $s = Ler-Sessao
  if ($s -and $s.sessionId -and $s.serverUrl) { $script:sess = $s; return $s }
  return (Login-SF)
}
function Soql($q) {
  $s = Sessao
  $inst = ([Uri]$s.serverUrl).GetLeftPart([UriPartial]::Authority)
  $uri  = "$inst/services/data/v$API/query?q=" + [Uri]::EscapeDataString($q)
  $hdr  = @{ Authorization = "Bearer $($s.sessionId)"; Accept = 'application/json' }
  try {
    return (Invoke-RestMethod -Uri $uri -Headers $hdr -Method Get -TimeoutSec 60 -ErrorAction Stop)
  } catch {
    $code = 0; try { $code = [int]$_.Exception.Response.StatusCode.value__ } catch {}
    # 401 = INVALID_SESSION_ID. 403 = "Bad_OAuth_Token" (sessao expirada em /services/oauth2/userinfo).
    if ($code -ne 401 -and $code -ne 403) { Fail "Consulta ao Salesforce falhou (HTTP $code): $($_.Exception.Message)" }
    # sessao morta -> relogin e UMA nova tentativa
    $s = Login-SF
    $inst = ([Uri]$s.serverUrl).GetLeftPart([UriPartial]::Authority)
    $uri  = "$inst/services/data/v$API/query?q=" + [Uri]::EscapeDataString($q)
    $hdr  = @{ Authorization = "Bearer $($s.sessionId)"; Accept = 'application/json' }
    try { return (Invoke-RestMethod -Uri $uri -Headers $hdr -Method Get -TimeoutSec 60 -ErrorAction Stop) }
    catch { Fail "Consulta ao Salesforce falhou mesmo apos relogin: $($_.Exception.Message)" }
  }
}

# Soql-All: mesma consulta, seguindo o nextRecordsUrl ate acabar. O SF devolve no maximo 2000
# registros por pagina - a turma inteira (ate 200 CPFs x historico) estoura isso com facilidade.
function Soql-All($q) {
  $r = Soql $q
  $recs = @($r.records)
  $guard = 0
  while ($r -and -not $r.done -and $r.nextRecordsUrl -and $guard -lt 30) {
    $guard++
    $s    = Sessao
    $inst = ([Uri]$s.serverUrl).GetLeftPart([UriPartial]::Authority)
    $hdr  = @{ Authorization = "Bearer $($s.sessionId)"; Accept = 'application/json' }
    try { $r = Invoke-RestMethod -Uri ($inst + $r.nextRecordsUrl) -Headers $hdr -Method Get -TimeoutSec 60 -ErrorAction Stop }
    catch { break }
    $recs += @($r.records)
  }
  return ,$recs
}

# ---- GRADE GGB (Green Belt / Golden Belt) ----
# 10 treinamentos contam para a grade. A sigla vem do NOME DA TURMA (ex.: "2025 - CEOP16"),
# porque no SF o CEOP e o FOP usam o MESMO curso ("Formacao de Oradores...") e so a turma separa.
# Fallback: nome do curso, quando a turma nao identifica.
# Apelidos que caem no MESMO treinamento da grade (grade = 9 itens distintos):
#   CEOP  <- tambem conta FOP  (no SF os dois ja usam o curso "Formacao de Oradores...")
#   FGPC  <- tambem contam FPCH (sigla antiga) e CIS ASSESSMENT
$GRADE = @('FCIS','IF','TV','BHP','ML5','FGPC','CIS','MASTER','CEOP')
# ordem importa: FCIS antes de CIS; CIS-FAM (CIS Familia) e KIT/PITCH NAO entram na grade
$GRADE_TURMA = @(
  @{ re = '^FCIS';            sigla = 'FCIS'   },
  @{ re = '^CIS-FAM';         sigla = ''       },   # CIS Familia: fora da grade
  @{ re = '^(CIS-GL|CIS)\d';  sigla = 'CIS'    },
  @{ re = '^CIS-GL';          sigla = 'CIS'    },
  @{ re = '^IF\d';            sigla = 'IF'     },
  @{ re = '^(TAV|TV)\b|^(TAV|TV)\d|^(TAV|TV)\s'; sigla = 'TV' },
  @{ re = '^BHP';             sigla = 'BHP'    },
  @{ re = '^ML5';             sigla = 'ML5'    },
  @{ re = '^(FGPC|FPCH)';     sigla = 'FGPC'   },   # FPCH e a sigla antiga da mesma formacao
  @{ re = '^MASTER';          sigla = 'MASTER' },
  @{ re = '^(CEOP|FOP)';      sigla = 'CEOP'   }    # FOP conta como CEOP
)
$GRADE_CURSO = @(
  @{ re = 'N(A|Ã)O UTILIZAR';                             sigla = ''       },   # curso descontinuado: fora
  @{ re = 'FORMA(C|Ç)(A|Ã)O INTER';                       sigla = 'FCIS'   },
  @{ re = 'INTELIG(E|Ê)NCIA FINANCEIRA';                  sigla = 'IF'     },
  @{ re = 'T(E|É)CNICAS (DE|AVAN)';                       sigla = 'TV'     },
  @{ re = 'BUSINESS HIGH PERFORMANCE';                    sigla = 'BHP'    },
  @{ re = 'ML5';                                          sigla = 'ML5'    },
  # FGPC engloba a formacao (nome atual e o antigo FPCH) e o CIS ASSESSMENT
  @{ re = 'PERFORMANCE E COMPORTAMENTO HUMANO';           sigla = 'FGPC'   },
  @{ re = 'PERFIL COMPORTAMENTAL';                        sigla = 'FGPC'   },
  @{ re = 'CIS ASSESSMENT';                               sigla = 'FGPC'   },
  @{ re = 'M(E|É)TODO CIS( GLOBAL)? - INTELIG';           sigla = 'CIS'    },
  @{ re = 'MASTER COACHING';                              sigla = 'MASTER' },
  @{ re = 'ORADORES E PALESTRANTES';                      sigla = 'CEOP'   }
)
function Sigla-Grade($turma, $cursoTxt) {
  $t = ("$turma" -replace '^\s*\S+\s*-\s*','').Trim()     # tira o "2025 - " da frente
  foreach ($g in $GRADE_TURMA) { if ($t -match $g.re) { return $g.sigla } }
  foreach ($g in $GRADE_CURSO) { if ("$cursoTxt" -match $g.re) { return $g.sigla } }
  return ''
}
# MAESTRIA (mastermind premium) NAO faz parte da grade GGB: e um produto exclusivo, contado a parte.
# Quem participou dele e "Maestro" - reconhecimento proprio, independente da quantidade da grade.
function E-Maestria($turma, $cursoTxt) {
  $t = ("$turma" -replace '^\s*\S+\s*-\s*','').Trim()
  return (($t -match '(?i)^MAESTR') -or ("$cursoTxt" -match '(?i)MAESTRIA'))
}
function Belt-De($n) { if ($n -ge 8) { 'GOLDEN' } elseif ($n -ge 5) { 'GREEN' } else { '' } }
function Belt-Label($b) { switch ("$b") { 'GOLDEN' { 'GOLDEN BELT' } 'GREEN' { 'GREEN BELT' } default { 'Aluno comum' } } }

# ---------------- acoes ----------------
if ($Acao -eq 'status') {
  $temCred = Test-Path $fCred
  if (-not $temCred) { Out-Json ([ordered]@{ ok=$true; configurado=$false; msg='Credenciais do Salesforce nao configuradas neste PC.' }) }
  $s = Sessao
  $r = Soql "SELECT Id FROM Account LIMIT 1"
  Out-Json ([ordered]@{ ok=$true; configurado=$true; usuario=$s.usuario; conectado=$true })
}

# --- credenciamentos: o aluno JA PARTICIPOU do treinamento? ---
# Regra (validada com a turma CIS-GL249): cada matricula gera um registro em Credenciamento__c.
# O cracha so e impresso no credenciamento presencial, entao N_de_impressoes__c > 0 = COMPARECEU.
# Zero = matriculado que nao compareceu (ou turma que ainda nao aconteceu).
if ($Acao -eq 'credenciamentos') {
  $cpfs = @()
  if ($CpfsFile -and (Test-Path $CpfsFile)) {
    foreach ($ln in (Get-Content -Encoding UTF8 $CpfsFile)) { $d = OnlyDigits $ln; if ($d.Length -eq 11) { $cpfs += $d } }
  } elseif ($Cpf) {
    $d = OnlyDigits $Cpf; if ($d.Length -eq 11) { $cpfs += $d }
  }
  $cpfs = @($cpfs | Select-Object -Unique)
  if ($cpfs.Count -eq 0) { Fail 'Informe ao menos um CPF valido (11 digitos).' }
  if ($cpfs.Count -gt 200) { $cpfs = @($cpfs | Select-Object -First 200) }   # teto de tamanho da SOQL

  # o SF guarda o CPF formatado em CPF_do_Cliente__c e (as vezes) so digitos em CPF__c
  $listaFmt = ($cpfs | ForEach-Object { "'" + (SoqlEsc (FmtCpf $_)) + "'" }) -join ','
  $listaDig = ($cpfs | ForEach-Object { "'" + (SoqlEsc $_) + "'" }) -join ','
  $q = "SELECT CPF_do_Cliente__c, CPF__c, Name, Curso__r.Name, Turma__r.Name, N_de_impressoes__c, Tipo_de_Matricula__c, CreatedDate " +
       "FROM Credenciamento__c WHERE CPF_do_Cliente__c IN ($listaFmt) OR CPF__c IN ($listaDig) ORDER BY CreatedDate DESC"
  # sem @() aqui: Soql-All devolve ,$array e o @() re-embrulharia tudo num unico elemento
  # (com 1 CPF passava despercebido; com 2+ o foreach via UM item que era o array inteiro)
  $regsSF = Soql-All $q

  $porCpf = @{}; $cursoCont = @{}
  foreach ($c in $cpfs) { $porCpf[$c] = @{ cpf=$c; cpf_fmt=(FmtCpf $c); registros=@() } }
  foreach ($rec in $regsSF) {
    $dig = OnlyDigits $(if ($rec.CPF_do_Cliente__c) { $rec.CPF_do_Cliente__c } else { $rec.CPF__c })
    if (-not $porCpf.ContainsKey($dig)) { continue }
    $imp = [double]$(if ($null -ne $rec.N_de_impressoes__c) { $rec.N_de_impressoes__c } else { 0 })
    # NAO usar $curso aqui: colide com o parametro -Curso (PowerShell e case-insensitive) e
    # sobrescreveria o alvo informado/detectado. Bug ja visto antes no projeto.
    $cursoNome = $(if ($rec.Curso__r) { [string]$rec.Curso__r.Name } else { '' })
    $turmaNome = $(if ($rec.Turma__r) { [string]$rec.Turma__r.Name } else { '' })
    $porCpf[$dig].registros += [ordered]@{
      curso      = $cursoNome
      turma      = $turmaNome
      impressoes = $imp
      participou = ($imp -gt 0)
      grade      = (Sigla-Grade $turmaNome $cursoNome)   # sigla da grade GGB ('' = fora da grade)
      maestria   = (E-Maestria  $turmaNome $cursoNome)
      tipo       = [string]$rec.Tipo_de_Matricula__c
      criado     = (DataBr $rec.CreatedDate)
    }
    if ($cursoNome) { if ($cursoCont.ContainsKey($cursoNome)) { $cursoCont[$cursoNome]++ } else { $cursoCont[$cursoNome] = 1 } }
  }

  # curso alvo = o informado, senao o mais frequente na lista (na pratica, o treinamento da turma)
  $alvo = $Curso
  if (-not $alvo -and $cursoCont.Count -gt 0) {
    $maiorN = -1
    foreach ($k in $cursoCont.Keys) { if ([int]$cursoCont[$k] -gt $maiorN) { $maiorN = [int]$cursoCont[$k]; $alvo = $k } }
  }
  $alvoN = ("$alvo").ToLower()

  $tAtual = ("$TurmaAtual").ToLower().Trim()
  $saida = @(); $jaFez = 0; $naoFoi = 0; $primeira = 0; $semReg = 0
  $nGreen = 0; $nGolden = 0; $nMaestro = 0; $porQtd = @{}
  foreach ($c in $cpfs) {
    $regs = @($porCpf[$c].registros)
    $doAlvo = @($regs | Where-Object { $alvoN -and ("$($_.curso)").ToLower() -eq $alvoN })
    # separa a inscricao NESTA turma (nao conta como falta) do historico anterior
    $atual  = @($doAlvo | Where-Object { $tAtual -and ("$($_.turma)").ToLower().Contains($tAtual) })
    $antes  = @($doAlvo | Where-Object { -not ($tAtual -and ("$($_.turma)").ToLower().Contains($tAtual)) })
    $vezes  = @($antes  | Where-Object { $_.participou })
    $faltou = @($antes  | Where-Object { -not $_.participou })
    $outros = @($regs   | Where-Object { $_.participou -and ("$($_.curso)").ToLower() -ne $alvoN })
    $situacao = if ($vezes.Count -gt 0)      { 'ja_fez' }          # participou do treinamento antes
                elseif ($faltou.Count -gt 0) { 'nao_compareceu' }  # matriculou em turma anterior e nao foi
                elseif ($regs.Count -gt 0)   { 'primeira_vez' }
                else                         { 'sem_registro' }
    switch ($situacao) { 'ja_fez' { $jaFez++ } 'nao_compareceu' { $naoFoi++ } 'sem_registro' { $semReg++ } default { $primeira++ } }

    # ---- FAIXA GGB do aluno ----
    # So conta treinamento da grade JA REALIZADO (cracha impresso). Repetido nao conta 2x:
    # a contagem e de SIGLAS DISTINTAS (Select-Object -Unique).
    # OBS: no lote a evidencia e so o cracha (N_de_impressoes__c). A ficha individual (aba SF x ZS)
    # ainda olha Presenca__c, que e mais fina - por isso ela pode achar 1 a mais em casos raros.
    $feitosG = @($regs | Where-Object { $_.participou -and $_.grade } | ForEach-Object { $_.grade } | Select-Object -Unique)
    $nG      = $feitosG.Count
    $beltG   = Belt-De $nG
    # MAESTRIA e mentoria anual, nao evento: 89% dos credenciamentos nao tem cracha impresso.
    # Por isso aqui a MATRICULA no SF ja vale como Maestro; o cracha vira so um selo de confirmacao.
    $regMaes = @($regs | Where-Object { $_.maestria })
    $maesFez = @($regMaes | Where-Object { $_.participou })
    if ($beltG -eq 'GOLDEN') { $nGolden++ } elseif ($beltG -eq 'GREEN') { $nGreen++ }
    if ($regMaes.Count -gt 0) { $nMaestro++ }
    if ($porQtd.ContainsKey($nG)) { $porQtd[$nG]++ } else { $porQtd[$nG] = 1 }

    $saida += [ordered]@{
      cpf=$c; cpf_fmt=(FmtCpf $c)
      situacao=$situacao
      ggb_qtd=$nG
      ggb_feitos=$feitosG
      ggb_falta=@($GRADE | Where-Object { $feitosG -notcontains $_ })
      belt=$beltG
      belt_label=(Belt-Label $beltG)
      falta_para_green=[Math]::Max(0, 5 - $nG)
      falta_para_golden=[Math]::Max(0, 8 - $nG)
      maestro=($regMaes.Count -gt 0)                       # matricula no MAESTRIA ja conta
      maestro_confirmado=($maesFez.Count -gt 0)            # + cracha impresso (raro nesse produto)
      maestro_turma=$(if ($maesFez.Count) { [string]$maesFez[0].turma } elseif ($regMaes.Count) { [string]$regMaes[0].turma } else { '' })
      vezes_no_alvo=$vezes.Count
      ultima_participacao_alvo=$(if ($vezes.Count) { $vezes[0].turma } else { '' })
      turmas_anteriores_alvo=$antes.Count
      faltas_no_alvo=$faltou.Count
      inscrito_nesta_turma=($atual.Count -gt 0)
      participacoes_outros=$outros.Count
      cursos_participados=@($regs | Where-Object { $_.participou } | ForEach-Object { $_.curso } | Select-Object -Unique)
      registros=$regs
    }
  }
  Out-Json ([ordered]@{
    ok=$true; total=$cpfs.Count; curso_alvo=$alvo; turma_atual=$TurmaAtual
    cursos=@($cursoCont.GetEnumerator() | Sort-Object -Property Value -Descending | ForEach-Object { [ordered]@{ curso=$_.Key; matriculas=$_.Value } })
    resumo=[ordered]@{ ja_fez=$jaFez; nao_compareceu=$naoFoi; primeira_vez=$primeira; sem_registro=$semReg }
    ggb=[ordered]@{
      grade=$GRADE
      green=$nGreen; golden=$nGolden; maestro=$nMaestro
      por_qtd=@($porQtd.GetEnumerator() | Sort-Object -Property Name | ForEach-Object { [ordered]@{ qtd=[int]$_.Key; alunos=[int]$_.Value } })
    }
    alunos=$saida
  })
}

# --- consultaNome: usado pela aba Turmas quando o aluno esta SEM CPF no Sales Cube ---
# Nunca preenche sozinho: devolve os CANDIDATOS para o usuario escolher (homonimo e comum).
if ($Acao -eq 'consultaNome') {
  $nm = ("$Nome" -replace '\s+',' ').Trim()
  if ($nm.Length -lt 5) { Fail 'Informe um nome com pelo menos 5 caracteres.' }

  # PEGADINHA: o LIKE do SOQL NAO ignora acento. O Sales Cube guarda "ADALMARIO" e o SF
  # "Adalmário" -> buscar o nome inteiro nao acha. Por isso a busca usa apenas os pedacos
  # do nome SEM acento (sobrenomes), e a conferencia fina e feita aqui, sem acento.
  function SemAcento($s) {
    $n = ("$s").Normalize([Text.NormalizationForm]::FormD)
    $sb = New-Object Text.StringBuilder
    foreach ($c in $n.ToCharArray()) {
      if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($c) -ne [Globalization.UnicodeCategory]::NonSpacingMark) { [void]$sb.Append($c) }
    }
    return $sb.ToString()
  }
  function NormNome($s) { (SemAcento (("$s" -replace '\s+',' ').Trim())).ToLower() }

  # Truque: no LIKE do SOQL o "_" casa QUALQUER 1 caractere. Como o acento cai sempre em vogal,
  # trocar toda vogal por "_" faz "ADALMARIO" casar tambem com "Adalmário" (e vice-versa).
  # As consoantes seguram a precisao; combinadas 2 a 2, o resultado e bem especifico.
  function PadraoLike($t) { ($t -replace '[aeiouAEIOUÀ-ü]','_') }

  $stop = @('de','da','do','dos','das','e','di','du','del','jr','junior','filho','neto','sobrinho')
  $tokens = @(($nm -split '\s+') | Where-Object { $_ -and ($stop -notcontains $_.ToLower()) })
  # forca do token = quantas consoantes sobram depois de trocar as vogais por "_".
  # "JOAO" vira "J___" (forca 1) e casaria com meio mundo; "CARLOS" vira "C_RL_S" (forca 4).
  function Forca($t) { ($t -replace '[aeiouAEIOUÀ-ü_]','').Length }
  $porForca = @($tokens | Sort-Object { Forca $_ } -Descending)
  $tentativas = @()
  if ($tokens.Count -ge 2) {
    $tentativas += ,@($porForca[0], $porForca[1])                              # 1) os 2 mais especificos
    $tentativas += ,@($tokens[0], $tokens[$tokens.Count-1])                    # 2) primeiro + ultimo (SF pode omitir o do meio)
    $tentativas += ,@($porForca[0])                                            # 3) so o mais especifico (mais amplo)
  } else {
    $tentativas += ,@($tokens)
  }
  $alvoN = NormNome $nm
  # a tentativa so termina quando sobra CANDIDATO (a SOQL pode trazer 60 homonimos e nenhum servir)
  function Filtrar($recs) {
    $out = @()
    foreach ($a in $recs) {
      $nomeN = NormNome $a.Name
      $ok = ($nomeN -eq $alvoN) -or ($nomeN.Contains($alvoN)) -or ($alvoN.Contains($nomeN))
      if (-not $ok) {
        $todos = $true
        foreach ($t in $tokens) { if (-not $nomeN.Contains((NormNome $t))) { $todos = $false; break } }
        $ok = $todos
      }
      if (-not $ok -and $tokens.Count -ge 2) {
        # aceita quando o SF omite o nome do meio: basta primeiro nome + ultimo sobrenome
        $p = NormNome $tokens[0]; $u = NormNome $tokens[$tokens.Count-1]
        $ok = $nomeN.StartsWith($p) -and $nomeN.EndsWith($u)
      }
      if (-not $ok) { continue }
      $out += [ordered]@{
        id=$a.Id; nome=$a.Name
        cpf=(OnlyDigits $a.CPFun__c); cpf_fmt=(FmtCpf $a.CPFun__c)
        telefone_fmt=(FmtTel $a.PersonMobilePhone); email=$a.PersonEmail
        nascimento_fmt=(DataBr $a.Data_de_Nascimento__c)
        cidade=$a.Cidade__c; uf=$a.Estado__c
        tem_cpf=([bool](OnlyDigits $a.CPFun__c))
        exato=($nomeN -eq $alvoN)
      }
    }
    return $out
  }

  $cands = @(); $filtros = @()
  foreach ($tt in $tentativas) {
    $filtros = @($tt | Where-Object { $_ } | Select-Object -Unique)
    if ($filtros.Count -eq 0) { continue }
    if ((@($filtros | Where-Object { (Forca $_) -ge 2 })).Count -eq 0) { continue }   # padrao fraco demais
    $where = ($filtros | ForEach-Object { "Name LIKE '%$(SoqlEsc (PadraoLike $_))%'" }) -join ' AND '
    $q = "SELECT Id, Name, CPFun__c, PersonEmail, PersonMobilePhone, Data_de_Nascimento__c, Cidade__c, Estado__c, CreatedDate " +
         "FROM Account WHERE $where ORDER BY CreatedDate DESC LIMIT 60"
    $r = Soql $q
    if (-not $r.records -or $r.records.Count -eq 0) { continue }
    $cands = @(Filtrar $r.records)
    if ($cands.Count -gt 0) { break }
  }
  # com CPF primeiro, e o nome exato na frente
  $cands = @($cands | Sort-Object @{Expression={ -not $_.exato }}, @{Expression={ -not $_.tem_cpf }})
  if ($cands.Count -gt 10) { $cands = @($cands | Select-Object -First 10) }
  Out-Json ([ordered]@{ ok=$true; achou=($cands.Count -gt 0); nome=$nm; busca=($filtros -join ' + '); total=$cands.Count; candidatos=$cands })
}

# --- consultaCpf ---
$dig = OnlyDigits $Cpf
if ($dig.Length -ne 11) { Fail 'Informe um CPF com 11 digitos.' }
if (-not (CpfValido $dig)) { Fail "CPF invalido (digito verificador nao confere): $(FmtCpf $dig)" }

$acc = Soql "SELECT Id, Name, CPFun__c, PersonEmail, PersonMobilePhone, NumeroCompleto__c, Data_de_Nascimento__c, CEP__c, Endereco__c, Numero__c, Complemento__c, Bairro__c, Cidade__c, Estado__c, Cargo__c, CreatedDate FROM Account WHERE CPFun__c = '$(SoqlEsc $dig)' LIMIT 5"
if (-not $acc.records -or $acc.records.Count -eq 0) {
  Out-Json ([ordered]@{ ok=$true; achou=$false; cpf=$dig; cpf_fmt=(FmtCpf $dig) })
}
$a = $acc.records[0]
$aid = $a.Id

$cliente = [ordered]@{
  id=$aid; nome=$a.Name; cpf=$dig; cpf_fmt=(FmtCpf $dig)
  email=$a.PersonEmail; telefone=$a.PersonMobilePhone; telefone_fmt=(FmtTel $a.PersonMobilePhone)
  nascimento=$a.Data_de_Nascimento__c; nascimento_fmt=(DataBr $a.Data_de_Nascimento__c)
  cep=$a.CEP__c; rua=$a.Endereco__c; numero=$a.Numero__c; complemento=$a.Complemento__c
  bairro=$a.Bairro__c; cidade=$a.Cidade__c; uf=$a.Estado__c; cargo=$a.Cargo__c
  criado_em=(DataBr $a.CreatedDate)
}

# itens (matriculas) — traz turma + datas dos modulos
$itensQ = Soql "SELECT Id, PedidoCispay__c, PedidoCispay__r.Name, Produto__r.Name, Turma__r.Name, Turma__r.Data_Inicial__c, Turma__r.Data_Final__c, Turma__r.DataInicialSegundoModulo__c, Status__c, ValorBruto__c, ValorFinal__c, CreatedDate FROM ItemPedidoCispay__c WHERE Cliente__c = '$(SoqlEsc $aid)' ORDER BY CreatedDate DESC"
$itens = @()
foreach ($i in $itensQ.records) {
  $itens += [ordered]@{
    pedido_id=$i.PedidoCispay__c
    pedido=$(if($i.PedidoCispay__r){$i.PedidoCispay__r.Name}else{''})
    produto=$(if($i.Produto__r){$i.Produto__r.Name}else{''})
    turma=$(if($i.Turma__r){$i.Turma__r.Name}else{''})
    turma_ini=$(if($i.Turma__r){DataBr $i.Turma__r.Data_Inicial__c}else{''})
    turma_fim=$(if($i.Turma__r){DataBr $i.Turma__r.Data_Final__c}else{''})
    turma_mod2=$(if($i.Turma__r){DataBr $i.Turma__r.DataInicialSegundoModulo__c}else{''})
    status=$i.Status__c
    valor_bruto=[double]$(if($i.ValorBruto__c){$i.ValorBruto__c}else{0})
    valor_com_juros=[double]$(if($i.ValorFinal__c){$i.ValorFinal__c}else{0})
    criado_em=(DataBr $i.CreatedDate)
  }
}

# formas de pagamento por pedido
$pgQ = Soql "SELECT PedidoCispay__c, PaymentMethod__c, PaymentType__c, Brand__c, Installments__c, Valor__c, ValorJuros__c, Status__c FROM FormaPagamentoPedidoCispay__c WHERE PedidoCispay__r.Cliente__c = '$(SoqlEsc $aid)'"
$pagsPorPedido = @{}
foreach ($p in $pgQ.records) {
  $k = "$($p.PedidoCispay__c)"
  if (-not $pagsPorPedido.ContainsKey($k)) { $pagsPorPedido[$k] = @() }
  $pagsPorPedido[$k] += [ordered]@{
    metodo=$p.PaymentMethod__c; tipo=$p.PaymentType__c; bandeira=$p.Brand__c
    parcelas=[int]$(if($p.Installments__c){$p.Installments__c}else{0})
    valor=[double]$(if($p.Valor__c){$p.Valor__c}else{0})
    valor_com_juros=[double]$(if($p.ValorJuros__c){$p.ValorJuros__c}else{0})
    status=$p.Status__c
  }
}

# pedidos + classificacao
$pedQ = Soql "SELECT Id, Name, Status__c, ValorTotal__c, ValorPago__c, ValorPendente__c, NumeroParcelas__c, CreatedDate FROM PedidoCispay__c WHERE Cliente__c = '$(SoqlEsc $aid)' ORDER BY CreatedDate DESC"
$pedidos = @()
$totalPago = 0.0
foreach ($p in $pedQ.records) {
  $vt = [double]$(if($p.ValorTotal__c){$p.ValorTotal__c}else{0})
  $vp = [double]$(if($p.ValorPago__c){$p.ValorPago__c}else{0})
  $meus = @($itens | Where-Object { $_.pedido_id -eq $p.Id })
  $comJuros = 0.0; foreach($m in $meus){ $comJuros += [double]$m.valor_com_juros }

  # classificacao (a regra que decide se PODE virar venda no Sales Cube)
  $tipo = 'pago'; $label = 'PAGO'; $podeLancar = $true; $motivo = ''
  if ("$($p.Status__c)" -match '(?i)cancel') {
    $tipo='cancelado'; $label='CANCELADO'; $podeLancar=$false; $motivo='Pedido cancelado no Salesforce.'
  } elseif ($vt -le 0) {
    $tipo='remanejamento'; $label='R$ 0 — REMANEJAMENTO'; $podeLancar=$false
    $motivo='Pedido de valor zero: troca/remanejamento de turma, nao venda. Lancar isso no Sales Cube cria matricula sem receita.'
  } elseif ($vp -le 0) {
    $tipo='aberto'; $label='EM ABERTO'; $podeLancar=$false; $motivo='Pedido sem valor pago ate agora.'
  }
  if ($vp -gt 0) { $totalPago += $vp }

  $pedidos += [ordered]@{
    id=$p.Id; nome=$p.Name; status=$p.Status__c
    valor_total=$vt; valor_pago=$vp
    valor_pendente=[double]$(if($p.ValorPendente__c){$p.ValorPendente__c}else{0})
    parcelas=[int]$(if($p.NumeroParcelas__c){$p.NumeroParcelas__c}else{0})
    criado_em=(DataBr $p.CreatedDate)
    tipo=$tipo; tipo_label=$label; pode_lancar=$podeLancar; motivo=$motivo
    valor_lancar=$(if($vp -gt 0){$vp}else{$vt})     # o que entra no Sales Cube: o que foi PAGO
    valor_com_juros=$comJuros                        # so para exibir o contraste; NUNCA lancar
    itens=$meus
    pagamentos=@($(if($pagsPorPedido.ContainsKey("$($p.Id)")){$pagsPorPedido["$($p.Id)"]}else{@()}))
  }
}

# oportunidades
$opQ = Soql "SELECT Id, Name, StageName, Amount, CloseDate, Owner.Name, CreatedDate FROM Opportunity WHERE AccountId = '$(SoqlEsc $aid)' ORDER BY CreatedDate DESC"
$ops = @()
foreach ($o in $opQ.records) {
  $ops += [ordered]@{
    id=$o.Id; nome=$o.Name; etapa=$o.StageName
    valor=[double]$(if($o.Amount){$o.Amount}else{0})
    fechamento=(DataBr $o.CloseDate); dono=$(if($o.Owner){$o.Owner.Name}else{''}); criado_em=(DataBr $o.CreatedDate)
  }
}

$qtdPagos = @($pedidos | Where-Object { $_.tipo -eq 'pago' }).Count
$qtdReman = @($pedidos | Where-Object { $_.tipo -eq 'remanejamento' }).Count

# ---- HISTORICO DE TREINAMENTOS (Credenciamento__c) ----
# Cada matricula gera um credenciamento. O cracha so e impresso no credenciamento presencial:
# N_de_impressoes__c > 0 = JA FEZ; zero = matriculado que ainda NAO fez (ou nao compareceu).
#
# HIERARQUIA DE EVIDENCIA (do mais forte para o mais fraco):
#   presenca > cracha impresso > pedido pago > credenciamento > item de pedido > data da turma.
# So afirmamos algo com os tres primeiros niveis. Data de turma NAO prova matricula: no SF a
# turma remarcada mantem o rotulo do ano antigo e o remanejamento deixa registros orfaos dos
# dois lados. Por isso os estados sao cinco:
#   fez           = presenca registrada ou cracha impresso
#   confirmado    = turma futura com pedido PAGO por tras
#   a_confirmar   = turma futura sem lastro financeiro / datas inconsistentes (DUVIDA, nao afirmacao)
#   residuo       = matricula aberta de um treinamento que o aluno JA FEZ (sobra de remanejamento)
#   nao_compareceu= a turma ja passou e nao houve credenciamento
$creds = @(); $credFez = 0; $credFalta = 0
$credDuvida = 0; $credResiduo = 0
$gradeFeitas = @(); $gradePend = @(); $gradeDuvida = @()
$hoje = (Get-Date).Date

# lastro financeiro por TURMA: o pedido que sustenta (ou nao) a matricula
$turmaPaga = @{}; $turmaAberta = @{}
foreach ($pd in $pedidos) {
  if ("$($pd.status)" -match '(?i)cancel') { continue }
  foreach ($itp in $pd.itens) {
    $kt = ("$($itp.turma)").Trim().ToLower(); if (-not $kt) { continue }
    if ([double]$pd.valor_pago -gt 0) { $turmaPaga[$kt] = $true }
    elseif ([double]$pd.valor_total -gt 0) { $turmaAberta[$kt] = $true }
  }
}
# identidade do TREINAMENTO (para saber se o aluno ja fez "esse mesmo"): sigla da grade quando
# existe; senao o nome do curso. E o que separa "matricula nova" de "resto de matricula velha".
function Chave-Treino($sigla, $curso) { if ("$sigla") { return "G:$sigla" }; return ("C:" + ("$curso".Trim().ToUpper())) }
# ano escrito no nome da turma ("2025 - ML5011") — serve so de ALERTA quando diverge da data real
function Ano-Rotulo($turma) { $m = [regex]::Match("$turma", '(19|20)\d{2}'); if ($m.Success) { return [int]$m.Value }; return 0 }

try {
  $cq = Soql ("SELECT Id, Curso__r.Name, Turma__r.Name, Turma__r.Data_Inicial__c, Turma__r.Data_Final__c, N_de_impressoes__c, Tipo_de_Matricula__c, CreatedDate " +
              "FROM Credenciamento__c WHERE CPF_do_Cliente__c = '$(SoqlEsc (FmtCpf $dig))' OR CPF__c = '$(SoqlEsc $dig)' ORDER BY CreatedDate DESC")
  $hoje = (Get-Date).Date

  # PRESENCA (aba "Relacionado" do credenciamento): 1 registro por DIA do evento, com entrada/saida.
  # E a confirmacao fina de quem esteve na sala - o Nº de impressoes so diz que o cracha foi impresso.
  $presPorCred = @{}
  try {
    $pq = Soql ("SELECT Credenciamento__c, Dia__c, Tipo__c, DataCredenciamento__c, Primeira_Entrada__c, Primeira_Sa_da__c, Segunda_Entrada__c, Segunda_Sa_da__c " +
                "FROM Presenca__c WHERE Cliente__c = '$(SoqlEsc $aid)' ORDER BY Dia__c")
    function HoraBr($iso) { if (-not $iso) { return '' } try { return ([datetime]$iso).ToLocalTime().ToString('dd/MM HH:mm') } catch { return '' } }
    foreach ($pr in $pq.records) {
      $k = [string]$pr.Credenciamento__c
      if (-not $k) { continue }
      if (-not $presPorCred.ContainsKey($k)) { $presPorCred[$k] = @() }
      $presPorCred[$k] += [ordered]@{
        dia      = [int]$(if ($pr.Dia__c) { $pr.Dia__c } else { 0 })
        tipo     = [string]$pr.Tipo__c
        entrada1 = (HoraBr $pr.Primeira_Entrada__c)
        saida1   = (HoraBr $pr.Primeira_Sa_da__c)
        entrada2 = (HoraBr $pr.Segunda_Entrada__c)
        saida2   = (HoraBr $pr.Segunda_Sa_da__c)
        credenciado_em = (HoraBr $pr.DataCredenciamento__c)
      }
    }
  } catch {}
  # 1a passada: le os credenciamentos crus e descobre O QUE O ALUNO JA FEZ.
  # Precisa vir antes da classificacao: e o historico dele que desmascara a matricula-resto.
  $brutos = @()
  foreach ($cr in $cq.records) {
    $imp = [double]$(if ($null -ne $cr.N_de_impressoes__c) { $cr.N_de_impressoes__c } else { 0 })
    $ini = $null; if ($cr.Turma__r -and $cr.Turma__r.Data_Inicial__c) { try { $ini = [datetime]$cr.Turma__r.Data_Inicial__c } catch {} }
    $fim = $null; if ($cr.Turma__r -and $cr.Turma__r.Data_Final__c)   { try { $fim = [datetime]$cr.Turma__r.Data_Final__c }   catch {} }
    $nomeCurso = $(if ($cr.Curso__r) { [string]$cr.Curso__r.Name } else { '(sem curso)' })
    $nomeTurma = $(if ($cr.Turma__r) { [string]$cr.Turma__r.Name } else { '' })
    $pres = @()
    if ($presPorCred.ContainsKey([string]$cr.Id)) { $pres = @($presPorCred[[string]$cr.Id] | Sort-Object { $_.dia }) }
    $diasPresente = @($pres | Where-Object { $_.entrada1 -or $_.entrada2 }).Count
    $brutos += [ordered]@{
      curso=$nomeCurso; turma=$nomeTurma; ini=$ini; fim=$fim; imp=$imp
      sigla=(Sigla-Grade $nomeTurma $nomeCurso)
      pres=$pres; dias=$diasPresente
      # presenca VENCE o cracha: a impressao pode falhar, quem entrou na sala entrou
      fez=($imp -gt 0 -or $diasPresente -gt 0)
      tipo=[string]$cr.Tipo_de_Matricula__c
      criado=(DataBr $cr.CreatedDate)
    }
  }
  $feitoKey = @{}
  foreach ($b in $brutos) { if ($b.fez) { $feitoKey[(Chave-Treino $b.sigla $b.curso)] = $true } }

  # 2a passada: classifica na ordem de precedencia
  foreach ($b in $brutos) {
    $kt      = ("$($b.turma)").Trim().ToLower()
    $pago    = ($kt -and $turmaPaga.ContainsKey($kt))
    $aberto  = ($kt -and $turmaAberta.ContainsKey($kt))
    $dup     = $feitoKey.ContainsKey((Chave-Treino $b.sigla $b.curso))
    $fimRef  = $(if ($b.fim) { $b.fim } else { $b.ini })
    $passou  = ($fimRef -and $fimRef.Date -lt $hoje)
    $datasOk = (-not $b.ini) -or (-not $b.fim) -or ($b.fim.Date -ge $b.ini.Date)
    $sit = ''; $motivo = ''
    if ($b.fez) {
      $sit = 'fez'
    } elseif (-not $b.ini) {
      $sit = 'a_confirmar'; $motivo = 'Turma sem data no Salesforce.'
    } elseif (-not $datasOk) {
      $sit = 'a_confirmar'; $motivo = 'Datas da turma inconsistentes no Salesforce (fim antes do inicio).'
    } elseif ($passou) {
      if ($dup) { $sit = 'residuo';        $motivo = 'Matricula antiga: o aluno ja realizou este treinamento em outra turma.' }
      else      { $sit = 'nao_compareceu'; $motivo = 'A turma ja aconteceu e nao houve credenciamento.' }
    } elseif ($dup -and -not $pago) {
      $sit = 'residuo'; $motivo = 'Ja realizou este treinamento e esta matricula futura nao tem pedido pago — provavel sobra de remanejamento.'
    } elseif ($pago) {
      $sit = 'confirmado'
    } elseif ($aberto) {
      $sit = 'a_confirmar'; $motivo = 'O pedido desta turma esta em aberto (nada pago) — confirmar antes de afirmar que ele esta matriculado.'
    } else {
      $sit = 'a_confirmar'; $motivo = 'Matricula futura sem pedido pago (tipico de troca de turma) — confirmar com o pedagogico.'
    }
    # rotulo do ano da turma x data real: so alerta, nunca decide o estado
    $anoRot = Ano-Rotulo $b.turma
    $suspeita = ($anoRot -gt 0 -and $b.ini -and [Math]::Abs($anoRot - $b.ini.Year) -ge 1)
    switch ($sit) {
      'fez'         { $credFez++;     if ($b.sigla) { $gradeFeitas += $b.sigla } }
      'confirmado'  { $credFalta++;   if ($b.sigla) { $gradePend   += $b.sigla } }
      'nao_compareceu' { $credFalta++ }
      'a_confirmar' { $credDuvida++;  if ($b.sigla) { $gradeDuvida += $b.sigla } }
      'residuo'     { $credResiduo++ }
    }
    $creds += [ordered]@{
      treinamento = $b.curso
      turma       = $b.turma
      inicio      = $(if ($b.ini) { $b.ini.ToString('dd/MM/yyyy') } else { '' })
      fim         = $(if ($b.fim) { $b.fim.ToString('dd/MM/yyyy') } else { '' })
      impressoes  = $b.imp
      ja_fez      = ($sit -eq 'fez')
      situacao    = $sit
      motivo      = $motivo
      data_suspeita = $suspeita
      tem_pedido_pago = $pago
      grade       = $b.sigla
      tipo        = $b.tipo
      matriculado_em = $b.criado
      presencas   = $b.pres          # 1 por dia do evento (aba Relacionado do credenciamento)
      dias_presente = $b.dias
    }
  }
} catch {}

# ---- MATRICULA SEM CREDENCIAMENTO (troca de turma) ----
# Na TROCA DE TURMA o SF atualiza o item do pedido (ItemPedidoCispay__c) mas NAO cria credenciamento
# na turma nova - ele so nasce perto do evento. Sem isso o aluno some do "agendado" e fica so a
# falta na turma antiga. Entao toda turma FUTURA que aparece nos itens e nao tem credenciamento
# entra aqui como agendada.
try {
  $turmasCred = @{}
  foreach ($c0 in $creds) { $k0 = ("$($c0.turma)").Trim().ToLower(); if ($k0) { $turmasCred[$k0] = $true } }
  foreach ($it in $itens) {
    if (-not $it.turma) { continue }
    # item cancelado ou que nem virou oportunidade NAO e matricula: nao gera linha nenhuma
    if ("$($it.status)" -match '(?i)cancel') { continue }
    if ("$($it.status)" -match '(?i)aguardando cria') { continue }
    $k = ("$($it.turma)").Trim().ToLower()
    if ($turmasCred.ContainsKey($k)) { continue }
    $iniIt = $null
    if ($it.turma_ini) { try { $iniIt = [datetime]::ParseExact($it.turma_ini,'dd/MM/yyyy',$null) } catch {} }
    if (-not $iniIt -or $iniIt.Date -lt $hoje) { continue }        # so as que ainda vao acontecer
    $turmasCred[$k] = $true
    $sgIt = Sigla-Grade $it.turma $it.produto
    $pagoIt = $turmaPaga.ContainsKey($k)
    $dupIt  = $feitoKey.ContainsKey((Chave-Treino $sgIt $it.produto))
    # mesma precedencia da tabela de credenciamentos — aqui o lastro e ainda mais fraco
    # (nao existe credenciamento), entao sem pedido pago nunca afirmamos "esta matriculado"
    if ($pagoIt)      { $sitIt = 'confirmado';  $motIt = '' }
    elseif ($dupIt)   { $sitIt = 'residuo';     $motIt = 'Ja realizou este treinamento e esta matricula futura nao tem pedido pago — provavel sobra de remanejamento.' }
    elseif ($turmaAberta.ContainsKey($k)) { $sitIt = 'a_confirmar'; $motIt = 'O pedido desta turma esta em aberto (nada pago) — confirmar antes de afirmar que ele esta matriculado.' }
    else              { $sitIt = 'a_confirmar'; $motIt = 'Matricula vinda de pedido R$ 0 (troca de turma), sem credenciamento gerado — confirmar com o pedagogico.' }
    $anoRotIt = Ano-Rotulo $it.turma
    switch ($sitIt) {
      'confirmado'  { $credFalta++;  if ($sgIt) { $gradePend   += $sgIt } }
      'a_confirmar' { $credDuvida++; if ($sgIt) { $gradeDuvida += $sgIt } }
      'residuo'     { $credResiduo++ }
    }
    $creds += [ordered]@{
      treinamento = $it.produto
      turma       = $it.turma
      inicio      = $it.turma_ini
      fim         = $it.turma_fim
      impressoes  = 0
      ja_fez      = $false
      situacao    = $sitIt
      motivo      = $motIt
      data_suspeita = ($anoRotIt -gt 0 -and [Math]::Abs($anoRotIt - $iniIt.Year) -ge 1)
      tem_pedido_pago = $pagoIt
      grade       = $sgIt
      tipo        = $it.status
      matriculado_em = $it.criado_em
      presencas   = @()
      dias_presente = 0
      sem_credenciamento = $true      # veio do pedido: o credenciamento ainda nao foi gerado
    }
  }
  # mantem a ordem: turma mais proxima/recente primeiro
  $creds = @($creds | Sort-Object @{Expression={ if ($_.inicio) { try { [datetime]::ParseExact($_.inicio,'dd/MM/yyyy',$null) } catch { [datetime]'1900-01-01' } } else { [datetime]'1900-01-01' } }} -Descending)
} catch {}

# GGB: conta treinamentos DISTINTOS da grade que o aluno JA REALIZOU (so impressoes > 0).
# 8+ = GOLDEN BELT · 5+ = GREEN BELT · abaixo disso, aluno comum.
$feitasU = @($gradeFeitas | Select-Object -Unique)
# "matriculado, ainda nao fez" agora exige matricula CONFIRMADA (pedido pago).
# A duvida vira um terceiro grupo, em vez de virar afirmacao para qualquer um dos lados.
$pendU   = @($gradePend | Where-Object { $feitasU -notcontains $_ } | Select-Object -Unique)
$duvidaU = @($gradeDuvida | Where-Object { $feitasU -notcontains $_ -and $pendU -notcontains $_ } | Select-Object -Unique)
$faltamU = @($GRADE | Where-Object { $feitasU -notcontains $_ })
$nGrade  = $feitasU.Count
$belt = if ($nGrade -ge 8) { 'GOLDEN' } elseif ($nGrade -ge 5) { 'GREEN' } else { '' }
$ggb = [ordered]@{
  grade            = $GRADE
  feitos           = $feitasU
  qtd              = $nGrade
  belt             = $belt
  belt_label       = $(switch ($belt) { 'GOLDEN' { 'GOLDEN BELT' } 'GREEN' { 'GREEN BELT' } default { 'Aluno comum' } })
  matriculado_falta = $pendU                                   # matricula CONFIRMADA (pedido pago) e ainda nao fez
  a_confirmar       = $duvidaU                                 # aparece matriculado, mas sem lastro: checar antes de afirmar
  nunca_matriculado = @($faltamU | Where-Object { $pendU -notcontains $_ -and $duvidaU -notcontains $_ })
  falta_para_green  = [Math]::Max(0, 5 - $nGrade)
  falta_para_golden = [Math]::Max(0, 8 - $nGrade)
}

Out-Json ([ordered]@{
  ok=$true; achou=$true; cpf=$dig; cpf_fmt=(FmtCpf $dig)
  cliente=$cliente
  pedidos=$pedidos
  oportunidades=$ops
  credenciamentos=$creds
  ggb=$ggb
  resumo=[ordered]@{
    total_pago=$totalPago; qtd_pedidos=$pedidos.Count; qtd_pagos=$qtdPagos; qtd_remanejamento=$qtdReman
    qtd_oportunidades=$ops.Count
    # os numeros do topo somam so CERTEZAS; duvida e residuo ficam em contadores proprios
    qtd_treinamentos=$creds.Count; treinamentos_feitos=$credFez; treinamentos_a_fazer=$credFalta
    treinamentos_a_confirmar=$credDuvida; treinamentos_residuo=$credResiduo
    ggb_qtd=$nGrade; ggb_belt=$belt
  }
})
