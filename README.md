# VeoHentai Addon para Nuvio & Stremio (Serverless en Vercel)

Addon completo y optimizado para **Nuvio** y **Stremio** desarrollado con **Express**, **Node.js**, **Cheerio** y **Axios**. Implementa web scraping en tiempo real sobre el sitio [veohentai.com](https://veohentai.com/) para indexar catálogos, metadatos, búsqueda global y extraer reproductores de video (m3u8/mp4) y servidores externos (HentaiPlayer, YourUpload, Streamtape, VOE, Mega, etc.) con sus correspondientes `proxyHeaders`.

---

## 📁 Estructura del Proyecto

```text
addon-veohentai/
├── api/
│   └── index.js       # Servidor Express, endpoints de Stremio/Nuvio y web scraping
├── test/
│   └── test.js        # Suite de pruebas automatizadas (npm test)
├── .gitignore         # Exclusión de node_modules, temporales y scratch
├── package.json       # Dependencias y scripts
├── vercel.json        # Configuración serverless para Vercel
└── README.md          # Documentación y guía de despliegue
```

---

## 📑 Manifiesto y Catálogos Configurados

- **Addon ID**: `com.veohentai.addon`
- **Nombre**: `VeoHentai Addon`
- **Prefijo de IDs**: `vht-`
- **Recursos**: `catalog`, `meta`, `stream`
- **Tipos soportados**: `anime`

### Catálogos Disponibles:
1. `vh-episodios-recientes` -> **Episodios Recientes**
2. `vh-top-semana` -> **Top 10 de la Semana**
3. `vh-mas-vistos` -> **Más Vistos**
4. `vh-sin-censura` -> **Hentai Sin Censura**
5. `vh-todos-episodios` -> **Todos los Episodios**

Todos los catálogos cuentan con soporte para búsqueda integrada mediante `extra: [{ name: "search", isRequired: false }]`.

---

## 🚀 1. Cómo Probar el Servidor Localmente

### Paso 1: Instalar dependencias
```bash
npm install
```
*(En Windows PowerShell si tienes políticas de ejecución restringidas, ejecuta `npm.cmd install`)*

### Paso 2: Ejecutar la Suite de Pruebas Automatizadas
Verifica que todos los endpoints (manifest, los 5 catálogos, búsqueda, metadatos y streams) respondan con HTTP 200 y JSON válido:
```bash
npm test
```

### Paso 3: Iniciar el servidor local
```bash
npm start
```
*(El servidor iniciará en el puerto **7000** por defecto: `http://localhost:7000`)*

---

## 🔍 2. Endpoints Disponibles y Pruebas Rápidas

| Tipo | Ruta | Descripción |
|---|---|---|
| **Home** | `GET /` | Página interactiva para probar e instalar con un clic |
| **Manifest** | `GET /manifest.json` | Manifiesto con los 5 catálogos y prefijo `vht-` |
| **Catálogo** | `GET /catalog/anime/vh-episodios-recientes.json` | Episodios recientes |
| **Catálogo** | `GET /catalog/anime/vh-top-semana.json` | Top 10 de la semana |
| **Catálogo** | `GET /catalog/anime/vh-mas-vistos.json` | Más vistos |
| **Catálogo** | `GET /catalog/anime/vh-sin-censura.json` | Hentai sin censura |
| **Catálogo** | `GET /catalog/anime/vh-todos-episodios.json` | Directorio completo de episodios |
| **Búsqueda** | `GET /catalog/anime/vh-todos-episodios/search=kanojo.json` | Búsqueda en tiempo real |
| **Metadatos** | `GET /meta/anime/vht-seishidouin-no-oshigoto-the-animation.json` | Sinopsis, poster, géneros y lista de episodios |
| **Streams** | `GET /stream/anime/vht-seishidouin-no-oshigoto-the-animation-2.json` | Extracción de reproductores con proxyHeaders |

*Nota: Todas las rutas soportan tanto formato con extensión `.json` como sin extensión.*

---

## 🔒 Encabezados de Streaming (`proxyHeaders`)

Cada stream generado incluye obligatoriamente en `behaviorHints.proxyHeaders.request`:
```json
{
  "Referer": "https://veohentai.com/",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}
```
Esto asegura que los reproductores de Nuvio y Stremio superen cualquier validación de hotlinking del servidor de origen.

---

## ☁️ 3. Despliegue en Vercel Serverless

1. Sube tu código a un repositorio de **GitHub**.
2. Ingresa a [vercel.com](https://vercel.com/) e inicia sesión.
3. Haz clic en **"Add New"** > **"Project"** e importa tu repositorio.
4. Vercel detectará automáticamente la configuración definida en `vercel.json`:
   ```json
   {
     "version": 2,
     "rewrites": [
       {
         "source": "/(.*)",
         "destination": "/api/index.js"
       }
     ]
   }
   ```
5. Presiona **Deploy**.
6. Una vez desplegado, copia la URL generada (ejemplo: `https://addon-veohentai.vercel.app/manifest.json`) y agrégala en Nuvio o Stremio.
