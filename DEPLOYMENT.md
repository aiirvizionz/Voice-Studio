# Voice Studio — publicación en GitHub / Render

## Bloqueos de publicación

- GitHub debe contar con el repositorio privado `aiirvizionz/Voice-Studio` con rama `main` y un commit inicial.
- La API key de OpenAI Platform se debe configurar manualmente como secreto en Render; no pegarla en chats, commits o capturas.
- Los valores `STUDIO_USERNAME` y `STUDIO_PASSWORD` deben crearse únicamente en Render. Utiliza una contraseña aleatoria larga.

## Parámetros de Render

| Parámetro | Valor |
|---|---|
| Proyecto | Voice Studio |
| Tipo | Web service (Node.js) |
| Repositorio | `https://github.com/aiirvizionz/Voice-Studio` |
| Branch | `main` |
| Región | `oregon` |
| Plan | `free` si está disponible |
| Build | `npm install && npm run build` |
| Start | `npm start` |
| Runtime version | `NODE_VERSION=22.16.0` |
| Secretos | `OPENAI_API_KEY`, `STUDIO_USERNAME`, `STUDIO_PASSWORD` |

El despliegue permanecerá protegido por autenticación Basic; sin credenciales el middleware responde 503. No quites esa protección mientras la API pueda generar gastos. Para uso público es necesario implementar auth real, rate limits y monitoreo de consumo.
