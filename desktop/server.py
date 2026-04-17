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
import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, UploadFile
from fastapi.staticfiles import StaticFiles
import uvicorn

# Carga perezosa de los pesos pesados → arranque rápido para /api/health
whisperx = None
torch = None
_whisper_model = None
_align_cache: dict = {}
_diarize_model = None

MODEL_SIZE = os.environ.get("VOZ_MODEL", "small")
LANG = "es"
DEVICE = "cpu"
COMPUTE_TYPE = "int8"
HF_TOKEN = os.environ.get("HF_TOKEN", "").strip()


def _ensure_loaded() -> None:
    global whisperx, torch, _whisper_model, _diarize_model, DEVICE, COMPUTE_TYPE
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
    if HF_TOKEN:
        try:
            print("[Voz] Cargando pipeline de diarización (pyannote)...")
            _diarize_model = whisperx.DiarizationPipeline(
                use_auth_token=HF_TOKEN, device=DEVICE
            )
        except Exception as e:
            print(f"[Voz] Diarización no disponible: {e}")
    else:
        print("[Voz] HF_TOKEN no configurado → sin diarización.")
    print("[Voz] Listo.")


app = FastAPI(title="Voz Desktop")


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
        if _diarize_model is not None:
            try:
                diarize_segments = _diarize_model(data)
                result = whisperx.assign_word_speakers(diarize_segments, result)
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
