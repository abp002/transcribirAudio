# Cómo encender Voz en la oficina

Guía diaria para arrancar el servidor en el PC Windows y compartir la app con tus compañeros.

---

## 🔧 Primera vez (solo una vez, ~30 min)

1. **Instala Python 3.11** → https://www.python.org/downloads/release/python-3119/
   - Descarga el **"Windows installer (64-bit)"**.
   - ⚠️ Durante la instalación marca la casilla **"Add python.exe to PATH"**.

2. **Copia esta carpeta** (`transcribirAudio/`) a tu Escritorio.

3. **Descarga Cloudflare Tunnel**:
   - Ve a https://github.com/cloudflare/cloudflared/releases/latest
   - Busca el archivo `cloudflared-windows-amd64.exe`.
   - Descárgalo y guárdalo **dentro de la carpeta `transcribirAudio\desktop\`** (junto a este archivo).
   - Renómbralo a `cloudflared.exe` si no lo está ya.

4. **Desactiva la suspensión** del PC cuando esté enchufado:
   - `Configuración` → `Sistema` → `Energía y batería` → `Tiempo de espera de pantalla y suspensión`.
   - Pon **"Nunca"** en "Cuando está enchufado, apagar después de…" y "Cuando está enchufado, poner en suspensión después de…".

5. **Doble-clic a `start-windows.bat`** por primera vez:
   - Se abre una ventana negra. Instala dependencias durante ~15-20 min (~5 GB descargando).
   - Si pide token de Hugging Face → pégalo y Enter. (Si ya hay un archivo `.hf_token` en la carpeta, lo lee solo).
   - Acaba imprimiendo:
     ```
     ✓ Voz Desktop en http://localhost:7860
     [Voz] Diarización usando modelo: ...
     [Voz] Listo.
     ```
   - Déjala corriendo. Ya nunca más volverá a tardar así.

---

## 🟢 Cada día al llegar a la oficina

**Dos ventanas, dos doble-clics, en este orden:**

### 1️⃣ Doble-clic a `start-windows.bat`
Se abre ventana negra. Espera ~60 s a que aparezca `[Voz] Listo.`. No la cierres.

### 2️⃣ Doble-clic a `tunnel.bat`
Se abre otra ventana negra. A los 5-10 s aparece:

```
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable): |
|  https://xxxxxx-xxxxxx-xxxxxx.trycloudflare.com                                            |
+--------------------------------------------------------------------------------------------+
```

**Copia esa URL** (`https://....trycloudflare.com`) y mándala a tus compañeros por WhatsApp/email.

> ⚠️ La URL cambia cada vez que cierras y abres `tunnel.bat`. Si siempre la relanzas, manda la URL nueva cada día (o deja las ventanas abiertas entre sesiones).

---

## 🔴 Al terminar el día

Cierra las dos ventanas negras con la X. La URL dejará de funcionar hasta el día siguiente.

Si quieres dejarlo corriendo toda la noche, simplemente no las cierres. Gastará RAM pero nada más (no consume CPU si nadie transcribe).

---

## 📣 Qué mandar a tus compañeros

Mensaje de WhatsApp/email listo para copiar:

> Hola, te paso la herramienta de transcripción:
>
> 👉 **https://xxxxxx-xxxxxx.trycloudflare.com**  *(pega la URL del día)*
>
> 1. Ábrela en **Chrome** (no Safari ni Firefox).
> 2. Acepta el permiso del micrófono.
> 3. Pulsa el círculo grande → habla → pulsa "Parar y transcribir".
> 4. Espera 1-3 min según duración.
> 5. El texto saldrá separado por voces (HABLANTE 1, HABLANTE 2...). **Clic en el nombre** para renombrar a "José", "Ana", etc.
> 6. Copia o descarga como `.txt`.
>
> Necesito tener mi PC de la oficina encendido con la app corriendo. Si la URL da error, avísame.

---

## ⚠️ Si algo va mal

**"La URL no carga" / "Este sitio no puede abrirse"**
- ¿La ventana de `tunnel.bat` sigue abierta? ¿Y la de `start-windows.bat`?
- ¿El PC se suspendió? (revisa paso 4 del setup).

**"Chrome dice sitio no seguro"**
- Los primeros 20-30 s después de lanzar `tunnel.bat` la URL puede tardar en propagarse. Refresca.

**"Alguien dice que no transcribe / se queda cargando"**
- Otro compañero probablemente está usando el servidor en ese momento (solo 1 transcripción a la vez). Esperar 1-2 min.

**"Quiero mejor calidad de transcripción"**
- Edita `start-windows.bat` con el Bloc de notas. Justo antes de la línea `python server.py` añade:
  ```
  set VOZ_MODEL=medium
  ```
- O `set VOZ_MODEL=large-v3` si el PC tiene 16+ GB de RAM.
- La primera vez con un modelo nuevo tarda un rato descargándolo (1.5 GB para `medium`, 3 GB para `large-v3`).

**Saber cuánto cargado está el servidor**
- En otra ventana de cmd ejecuta: `curl http://localhost:7860/api/health`
- Si devuelve `{"ok":true,...}` el servidor está vivo.

---

## 🔒 Seguridad

- Cualquiera con la URL `trycloudflare.com` puede usar la app. Si quieres restringirlo a emails de la empresa: [setup de Cloudflare Access pendiente, ver `../CLAUDE.md`].
- El audio viaja cifrado (HTTPS) desde el navegador del compañero hasta tu PC. Una vez ahí, se procesa localmente y nunca sale a ningún otro servidor.
