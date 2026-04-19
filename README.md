# Voz · Transcriptor de reuniones con diarización

App web de transcripción en español con detección de hablantes (quién dijo qué). Para **Win Innovación**.

- **Frontend** (PWA): `index.html`, `app.js`, etc. Se despliega en GitHub Pages → https://abp002.github.io/transcribirAudio/
- **Backend** (`desktop/`): servidor Python con whisperX + pyannote que corre en el PC de la oficina. Es quien hace el trabajo pesado.
- Los compañeros abren la URL de GitHub Pages, pegan una vez la URL del servidor, y ya.

## Qué archivo es qué

**En la raíz — lo que se toca con doble-clic:**

| Archivo | Para qué |
|---|---|
| `start-mac.command` | Arranca el servidor en macOS. Doble-clic. |
| `start-windows.bat` | Arranca el servidor en Windows. Doble-clic. |
| `tunnel.bat` | Arranca el Cloudflare Tunnel (URL pública para compañeros). Doble-clic. |
| `COMO-USAR.md` | Guía práctica del día a día. |

**En la raíz — el frontend (PWA):**

| Archivo | Para qué |
|---|---|
| `index.html` | UI |
| `app.js` | Lógica de la app |
| `pcm-recorder.js` | Captura de audio PCM |
| `sw.js` | Service worker (offline) |
| `manifest.json` | PWA instalable |
| `icon.svg`, `logo.png` | Iconos y logo |

**En `desktop/` — el backend Python (no hace falta tocarlo):**

| Archivo | Para qué |
|---|---|
| `server.py` | FastAPI + whisperX + pyannote |
| `requirements.txt` | Dependencias Python |
| `.hf_token` | Token de Hugging Face (no tracked) |
| `venv/` | Entorno virtual (no tracked) |

## Flujo rápido

1. En el PC Windows de la oficina: doble-clic a `start-windows.bat` y `tunnel.bat`. Copia la URL `https://xxx.trycloudflare.com` que aparece.
2. Mándala a los compañeros junto con el enlace `https://abp002.github.io/transcribirAudio/`.
3. Ellos abren el enlace de GitHub Pages, pegan la URL del tunnel la primera vez, y ya graban.

Detalles completos en [`COMO-USAR.md`](COMO-USAR.md).

## Limitaciones honestas

- **Diarización** (detectar 2-5 hablantes): buena calidad en reuniones limpias (~85-95%). Baja con solapamiento de voces o audio muy comprimido.
- El servidor procesa **una transcripción a la vez**. Si dos compañeros paran a la vez, el segundo espera.
- El PC de la oficina **tiene que estar encendido** para que los compañeros puedan usar la app.
- Nombres propios, siglas y jerga muy técnica pueden salir mal escritos.

## Créditos

- [Whisper](https://openai.com/research/whisper) (OpenAI) + [whisperX](https://github.com/m-bain/whisperX) + [pyannote.audio](https://github.com/pyannote/pyannote-audio).
- Frontend PWA estático compatible con GitHub Pages y Cloudflare Pages.
