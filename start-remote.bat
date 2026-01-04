@echo off
echo.
echo ╔═══════════════════════════════════════════════╗
echo ║   Iniciando Halfeld PetCare...                ║
echo ╚═══════════════════════════════════════════════╝
echo.
echo Descobrindo seu IP local...
echo.

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set IP=%%a
    goto :found
)

:found
set IP=%IP:~1%
echo ╔═══════════════════════════════════════════════╗
echo ║  SEU IP LOCAL: %IP%
echo ║  
echo ║  ACESSE DE QUALQUER DISPOSITIVO:
echo ║  http://%IP%:3000
echo ╚═══════════════════════════════════════════════╝
echo.

cd "c:\Halfeld PetCare\App Repository"
set HOST=0.0.0.0
node server.js
