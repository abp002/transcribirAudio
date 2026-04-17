#!/bin/bash
cd "$(dirname "$0")"
set -e

if ! command -v python3 &> /dev/null; then
    osascript -e 'display dialog "Python 3 no está instalado.\n\nDescárgalo de python.org e instálalo antes de volver a ejecutar este script." buttons {"OK"} default button 1'
    exit 1
fi

if [ ! -d "venv" ]; then
    echo "Creando entorno Python (solo la primera vez)..."
    python3 -m venv venv
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
