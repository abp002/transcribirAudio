@echo off
cd /d "%~dp0"

if not exist cloudflared.exe (
    echo.
    echo ==========================================
    echo ERROR: falta cloudflared.exe en esta carpeta.
    echo.
    echo Descargalo de:
    echo   https://github.com/cloudflare/cloudflared/releases/latest
    echo.
    echo Busca "cloudflared-windows-amd64.exe",
    echo guardalo aqui y renombralo a "cloudflared.exe".
    echo ==========================================
    echo.
    pause
    exit /b 1
)

echo.
echo Arrancando Cloudflare Tunnel hacia http://localhost:7860
echo.
echo La URL publica aparecera en unos segundos (busca "trycloudflare.com"
echo en las lineas de abajo). Copiala y mandasela a tus companeros.
echo.
echo Deja esta ventana abierta mientras quieras que la URL funcione.
echo.

cloudflared.exe tunnel --url http://localhost:7860
pause
