' Abrir Chamados.vbs
' Sobe o servidor (Servir.ps1) em segundo plano, sem janela preta, e abre o navegador.
' Com o argumento /nobrowser NAO abre o navegador (quem chamou ja abriu a tela de
' abertura) - e o que o atalho "Abrir APP CHAMADO.bat" usa.
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
pasta = fso.GetParentFolderName(WScript.ScriptFullName)
ps1 = pasta & "\Servir.ps1"
extra = ""
If WScript.Arguments.Count > 0 Then
  If LCase(WScript.Arguments(0)) = "/nobrowser" Then extra = " -NaoAbrir"
End If
sh.CurrentDirectory = pasta
sh.Run "powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & ps1 & """" & extra, 0, False
