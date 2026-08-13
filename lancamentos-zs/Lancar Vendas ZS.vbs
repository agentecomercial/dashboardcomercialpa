' Lancar Vendas ZS.vbs
' Atalho de duplo clique para o fluxo Salesforce -> Zsales.
' Abre o seletor de arquivo do Windows, roda a previa e so grava depois de voce confirmar.
Option Explicit

Dim fso, sh, pasta, script, cmd, resp, arquivo
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh  = CreateObject("WScript.Shell")
pasta  = fso.GetParentFolderName(WScript.ScriptFullName)
script = pasta & "\Lancar-Vendas-SF.ps1"

If Not fso.FileExists(script) Then
  MsgBox "Nao encontrei o Lancar-Vendas-SF.ps1 nesta pasta.", 16, "Lancamentos ZS"
  WScript.Quit
End If

' ---------- 1) escolher o relatorio ----------
arquivo = EscolherArquivo()
If arquivo = "" Then WScript.Quit

' ---------- 2) previa (nao grava nada) ----------
cmd = "powershell -NoProfile -ExecutionPolicy Bypass -File """ & script & """ -Arquivo """ & arquivo & """ -Abrir"
If sh.Run(cmd, 1, True) <> 0 Then
  MsgBox "A previa falhou. Veja a janela do PowerShell.", 16, "Lancamentos ZS"
  WScript.Quit
End If

' ---------- 3) cadastro ----------
resp = MsgBox("Previa gerada e aberta no navegador." & vbCrLf & vbCrLf & _
              "Confira a tabela." & vbCrLf & vbCrLf & _
              "Posso CADASTRAR os clientes no Zsales agora?" & vbCrLf & _
              "(so preenche campo vazio; nada e sobrescrito)", 4 + 32, "Etapa 2 — Cadastro")
If resp <> 6 Then
  MsgBox "Parei aqui. Nada foi gravado." & vbCrLf & "A previa continua na pasta 'previas'.", 64, "Lancamentos ZS"
  WScript.Quit
End If
sh.Run "powershell -NoProfile -ExecutionPolicy Bypass -File """ & script & """ -Acao cadastro -Aplicar", 1, True

' ---------- 4) vendas ----------
resp = MsgBox("Cadastro concluido." & vbCrLf & vbCrLf & _
              "Posso LANCAR AS VENDAS agora?" & vbCrLf & _
              "(oportunidade + produto + pagamento + anotacoes + fechar como ganha)", 4 + 32, "Etapa 3 — Vendas")
If resp <> 6 Then
  MsgBox "Parei antes das vendas. Os cadastros ja foram gravados." & vbCrLf & vbCrLf & _
         "Para lancar depois, rode o atalho de novo ou:" & vbCrLf & _
         ".\Lancar-Vendas-SF.ps1 -Acao vendas -Aplicar", 64, "Lancamentos ZS"
  WScript.Quit
End If
sh.Run "powershell -NoProfile -ExecutionPolicy Bypass -File """ & script & """ -Acao vendas -Aplicar", 1, True

MsgBox "Fluxo concluido." & vbCrLf & vbCrLf & _
       "Confira o resumo na janela do PowerShell: as vendas ganhas trazem o link do Zsales " & _
       "e as que ficaram abertas aparecem com o motivo.", 64, "Lancamentos ZS"

' ================= helpers =================
Function EscolherArquivo()
  Dim dlg, caminho
  caminho = ""
  ' 1a tentativa: caixa de dialogo do Windows (UserAccounts.CommonDialog existe so em algumas versoes)
  On Error Resume Next
  Set dlg = CreateObject("UserAccounts.CommonDialog")
  If Err.Number = 0 Then
    dlg.Filter = "Relatorio do Salesforce (*.xls;*.csv)|*.xls;*.csv|Todos (*.*)|*.*"
    dlg.InitialDir = sh.SpecialFolders("MyDocuments") & "\..\Downloads"
    If dlg.ShowOpen Then caminho = dlg.FileName
    EscolherArquivo = caminho
    Exit Function
  End If
  Err.Clear
  ' 2a tentativa: seletor do Shell
  Dim shellApp, arq
  Set shellApp = CreateObject("Shell.Application")
  Set arq = shellApp.BrowseForFolder(0, "Selecione a PASTA do relatorio (depois escolha o arquivo)", &H4000, sh.SpecialFolders("MyDocuments") & "\..\Downloads")
  On Error GoTo 0
  If Not arq Is Nothing Then
    caminho = InputBox("Confirme o caminho completo do relatorio (.xls exportado do Salesforce):", _
                       "Lancamentos ZS", arq.Self.Path & "\")
  Else
    caminho = InputBox("Cole o caminho completo do relatorio (.xls exportado do Salesforce):", "Lancamentos ZS", _
                       sh.SpecialFolders("MyDocuments") & "\..\Downloads\")
  End If
  If caminho <> "" Then
    If Not fso.FileExists(caminho) Then
      MsgBox "Arquivo nao encontrado:" & vbCrLf & caminho, 16, "Lancamentos ZS"
      caminho = ""
    End If
  End If
  EscolherArquivo = caminho
End Function
