@echo off
cd /d "%~dp0\desktop"

REM whisperX requiere Python 3.10-3.12 (ctranslate2 4.4.0 no tiene wheels para 3.13+).
set PYEXE=
for %%v in (python3.12 python3.11 python3.10) do (
    where %%v >nul 2>nul && set PYEXE=%%v && goto :found
)
where py >nul 2>nul && (
    for %%v in (3.12 3.11 3.10) do (
        py -%%v -c "" >nul 2>nul && set PYEXE=py -%%v && goto :found
    )
)
where python >nul 2>nul && (
    for /f "tokens=2 delims=." %%m in ('python -c "import sys;print(sys.version_info.major,sys.version_info.minor)"') do (
        if %%m GEQ 10 if %%m LEQ 12 set PYEXE=python && goto :found
    )
)

echo.
echo ==========================================
echo ERROR: necesitas Python 3.10, 3.11 o 3.12.
echo Tu Python es demasiado nuevo (3.13+) y
echo whisperX no es compatible aun.
echo.
echo Instala Python 3.11 desde:
echo   https://www.python.org/downloads/release/python-3119/
echo ==========================================
pause
exit /b 1

:found
echo Usando %PYEXE%
if not exist venv (
    echo Creando entorno Python (solo la primera vez)...
    %PYEXE% -m venv venv
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
