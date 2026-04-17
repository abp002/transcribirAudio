#!/bin/bash
cd "$(dirname "$0")"
set -e

# whisperX pin ctranslate2==4.4.0 que solo tiene wheels para Python 3.10-3.12.
# Buscamos la mejor versión disponible.
PYTHON=""
for v in python3.12 python3.11 python3.10; do
    if command -v "$v" &>/dev/null; then
        PYTHON="$v"
        break
    fi
done
if [ -z "$PYTHON" ]; then
    # Fallback a python3 si es 3.10-3.12
    if command -v python3 &>/dev/null; then
        PY_MINOR=$(python3 -c 'import sys; print(sys.version_info.minor)' 2>/dev/null || echo 99)
        if [ "$PY_MINOR" -ge 10 ] && [ "$PY_MINOR" -le 12 ]; then
            PYTHON="python3"
        fi
    fi
fi

if [ -z "$PYTHON" ]; then
    echo ""
    echo "=========================================="
    echo "ERROR: necesitas Python 3.10, 3.11 o 3.12."
    echo ""
    echo "Tu 'python3' es demasiado nuevo (≥ 3.13) y"
    echo "whisperX aún no es compatible. Instala una"
    echo "versión antigua junto a la actual:"
    echo ""
    echo "  brew install python@3.11"
    echo ""
    echo "Y vuelve a ejecutar este script."
    echo "=========================================="
    osascript -e 'display dialog "Necesitas Python 3.10-3.12.\n\nInstala una versión compatible con:\nbrew install python@3.11\n\nLuego vuelve a lanzar este script." buttons {"OK"} default button 1' 2>/dev/null || true
    exit 1
fi

echo "Usando $($PYTHON --version) en $(which $PYTHON)"

if [ ! -d "venv" ]; then
    echo "Creando entorno Python (solo la primera vez)..."
    "$PYTHON" -m venv venv
fi
source venv/bin/activate

if [ ! -f "venv/.installed" ]; then
    echo "Instalando dependencias (10-20 min la primera vez, ~5 GB)..."
    pip install --upgrade pip >/dev/null
    pip install -r requirements.txt
    touch venv/.installed
fi

if [ -f ".hf_token" ]; then
    export HF_TOKEN="$(cat .hf_token)"
elif [ -z "$HF_TOKEN" ]; then
    echo ""
    echo "=========================================="
    echo "Para detectar QUIÉN habla necesitas un"
    echo "token gratuito de Hugging Face:"
    echo ""
    echo "1. Crea cuenta en https://huggingface.co"
    echo "2. https://huggingface.co/settings/tokens → 'New token' (Read)"
    echo "3. Acepta las licencias en:"
    echo "   https://huggingface.co/pyannote/speaker-diarization-3.1"
    echo "   https://huggingface.co/pyannote/segmentation-3.0"
    echo "=========================================="
    echo ""
    read -p "Pega el token aquí (o Enter para seguir SIN diarización): " t
    if [ -n "$t" ]; then
        echo "$t" > .hf_token
        export HF_TOKEN="$t"
    fi
fi

python server.py
