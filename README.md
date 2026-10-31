# Voice Studio — MVP v0.1

Aplicación web para diseñar **voces originales mediante Prompt-to-Voice**, probarlas en sesiones **GPT-Live** y guardar el audio de las pruebas.

## Funciones implementadas

- Generación de prompts vocales desde controles de acento, tono, ritmo, textura y expresividad.
- `POST /api/voices` → crea voces `type: "prompt"` en OpenAI (`model: "auto"`).
- `POST /api/live` → crea sesión WebRTC con `gpt-live-1` y una voz guardada.
- WebRTC navegador ↔ GPT-Live: micrófono, respuesta de voz, subtítulos de salida y duración reportada.
- Grabación de la voz remota y descarga como **WebM** (M4A según compatibilidad del navegador).
- Editor de guiones, biblioteca de voces y borradores mediante `localStorage`.
- Navegación responsive, avisos y manejo básico de errores.

## Requisitos

- Node.js **22.6 o posterior**, npm.
- Un proyecto de OpenAI Platform con acceso a GPT-Live y clave API configurada.
- Navegador actualizado con WebRTC, micrófono y MediaRecorder.
- **localhost** o HTTPS (el micrófono requiere contexto seguro).

## Arrancar

```bash
npm install
cp .env.example .env.local
```

Edita `.env.local` y establece `OPENAI_API_KEY` con tu clave real. Después:

```bash
npm run dev
```

Abre http://127.0.0.1:3000

**Nunca** incluyas la clave en el frontend ni la subas a GitHub. Se utiliza solo en rutas del servidor. No se incluye ninguna clave ni audio real en este repositorio.

## Primer uso

1. Edita los ajustes vocales, pon un nombre y pulsa **Crear mi voz**.
2. Selecciona tu voz en el estudio o desde **Mis voces**.
3. Pulsa **Play** en Laboratorio Live y autoriza el micrófono.
4. Pide a GPT-Live por voz que diga algo, o usa **Enviar guion a Live** y pídele que lo narre.
5. Pulsa **Stop**. Si hubo salida de audio, aparecerá el reproductor y la descarga de la muestra.

## Límites importantes

- **GPT-Live es conversacional, no un TTS de lectura exacta.** `session.commentary.append` añade contenido que GPT-Live puede comunicar o parafrasear; enviar un guion no garantiza que hable ni que lo lea literalmente. Puede requerir pedirle verbalmente que narre el texto. El envío desde UI limita a 900 caracteres por seguridad.
- Las voces creadas por descripción funcionan con GPT-Live, **no** con `/v1/audio/speech` ni la Realtime API convencional.
- La creación de voz guarda un identificador en OpenAI, pero no devuelve una muestra de audio. La prueba se realiza abriendo una sesión Live que **genera consumo facturable**.
- La grabación conserva únicamente la pista remota de audio generada en el navegador, no un WAV certificado ni el audio original enviado a OpenAI.
- Los controles son **traducidos a prompts**, no valores DSP o parámetros numéricos de voz en la API.
- Las voces y guiones se guardan **solo en el navegador actual**. Borrar de la biblioteca no elimina la voz en OpenAI.
- No hay autenticación multiusuario ni límites automáticos de gasto. Para Render se incluyó autenticación HTTP Basic de uso personal (véase abajo). **No abras el estudio al público** sin rate limits, autorización por usuario, cuotas y monitoreo de consumo.
- Al compartir audio, identifícalo de forma clara como generado por IA. No imites voces de personas reales ni crees voces infantiles.
- Para producción, evalúa costes y cambios de API en la documentación oficial.

## Estructura

```text
src/app/page.tsx              Interfaz principal, WebRTC y biblioteca
src/app/globals.css           Estilos responsive
src/app/api/voices/route.ts   Proxy de creación de voces
src/app/api/live/route.ts     Proxy de señalización SDP para GPT-Live
src/lib/voice.ts              Tipos, presets, prompts
src/lib/storage.ts            Persistencia local
```

## Próximas iteraciones

- Auth, base de datos (p. ej., Supabase) y límites por usuario.
- Captura más robusta de grabaciones, indicadores de generación y controles de transporte.
- Motor de *text-to-speech* exacto con un modelo compatible, **separado** de las voces Prompt-to-Voice.
- Editor de guiones por segmentos, línea de tiempo, exportación y proyectos sincronizados.

## Documentación oficial

- https://developers.openai.com/api/docs/guides/custom-voices
- https://developers.openai.com/api/docs/guides/voice-webrtc
- https://developers.openai.com/api/docs/guides/live-conversations

## Despliegue seguro en Render

La aplicación incluye `render.yaml` para desplegarla desde GitHub. Configura **antes de abrirla** las variables secretas `OPENAI_API_KEY`, `STUDIO_USERNAME` y `STUDIO_PASSWORD` en el panel de Render. En producción, el middleware exige autenticación HTTP Basic para toda la aplicación y sus endpoints de pago; sin credenciales configuradas responde 503. Usa una contraseña larga y única. No subas `.env.local` a GitHub.

Render: servicio web Node, `npm install && npm run build`, `npm start`, puerto `PORT` (predeterminado 10000). El plan gratuito puede suspender la instancia y limitar su disponibilidad. La protección HTTP Basic es adecuada solo para pruebas personales; antes de abrir acceso a terceros, reemplázala con autenticación de usuarios y cuotas de uso.

## GitHub → Render (MVP privado)

1. Crea un repositorio privado llamado `Voice-Studio` en tu cuenta de GitHub e **inicialízalo con un README** para tener la rama `main`.
2. Sube los archivos de este paquete al directorio raíz del repo; **no subas** `.env.local`, secretos ni archivos generados. Puedes usar GitHub Desktop, `git` o una integración conectada.
3. En Render crea **New → Web Service** desde `https://github.com/aiirvizionz/Voice-Studio`.
4. Elige **Node**, plan `free` (si está disponible), región `oregon`, rama `main`, comando de build `npm install && npm run build` y de inicio `npm start`.
5. Antes de hacer una prueba que consuma créditos, configura en **Environment** estas variables protegidas: `OPENAI_API_KEY`, `STUDIO_USERNAME`, `STUDIO_PASSWORD` y `NODE_VERSION=22.16.0`.
6. Prueba con usuario y contraseña de Basic Auth, crea una voz y luego abre una sesión GPT-Live.

**Importante:** no se puede extraer ni reutilizar la clave del servicio ChatGPT Plus; necesitas una clave API válida de OpenAI Platform. Al crear voces por descripción no se genera automáticamente un archivo de audio. Para escucharla debes crear una sesión GPT-Live facturable.
