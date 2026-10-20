const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();

// Habilitar CORS para permitir solicitudes desde cualquier cliente (Nuvio, Stremio Web, etc.)
app.use(cors());
app.use(express.json());

// Constantes de configuración
const BASE_URL = 'https://veohentai.com';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Dominios publicitarios y rastreadores conocidos para filtrar de iframes y reproductores
const AD_DOMAINS = [
  'adtng.com',
  'adsterra.com',
  'exoclick.com',
  'syxkn',
  'visariomedia.com',
  'vrdcftcmydygd.com',
  'realsrv.com',
  'doubleclick.net',
  'googlesyndication.com',
  'google.com',
  'cloudflare.com',
  'trafficjunky.com',
  'tsyndicate.com',
  'newlyhalloed.com',
  'disqus.com'
];

// Manifiesto oficial del Addon para Nuvio y Stremio
const MANIFEST = {
  id: 'com.veohentai.addon',
  name: 'VeoHentai Addon',
  version: '1.0.0',
  description: 'Addon serverless para Nuvio y Stremio con web scraping en tiempo real de VeoHentai.',
  resources: ['catalog', 'meta', 'stream'],
  types: ['anime'],
  idPrefixes: ['vht-'],
  catalogs: [
    {
      type: 'anime',
      id: 'vh-episodios-recientes',
      name: 'Episodios Recientes',
      extra: [{ name: 'search', isRequired: false }]
    },
    {
      type: 'anime',
      id: 'vh-top-semana',
      name: 'Top 10 de la Semana',
      extra: [{ name: 'search', isRequired: false }]
    },
    {
      type: 'anime',
      id: 'vh-mas-vistos',
      name: 'Más Vistos',
      extra: [{ name: 'search', isRequired: false }]
    },
    {
      type: 'anime',
      id: 'vh-sin-censura',
      name: 'Hentai Sin Censura',
      extra: [{ name: 'search', isRequired: false }]
    },
    {
      type: 'anime',
      id: 'vh-todos-episodios',
      name: 'Todos los Episodios',
      extra: [{ name: 'search', isRequired: false }]
    }
  ],
  logo: 'https://veohentai.com/logo.svg',
  background: 'https://veohentai.com/media/2026/10/seishidouin-no-oshigoto-the-animation-episodio-2.jpg',
  behaviorHints: {
    configurable: false,
    configurationRequired: false
  }
};

/**
 * Resuelve y extrae el stream de video directo (.mp4 o .m3u8) o retorna la URL embebida
 * garantizando siempre los proxyHeaders requeridos por la plataforma.
 */
