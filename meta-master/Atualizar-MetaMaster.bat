@echo off
REM Regenera dados.js (vendas + metas + fotos da pasta) e reabre o gerador.
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0Gerar-Dados-MetaMaster.ps1"
start "" "%~dp0index.html"
