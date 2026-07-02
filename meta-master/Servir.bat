@echo off
REM Serve a pasta em http://localhost:8765 com a rota /api/atualizar,
REM que faz o botao "RECARREGAR DADOS" puxar o faturamento atual (Sales Cube).
REM Mantenha esta janela aberta enquanto usa. Encerre com Ctrl+C.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Servir.ps1"
pause
