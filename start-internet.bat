@echo off
title Halfeld PetCare - Internet Access via ngrok

echo.
echo ╔═══════════════════════════════════════════════╗
echo ║   Halfeld PetCare - Acesso via Internet      ║
echo ╚═══════════════════════════════════════════════╝
echo.

REM Verificar se ngrok existe
if not exist "ngrok.exe" (
    echo ❌ ERRO: ngrok.exe não encontrado!
    echo.
    echo Por favor:
    echo 1. Baixe ngrok em: https://ngrok.com/download
    echo 2. Extraia ngrok.exe nesta pasta
    echo 3. Execute: ngrok config add-authtoken SEU_TOKEN
    echo.
    pause
    exit
)

echo ✓ Iniciando servidor...
start "Halfeld Server" cmd /k "cd /d %~dp0 && node server.js"

echo ✓ Aguardando servidor inicializar...
timeout /t 5 /nobreak >nul

echo.
echo ╔═══════════════════════════════════════════════╗
echo ║   Iniciando túnel ngrok...                    ║
echo ║   Copie a URL https://xxxx.ngrok.io           ║
echo ║   e compartilhe com quem precisar acessar!    ║
echo ╚═══════════════════════════════════════════════╝
echo.

ngrok http 3000
