# Voz · Transcriptor en español

Aplicación web (PWA) que transcribe reuniones en español **directamente en el navegador**. Sin servidor, sin coste, sin que el audio salga del ordenador.

- ✅ 100% privado — el audio se procesa en local
- ✅ Gratis — no usa APIs de pago
- ✅ Funciona offline tras la primera carga
- ✅ Instalable como app (PWA) en Windows, Mac, Android, iPhone
- ✅ Tres niveles de calidad seleccionables

## Cómo desplegar en GitHub Pages (gratis)

1. Crea un repositorio nuevo en GitHub, por ejemplo `voz-transcriptor`.
2. Sube **todos los archivos de esta carpeta** al repo (puedes arrastrarlos en la web de GitHub).
3. Ve a **Settings → Pages**.
4. En "Source" elige **Deploy from a branch**, rama `main`, carpeta `/ (root)`.
5. Pulsa **Save**. En ~1 minuto tendrás una URL tipo `https://tu-usuario.github.io/voz-transcriptor/`.
6. Comparte esa URL con tus compañeros. Al abrirla por primera vez se descargará el modelo (~500 MB) y después funcionará sin conexión.

> ⚠️ **Importante:** el acceso al micrófono solo funciona bajo **HTTPS**. GitHub Pages lo da automáticamente. Si abres el archivo directamente (`file://`) no funcionará.

## Probarlo en local antes de subirlo

Necesitas un servidor HTTP local (no vale abrir el HTML directamente). Lo más sencillo con Python:

```bash
cd transcriptor
python3 -m http.server 8000
```

Abre `http://localhost:8000` en Chrome o Edge. El micrófono funciona en `localhost` sin necesidad de HTTPS.

## Guía para tus compañeros (no técnicos)

1. Abre la URL que te he pasado en **Chrome** o **Edge** (en Mac también Safari).
2. La primera vez tarda unos minutos en descargar el motor. Una sola vez.
3. Pulsa el círculo naranja **Grabar**.
4. Acepta el permiso del micrófono.
5. Habla con normalidad. Verás una vista previa del texto apareciendo poco a poco.
6. Cuando termines, pulsa **Parar y transcribir**.
7. Copia el texto o descárgalo como `.txt`.
8. *(Opcional)* Pega ese texto en ChatGPT/Claude/etc. y pide un resumen o extracción de tareas.

### Instalarla como app

En Chrome/Edge verás un icono de "Instalar" en la barra de direcciones. Al pulsarlo aparecerá como aplicación independiente en el escritorio / menú de inicio, sin barra de navegador.

## Archivos

| Archivo | Qué hace |
|---|---|
| `index.html` | Interfaz de usuario |
| `app.js` | Lógica principal: grabación, UI |
| `worker.js` | Ejecuta Whisper en segundo plano |
| `manifest.json` | Convierte la web en app instalable |
| `sw.js` | Service worker para funcionamiento offline |
| `icon.svg` | Icono de la app |

## Modelos disponibles

| Modelo | Tamaño | Velocidad | Calidad |
|---|---|---|---|
| `whisper-base` | 150 MB | Muy rápido | Buena |
| `whisper-small` | 500 MB | Rápido | Muy buena ⭐ |
| `whisper-medium` | 1.5 GB | Lento | Excelente |

Por defecto se usa `small`, que es el mejor compromiso. Se puede cambiar en el selector de abajo.

## Limitaciones honestas

- La primera carga del modelo requiere conexión a Internet (descarga desde Hugging Face).
- Con WebGPU (Chrome/Edge recientes) va mucho más rápido. En otros navegadores usa CPU.
- Reuniones de >30 min pueden tardar varios minutos en procesarse al final.
- Whisper **no distingue hablantes** ("speaker diarization"). Si necesitáis eso, es otro nivel técnico.
- Aunque Whisper es muy fiable en español, ocasionalmente puede cometer errores con nombres propios, siglas o jerga muy técnica.

## Créditos

- Modelo [Whisper](https://openai.com/research/whisper) de OpenAI
- Ejecución en navegador con [Transformers.js](https://huggingface.co/docs/transformers.js/) de Hugging Face
