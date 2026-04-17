# Voz Desktop — versión local con diarización

Ejecuta Whisper + pyannote en **tu propio ordenador**. El audio nunca sale de aquí. Detecta quién habla en una reunión de hasta ~10 personas con calidad profesional.

## ¿Cuándo usar esta versión?

- Reuniones con varias personas (quieres ver quién dijo qué).
- Máxima privacidad (el audio no sale del portátil).
- No te importa esperar 15-20 min la primera vez para instalar.

Para notas rápidas de una sola voz, la versión online (`https://abp002.github.io/transcribirAudio/`) sigue funcionando sin nada de esto.

## Requisitos

- **Python 3.10, 3.11 o 3.12** (3.13+ NO, whisperX no es compatible todavía).
  - Mac: `brew install python@3.11`
  - Windows: https://www.python.org/downloads/release/python-3119/
- **5 GB de disco libre** (para los modelos + dependencias).
- Un **token gratuito de Hugging Face** (ver abajo).

## Setup (primera vez, ~15 min)

### 1. Consigue el token de Hugging Face

Solo hace falta la **primera vez**. Es gratis.

1. Crea cuenta en https://huggingface.co (con tu email).
2. Ve a https://huggingface.co/settings/tokens → **New token** → tipo `Read` → copia el token.
3. Acepta las licencias en **estas dos** páginas (clic en "Agree"):
   - https://huggingface.co/pyannote/speaker-diarization-3.1
   - https://huggingface.co/pyannote/segmentation-3.0

### 2. Arranca el servidor

**Mac:** doble-clic en `start-mac.command`. La primera vez pegará el token cuando lo pida.

**Windows:** doble-clic en `start-windows.bat`.

La primera ejecución:
- Crea un entorno Python aislado (`venv/`).
- Descarga whisperX + pytorch + pyannote (~5 GB, 10-20 min según internet).
- Pide el token de Hugging Face (solo la primera vez, se guarda en `.hf_token`).
- Arranca el servidor en `http://localhost:7860`.

### 3. Abre la app

Abre `http://localhost:7860` en Chrome/Edge/Safari. La PWA detecta el backend automáticamente y muestra "Modo local con diarización" en la cabecera. Graba normal, y al terminar verás el texto **agrupado por hablante**.

## Siguientes arranques

Doble-clic al script y listo. No pide token ni instala nada.

## Cambiar el modelo

Por defecto usa `small` (equilibrio calidad/velocidad). Para más precisión:

```bash
# Mac/Linux
VOZ_MODEL=medium ./start-mac.command

# Windows
set VOZ_MODEL=medium && start-windows.bat
```

Opciones: `tiny` / `base` / `small` / `medium` / `large-v3`.

## Solución de problemas

**"Python 3 no está instalado"** → instálalo de https://www.python.org/downloads/. En Mac, `brew install python@3.11` también vale.

**"HTTP 403" o "license" en el arranque** → no aceptaste las licencias de pyannote. Vuelve al paso 1.3.

**Muy lento** → estás en CPU. Si tienes GPU NVIDIA, instala `torch` con CUDA siguiendo https://pytorch.org/get-started/locally/. Si estás en Mac M1/M2, el rendimiento CPU suele bastar para reuniones <1h.

**El navegador dice "sitio no seguro"** → normal en `localhost` para el micrófono. Chrome/Edge permiten `localhost` sin HTTPS. Si pasa en Safari, usa Chrome.

## Arquitectura

```
┌─────────────────────────────┐
│ Navegador (localhost:7860)  │
│  ├─ PWA (index.html, app.js)│  ← servida por el mismo backend
│  └─ Graba audio (AudioWorklet)
└──────────────┬──────────────┘
               │ POST /api/transcribe (WAV)
               ▼
┌─────────────────────────────┐
│ server.py (FastAPI)         │
│  ├─ Whisper (texto)         │
│  ├─ wav2vec2 (alineado)     │
│  └─ pyannote (quién habla)  │
└─────────────────────────────┘
```

Todo en tu máquina. Nada sale a internet tras la primera descarga de modelos.
