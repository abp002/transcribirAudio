# Cómo usar Voz

Guía diaria para arrancar el servidor en el PC de la oficina y que los compañeros puedan usar la app desde los suyos.

---

## 🔧 Primera vez (una sola vez, ~30 min)

### En el PC Windows de la oficina (el que se queda encendido)

1. **Instala Python 3.11** → https://www.python.org/downloads/release/python-3119/
   - Descarga el **"Windows installer (64-bit)"**.
   - ⚠️ Durante la instalación marca la casilla **"Add python.exe to PATH"**.

2. **Copia esta carpeta completa** (`transcribirAudio/`) al Escritorio del PC.

3. **Descarga Cloudflare Tunnel**:
   - Ve a https://github.com/cloudflare/cloudflared/releases/latest
   - Busca el archivo `cloudflared-windows-amd64.exe` y descárgalo.
   - Guárdalo **en la raíz de `transcribirAudio/`** (junto a `tunnel.bat`).
   - Renómbralo a `cloudflared.exe`.

4. **Desactiva la suspensión** del PC cuando esté enchufado:
   `Configuración` → `Sistema` → `Energía y batería` → pon **"Nunca"** para "suspender".

5. **Doble-clic a `start-windows.bat`** por primera vez:
   - Ventana negra abierta. Instala dependencias ~15-20 min (~5 GB descargando).
   - Si pide token de Hugging Face → pégalo y Enter.
   - Acaba imprimiendo:
     ```
     ✓ Voz Desktop en http://localhost:7860
     [Voz] Listo.
     ```
   - Déjala corriendo.

---

## 🟢 Cada día al llegar a la oficina

**Dos ventanas, dos doble-clics. En este orden:**

### 1️⃣ Doble-clic a `start-windows.bat`
Ventana negra. Espera ~60 s a que aparezca `[Voz] Listo.` No la cierres.

### 2️⃣ Doble-clic a `tunnel.bat`
Otra ventana negra. A los 5-10 s aparece:
```
+---------------------------------------------------------+
|  Your quick Tunnel has been created!                   |
|  https://xxxxxx-xxxxxx.trycloudflare.com               |
+---------------------------------------------------------+
```

Copia esa URL. Es la que mandas a los compañeros cada día.

> ⚠️ Al cerrar `tunnel.bat` la URL deja de funcionar. Al abrirlo cambia a otra nueva. Por eso hay que mandarla cada día (o dejarla abierta siempre).

---

## 📣 Qué mandarles a los compañeros

Les mandas **DOS cosas**: la URL fija de la app + la URL cambiante del tunnel de hoy.

### La primera vez (WhatsApp/email)

> Hola, te paso la herramienta:
>
> **1.** Abre este enlace (guárdalo en favoritos): **https://abp002.github.io/transcribirAudio/**
>
> **2.** La primera vez te saldrá una pantalla pidiendo "URL del servidor". Pega esta:
> `https://xxxxxx-xxxxxx.trycloudflare.com` *(la URL del tunnel de hoy)*
>
> **3.** Pulsa **Conectar** y ya te deja grabar.
>
> Si otro día te pide la URL de nuevo, es porque cambió. Pregúntame y te la paso.
>
> **Cómo usar**: círculo grande → habla → botón "Parar y transcribir". Espera 1-3 min y sale el texto separado por hablantes. Clic sobre "HABLANTE 1" para poner nombre real (ej. "José").

### Días siguientes (cuando cambie la URL del tunnel)

> La URL del servidor de hoy: `https://nueva-url.trycloudflare.com`
>
> Si te da error "no se pudo conectar", abre la app de nuevo, borra la URL vieja y pega esta.

---

## 🔴 Al terminar el día

Cierra las dos ventanas negras con la X. Si las dejas abiertas toda la noche no pasa nada (no consume CPU si nadie graba), y así mantienes la misma URL del tunnel varios días.

---

## ⚠️ Si algo va mal

**"No se pudo conectar con esa URL"** (les pasa a los compañeros al pegar la URL del tunnel)
- ¿`tunnel.bat` sigue abierto en tu PC?
- ¿`start-windows.bat` sigue abierto y mostrando `[Voz] Listo.`?
- ¿El PC se suspendió? (revisa paso 4 del setup).

**"Chrome dice sitio no seguro"**
- Espera 20-30 s después de lanzar `tunnel.bat`. La URL tarda en propagarse.

**Alguien dice que la transcripción se queda eternamente cargando**
- Otro compañero probablemente está transcribiendo en ese momento (solo 1 a la vez). Esperar.

**Quiero usar un modelo más potente**
- Edita `start-windows.bat` con Bloc de notas.
- Justo antes de la línea `python server.py` añade:
  ```
  set VOZ_MODEL=medium
  ```
- Opciones: `tiny` / `base` / `small` / `medium` / `large-v3`.
- Primera vez con cada modelo tarda más (descarga los pesos: 1.5 GB para `medium`, 3 GB para `large-v3`).
- Reinicia `start-windows.bat` tras editarlo.

**Verificar que el servidor está vivo**
- En otra ventana de cmd ejecuta: `curl http://localhost:7860/api/health`
- Si devuelve `{"ok":true,...}` está bien.

---

## 🔒 Seguridad actual

- Cualquiera con la URL `trycloudflare.com` de hoy puede usar la app. Al ser cambiante y solo compartida por WhatsApp privado, el riesgo es bajo.
- Para restringir a emails autorizados: setup de Cloudflare Access (pendiente, ver `CLAUDE.md`).
- El audio va **cifrado HTTPS** desde el navegador del compañero hasta tu PC. Una vez ahí se procesa localmente y nunca sale a ningún otro servidor.

---

## 🖥️ Para probarlo TÚ solo en tu Mac/PC sin compartir

- **Mac**: doble-clic a `start-mac.command`, luego abre `http://localhost:7860` en Chrome.
- **Windows**: doble-clic a `start-windows.bat`, luego abre `http://localhost:7860` en Chrome.

No hace falta tunnel para uso propio — `localhost` funciona sin HTTPS.
