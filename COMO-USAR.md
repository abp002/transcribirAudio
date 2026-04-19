# Cómo usar Voz en la oficina (Windows)

Guía para arrancar el servidor en el PC Windows de la oficina y que el equipo pueda usar la app desde sus propios PCs.

---

## 📋 Resumen en una línea

El PC de la oficina corre un servidor local → un "tunnel" le da una URL HTTPS pública → los compañeros abren `https://abp002.github.io/transcribirAudio/`, pegan esa URL, y ya graban.

---

## 🔧 Primera vez — Setup completo (~30 min)

### 1. Instalar Python 3.11

Descarga el instalador oficial:
https://www.python.org/downloads/release/python-3119/

- Elige **"Windows installer (64-bit)"**.
- Durante la instalación ⚠️ **marca la casilla `Add python.exe to PATH`** (crítico; si no lo marcas el `start-windows.bat` no encontrará Python).
- Siguiente → Siguiente → Instalar.

### 2. Copiar la carpeta `transcribirAudio/` al Escritorio

Trae la carpeta completa (USB, OneDrive, `git clone`, como sea). Debe quedar algo tipo:
```
C:\Users\TuUsuario\Desktop\transcribirAudio\
```

### 3. Descargar Cloudflare Tunnel

Es un archivo `.exe` que convierte tu PC en un servidor accesible por internet.

- Ve a: https://github.com/cloudflare/cloudflared/releases/latest
- Busca **`cloudflared-windows-amd64.exe`** y descárgalo.
- Guárdalo **dentro de `transcribirAudio\`** (la raíz de la carpeta, junto a `tunnel.bat`).
- **Renómbralo** a exactamente `cloudflared.exe`.

### 4. Desactivar suspensión del PC

`Configuración` → `Sistema` → `Energía y batería` → `Tiempo de espera de pantalla y suspensión`:
- "Cuando está enchufado, apagar pantalla tras" → **Nunca**
- "Cuando está enchufado, suspender tras" → **Nunca**

Si el PC se suspende, los compañeros no pueden usar la app.

### 5. Primera ejecución del servidor

Doble-clic a **`start-windows.bat`** (en la raíz de `transcribirAudio\`).

Se abre una ventana negra (cmd). La primera vez hace lo siguiente sola:
- Crea un entorno Python aislado.
- Descarga whisperX + pyannote + pytorch (~5 GB). Tarda **15-20 min**.
- Te pide el token de Hugging Face → pégalo y Enter.
- Descarga los modelos de IA (~500 MB).
- Acaba imprimiendo:
  ```
  ✓ Voz Desktop en http://localhost:7860
  [Voz] Diarización usando modelo: ...
  [Voz] Listo.
  ```

**Deja esa ventana abierta.** Si la cierras, el servidor se apaga.

### 6. Probar tú mismo en el propio PC

Abre Chrome en ese PC, ve a `http://localhost:7860` y graba algo. Si funciona, el servidor está operativo.

---

## 🟢 Rutina diaria — Cada mañana al llegar

Dos doble-clics en este orden:

### 1. Doble-clic a `start-windows.bat`
Ventana negra. Espera ~30-60 s a que aparezca `[Voz] Listo.`. No la cierres.

### 2. Doble-clic a `tunnel.bat`
Otra ventana negra. A los 5-10 s aparece:
```
+---------------------------------------------------------+
|  Your quick Tunnel has been created!                   |
|  https://xxxxxx-xxxxxx.trycloudflare.com               |
+---------------------------------------------------------+
```

**Copia esa URL.** Es la que compartes hoy con el equipo.

⚠️ Si cierras `tunnel.bat`, la URL muere. Al relanzar sale una nueva.

---

## 📣 Qué mandar a los compañeros

### La primera vez (plantilla WhatsApp/email)

> Hola, te paso la herramienta de transcripción.
>
> **1.** Abre este enlace y guárdalo en favoritos del navegador:
> **https://abp002.github.io/transcribirAudio/**
>
> **2.** La primera vez sale una pantalla pidiendo "URL del servidor". Pega esta:
> `https://xxxxxx-xxxxxx.trycloudflare.com` *(la URL del tunnel de hoy)*
>
> Pulsa **Conectar**.
>
> **3.** Ya puedes grabar:
> - Círculo grande → habla → botón **"Parar y transcribir"**.
> - Espera 1-3 min (se lo está currando, no se ha colgado).
> - Sale el texto separado por hablantes (HABLANTE 1, HABLANTE 2…).
> - **Clic sobre "HABLANTE 1"** para ponerle nombre real (ej. "José") y se renombra en todo el texto.
> - Botones Copiar y Descargar .txt abajo.
>
> **Importante**: funciona solo mientras yo tenga encendido mi PC de la oficina. Si un día da error de conexión, avísame.

