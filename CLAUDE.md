# Voz · Transcriptor Win Innovación

PWA de transcripción de reuniones en español con Whisper + Transformers.js. Todo se procesa en el navegador del usuario. Repo: https://github.com/abp002/transcribirAudio. Live: https://abp002.github.io/transcribirAudio/.

## Identidad git de este repo

- Local config: `abp002 <abp002@users.noreply.github.com>` (personal).
- El global del equipo es la cuenta de la escuela (`abp0035`), no usar aquí.
- Push por SSH alias `github.com-personal` (clave `~/.ssh/id_ed25519_personal`).

## Pendientes

### 1. Migrar a Cloudflare Pages + Cloudflare Access (PRIORIDAD)

Razón: GitHub Pages es público y cualquiera con el enlace puede usar la app. El usuario quiere auth real, gratis, para un equipo pequeño (<50 personas).

Plan:
1. Crear cuenta en Cloudflare (si no la tiene).
2. Cloudflare Pages → conectar repo `abp002/transcribirAudio` → deploy automático en cada push.
3. Activar Cloudflare Access (Zero Trust) en el dominio de Pages.
4. Crear una policy con lista de emails permitidos de Win Innovación.
5. Desactivar GitHub Pages una vez CF Pages funcione (Settings → Pages → None).

Notas:
- CF Pages respeta el mismo layout estático (7 archivos + logo). Sin cambios de código.
- CF Access manda un magic-link al email para autenticar. Tier gratuito hasta 50 usuarios.
- Si se migra el dominio, actualizar la URL en cualquier mensaje/README.

### 2. Bug de transcripción: "(", "Y" o "<<<<<<<" en la salida

Síntoma: la vista previa y/o la transcripción final devuelven muy poco texto (un carácter) o cadenas repetidas de `<`. Pasa especialmente en móvil.

Causa probable: el pipeline `MediaRecorder` (WebM/Opus con `timeslice`) + `decodeAudioData` no siempre produce audio decodable. En móvil (iOS Safari → MP4/AAC, Android Chrome → WebM) se agrava porque los contenedores cambian.

Hipótesis a investigar:
- Concatenar chunks con timeslice no siempre da un WebM válido para `decodeAudioData`.
- Alternativa: reemplazar `MediaRecorder` por captura directa con `AudioWorklet` → Float32 PCM al vuelo, sin pasar por WebM/MP4.

Antes de reescribir: confirmar duración/amplitud del Float32 que llega al worker (añadir un `console.log(audio.length, audio[0])` en `worker.js` al recibir el mensaje).

### 3. Revisar velocidad de preview en móvil

Usuario reporta que la vista previa "empieza muy tarde" en móvil. Actualmente primer preview a los 12 s (`state.previewInterval = setInterval(requestPreview, 12000)`). En móvil con `base` el procesado tarda más que el intervalo.

Opciones:
- Primer preview a los 6 s, luego cada 15 s.
- Pasar la primera preview inmediatamente (tras 2-3 s de audio) para dar señal de vida antes.

### 4. Recordatorios menores

- El service worker solo cachea assets same-origin. La librería `@huggingface/transformers` se sirve desde jsdelivr CDN → la promesa "offline tras la primera carga" depende de la caché HTTP del navegador para el JS. Si se quisiera offline "de verdad", descargar `transformers.min.js` al repo.
- Icono PWA: actualmente se usa `logo.png` (PNG oficial de la web Win Innovación). En Android adaptive icons (purpose=maskable) se recortaría; para desktop/Windows no es problema.