async function resolveServer(serverName, embedUrl) {
  const streams = [];

  try {
    const normalizedUrl = embedUrl.startsWith('//') ? `https:${embedUrl}` : embedUrl;
    const lowerUrl = normalizedUrl.toLowerCase();

    // 1. Extractor para HentaiPlayer
    if (lowerUrl.includes('hentaiplayer.com')) {
      try {
        const hpResp = await axios.get(normalizedUrl, {
          headers: {
            'User-Agent': USER_AGENT,
            Referer: `${BASE_URL}/`
          },
          timeout: 4500
        });

        const $hp = cheerio.load(hpResp.data);
        const dataId = $hp('.servers li').attr('data-id');

        if (dataId) {
          const vidMatch = dataId.match(/vid=([a-zA-Z0-9+/=]+)/);
          if (vidMatch) {
            const decodedVid = Buffer.from(vidMatch[1], 'base64').toString('utf8');
            const directUrl = decodedVid.split('|')[0];
            if (directUrl && directUrl.startsWith('http')) {
              streams.push({
                name: 'VeoHentai',
                title: `${serverName || 'HentaiPlayer'} (Directo MP4 - HD)`,
                url: directUrl,
                behaviorHints: {
                  proxyHeaders: {
                    request: {
                      Referer: 'https://veohentai.com/',
                      'User-Agent': USER_AGENT
                    }
                  },
                  notWebReady: false
                }
              });
            }
          }

          // Opción reproductor php
          streams.push({
            name: 'VeoHentai',
            title: `${serverName || 'HentaiPlayer'} (Player PHP)`,
            url: `https://hentaiplayer.com${dataId}`,
            behaviorHints: {
              proxyHeaders: {
                request: {
                  Referer: normalizedUrl,
                  'User-Agent': USER_AGENT
                }
              }
            }
          });
        }
      } catch (err) {
        // En caso de fallo, el flujo continúa agregando el reproductor embebido
      }
    }

    // 2. Extractor para YourUpload
    if (lowerUrl.includes('yourupload.com')) {
      try {
        const resp = await axios.get(normalizedUrl, {
          headers: {
            'User-Agent': USER_AGENT,
            Referer: `${BASE_URL}/`
          },
          timeout: 4500
        });

        const html = resp.data;
        const ogMatch = html.match(/<meta\s+property=["']og:video["']\s+content=["']([^"']+\.mp4[^"']*)["']/i);
        const jwMatch = html.match(/file:\s*['"](https?:\/\/[^'"]+\.mp4[^'"]*)['"]/i);
        const directMp4 = (ogMatch && ogMatch[1]) || (jwMatch && jwMatch[1]);

        if (directMp4) {
          streams.push({
            name: 'VeoHentai',
            title: `${serverName || 'YourUpload'} (Directo MP4 - HD)`,
            url: directMp4,
            behaviorHints: {
              proxyHeaders: {
                request: {
                  Referer: 'https://veohentai.com/',
                  'User-Agent': USER_AGENT
                }
              },
              notWebReady: false
            }
          });
        }
      } catch (err) {}
    }

    // 3. Extractor para VOE
    if (lowerUrl.includes('voe.sx') || lowerUrl.includes('derricknationtop.com')) {
      try {
        const resp = await axios.get(normalizedUrl, {
          headers: {
            'User-Agent': USER_AGENT,
            Referer: `${BASE_URL}/`
          },
          maxRedirects: 3,
          timeout: 4500
        });

        const html = resp.data;
        const hlsMatch = html.match(/['"](https?:\/\/[^'"]+\.m3u8[^'"]*)['"]/i);
        const mp4Match = html.match(/['"](https?:\/\/[^'"]+\.mp4[^'"]*)['"]/i);
        const directVoe = (hlsMatch && hlsMatch[1]) || (mp4Match && mp4Match[1]);

        if (directVoe) {
          streams.push({
            name: 'VeoHentai',
            title: `${serverName || 'VOE'} (Directo HLS / MP4)`,
            url: directVoe,
            behaviorHints: {
              proxyHeaders: {
                request: {
                  Referer: 'https://veohentai.com/',
                  'User-Agent': USER_AGENT
                }
              }
            }
          });
        }
      } catch (err) {}
    }

    // 4. Extractor / Convertidor para Mega
    let finalEmbedUrl = normalizedUrl;
    if (lowerUrl.includes('mega.nz/#!') || lowerUrl.includes('mega.nz/file/')) {
      finalEmbedUrl = normalizedUrl
        .replace('mega.nz/#!', 'mega.nz/embed/!')
        .replace('mega.nz/file/', 'mega.nz/embed/');
    }

    // Siempre agregamos el reproductor embebido con los proxyHeaders requeridos
    streams.push({
      name: 'VeoHentai',
      title: `${serverName || 'Reproductor'} (Embebido)`,
      url: finalEmbedUrl,
      behaviorHints: {
        proxyHeaders: {
          request: {
            Referer: `${BASE_URL}/`,
            'User-Agent': USER_AGENT
          }
        }
      }
    });
  } catch (error) {
    streams.push({
      name: 'VeoHentai',
      title: `${serverName || 'Servidor'} (Embebido)`,
      url: embedUrl,
      behaviorHints: {
        proxyHeaders: {
          request: {
            Referer: `${BASE_URL}/`,
            'User-Agent': USER_AGENT
          }
        }
      }
    });
  }

  return streams;
}

/**
 * Función auxiliar para parsear tarjetas de anime desde cheerio
 */
function extractCardsFromCheerio($, containerSelector) {
  const metas = [];
  const seenIds = new Set();
  const root = containerSelector ? $(containerSelector) : $('body');

  root.find('a[href^="/ver/"], a[href^="/serie/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (!href) return;

    const cleanPath = href.replace(/^\/(?:ver|serie)\//, '').replace(/\/$/, '').trim();
    if (!cleanPath) return;

    // Obtener slug limpio de la serie (removiendo número de episodio si viene de /ver/)
    const epMatch = cleanPath.match(/-(?:episodio|episode)-(\d+)$/i) || cleanPath.match(/-(\d+)$/);
    const seriesSlug = epMatch ? cleanPath.slice(0, epMatch.index) : cleanPath;

    const id = `vht-${seriesSlug}`;
    if (seenIds.has(id)) return;
    seenIds.add(id);

    // Poster
    let poster =
      $(el).find('img').attr('src') ||
      $(el).find('img').attr('data-src') ||
      '';

    if (poster && !poster.startsWith('http://') && !poster.startsWith('https://')) {
      poster = `${BASE_URL}${poster.startsWith('/') ? '' : '/'}${poster}`;
    }

    // Título
    let rawTitle =
      $(el).find('h3').text().trim() ||
      $(el).find('h2').text().trim() ||
      $(el).find('img').attr('alt') ||
      seriesSlug;

    // Limpiar sufijo de episodio del título de la serie
    let cleanTitle = rawTitle.replace(/\s*:?\s*(?:episodio|episode)\s*\d+.*$/i, '').trim();
    if (!cleanTitle) cleanTitle = rawTitle;

    metas.push({
      id,
      type: 'anime',
      name: cleanTitle,
      poster,
      description: `Ver ${cleanTitle} en VeoHentai`
    });
  });

  return metas;
}

/**
 * Web Scraping para los Catálogos y Búsqueda en VeoHentai
 */
async function scrapeCatalog(catalogId, searchQuery) {
  const axiosHeaders = {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    Referer: `${BASE_URL}/`
  };

  // 1. Caso de Búsqueda
  if (searchQuery && typeof searchQuery === 'string' && searchQuery.trim() !== '') {
    const searchUrl = `${BASE_URL}/buscar/?q=${encodeURIComponent(searchQuery.trim())}`;
    const resp = await axios.get(searchUrl, { headers: axiosHeaders, timeout: 7000 });
    const $ = cheerio.load(resp.data);
    return extractCardsFromCheerio($);
  }

  // 2. Mapeo de catálogos específicos
  // Cada catálogo puede ser obtenido desde la sección exacta del home o su URL dedicada
  if (catalogId === 'vh-episodios-recientes') {
    const resp = await axios.get(`${BASE_URL}/`, { headers: axiosHeaders, timeout: 7000 });
    const $ = cheerio.load(resp.data);
    let cards = [];
    $('h2').each((_, h2) => {
      if ($(h2).text().trim().toLowerCase().includes('episodios recientes')) {
        let sec = $(h2).closest('section');
        if (!sec.length) sec = $(h2).parent().parent();
        cards = extractCardsFromCheerio($, sec);
      }
    });
    return cards.length > 0 ? cards : extractCardsFromCheerio($);
  }

  if (catalogId === 'vh-top-semana') {
    try {
      const resp = await axios.get(`${BASE_URL}/explorar/?orden=vistas-semana`, { headers: axiosHeaders, timeout: 7000 });
      const $ = cheerio.load(resp.data);
      const cards = extractCardsFromCheerio($);
      if (cards.length > 0) return cards;
    } catch (e) {}

    // Fallback a sección del Home
    const resp = await axios.get(`${BASE_URL}/`, { headers: axiosHeaders, timeout: 7000 });
    const $ = cheerio.load(resp.data);
    let cards = [];
    $('h2').each((_, h2) => {
      if ($(h2).text().trim().toLowerCase().includes('top 10 de la semana')) {
        let sec = $(h2).closest('section');
        if (!sec.length) sec = $(h2).parent().parent();
        cards = extractCardsFromCheerio($, sec);
      }
    });
    return cards;
  }

  if (catalogId === 'vh-mas-vistos') {
    try {
      const resp = await axios.get(`${BASE_URL}/explorar/?orden=vistas`, { headers: axiosHeaders, timeout: 7000 });
      const $ = cheerio.load(resp.data);
      const cards = extractCardsFromCheerio($);
      if (cards.length > 0) return cards;
    } catch (e) {}

    const resp = await axios.get(`${BASE_URL}/`, { headers: axiosHeaders, timeout: 7000 });
    const $ = cheerio.load(resp.data);
    let cards = [];
    $('h2').each((_, h2) => {
      if ($(h2).text().trim().toLowerCase().includes('más vistos')) {
        let sec = $(h2).closest('section');
        if (!sec.length) sec = $(h2).parent().parent();
        cards = extractCardsFromCheerio($, sec);
      }
    });
    return cards;
  }

  if (catalogId === 'vh-sin-censura') {
    try {
      const resp = await axios.get(`${BASE_URL}/genero/hentai-sin-censura/`, { headers: axiosHeaders, timeout: 7000 });
      const $ = cheerio.load(resp.data);
      const cards = extractCardsFromCheerio($);
      if (cards.length > 0) return cards;
    } catch (e) {}

    const resp = await axios.get(`${BASE_URL}/`, { headers: axiosHeaders, timeout: 7000 });
    const $ = cheerio.load(resp.data);
    let cards = [];
    $('h2').each((_, h2) => {
      if ($(h2).text().trim().toLowerCase().includes('sin censura')) {
        let sec = $(h2).closest('section');
        if (!sec.length) sec = $(h2).parent().parent();
        cards = extractCardsFromCheerio($, sec);
      }
    });
    return cards;
  }

  // vh-todos-episodios o cualquier otro catálogo por defecto
  try {
    const resp = await axios.get(`${BASE_URL}/explorar/`, { headers: axiosHeaders, timeout: 7000 });
    const $ = cheerio.load(resp.data);
    const cards = extractCardsFromCheerio($);
    if (cards.length > 0) return cards;
  } catch (e) {}

  const resp = await axios.get(`${BASE_URL}/`, { headers: axiosHeaders, timeout: 7000 });
  const $ = cheerio.load(resp.data);
  let cards = [];
  $('h2').each((_, h2) => {
    if ($(h2).text().trim().toLowerCase().includes('todos los episodios')) {
      let sec = $(h2).closest('section');
      if (!sec.length) sec = $(h2).parent().parent();
      cards = extractCardsFromCheerio($, sec);
    }
  });
  return cards.length > 0 ? cards : extractCardsFromCheerio($);
}

/**
 * Web Scraping para Metadatos de una Serie Hentai y su lista de episodios
 */
async function scrapeMeta(rawId) {
  const cleanId = (rawId || '').replace(/\.json$/, '').trim();
  const cleanSlug = cleanId
    .replace(/^vht-/, '')
    .replace(/^\/(ver|serie)\//, '')
    .replace(/\/$/, '')
    .trim();

  // Si el slug incluye -episodio-X o -X, identificar el slug de la serie
  const epMatch = cleanSlug.match(/-(?:episodio|episode)-(\d+)$/i) || cleanSlug.match(/-(\d+)$/);
  const seriesSlug = epMatch ? cleanSlug.slice(0, epMatch.index) : cleanSlug;

  const axiosHeaders = {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    Referer: `${BASE_URL}/`
  };

  let html = '';
  let finalSlug = seriesSlug;

  // 1. Intentar cargar página de serie /serie/:slug/
  try {
    const resp = await axios.get(`${BASE_URL}/serie/${seriesSlug}/`, {
      headers: axiosHeaders,
      timeout: 7000
    });
    html = resp.data;
  } catch (err) {
    // Si falla con seriesSlug, intentar con cleanSlug directamente
    if (seriesSlug !== cleanSlug) {
      try {
        const resp = await axios.get(`${BASE_URL}/serie/${cleanSlug}/`, {
          headers: axiosHeaders,
          timeout: 7000
        });
        html = resp.data;
        finalSlug = cleanSlug;
      } catch (e2) {}
    }

    // Si aún no hay HTML, intentar con la página de episodio /ver/
    if (!html) {
      try {
        const resp = await axios.get(`${BASE_URL}/ver/${cleanSlug}/`, {
          headers: axiosHeaders,
          timeout: 7000
        });
        html = resp.data;
      } catch (e3) {}
    }
  }

  if (!html) {
    return null;
  }

  const $ = cheerio.load(html);

  // Título
  const rawTitle =
    $('h1').first().text().trim() ||
    $('meta[property="og:title"]').attr('content') ||
    finalSlug;

  const title = rawTitle.replace(/\s*-\s*【?VeoHentai.*$/i, '').trim();

  // Poster
  let poster =
    $('meta[property="og:image"]').attr('content') ||
    $('img[alt*="' + title + '"]').attr('src') ||
    $('img').first().attr('src') ||
    '';

  if (poster && !poster.startsWith('http://') && !poster.startsWith('https://')) {
    poster = `${BASE_URL}${poster.startsWith('/') ? '' : '/'}${poster}`;
  }

  // Sinopsis / Descripción
  let description =
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') ||
    $('p.sinopsis').text().trim() ||
    '';

  description = description.replace(/\s*-\s*VeoHentai.*$/i, '').trim();
  if (!description) {
    description = `Ver ${title} en VeoHentai en HD sub español.`;
  }

  // Géneros (limpiando números finales como "Enfermeras3" -> "Enfermeras")
  const genres = [];
  $('a[href^="/genero/"]').each((_, el) => {
    let g = $(el).text().trim().replace(/\d+$/, '').trim();
    if (g && !genres.includes(g)) genres.push(g);
  });

  // Lista de episodios
  const episodes = [];
  $('a[href^="/ver/"]').each((_, a) => {
    const href = $(a).attr('href') || '';
    const clean = href.replace(/^\/ver\//, '').replace(/\/$/, '');
    const m = clean.match(/-(?:episodio|episode)-(\d+)$/i) || clean.match(/-(\d+)$/);
    const epNum = m ? parseInt(m[1], 10) : 1;

    if (!episodes.some((e) => e.episode === epNum)) {
      episodes.push({
        id: `vht-${finalSlug}-${epNum}`,
        title: `Episodio ${epNum}`,
        season: 1,
        episode: epNum
      });
    }
  });

  // Si no se encontraron episodios mediante enlaces en la página, crear al menos el episodio 1
  if (episodes.length === 0) {
    episodes.push({
      id: `vht-${finalSlug}-1`,
      title: 'Episodio 1',
      season: 1,
      episode: 1
    });
  }

  // Ordenar episodios numéricamente en orden ascendente (1, 2, 3...)
  episodes.sort((a, b) => a.episode - b.episode);

  return {
    id: `vht-${finalSlug}`,
    type: 'anime',
    name: title,
    poster,
    background: poster,
    description,
    genres: genres.length > 0 ? genres : ['Hentai', 'Anime'],
    videos: episodes
  };
}

/**
 * Web Scraping para un episodio de VeoHentai y extracción de streams
 */
async function scrapeEpisode(episodeSlugOrUrl) {
  let cleanId = '';

  if (episodeSlugOrUrl.startsWith('http://') || episodeSlugOrUrl.startsWith('https://')) {
    cleanId = episodeSlugOrUrl
      .replace(/^https?:\/\/[^\/]+\/(ver|serie)\//, '')
      .replace(/^\//, '')
      .replace(/\/$/, '')
      .trim();
  } else {
    cleanId = episodeSlugOrUrl
      .replace(/^vht-/, '')
      .replace(/^\/(ver|serie)\//, '')
      .replace(/\/$/, '')
      .trim();
  }

  const epMatch = cleanId.match(/-(?:episodio|episode)-(\d+)$/i) || cleanId.match(/-(\d+)$/);
  const seriesSlug = epMatch ? cleanId.slice(0, epMatch.index) : cleanId;
  const epNum = epMatch ? epMatch[1] : '1';

  const axiosHeaders = {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    Referer: `${BASE_URL}/`
  };

  const candidateUrls = [
    `${BASE_URL}/ver/${seriesSlug}-episodio-${epNum}/`,
    `${BASE_URL}/ver/${seriesSlug}-episode-${epNum}/`,
    `${BASE_URL}/ver/${cleanId}/`,
    `${BASE_URL}/ver/${seriesSlug}/`
  ];

  let html = '';
  for (const url of candidateUrls) {
    try {
      const resp = await axios.get(url, {
        headers: axiosHeaders,
        timeout: 6000
      });
      if (resp.status === 200 && resp.data) {
        html = resp.data;
        break;
      }
    } catch (e) {}
  }

  // Fallback: si no cargó directo, consultar la serie para obtener la URL exacta del episodio
  if (!html) {
    try {
      const sResp = await axios.get(`${BASE_URL}/serie/${seriesSlug}/`, {
        headers: axiosHeaders,
        timeout: 6000
      });
      const $s = cheerio.load(sResp.data);
      let targetHref = '';
      $s('a[href^="/ver/"]').each((_, a) => {
        const href = $s(a).attr('href') || '';
        if (href.includes(`episodio-${epNum}`) || href.includes(`episode-${epNum}`) || href.endsWith(`-${epNum}/`)) {
          targetHref = href;
        }
      });
      if (targetHref) {
        const fullUrl = `${BASE_URL}${targetHref.startsWith('/') ? '' : '/'}${targetHref}`;
        const epResp = await axios.get(fullUrl, {
          headers: axiosHeaders,
          timeout: 6000
        });
        html = epResp.data;
      }
    } catch (e) {}
  }

  if (!html) {
    return [];
  }

  const $ = cheerio.load(html);
  const foundServers = [];
  const seenUrls = new Set();

  const addServer = (name, url) => {
    if (!url || typeof url !== 'string') return;
    const cleanUrl = url.trim().replace(/\\\//g, '/');
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://') && !cleanUrl.startsWith('//')) {
      return;
    }
    // Descartar si coincide con dominios publicitarios
    if (AD_DOMAINS.some((domain) => cleanUrl.toLowerCase().includes(domain))) {
      return;
    }
    if (!seenUrls.has(cleanUrl)) {
      seenUrls.add(cleanUrl);
      foundServers.push({ name: name || 'Servidor', url: cleanUrl });
    }
  };

  // 1. Extraer reproductores desde iframes
  $('iframe').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src');
    if (src) {
      addServer('Reproductor', src);
    }
  });

  // 2. Extraer embedUrl de application/ld+json
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html());
      if (json && json.embedUrl) {
        addServer('HentaiPlayer', json.embedUrl);
      }
    } catch (e) {}
  });

  // 3. Extraer enlaces externos (Mega, YourUpload, Streamtape, VOE, etc.)
  $('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (
      href.includes('mega.nz') ||
      href.includes('yourupload.com') ||
      href.includes('streamtape') ||
      href.includes('voe.sx') ||
      href.includes('derricknationtop.com')
    ) {
      addServer('Servidor Externo', href);
    }
  });

  // 4. Extraer posibles variables JS con servidores (ej: var videos = [...])
  const scriptContent = $('script')
    .map((_, el) => $(el).html() || '')
    .get()
    .join('\n');

  const videosVarMatch = scriptContent.match(/var\s+videos\s*=\s*(\[[\s\S]*?\]);/);
  if (videosVarMatch && videosVarMatch[1]) {
    try {
      const parsed = JSON.parse(videosVarMatch[1]);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (Array.isArray(item) && item.length >= 2) {
            addServer(item[0], item[1]);
          }
        }
      }
    } catch (e) {}
  }

  // Resolver servidores en paralelo
  const resolutionPromises = foundServers.map((srv) => resolveServer(srv.name, srv.url));
  const resolvedResults = await Promise.allSettled(resolutionPromises);

  const streams = [];
  for (const res of resolvedResults) {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      streams.push(...res.value);
    }
  }

  return streams;
}