### Cuando cambie la URL (al reiniciar el tunnel)

> La URL del servidor de hoy: `https://nueva-url.trycloudflare.com`
>
> Si en la app te sale "no se pudo conectar", refresca la página, borra la URL vieja del recuadro y pega esta.

---

## 🔴 Al terminar el día

- **Si vas a dejar el PC encendido toda la noche** (recomendado): no cierres las dos ventanas. La misma URL sigue viva hasta que algo se caiga o haya reinicio. Menos mensajes al grupo de WhatsApp.
- **Si vas a apagar el PC**: cierra las dos ventanas (X en la esquina) y apaga normal. Mañana se relanzan las dos y se manda la URL nueva.

---

## ⚠️ Problemas comunes

### A los compañeros les sale "No se pudo conectar con esa URL"
- ¿Sigue abierto `tunnel.bat` en tu PC?
- ¿Sigue abierto `start-windows.bat` mostrando `[Voz] Listo.`?
- ¿El PC se suspendió? Revisa paso 4 del setup.
- Si acabas de lanzar `tunnel.bat`, **espera 20-30 s**; la URL tarda en propagarse los primeros segundos.

### "Chrome dice que el sitio no es seguro"
Refresca. Suele ser que el tunnel todavía no se ha propagado.

### Alguien dice que "se queda cargando eternamente"
Otro compañero probablemente está transcribiendo en ese momento (el servidor procesa **una sola transcripción a la vez**). Esperar 1-2 min y volver a intentar.

### Quiero mejor calidad de transcripción (más preciso pero más lento)
Abre `start-windows.bat` con **Bloc de notas** (clic derecho → Editar). Justo antes de la línea `python server.py` añade una línea:

```
set VOZ_MODEL=medium
```

Guarda y cierra. Cierra la ventana negra del servidor (si está abierta) y vuelve a doble-clic. La primera vez con `medium` tarda más (descarga 1.5 GB).

Modelos posibles, de más rápido a más preciso:
- `tiny` — velocidad pura, calidad justa.
- `base` — rápido, calidad decente.
- `small` — equilibrio, el por defecto.
- `medium` — más preciso, más lento. Necesita 8+ GB RAM libres.
- `large-v3` — máxima calidad. Necesita 16+ GB RAM y bastante paciencia en CPU.

### Quiero verificar que el servidor está vivo
Abre otra ventana de **cmd** (Win+R → `cmd`) y ejecuta:
```
curl http://localhost:7860/api/health
```
Debe responder algo tipo:
```
{"ok":true,"model":"small","device":"cpu","diarization":true}
```

---

## 🔒 Nota de seguridad

- Cualquiera con la URL `trycloudflare.com` de hoy puede usar el servidor. Como cambia a menudo y solo se comparte por canales privados (WhatsApp del equipo), el riesgo práctico es bajo.
- Para restringirlo de verdad a emails autorizados, hace falta montar **Cloudflare Access** encima (requiere dominio propio en Cloudflare). Pendiente para fase 2.
- El audio viaja **cifrado por HTTPS** hasta tu PC. Ahí se procesa localmente y **nunca sale** a ningún otro servidor (ni OpenAI, ni Google, nada).

---

## 📂 Qué hay en la carpeta — explicación rápida

```
transcribirAudio\
├── start-windows.bat      ← ▶️ DOBLE-CLIC para arrancar el servidor
├── tunnel.bat             ← ▶️ DOBLE-CLIC para arrancar el tunnel
├── cloudflared.exe        ← (te lo descargas tú, paso 3 del setup)
├── COMO-USAR.md           ← este archivo
├── README.md              ← info del proyecto
├── index.html + app.js + ...  ← el frontend (la parte visual de la app)
└── desktop\
    ├── server.py          ← código del servidor (no tocar)
    ├── requirements.txt
    └── venv\              ← entorno Python (se crea solo)
```
