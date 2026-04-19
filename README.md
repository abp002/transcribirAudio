# Voz · Transcriptor de reuniones con diarización

App de transcripción de reuniones en español con detección de hablantes (quién dijo qué). Para **Win Innovación**.

El servidor corre en un PC Windows de la oficina. Los compañeros acceden desde sus PCs por una URL web.

👉 **Cómo instalarlo, arrancarlo y compartirlo con el equipo:** [**`COMO-USAR.md`**](COMO-USAR.md)

---

## Arquitectura

```
┌──────────────────────────────┐
│  Chrome del compañero        │
│  https://abp002.github.io/   │     ← frontend estático (PWA)
│  transcribirAudio/           │        hospedado en GitHub Pages
└──────────┬───────────────────┘
           │  audio WAV + HTTPS
           ▼
┌──────────────────────────────┐
│  Cloudflare Tunnel           │     ← URL pública https://xxx.trycloudflare.com
└──────────┬───────────────────┘
           │  localhost:7860
           ▼
┌──────────────────────────────┐
│  PC Windows de la oficina    │
│  ├── server.py (FastAPI)     │     ← backend: whisperX + pyannote
│  ├── Whisper (transcripción) │
│  └── pyannote (quién habla)  │
└──────────────────────────────┘
```

## Qué hay en la carpeta

**Raíz — lo que se toca:**
- `start-windows.bat` — doble-clic para arrancar el servidor.
- `tunnel.bat` — doble-clic para arrancar el tunnel público.
- `cloudflared.exe` — (lo descarga el usuario, ver `COMO-USAR.md`).
- `COMO-USAR.md` — guía operativa del día a día.
- `README.md` — este archivo.
- `CLAUDE.md` — notas internas / pendientes.

**Raíz — frontend PWA (no se toca, se sirve desde GitHub Pages):**
- `index.html`, `app.js`, `pcm-recorder.js`, `sw.js`, `manifest.json`, `icon.svg`, `logo.png`.

**`desktop/` — backend (no se toca):**
- `server.py` — FastAPI + whisperX + pyannote.
- `requirements.txt` — dependencias Python.
- `venv/` — entorno virtual (se crea automático, no en git).
- `.hf_token` — token de Hugging Face (no en git).

## Requisitos del PC de la oficina

- **Windows 10/11**.
- **Python 3.10, 3.11 o 3.12** (3.13+ no sirve, whisperX aún no es compatible).
- **RAM libre**: 4 GB mínimo con modelo `small`, 8-16 GB para `medium`, 16+ GB para `large-v3`.
- **~10 GB libres en disco** (modelos + dependencias + venv).
- Internet las primera vez (descarga modelos); después puede funcionar sin conexión para el propio servidor, pero los compañeros sí necesitan el tunnel activo para entrar.

## Limitaciones honestas

- **Diarización**: funciona bien en reuniones limpias con 2-5 hablantes (~85-95% precisión). Baja con solapamiento, audio muy comprimido o entornos ruidosos.
- **Una transcripción a la vez**: el servidor no tiene cola. Si dos compañeros dan a "Parar" simultáneamente, el segundo espera a que termine el primero.
- **El PC de la oficina debe estar encendido** para que funcione. Si se suspende o se apaga, los compañeros ven error.
- **Nombres propios, siglas y jerga técnica** pueden salir mal escritos (son las limitaciones típicas de Whisper).
- **URL del tunnel cambia** cada vez que se reinicia `tunnel.bat`. Si quieres URL fija hace falta dominio propio + Cloudflare Named Tunnel (pendiente).

## Créditos técnicos

- [OpenAI Whisper](https://openai.com/research/whisper) — transcripción.
- [whisperX](https://github.com/m-bain/whisperX) — Whisper optimizado + alineado palabra-hablante.
- [pyannote.audio](https://github.com/pyannote/pyannote-audio) — diarización de hablantes.
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) — exposición pública HTTPS sin abrir puertos.
- [FastAPI](https://fastapi.tiangolo.com/) — framework del backend.
