' ============================================================
'  Meta Master - atalho unico
'  Liga o servidor local (janela VISIVEL = confiavel) e abre o
'  app no navegador no endereco que permite ATUALIZAR o faturamento.
'  Use SEMPRE este atalho para abrir o Meta Master.
'  IMPORTANTE: deixe a janela preta do servidor ABERTA enquanto usa.
' ============================================================
Option Explicit
Dim sh, fso, dir, http, noAr

Set sh  = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir

' O servidor ja esta rodando?
noAr = False
On Error Resume Next
Set http = CreateObject("MSXML2.XMLHTTP")
http.Open "GET", "http://localhost:8765/index.html", False
http.Send
If Err.Number = 0 Then noAr = True
On Error GoTo 0

If noAr Then
    ' Ja no ar: so abre o navegador na versao atualizavel.
    sh.Run "http://localhost:8765/index.html", 1, False
Else
    ' Inicia o servidor com janela VISIVEL (1 = normal) — confiavel,
    ' nao morre sozinho e da pra ver/encerrar (Ctrl+C ou fechar a janela).
    ' O proprio Servir.ps1 abre o navegador quando sobe.
    sh.Run "powershell -NoProfile -ExecutionPolicy Bypass -File """ & dir & "\Servir.ps1""", 1, False
End If
