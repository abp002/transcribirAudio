@echo off
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
    echo Python 3 no esta instalado. Descargalo de python.org.
    pause
    exit /b 1
)

if not exist venv (
    echo Creando entorno Python (solo la primera vez)...
    python -m venv venv
)
call venv\Scripts\activate.bat

if not exist venv\.installed (
    echo Instalando dependencias (10-20 min la primera vez, ~5 GB)...
    python -m pip install --upgrade pip >nul
    pip install -r requirements.txt
    if errorlevel 1 (
        echo Fallo al instalar dependencias.
        pause
        exit /b 1
    )
    echo. > venv\.installed
)

if exist .hf_token (
    set /p HF_TOKEN=<.hf_token
) else if "%HF_TOKEN%"=="" (
    echo.
    echo ==========================================
    echo Para detectar QUIEN habla necesitas un
    echo token gratuito de Hugging Face:
    echo.
    echo 1. Crea cuenta en https://huggingface.co
    echo 2. https://huggingface.co/settings/tokens - crea token (Read)
    echo 3. Acepta las licencias en:
    echo    https://huggingface.co/pyannote/speaker-diarization-3.1
    echo    https://huggingface.co/pyannote/segmentation-3.0
    echo ==========================================
    echo.
    set /p HF_TOKEN="Pega el token aqui (o Enter para seguir SIN diarizacion): "
    if not "%HF_TOKEN%"=="" (
        echo %HF_TOKEN% > .hf_token
    )
)

python server.py