// ==========================================
// RUTAS Y ENDPOINTS DEL ADDON
// ==========================================

// Página interactiva del Addon
app.get('/', (req, res) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const manifestUrl = `${protocol}://${host}/manifest.json`;
  const stremioInstallUrl = manifestUrl.replace(/^https?:\/\//, 'stremio://');

  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>VeoHentai Addon para Nuvio & Stremio</title>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
      <style>
        body { background: #0b0f19; color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; }
        .hero { max-width: 720px; margin: 40px auto; padding: 32px; background: #151d30; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.6); border: 1px solid #1e293b; }
        .badge-status { background: #10b981; color: #fff; font-size: 0.85rem; padding: 5px 12px; border-radius: 9999px; }
        .code-box { background: #090d16; padding: 12px; border-radius: 8px; font-family: monospace; word-break: break-all; color: #38bdf8; border: 1px solid #1e293b; }
        .btn-install { background: #e11d48; color: white; border: none; padding: 12px 24px; font-weight: 600; border-radius: 8px; text-decoration: none; display: inline-block; transition: 0.2s; }
        .btn-install:hover { background: #be123c; color: white; }
        .catalog-pill { background: #1e293b; padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; margin: 2px; display: inline-block; color: #cbd5e1; }
      </style>
    </head>
    <body>
      <div class="hero text-center">
        <h1 class="h3 mb-2 font-weight-bold">VeoHentai Addon</h1>
        <p class="text-secondary mb-3">Addon Serverless con Catálogos, Búsqueda y Streams en Tiempo Real</p>
        <span class="badge-status mb-4 d-inline-block">● Activo y Compatible con Nuvio / Stremio</span>

        <div class="my-4">
          <a href="${stremioInstallUrl}" class="btn-install w-100 mb-2">Instalar en Stremio</a>
          <a href="${manifestUrl}" target="_blank" class="btn btn-outline-light w-100">Ver manifest.json</a>
        </div>

        <div class="text-start mt-4">
          <label class="form-label text-secondary small">URL del Manifiesto para Nuvio / Stremio:</label>
          <div class="code-box">${manifestUrl}</div>
        </div>

        <div class="text-start mt-4">
          <label class="form-label text-secondary small">Catálogos Disponibles:</label>
          <div>
            <span class="catalog-pill">Episodios Recientes</span>
            <span class="catalog-pill">Top 10 de la Semana</span>
            <span class="catalog-pill">Más Vistos</span>
            <span class="catalog-pill">Hentai Sin Censura</span>
            <span class="catalog-pill">Todos los Episodios</span>
          </div>
        </div>

        <div class="text-start mt-4">
          <label class="form-label text-secondary small">Pruebas Rápidas de Endpoints:</label>
          <ul class="list-unstyled mt-2">
            <li class="mb-2">
              <span class="text-white small">📁 Catálogo Episodios Recientes:</span><br>
              <a href="/catalog/anime/vh-episodios-recientes.json" target="_blank" style="color: #38bdf8;">/catalog/anime/vh-episodios-recientes.json</a>
            </li>
            <li class="mb-2">
              <span class="text-white small">📁 Catálogo Top 10 de la Semana:</span><br>
              <a href="/catalog/anime/vh-top-semana.json" target="_blank" style="color: #38bdf8;">/catalog/anime/vh-top-semana.json</a>
            </li>
            <li class="mb-2">
              <span class="text-white small">📁 Catálogo Hentai Sin Censura:</span><br>
              <a href="/catalog/anime/vh-sin-censura.json" target="_blank" style="color: #38bdf8;">/catalog/anime/vh-sin-censura.json</a>
            </li>
            <li class="mb-2">
              <span class="text-white small">🔍 Búsqueda en Catálogo:</span><br>
              <a href="/catalog/anime/vh-todos-episodios/search=kanojo.json" target="_blank" style="color: #38bdf8;">/catalog/anime/vh-todos-episodios/search=kanojo.json</a>
            </li>
            <li class="mb-2">
              <span class="text-white small">📄 Metadatos y Episodios:</span><br>
              <a href="/meta/anime/vht-seishidouin-no-oshigoto-the-animation.json" target="_blank" style="color: #38bdf8;">/meta/anime/vht-seishidouin-no-oshigoto-the-animation.json</a>
            </li>
            <li class="mb-2">
              <span class="text-white small">🎬 Streams de Episodio:</span><br>
              <a href="/stream/anime/vht-seishidouin-no-oshigoto-the-animation-2.json" target="_blank" style="color: #38bdf8;">/stream/anime/vht-seishidouin-no-oshigoto-the-animation-2.json</a>
            </li>
          </ul>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Endpoint GET /manifest.json
app.get(['/manifest.json', '/manifest'], (req, res) => {
  res.setHeader('Cache-Control', 'max-age=86400, public');
  res.json(MANIFEST);
});

// Endpoint GET /catalog/:type/:id y búsquedas
const catalogHandler = async (req, res) => {
  const catalogId = (req.params.id || '').replace(/\.json$/, '');
  let searchQuery = req.params.query || req.query.search || null;

  if (!searchQuery && req.params.extra) {
    const extraMatch = req.params.extra.match(/search[=:](.+)/i);
    if (extraMatch) {
      searchQuery = extraMatch[1];
    }
  }

  if (searchQuery) {
    searchQuery = decodeURIComponent(searchQuery).replace(/\.json$/, '').trim();
  }

  try {
    const metas = await scrapeCatalog(catalogId, searchQuery);
    res.setHeader('Cache-Control', 'max-age=600, public');
    return res.json({ metas: metas || [] });
  } catch (error) {
    console.error(`[Catalog Error] Error al consultar catálogo "${catalogId}" (query: "${searchQuery}"):`, error.message);
    return res.json({ metas: [] });
  }
};

app.get('/catalog/:type/:id/search=:query.json', catalogHandler);
app.get('/catalog/:type/:id/search=:query', catalogHandler);
app.get('/catalog/:type/:id/:extra.json', catalogHandler);
app.get('/catalog/:type/:id/:extra', catalogHandler);
app.get('/catalog/:type/:id.json', catalogHandler);
app.get('/catalog/:type/:id', catalogHandler);

// Endpoint GET /meta/:type/:id.json (y fallback sin extensión)
const metaHandler = async (req, res) => {
  const rawId = req.params.id;

  try {
    const meta = await scrapeMeta(rawId);
    if (!meta) {
      return res.json({ meta: null });
    }
    res.setHeader('Cache-Control', 'max-age=1800, public');
    return res.json({ meta });
  } catch (error) {
    console.error(`[Meta Error] Error al extraer metadatos para ID "${rawId}":`, error.message);
    return res.json({ meta: null });
  }
};

app.get('/meta/:type/:id.json', metaHandler);
app.get('/meta/:type/:id', metaHandler);

// Endpoint GET /stream/:type/:id.json (y fallback sin extensión)
const streamHandler = async (req, res) => {
  const rawId = req.params.id;

  try {
    const episodeId = rawId ? rawId.replace(/\.json$/, '') : '';

    if (!episodeId) {
      return res.json({ streams: [] });
    }

    const streams = await scrapeEpisode(episodeId);
    res.setHeader('Cache-Control', 'max-age=300, public');
    return res.json({ streams: streams || [] });
  } catch (error) {
    console.error(`[Stream Error] Error extrayendo streams para ID "${rawId}":`, error.message);
    return res.json({ streams: [] });
  }
};

app.get('/stream/:type/:id.json', streamHandler);
app.get('/stream/:type/:id', streamHandler);

// Iniciar servidor local si no estamos en entorno Vercel Serverless
if (!process.env.VERCEL && require.main === module) {
  const PORT = process.env.PORT || 7000;
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 VeoHentai Addon iniciado correctamente en puerto ${PORT}`);
    console.log(`📡 Local: http://localhost:${PORT}`);
    console.log(`📄 Manifiesto: http://localhost:${PORT}/manifest.json`);
    console.log(`📁 Catálogos:`);
    console.log(`   - http://localhost:${PORT}/catalog/anime/vh-episodios-recientes.json`);
    console.log(`   - http://localhost:${PORT}/catalog/anime/vh-top-semana.json`);
    console.log(`   - http://localhost:${PORT}/catalog/anime/vh-mas-vistos.json`);
    console.log(`   - http://localhost:${PORT}/catalog/anime/vh-sin-censura.json`);
    console.log(`   - http://localhost:${PORT}/catalog/anime/vh-todos-episodios.json`);
    console.log(`=======================================================`);
  });
}

// Exportar app para Vercel Serverless
module.exports = app;
