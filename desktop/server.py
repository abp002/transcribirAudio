"""Voz Desktop — backend local con whisperX + pyannote.

Corre Whisper (transcripción) + pyannote (diarización de voces)
en tu propio ordenador. El audio NUNCA sale de aquí.

Uso:
    python server.py

Requiere Python 3.10+ y las dependencias de requirements.txt.
Para diarización necesitas un token gratuito de Hugging Face
exportado como HF_TOKEN (ver README.md).
"""
from __future__ import annotations

import gc
import inspect
import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

# Carga perezosa de los pesos pesados → arranque rápido para /api/health
whisperx = None
torch = None
_whisper_model = None
_align_cache: dict = {}
_diarize_model = None
_assign_word_speakers = None

MODEL_SIZE = os.environ.get("VOZ_MODEL", "small")
LANG = "es"
DEVICE = "cpu"
COMPUTE_TYPE = "int8"
HF_TOKEN = os.environ.get("HF_TOKEN", "").strip()


def _resolve_diarize_api(wx):
    """whisperX movió DiarizationPipeline/assign_word_speakers a wx.diarize en 3.4+,
    pero versiones viejas lo exportaban en el top-level. Resolvemos ambos."""
    DP = None
    ASW = None
    try:
        from whisperx.diarize import DiarizationPipeline as _DP
        DP = _DP
    except Exception:
        DP = getattr(wx, "DiarizationPipeline", None)
    try:
        from whisperx.diarize import assign_word_speakers as _ASW
        ASW = _ASW
    except Exception:
        ASW = getattr(wx, "assign_word_speakers", None)
    return DP, ASW


def _instantiate_diarize_pipeline(DP, token: str, device: str):
    """Construye DiarizationPipeline tolerante a:
      1. Renombres de parámetro (use_auth_token → token en whisperX 3.8+).
      2. Modelo por defecto gated (community-1 en 3.8+); si falla por 403,
         cae a pyannote/speaker-diarization-3.1 que es el que la mayoría
         de usuarios acepta primero."""
    try:
        sig = inspect.signature(DP.__init__)
        params = sig.parameters
    except (TypeError, ValueError):
        params = {}

    token_kw = None
    for name in ("token", "use_auth_token", "hf_token", "auth_token"):
        if name in params:
            token_kw = name
            break

    def build(model_name):
        kwargs = {}
        if token_kw:
            kwargs[token_kw] = token
        if "device" in params:
            kwargs["device"] = device
        if model_name is not None and "model_name" in params:
            kwargs["model_name"] = model_name
        return DP(**kwargs)

    # Fuerza override si el usuario lo pide por env
    force = os.environ.get("VOZ_DIARIZE_MODEL", "").strip()
    candidates = [force] if force else [None, "pyannote/speaker-diarization-3.1"]

    last_err = None
    for candidate in candidates:
        try:
            pipe = build(candidate)
            used = candidate or "(default whisperX: community-1)"
            print(f"[Voz] Diarización usando modelo: {used}")
            return pipe
        except Exception as e:
            last_err = e
            msg = str(e)
            if "restricted" in msg or "gated" in msg or "403" in msg or "401" in msg:
                print(f"[Voz]   {candidate or 'modelo por defecto'} no accesible, probando fallback...")
                continue
            # Error no relacionado con licencia → no seguimos probando
            raise
    raise last_err or RuntimeError("No se pudo cargar ningún modelo de diarización")


def _ensure_loaded() -> None:
    global whisperx, torch, _whisper_model, _diarize_model, _assign_word_speakers, DEVICE, COMPUTE_TYPE
    if whisperx is not None:
        return
    import whisperx as _wx
    import torch as _t
    whisperx = _wx
    torch = _t
    if torch.cuda.is_available():
        DEVICE = "cuda"
        COMPUTE_TYPE = "float16"
    print(f"[Voz] Cargando Whisper '{MODEL_SIZE}' en {DEVICE}...")
    _whisper_model = whisperx.load_model(
        MODEL_SIZE, DEVICE, compute_type=COMPUTE_TYPE, language=LANG
    )
    DP, ASW = _resolve_diarize_api(whisperx)
    _assign_word_speakers = ASW
    if HF_TOKEN and DP is not None:
        try:
            print("[Voz] Cargando pipeline de diarización (pyannote)...")
            _diarize_model = _instantiate_diarize_pipeline(DP, HF_TOKEN, DEVICE)
        except Exception as e:
            print(f"[Voz] Diarización no disponible: {e}")
    elif not HF_TOKEN:
        print("[Voz] HF_TOKEN no configurado → sin diarización.")
    else:
        print("[Voz] whisperX no expone DiarizationPipeline en esta versión.")
    print("[Voz] Listo.")


app = FastAPI(title="Voz Desktop")

# CORS: permite que la PWA hospedada en github.io (u otro origen)
# hable con este backend. No usamos cookies, allow_origins="*" es OK.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    _ensure_loaded()
    return {
        "ok": True,
        "model": MODEL_SIZE,
        "device": DEVICE,
        "diarization": _diarize_model is not None,
    }


@app.post("/api/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    _ensure_loaded()
    suffix = Path(audio.filename or "in.wav").suffix or ".wav"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(await audio.read())
        tmp_path = f.name

    try:
        data = whisperx.load_audio(tmp_path)
        result = _whisper_model.transcribe(data, batch_size=8, language=LANG)
        lang = result.get("language", LANG)

        # Alineado a nivel de palabra → necesario para asignar hablante
        if lang not in _align_cache:
            try:
                am, meta = whisperx.load_align_model(language_code=lang, device=DEVICE)
                _align_cache[lang] = (am, meta)
            except Exception as e:
                print(f"[Voz] Align model no disponible ({lang}): {e}")
                _align_cache[lang] = None
        am_meta = _align_cache[lang]
        if am_meta:
            try:
                result = whisperx.align(
                    result["segments"], *am_meta, data, DEVICE,
                    return_char_alignments=False,
                )
            except Exception as e:
                print(f"[Voz] Alineado falló: {e}")

        # Diarización
        if _diarize_model is not None and _assign_word_speakers is not None:
            try:
                diarize_segments = _diarize_model(data)
                result = _assign_word_speakers(diarize_segments, result)
            except Exception as e:
                print(f"[Voz] Diarización falló: {e}")

        # Agrupar segmentos consecutivos del mismo hablante
        out = []
        cur = None
        for seg in result.get("segments", []):
            text = (seg.get("text") or "").strip()
            if not text:
                continue
            speaker = seg.get("speaker", "?")
            if cur is None or cur["speaker"] != speaker:
                if cur:
                    out.append(cur)
                cur = {"speaker": speaker, "text": text}
            else:
                cur["text"] += " " + text
        if cur:
            out.append(cur)
        gc.collect()
        return {"segments": out, "language": lang}
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


# La PWA (7 archivos estáticos) está en el directorio padre del repo.
REPO_ROOT = Path(__file__).parent.parent
app.mount("/", StaticFiles(directory=str(REPO_ROOT), html=True), name="pwa")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    print(f"\n✓ Voz Desktop en http://localhost:{port}")
    print("  Abre esa URL en Chrome/Edge/Safari.\n")
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
